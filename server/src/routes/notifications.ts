import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { validate, validatedQuery } from '../middleware/validate.js';

export const notificationRouter = Router();

const listSchema = z.object({
  unreadOnly: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

notificationRouter.get(
  '/',
  requireAuth,
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { unreadOnly, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unreadOnly === 'true' ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unread = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json({ notifications, unread });
  }),
);

notificationRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id as string, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

notificationRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
