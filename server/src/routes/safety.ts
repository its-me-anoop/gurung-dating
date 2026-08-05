import { Router } from 'express';
import { z } from 'zod';
import { profileCardDto } from '../domain/profile.js';
import { zReportReason } from '../domain/vocab.js';
import { badRequest, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireActive, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { conversationPair } from '../services/access.js';

export const safetyRouter = Router();

/**
 * Blocking is immediate and total: the two accounts stop seeing each other in
 * search, cannot open each other's profiles, and any open interest is closed
 * so neither shows up in the other's lists.
 */
safetyRouter.post(
  '/blocks',
  requireAuth,
  validate(
    z.object({
      userId: z.string().min(1),
      reason: z.string().trim().max(300).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const ownerId = req.user!.id;
    const { userId: targetId, reason } = req.body as { userId: string; reason?: string };
    if (targetId === ownerId) throw badRequest('You cannot block yourself.');

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw notFound('That member does not exist.');

    await prisma.block.upsert({
      where: { ownerId_targetId: { ownerId, targetId } },
      create: { ownerId, targetId, reason: reason ?? null },
      update: { reason: reason ?? null },
    });

    // Withdraw anything still pending between the two, and close the thread.
    await prisma.interest.updateMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: ownerId, receiverId: targetId },
          { senderId: targetId, receiverId: ownerId },
        ],
      },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });

    const pair = conversationPair(ownerId, targetId);
    await prisma.conversation.updateMany({
      where: pair,
      data: { closedAt: new Date(), closedById: ownerId },
    });

    res.status(201).json({ ok: true });
  }),
);

safetyRouter.delete(
  '/blocks/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.block.deleteMany({
      where: { ownerId: req.user!.id, targetId: req.params.userId as string },
    });
    res.json({ ok: true });
  }),
);

safetyRouter.get(
  '/blocks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const blocks = await prisma.block.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { target: { include: { profile: { include: { photos: true } } } } },
    });

    res.json({
      blocks: blocks.map((b) => ({
        userId: b.targetId,
        reason: b.reason,
        createdAt: b.createdAt,
        displayName: b.target.profile?.displayName ?? 'Former member',
      })),
    });
  }),
);

safetyRouter.post(
  '/reports',
  requireAuth,
  validate(
    z.object({
      userId: z.string().min(1),
      reason: zReportReason,
      details: z.string().trim().max(2000).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const reporterId = req.user!.id;
    const { userId: reportedId, reason, details } = req.body as {
      userId: string;
      reason: string;
      details?: string;
    };
    if (reportedId === reporterId) throw badRequest('You cannot report yourself.');

    const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
    if (!target) throw notFound('That member does not exist.');

    const report = await prisma.report.create({
      data: { reporterId, reportedId, reason, details: details ?? null },
    });

    res.status(201).json({
      report: { id: report.id, status: report.status },
      message: 'Thank you. A moderator will look into this.',
    });
  }),
);

// ---------------------------------------------------------------------------
// Shortlist
// ---------------------------------------------------------------------------

safetyRouter.post(
  '/shortlist',
  requireActive,
  validate(
    z.object({ userId: z.string().min(1), note: z.string().trim().max(300).optional() }),
  ),
  asyncHandler(async (req, res) => {
    const ownerId = req.user!.id;
    const { userId: targetId, note } = req.body as { userId: string; note?: string };
    if (targetId === ownerId) throw badRequest('You cannot shortlist yourself.');

    await prisma.shortlist.upsert({
      where: { ownerId_targetId: { ownerId, targetId } },
      create: { ownerId, targetId, note: note ?? null },
      update: { note: note ?? null },
    });
    res.status(201).json({ ok: true });
  }),
);

safetyRouter.delete(
  '/shortlist/:userId',
  requireActive,
  asyncHandler(async (req, res) => {
    await prisma.shortlist.deleteMany({
      where: { ownerId: req.user!.id, targetId: req.params.userId as string },
    });
    res.json({ ok: true });
  }),
);

safetyRouter.get(
  '/shortlist',
  requireActive,
  asyncHandler(async (req, res) => {
    const items = await prisma.shortlist.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { target: { include: { profile: { include: { photos: true } } } } },
    });

    res.json({
      items: items
        .filter((i) => i.target.profile)
        .map((i) => ({
          note: i.note,
          addedAt: i.createdAt,
          profile: profileCardDto(
            { ...i.target.profile!, user: i.target },
            { isShortlisted: true },
          ),
        })),
    });
  }),
);
