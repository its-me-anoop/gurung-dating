import { Router } from 'express';
import { z } from 'zod';
import { photoDto, publicProfileDto } from '../domain/profile.js';
import { zReportStatus } from '../domain/vocab.js';
import { badRequest, notFound } from '../lib/errors.js';
import { notify } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { validate, validatedQuery } from '../middleware/validate.js';

export const adminRouter = Router();

const staffOnly = requireRole('ADMIN', 'MODERATOR');
const adminOnly = requireRole('ADMIN');

adminRouter.get(
  '/stats',
  staffOnly,
  asyncHandler(async (_req, res) => {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalMembers,
      activeMembers,
      newThisMonth,
      verifiedProfiles,
      pendingPhotos,
      openReports,
      connections,
      messages,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.user.count({ where: { status: 'ACTIVE', lastActiveAt: { gte: since7 } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.profile.count({ where: { verified: true } }),
      prisma.photo.count({ where: { moderationStatus: 'PENDING' } }),
      prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.interest.count({ where: { status: 'ACCEPTED' } }),
      prisma.message.count(),
    ]);

    const byRegion = await prisma.profile.groupBy({
      by: ['ukRegion'],
      _count: { _all: true },
      orderBy: { _count: { ukRegion: 'desc' } },
      take: 10,
    });

    res.json({
      totalMembers,
      activeMembers,
      newThisMonth,
      verifiedProfiles,
      pendingPhotos,
      openReports,
      connections,
      messages,
      byRegion: byRegion.map((r) => ({ region: r.ukRegion, count: r._count._all })),
    });
  }),
);

// --- Photo moderation --------------------------------------------------------

adminRouter.get(
  '/photos/pending',
  staffOnly,
  asyncHandler(async (_req, res) => {
    const photos = await prisma.photo.findMany({
      where: { moderationStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { profile: { select: { displayName: true, verified: true } } },
    });

    res.json({
      photos: photos.map((p) => ({
        ...photoDto(p),
        uploadedAt: p.createdAt,
        member: {
          userId: p.userId,
          displayName: p.profile.displayName,
          verified: p.profile.verified,
        },
      })),
    });
  }),
);

adminRouter.post(
  '/photos/:id/moderate',
  staffOnly,
  validate(
    z.object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      note: z.string().trim().max(300).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body as { decision: 'APPROVED' | 'REJECTED'; note?: string };
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id as string } });
    if (!photo) throw notFound('That photo does not exist.');

    const updated = await prisma.photo.update({
      where: { id: photo.id },
      data: { moderationStatus: decision, moderationNote: note ?? null },
    });

    // First approved photo becomes the main picture if there isn't one yet.
    if (decision === 'APPROVED') {
      const hasPrimary = await prisma.photo.findFirst({
        where: { userId: photo.userId, isPrimary: true, moderationStatus: 'APPROVED' },
      });
      if (!hasPrimary) {
        await prisma.photo.update({ where: { id: photo.id }, data: { isPrimary: true } });
      }
    }

    await notify({
      userId: photo.userId,
      type: decision === 'APPROVED' ? 'PHOTO_APPROVED' : 'PHOTO_REJECTED',
      title: decision === 'APPROVED' ? 'Your photo was approved' : 'A photo was not approved',
      body: note ?? undefined,
      link: '/profile/photos',
    });

    res.json({ photo: photoDto(updated) });
  }),
);

// --- Reports ------------------------------------------------------------------

const reportListSchema = z.object({
  status: z.union([zReportStatus, z.literal('ALL')]).default('OPEN'),
});

adminRouter.get(
  '/reports',
  staffOnly,
  validate(reportListSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { status } = validatedQuery<z.infer<typeof reportListSchema>>(req);
    const reports = await prisma.report.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, profile: { select: { displayName: true } } } },
        reported: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        resolution: r.resolution,
        reporter: { userId: r.reporterId, displayName: r.reporter.profile?.displayName ?? '—' },
        reported: {
          userId: r.reportedId,
          displayName: r.reported.profile?.displayName ?? '—',
          accountStatus: r.reported.status,
        },
      })),
    });
  }),
);

adminRouter.post(
  '/reports/:id/resolve',
  staffOnly,
  validate(
    z.object({
      status: z.enum(['REVIEWING', 'ACTIONED', 'DISMISSED']),
      resolution: z.string().trim().max(1000).optional(),
      /** Optional account action to apply to the reported member at the same time. */
      action: z.enum(['NONE', 'SUSPEND', 'REINSTATE']).default('NONE'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { status, resolution, action } = req.body as {
      status: string;
      resolution?: string;
      action: 'NONE' | 'SUSPEND' | 'REINSTATE';
    };
    const report = await prisma.report.findUnique({ where: { id: req.params.id as string } });
    if (!report) throw notFound('That report does not exist.');

    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        status,
        resolution: resolution ?? null,
        resolvedById: req.user!.id,
        resolvedAt: new Date(),
      },
    });

    if (action === 'SUSPEND') {
      await prisma.user.update({ where: { id: report.reportedId }, data: { status: 'SUSPENDED' } });
      await prisma.session.updateMany({
        where: { userId: report.reportedId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (action === 'REINSTATE') {
      await prisma.user.update({ where: { id: report.reportedId }, data: { status: 'ACTIVE' } });
    }

    res.json({ report: updated });
  }),
);

// --- Members ------------------------------------------------------------------

const memberSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

adminRouter.get(
  '/members',
  staffOnly,
  validate(memberSearchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { q, status, page, perPage } = validatedQuery<z.infer<typeof memberSearchSchema>>(req);

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { profile: { displayName: { contains: q } } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { profile: { include: { photos: true } } },
      }),
    ]);

    res.json({
      total,
      page,
      perPage,
      members: users.map((u) => ({
        userId: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        profile: u.profile ? publicProfileDto({ ...u.profile, user: u }, true) : null,
      })),
    });
  }),
);

adminRouter.post(
  '/members/:userId/verify',
  staffOnly,
  validate(z.object({ verified: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { verified } = req.body as { verified: boolean };
    const profile = await prisma.profile.findUnique({
      where: { userId: req.params.userId as string },
    });
    if (!profile) throw notFound('That member does not have a profile.');

    await prisma.profile.update({
      where: { id: profile.id },
      data: { verified, verifiedAt: verified ? new Date() : null },
    });

    if (verified) {
      await notify({
        userId: profile.userId,
        type: 'PROFILE_VERIFIED',
        title: 'Your profile is verified',
        body: 'Members can now see the verified badge on your profile.',
        link: '/profile',
      });
    }

    res.json({ ok: true, verified });
  }),
);

adminRouter.post(
  '/members/:userId/status',
  adminOnly,
  validate(
    z.object({
      status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
      reason: z.string().trim().max(500).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId as string;
    const { status, reason } = req.body as { status: string; reason?: string };
    if (targetId === req.user!.id) throw badRequest('You cannot change your own account status.');

    await prisma.user.update({ where: { id: targetId }, data: { status } });
    if (status !== 'ACTIVE') {
      await prisma.session.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await notify({
        userId: targetId,
        type: 'SYSTEM',
        title: 'Your account has been reinstated',
        body: reason,
      });
    }

    res.json({ ok: true, status });
  }),
);

adminRouter.post(
  '/members/:userId/role',
  adminOnly,
  validate(z.object({ role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN']) })),
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId as string;
    const { role } = req.body as { role: string };
    if (targetId === req.user!.id) throw badRequest('You cannot change your own role.');

    await prisma.user.update({ where: { id: targetId }, data: { role } });
    res.json({ ok: true, role });
  }),
);
