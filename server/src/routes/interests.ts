import { Router } from 'express';
import { z } from 'zod';
import { profileCardDto } from '../domain/profile.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { notify } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { requireActive } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import { validate, validatedQuery } from '../middleware/validate.js';
import { conversationPair, isBlockedBetween } from '../services/access.js';

export const interestRouter = Router();

const profileInclude = { photos: true, user: true } as const;

async function displayNameOf(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  return profile?.displayName ?? 'A member';
}

/** Express interest in someone. Sending a second time re-opens a withdrawal. */
interestRouter.post(
  '/',
  requireActive,
  contactLimiter,
  validate(
    z.object({
      receiverId: z.string().min(1),
      message: z.string().trim().max(500).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const senderId = req.user!.id;
    const { receiverId, message } = req.body as { receiverId: string; message?: string };

    if (receiverId === senderId) throw badRequest('You cannot send yourself an interest.');

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, status: true, profile: { select: { id: true } } },
    });
    if (!receiver?.profile || receiver.status === 'SUSPENDED' || receiver.status === 'DEACTIVATED') {
      throw notFound('That member is not available.');
    }
    if (await isBlockedBetween(senderId, receiverId)) {
      throw notFound('That member is not available.');
    }

    // If they already sent one to us, accept it rather than creating a mirror.
    const incoming = await prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
    });
    if (incoming && incoming.status === 'PENDING') {
      const accepted = await acceptInterest(incoming.id, senderId);
      res.status(200).json({ interest: accepted, matched: true });
      return;
    }

    const existing = await prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });

    if (existing) {
      if (existing.status === 'PENDING') throw conflict('You have already expressed interest.');
      if (existing.status === 'ACCEPTED') throw conflict('You are already connected.');
      if (existing.status === 'DECLINED') {
        throw conflict('This member has already responded to your interest.');
      }
      // WITHDRAWN — allow a second try.
      const revived = await prisma.interest.update({
        where: { id: existing.id },
        data: { status: 'PENDING', message: message ?? null, respondedAt: null },
      });
      await notify({
        userId: receiverId,
        type: 'INTEREST_RECEIVED',
        title: `${await displayNameOf(senderId)} is interested in your profile`,
        body: message ?? undefined,
        link: '/interests',
      });
      res.status(200).json({ interest: revived, matched: false });
      return;
    }

    const interest = await prisma.interest.create({
      data: { senderId, receiverId, message: message ?? null },
    });

    await notify({
      userId: receiverId,
      type: 'INTEREST_RECEIVED',
      title: `${await displayNameOf(senderId)} is interested in your profile`,
      body: message ?? undefined,
      link: '/interests',
    });

    res.status(201).json({ interest, matched: false });
  }),
);

/**
 * Accepting an interest is what creates a connection: it opens the one
 * conversation for the pair and unlocks connections-only photos both ways.
 */
async function acceptInterest(interestId: string, actingUserId: string) {
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) throw notFound('That interest no longer exists.');
  if (interest.receiverId !== actingUserId) {
    throw notFound('That interest no longer exists.');
  }
  if (interest.status === 'ACCEPTED') return interest;
  if (interest.status !== 'PENDING') {
    throw badRequest('That interest has already been dealt with.');
  }

  const updated = await prisma.interest.update({
    where: { id: interestId },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });

  const pair = conversationPair(interest.senderId, interest.receiverId);
  await prisma.conversation.upsert({
    where: { memberAId_memberBId: pair },
    create: pair,
    update: { closedAt: null, closedById: null },
  });

  await notify({
    userId: interest.senderId,
    type: 'INTEREST_ACCEPTED',
    title: `${await displayNameOf(actingUserId)} accepted your interest`,
    body: 'You can now message each other.',
    link: '/messages',
  });

  return updated;
}

interestRouter.post(
  '/:id/accept',
  requireActive,
  asyncHandler(async (req, res) => {
    const interest = await acceptInterest(req.params.id as string, req.user!.id);
    res.json({ interest, matched: true });
  }),
);

interestRouter.post(
  '/:id/decline',
  requireActive,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const interest = await prisma.interest.findUnique({ where: { id } });
    if (!interest || interest.receiverId !== req.user!.id) {
      throw notFound('That interest no longer exists.');
    }
    if (interest.status !== 'PENDING') throw badRequest('That interest has already been dealt with.');

    const updated = await prisma.interest.update({
      where: { id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    // The sender is told only that it was answered — declining should never
    // become a notification that stings.
    await notify({
      userId: interest.senderId,
      type: 'INTEREST_DECLINED',
      title: 'One of your interests was answered',
      body: 'Keep looking — there are other profiles that may suit you better.',
      link: '/interests',
    });

    res.json({ interest: updated });
  }),
);

/** Withdraw an interest you sent while it is still pending. */
interestRouter.post(
  '/:id/withdraw',
  requireActive,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const interest = await prisma.interest.findUnique({ where: { id } });
    if (!interest || interest.senderId !== req.user!.id) {
      throw notFound('That interest no longer exists.');
    }
    if (interest.status !== 'PENDING') throw badRequest('You can only withdraw a pending interest.');

    const updated = await prisma.interest.update({
      where: { id },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });
    res.json({ interest: updated });
  }),
);

const listSchema = z.object({
  box: z.enum(['received', 'sent', 'connections']).default('received'),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'ALL']).default('PENDING'),
});

interestRouter.get(
  '/',
  requireActive,
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { box, status } = validatedQuery<z.infer<typeof listSchema>>(req);
    const me = req.user!.id;

    if (box === 'connections') {
      const connections = await prisma.interest.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: me }, { receiverId: me }],
        },
        orderBy: { respondedAt: 'desc' },
        include: {
          sender: { include: { profile: { include: profileInclude } } },
          receiver: { include: { profile: { include: profileInclude } } },
        },
      });

      res.json({
        items: connections
          .map((c) => {
            const other = c.senderId === me ? c.receiver : c.sender;
            if (!other.profile) return null;
            return {
              id: c.id,
              connectedAt: c.respondedAt,
              profile: profileCardDto({ ...other.profile, user: other }),
            };
          })
          .filter(Boolean),
      });
      return;
    }

    const where =
      box === 'received'
        ? { receiverId: me, ...(status === 'ALL' ? {} : { status }) }
        : { senderId: me, ...(status === 'ALL' ? {} : { status }) };

    const interests = await prisma.interest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { profile: { include: profileInclude } } },
        receiver: { include: { profile: { include: profileInclude } } },
      },
    });

    res.json({
      items: interests
        .map((i) => {
          const other = box === 'received' ? i.sender : i.receiver;
          if (!other.profile) return null;
          return {
            id: i.id,
            status: i.status,
            message: i.message,
            createdAt: i.createdAt,
            respondedAt: i.respondedAt,
            profile: profileCardDto({ ...other.profile, user: other }),
          };
        })
        .filter(Boolean),
    });
  }),
);

/** Counts for the navigation badges. */
interestRouter.get(
  '/summary',
  requireActive,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const [pendingReceived, pendingSent, connections] = await Promise.all([
      prisma.interest.count({ where: { receiverId: me, status: 'PENDING' } }),
      prisma.interest.count({ where: { senderId: me, status: 'PENDING' } }),
      prisma.interest.count({
        where: { status: 'ACCEPTED', OR: [{ senderId: me }, { receiverId: me }] },
      }),
    ]);
    res.json({ pendingReceived, pendingSent, connections });
  }),
);
