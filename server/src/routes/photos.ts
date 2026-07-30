import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../config/env.js';
import { computeCompleteness, photoDto } from '../domain/profile.js';
import { zPhotoVisibility } from '../domain/vocab.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { areConnected, isBlockedBetween } from '../services/access.js';

export const photoRouter = Router();

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      cb(badRequest('Please upload a JPEG, PNG or WebP image.'));
      return;
    }
    cb(null, true);
  },
});

async function ensureUploadDir(): Promise<string> {
  await fs.mkdir(env.uploadRoot, { recursive: true });
  return env.uploadRoot;
}

/** Recomputes and stores completeness after a photo change. */
async function refreshCompleteness(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { photos: true },
  });
  if (!profile) return;
  const completeness = computeCompleteness(profile);
  if (completeness !== profile.completeness) {
    await prisma.profile.update({ where: { id: profile.id }, data: { completeness } });
  }
}

photoRouter.post(
  '/',
  requireAuth,
  uploadLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    if (!req.file) throw badRequest('No image was uploaded.');

    const count = await prisma.photo.count({ where: { userId } });
    if (count >= env.MAX_PHOTOS_PER_USER) {
      throw badRequest(`You can have up to ${env.MAX_PHOTOS_PER_USER} photos. Remove one first.`);
    }

    // Re-encode rather than storing the original: it normalises the format,
    // caps the dimensions, and strips EXIF — which on a phone photo carries the
    // GPS coordinates of wherever it was taken.
    const processed = await sharp(req.file.buffer)
      .rotate()
      .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    const thumbnailBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize(24, 32, { fit: 'inside' })
      .jpeg({ quality: 50 })
      .toBuffer();

    const dir = await ensureUploadDir();
    const storageKey = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await fs.writeFile(path.join(dir, storageKey), processed.data);

    const isFirst = count === 0;
    const photo = await prisma.photo.create({
      data: {
        userId,
        storageKey,
        thumbnail: `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`,
        isPrimary: isFirst,
        position: count,
        width: processed.info.width,
        height: processed.info.height,
        bytes: processed.info.size,
        moderationStatus: env.AUTO_APPROVE_PHOTOS ? 'APPROVED' : 'PENDING',
      },
    });

    await refreshCompleteness(userId);
    res.status(201).json({ photo: photoDto(photo) });
  }),
);

/** Streams the image, enforcing the owner's per-photo visibility setting. */
photoRouter.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id as string } });
    if (!photo) throw notFound('That photo does not exist.');

    const viewerId = req.user?.id ?? null;
    const isOwner = viewerId === photo.userId;
    const isStaff = req.user?.role === 'ADMIN' || req.user?.role === 'MODERATOR';

    if (!isOwner && !isStaff) {
      if (photo.moderationStatus !== 'APPROVED') throw notFound('That photo does not exist.');
      if (photo.visibility === 'MEMBERS' && !viewerId) throw forbidden('Sign in to see this photo.');
      if (photo.visibility === 'CONNECTIONS') {
        if (!viewerId || !(await areConnected(viewerId, photo.userId))) {
          throw forbidden('This photo is only visible to connections.');
        }
      }
      if (viewerId && (await isBlockedBetween(viewerId, photo.userId))) {
        throw notFound('That photo does not exist.');
      }
    }

    const filePath = path.join(env.uploadRoot, photo.storageKey);
    try {
      await fs.access(filePath);
    } catch {
      throw notFound('That image is no longer available.');
    }

    res.type('image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  }),
);

photoRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const photos = await prisma.photo.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
    });
    res.json({ photos: photos.map(photoDto) });
  }),
);

photoRouter.patch(
  '/:id',
  requireAuth,
  validate(
    z.object({
      caption: z.string().trim().max(200).nullable().optional(),
      visibility: zPhotoVisibility.optional(),
      isPrimary: z.literal(true).optional(),
      position: z.number().int().min(0).max(50).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const input = req.body as {
      caption?: string | null;
      visibility?: string;
      isPrimary?: true;
      position?: number;
    };

    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo || photo.userId !== userId) throw notFound('That photo does not exist.');

    if (input.isPrimary) {
      if (photo.moderationStatus !== 'APPROVED') {
        throw badRequest('A photo has to be approved before it can be your main picture.');
      }
      await prisma.photo.updateMany({ where: { userId }, data: { isPrimary: false } });
    }

    const updated = await prisma.photo.update({
      where: { id },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.isPrimary ? { isPrimary: true } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
    res.json({ photo: photoDto(updated) });
  }),
);

photoRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id as string } });
    if (!photo || photo.userId !== userId) throw notFound('That photo does not exist.');

    await prisma.photo.delete({ where: { id: photo.id } });
    await fs.unlink(path.join(env.uploadRoot, photo.storageKey)).catch(() => undefined);

    // If the main picture went, promote the next approved one.
    if (photo.isPrimary) {
      const next = await prisma.photo.findFirst({
        where: { userId, moderationStatus: 'APPROVED' },
        orderBy: { position: 'asc' },
      });
      if (next) await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
    }

    await refreshCompleteness(userId);
    res.json({ ok: true });
  }),
);
