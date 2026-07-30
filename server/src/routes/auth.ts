import { Router, type Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { deriveClanGroup, isOldEnough } from '../domain/profile.js';
import { zGender } from '../domain/vocab.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { hashPassword, isAcceptablePassword, describePasswordRules, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import {
  generateRefreshToken,
  generateUrlToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

async function issueSession(
  userId: string,
  email: string,
  role: string,
  meta: { userAgent?: string; ip?: string },
) {
  const { token, hash } = generateRefreshToken();
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hash,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ip ?? null,
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { refreshToken: token, accessToken: signAccessToken({ sub: userId, email, role }) };
}

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.').toLowerCase().trim(),
  password: z.string().refine(isAcceptablePassword, describePasswordRules()),
  displayName: z.string().trim().min(2, 'Please tell us what to call you.').max(60),
  gender: zGender,
  dateOfBirth: z.coerce.date(),
  /** Optional at sign-up — the profile wizard collects the rest. */
  clan: z.string().optional(),
  ukRegion: z.string().optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the terms and community guidelines.' }),
  }),
});

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof registerSchema>;

    if (!isOldEnough(input.dateOfBirth, env.MIN_AGE)) {
      throw badRequest(`You need to be at least ${env.MIN_AGE} to join.`);
    }
    if (input.dateOfBirth > new Date()) {
      throw badRequest('That date of birth is in the future.');
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw conflict('There is already an account with that email address.');
    }

    const verificationToken = generateUrlToken();
    const autoVerify = env.AUTO_VERIFY_EMAIL || env.isTest;

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        status: autoVerify ? 'ACTIVE' : 'PENDING_VERIFICATION',
        emailVerifiedAt: autoVerify ? new Date() : null,
        emailVerificationToken: autoVerify ? null : verificationToken,
        profile: {
          create: {
            displayName: input.displayName,
            gender: input.gender,
            dateOfBirth: input.dateOfBirth,
            clan: input.clan ?? null,
            clanGroup: deriveClanGroup(input.clan),
            ukRegion: input.ukRegion ?? null,
            preference: {
              create: {
                // A sensible opening range — members widen or narrow it later.
                ageMin: Math.max(env.MIN_AGE, new Date().getFullYear() - input.dateOfBirth.getFullYear() - 6),
                ageMax: new Date().getFullYear() - input.dateOfBirth.getFullYear() + 8,
              },
            },
          },
        },
      },
      include: { profile: true },
    });

    const { accessToken, refreshToken } = await issueSession(user.id, user.email, user.role, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
      // Until email delivery is wired up, the token is returned in non-production
      // so the flow is testable end to end.
      ...(env.isProduction || autoVerify ? {} : { verificationToken }),
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Please enter your password.'),
});

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });

    // Same response for "no such user" and "wrong password" so the endpoint
    // cannot be used to discover which addresses are registered.
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      throw unauthorized('That email address and password do not match.');
    }
    if (user.status === 'SUSPENDED') {
      throw unauthorized('This account is suspended. Please contact support.');
    }

    if (user.status === 'DEACTIVATED') {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    }

    const { accessToken, refreshToken } = await issueSession(user.id, user.email, user.role, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setRefreshCookie(res, refreshToken);
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status === 'DEACTIVATED' ? 'ACTIVE' : user.status,
      },
    });
  }),
);

/**
 * Rotates the refresh token: the presented one is revoked and a fresh one
 * issued, so a stolen token stops working as soon as the real member refreshes.
 */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const presented =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (!presented) throw unauthorized('No refresh token.');

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(presented) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearRefreshCookie(res);
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    if (session.user.status === 'SUSPENDED') {
      clearRefreshCookie(res);
      throw unauthorized('This account is suspended.');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken } = await issueSession(
      session.userId,
      session.user.email,
      session.user.role,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    );
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        status: session.user.status,
      },
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (presented) {
      await prisma.session.updateMany({
        where: { refreshTokenHash: hashToken(presented), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

/** Signs out every device — useful after a password change or a scare. */
authRouter.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.session.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/verify-email',
  validate(z.object({ token: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };
    const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
    if (!user) throw badRequest('That confirmation link is no longer valid.');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
      },
    });
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(z.object({ email: z.string().email().toLowerCase().trim() })),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });

    let resetToken: string | undefined;
    if (user) {
      resetToken = generateUrlToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: resetToken, passwordResetExpiresAt: expires },
      });
    }

    // Always the same response, so the endpoint cannot enumerate accounts.
    res.json({
      ok: true,
      message: 'If that address has an account, a reset link is on its way.',
      ...(env.isProduction ? {} : { resetToken }),
    });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(
    z.object({
      token: z.string().min(10),
      password: z.string().refine(isAcceptablePassword, describePasswordRules()),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw badRequest('That reset link has expired. Please request a new one.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      }),
      // Changing a password ends every existing session.
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validate(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().refine(isAcceptablePassword, describePasswordRules()),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Your current password is not correct.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        profile: { select: { id: true, displayName: true, completeness: true, verified: true } },
      },
    });
    const unreadNotifications = await prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    res.json({ user, unreadNotifications });
  }),
);

/** Lists signed-in devices so a member can revoke one they don't recognise. */
authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ sessions });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.session.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
