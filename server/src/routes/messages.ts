import { Router } from 'express';
import { z } from 'zod';
import { publicProfileDto } from '../domain/profile.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { notify } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { requireActive } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import { validate, validatedQuery } from '../middleware/validate.js';
import { areConnected, conversationPair, isBlockedBetween } from '../services/access.js';

export const messageRouter = Router();

/**
 * Messaging is gated on a mutual connection. That single rule is what keeps the
 * site free of the unsolicited-message problem that drives people (women in
 * particular) off matrimony sites — you cannot write to someone who has not
 * accepted your interest.
 */
async function loadConversationFor(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw notFound('That conversation does not exist.');
  if (conversation.memberAId !== userId && conversation.memberBId !== userId) {
    throw notFound('That conversation does not exist.');
  }
  return conversation;
}

function otherMemberId(
  conversation: { memberAId: string; memberBId: string },
  userId: string,
): string {
  return conversation.memberAId === userId ? conversation.memberBId : conversation.memberAId;
}

messageRouter.get(
  '/conversations',
  requireActive,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ memberAId: me }, { memberBId: me }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        memberA: { include: { profile: { include: { photos: true } } } },
        memberB: { include: { profile: { include: { photos: true } } } },
      },
    });

    const items = await Promise.all(
      conversations.map(async (c) => {
        const isA = c.memberAId === me;
        const other = isA ? c.memberB : c.memberA;
        if (!other.profile) return null;

        const lastReadAt = isA ? c.aLastReadAt : c.bLastReadAt;
        const unread = await prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: me },
            deletedAt: null,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        return {
          id: c.id,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview,
          unread,
          closed: Boolean(c.closedAt),
          participant: publicProfileDto({ ...other.profile, user: other }, true),
        };
      }),
    );

    res.json({ conversations: items.filter(Boolean) });
  }),
);

/** Opens (or finds) the conversation with a connection. */
messageRouter.post(
  '/conversations',
  requireActive,
  validate(z.object({ userId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { userId: otherId } = req.body as { userId: string };

    if (otherId === me) throw badRequest('You cannot message yourself.');
    if (await isBlockedBetween(me, otherId)) throw notFound('That member is not available.');
    if (!(await areConnected(me, otherId))) {
      throw forbidden('You can message someone once you have both accepted an interest.');
    }

    const pair = conversationPair(me, otherId);
    const conversation = await prisma.conversation.upsert({
      where: { memberAId_memberBId: pair },
      create: pair,
      update: {},
    });

    res.status(201).json({ conversation: { id: conversation.id } });
  }),
);

const listMessagesSchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

messageRouter.get(
  '/conversations/:id/messages',
  requireActive,
  validate(listMessagesSchema, 'query'),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { before, limit } = validatedQuery<z.infer<typeof listMessagesSchema>>(req);
    const conversation = await loadConversationFor(req.params.id as string, me);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Mark as read up to now, and stamp the individual rows so the sender's
    // read receipts are accurate.
    const isA = conversation.memberAId === me;
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversation.id },
        data: isA ? { aLastReadAt: new Date() } : { bLastReadAt: new Date() },
      }),
      prisma.message.updateMany({
        where: { conversationId: conversation.id, senderId: { not: me }, readAt: null },
        data: { readAt: new Date() },
      }),
    ]);

    res.json({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        body: m.deletedAt ? null : m.body,
        deleted: Boolean(m.deletedAt),
        mine: m.senderId === me,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
      hasMore: messages.length === limit,
    });
  }),
);

messageRouter.post(
  '/conversations/:id/messages',
  requireActive,
  contactLimiter,
  validate(z.object({ body: z.string().trim().min(1, 'Write something first.').max(4000) })),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { body } = req.body as { body: string };
    const conversation = await loadConversationFor(req.params.id as string, me);
    const otherId = otherMemberId(conversation, me);

    if (conversation.closedAt) throw forbidden('This conversation has been closed.');
    if (await isBlockedBetween(me, otherId)) throw forbidden('You cannot message this member.');
    if (!(await areConnected(me, otherId))) {
      throw forbidden('You are no longer connected with this member.');
    }

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: me, body },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: body.slice(0, 140),
      },
    });

    const senderName =
      (await prisma.profile.findUnique({ where: { userId: me }, select: { displayName: true } }))
        ?.displayName ?? 'A member';

    await notify({
      userId: otherId,
      type: 'NEW_MESSAGE',
      title: `New message from ${senderName}`,
      body: body.slice(0, 120),
      link: `/messages/${conversation.id}`,
    });

    res.status(201).json({
      message: {
        id: message.id,
        body: message.body,
        mine: true,
        readAt: null,
        createdAt: message.createdAt,
      },
    });
  }),
);

/** Deleting removes your own message for both sides but keeps the thread intact. */
messageRouter.delete(
  '/messages/:id',
  requireActive,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const message = await prisma.message.findUnique({ where: { id: req.params.id as string } });
    if (!message || message.senderId !== me) throw notFound('That message does not exist.');

    await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: '' },
    });
    res.json({ ok: true });
  }),
);

messageRouter.post(
  '/conversations/:id/close',
  requireActive,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const conversation = await loadConversationFor(req.params.id as string, me);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { closedAt: new Date(), closedById: me },
    });
    res.json({ ok: true });
  }),
);

messageRouter.get(
  '/unread-count',
  requireActive,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ memberAId: me }, { memberBId: me }] },
      select: { id: true, memberAId: true, aLastReadAt: true, bLastReadAt: true },
    });

    let total = 0;
    for (const c of conversations) {
      const lastReadAt = c.memberAId === me ? c.aLastReadAt : c.bLastReadAt;
      total += await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: me },
          deletedAt: null,
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
    }
    res.json({ unread: total });
  }),
);
