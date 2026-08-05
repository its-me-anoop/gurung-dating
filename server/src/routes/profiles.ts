import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { sharedClanAdvisory } from '../domain/gurung.js';
import { computeCompatibility } from '../domain/matching.js';
import {
  computeCompleteness,
  deriveClanGroup,
  isOldEnough,
  ownProfileDto,
  preferenceDto,
  publicProfileDto,
} from '../domain/profile.js';
import {
  zChildrenLivingStatus,
  zClan,
  zDiet,
  zDistrict,
  zEducation,
  zEmploymentStatus,
  zFamilyType,
  zFamilyValues,
  zFluency,
  zHabit,
  zHeritage,
  zIncomeBand,
  zIntent,
  zLanguage,
  zMaritalStatus,
  zProfileManagedBy,
  zRaisedIn,
  zReligion,
  zResidencyStatus,
  zUkRegion,
  zVisibility,
} from '../domain/vocab.js';
import { badRequest, notFound } from '../lib/errors.js';
import { serialiseList } from '../lib/json.js';
import { notify } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { requireActive, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { resolveProfileAccess } from '../services/access.js';

export const profileRouter = Router();

/** Trims a string and turns "" into null, so blanking a field really clears it. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  dateOfBirth: z.coerce.date().optional(),
  heightCm: z.number().int().min(120).max(230).nullable().optional(),
  maritalStatus: zMaritalStatus.optional(),
  hasChildren: z.boolean().optional(),
  childrenLivingStatus: zChildrenLivingStatus.nullable().optional(),

  heritage: zHeritage.optional(),
  clan: zClan.nullable().optional(),
  motherClan: zClan.nullable().optional(),
  ancestralDistrict: zDistrict.nullable().optional(),
  religion: zReligion.nullable().optional(),
  motherTongue: zLanguage.nullable().optional(),
  gurungFluency: zFluency.nullable().optional(),
  languages: z.array(zLanguage).max(10).optional(),

  ukRegion: zUkRegion.nullable().optional(),
  city: nullableText(80),
  postcodeArea: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,2}[0-9][A-Z0-9]?$/, 'Use just the first part of your postcode, e.g. SW19.')
    .nullable()
    .optional(),
  residencyStatus: zResidencyStatus.nullable().optional(),
  yearsInUk: z.number().int().min(0).max(90).nullable().optional(),
  raisedIn: zRaisedIn.nullable().optional(),
  serviceFamily: z.boolean().optional(),
  willingToRelocate: z.boolean().optional(),

  education: zEducation.nullable().optional(),
  fieldOfStudy: nullableText(120),
  occupation: nullableText(120),
  incomeBand: zIncomeBand.nullable().optional(),
  employmentStatus: zEmploymentStatus.nullable().optional(),

  diet: zDiet.nullable().optional(),
  smoking: zHabit.nullable().optional(),
  drinking: zHabit.nullable().optional(),

  familyType: zFamilyType.nullable().optional(),
  familyValues: zFamilyValues.nullable().optional(),
  fatherOccupation: nullableText(120),
  motherOccupation: nullableText(120),
  brothers: z.number().int().min(0).max(20).nullable().optional(),
  sisters: z.number().int().min(0).max(20).nullable().optional(),
  familyBasedIn: nullableText(120),

  headline: nullableText(120),
  about: nullableText(3000),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  lookingFor: nullableText(2000),

  intent: zIntent.optional(),
  visibility: zVisibility.optional(),
  profileManagedBy: zProfileManagedBy.optional(),
});

profileRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      include: { photos: true, preference: true, user: true },
    });
    if (!profile) throw notFound('You do not have a profile yet.');
    res.json({ profile: ownProfileDto(profile) });
  }),
);

profileRouter.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof updateProfileSchema>;

    if (input.dateOfBirth) {
      if (input.dateOfBirth > new Date()) throw badRequest('That date of birth is in the future.');
      if (!isOldEnough(input.dateOfBirth, env.MIN_AGE)) {
        throw badRequest(`Members must be at least ${env.MIN_AGE}.`);
      }
    }
    if (input.hasChildren === false) input.childrenLivingStatus = null;

    const { languages, interests, clan, ...rest } = input;

    const data: Record<string, unknown> = { ...rest };
    if (languages !== undefined) data.languages = serialiseList(languages);
    if (interests !== undefined) data.interests = serialiseList(interests);
    if (clan !== undefined) {
      data.clan = clan;
      // clanGroup is derived, never accepted from the client.
      data.clanGroup = deriveClanGroup(clan);
    }

    const updated = await prisma.profile.update({
      where: { userId: req.user!.id },
      data,
      include: { photos: true, preference: true, user: true },
    });

    // Completeness depends on the row we just wrote, so recompute and persist.
    const completeness = computeCompleteness(updated);
    const final =
      completeness === updated.completeness
        ? updated
        : await prisma.profile.update({
            where: { id: updated.id },
            data: { completeness },
            include: { photos: true, preference: true, user: true },
          });

    res.json({ profile: ownProfileDto(final) });
  }),
);

const preferenceSchema = z.object({
  ageMin: z.number().int().min(18).max(99).nullable().optional(),
  ageMax: z.number().int().min(18).max(99).nullable().optional(),
  heightMinCm: z.number().int().min(120).max(230).nullable().optional(),
  heightMaxCm: z.number().int().min(120).max(230).nullable().optional(),
  maritalStatuses: z.array(zMaritalStatus).optional(),
  religions: z.array(zReligion).optional(),
  ukRegions: z.array(zUkRegion).optional(),
  educationLevels: z.array(zEducation).optional(),
  diets: z.array(zDiet).optional(),
  residencyStatuses: z.array(zResidencyStatus).optional(),
  ancestralDistricts: z.array(zDistrict).optional(),
  clanGroups: z.array(z.enum(['CHAR_JAT', 'SOHRA_JAT', 'OTHER'])).optional(),
  intents: z.array(zIntent).optional(),
  maxSmoking: zHabit.nullable().optional(),
  maxDrinking: zHabit.nullable().optional(),
  gurungHeritageOnly: z.boolean().optional(),
  observeClanExogamy: z.boolean().optional(),
  verifiedOnly: z.boolean().optional(),
  ukBasedFamilyOnly: z.boolean().optional(),
  maxDistanceMiles: z.number().int().min(5).max(1000).nullable().optional(),
});

profileRouter.put(
  '/me/preferences',
  requireAuth,
  validate(preferenceSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof preferenceSchema>;

    if (input.ageMin != null && input.ageMax != null && input.ageMin > input.ageMax) {
      throw badRequest('The minimum age cannot be higher than the maximum age.');
    }
    if (input.heightMinCm != null && input.heightMaxCm != null && input.heightMinCm > input.heightMaxCm) {
      throw badRequest('The minimum height cannot be higher than the maximum height.');
    }

    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    if (!profile) throw notFound('You do not have a profile yet.');

    const listFields = [
      'maritalStatuses',
      'religions',
      'ukRegions',
      'educationLevels',
      'diets',
      'residencyStatuses',
      'ancestralDistricts',
      'clanGroups',
      'intents',
    ] as const;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      data[key] = (listFields as readonly string[]).includes(key)
        ? serialiseList(value as string[])
        : value;
    }

    const preference = await prisma.preference.upsert({
      where: { profileId: profile.id },
      create: { profileId: profile.id, ...data },
      update: data,
    });

    res.json({ preference: preferenceDto(preference) });
  }),
);

/** Deactivating hides the profile everywhere; signing back in restores it. */
profileRouter.post(
  '/me/deactivate',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.user!.id }, data: { status: 'DEACTIVATED' } });
    await prisma.session.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true, message: 'Your profile is hidden. Sign in again to bring it back.' });
  }),
);

/** Permanent deletion. Cascades remove photos, messages, interests and blocks. */
profileRouter.delete(
  '/me',
  requireAuth,
  validate(z.object({ confirm: z.literal('DELETE') })),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.user!.id } });
    res.json({ ok: true });
  }),
);

/**
 * A single profile. Response is tailored to the viewer: their compatibility
 * score, whether they've already sent an interest, and the clan advisory.
 */
profileRouter.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId as string;
    const access = await resolveProfileAccess(targetId, req.user);

    const profile = await prisma.profile.findUnique({
      where: { userId: targetId },
      include: { photos: true, preference: true, user: true },
    });
    if (!profile) throw notFound('That profile is not available.');

    if (access.isSelf) {
      res.json({ profile: ownProfileDto(profile), viewer: { isSelf: true } });
      return;
    }

    const dto = publicProfileDto(profile, access.isConnection);

    let compatibility = null;
    let advisory = null;
    let interestStatus: string | null = null;
    let interestDirection: 'SENT' | 'RECEIVED' | null = null;
    let isShortlisted = false;

    if (access.viewerId) {
      const viewerProfile = await prisma.profile.findUnique({
        where: { userId: access.viewerId },
        include: { preference: true },
      });

      if (viewerProfile) {
        const result = computeCompatibility(
          { profile: viewerProfile, preference: viewerProfile.preference },
          { profile, preference: profile.preference },
        );
        compatibility = {
          score: result.score,
          coverage: result.coverage,
          highlights: result.highlights,
          factors: result.factors.filter((f) => f.score != null),
        };
        advisory = sharedClanAdvisory(viewerProfile, profile);
      }

      const [interest, shortlist] = await Promise.all([
        prisma.interest.findFirst({
          where: {
            OR: [
              { senderId: access.viewerId, receiverId: targetId },
              { senderId: targetId, receiverId: access.viewerId },
            ],
          },
        }),
        prisma.shortlist.findUnique({
          where: { ownerId_targetId: { ownerId: access.viewerId, targetId } },
        }),
      ]);

      if (interest) {
        interestStatus = interest.status;
        interestDirection = interest.senderId === access.viewerId ? 'SENT' : 'RECEIVED';
      }
      isShortlisted = Boolean(shortlist);

      // Record the view (one row per pair, refreshed) and let them know.
      if (access.viewerId !== targetId) {
        const existing = await prisma.profileView.findUnique({
          where: { viewerId_viewedId: { viewerId: access.viewerId, viewedId: targetId } },
        });
        await prisma.profileView.upsert({
          where: { viewerId_viewedId: { viewerId: access.viewerId, viewedId: targetId } },
          create: { viewerId: access.viewerId, viewedId: targetId },
          update: { viewedAt: new Date() },
        });
        // Only notify on a first view, or after a long gap — nobody wants a
        // ping every time someone re-reads their profile.
        const quietFor = existing ? Date.now() - existing.viewedAt.getTime() : Infinity;
        if (quietFor > 7 * 24 * 60 * 60 * 1000) {
          const viewerName = (
            await prisma.profile.findUnique({
              where: { userId: access.viewerId },
              select: { displayName: true },
            })
          )?.displayName;
          if (viewerName) {
            await notify({
              userId: targetId,
              type: 'PROFILE_VIEW',
              title: `${viewerName} viewed your profile`,
              link: `/members/${access.viewerId}`,
            });
          }
        }
      }
    }

    res.json({
      profile: dto,
      compatibility,
      advisory,
      viewer: {
        isSelf: false,
        isConnection: access.isConnection,
        interestStatus,
        interestDirection,
        isShortlisted,
      },
    });
  }),
);

/** Who has looked at my profile. */
profileRouter.get(
  '/me/viewers',
  requireActive,
  asyncHandler(async (req, res) => {
    const views = await prisma.profileView.findMany({
      where: { viewedId: req.user!.id },
      orderBy: { viewedAt: 'desc' },
      take: 50,
      include: {
        viewer: { include: { profile: { include: { photos: true } } } },
      },
    });

    res.json({
      viewers: views
        .filter((v) => v.viewer.profile)
        .map((v) => ({
          viewedAt: v.viewedAt,
          profile: publicProfileDto({ ...v.viewer.profile!, photos: v.viewer.profile!.photos }),
        })),
    });
  }),
);
