import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { distanceBetweenRegions } from '../domain/gurung.js';
import { computeCompatibility } from '../domain/matching.js';
import { profileCardDto } from '../domain/profile.js';
import {
  GURUNG_HERITAGES,
  zClan,
  zDiet,
  zDistrict,
  zEducation,
  zGender,
  zHeritage,
  zIntent,
  zMaritalStatus,
  zReligion,
  zResidencyStatus,
  zUkRegion,
} from '../domain/vocab.js';
import { parseList } from '../lib/json.js';
import { prisma } from '../lib/prisma.js';
import { requireActive } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { validate, validatedQuery, zBoolish, zCsv } from '../middleware/validate.js';
import { blockedUserIds } from '../services/access.js';

export const discoveryRouter = Router();

/** Turn an age bound into the date-of-birth bound it implies. */
function dobBoundForAge(age: number, kind: 'min' | 'max'): Date {
  const d = new Date();
  // Someone with a minimum age of 30 must be born on or before today-30y.
  d.setFullYear(d.getFullYear() - (kind === 'min' ? age : age + 1));
  if (kind === 'max') d.setDate(d.getDate() + 1);
  return d;
}

const searchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  gender: zGender.optional(),
  ageMin: z.coerce.number().int().min(18).max(99).optional(),
  ageMax: z.coerce.number().int().min(18).max(99).optional(),
  heightMinCm: z.coerce.number().int().min(120).max(230).optional(),
  heightMaxCm: z.coerce.number().int().min(120).max(230).optional(),
  clans: zCsv.optional(),
  excludeClans: zCsv.optional(),
  clanGroups: zCsv.optional(),
  heritages: zCsv.optional(),
  districts: zCsv.optional(),
  regions: zCsv.optional(),
  religions: zCsv.optional(),
  maritalStatuses: zCsv.optional(),
  educationLevels: zCsv.optional(),
  diets: zCsv.optional(),
  residencyStatuses: zCsv.optional(),
  intents: zCsv.optional(),
  languages: zCsv.optional(),
  verifiedOnly: zBoolish.optional(),
  withPhotoOnly: zBoolish.optional(),
  serviceFamily: zBoolish.optional(),
  activeWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  maxDistanceMiles: z.coerce.number().int().min(5).max(1000).optional(),
  /** `compatibility` re-ranks in memory; the others map to SQL ordering. */
  sort: z.enum(['compatibility', 'recent', 'active', 'complete']).default('compatibility'),
  /** Apply the member's saved preferences as filters on top of the query. */
  usePreferences: zBoolish.default(false),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(24),
});

type SearchInput = z.infer<typeof searchSchema>;

const validClans = new Set(zClan.options);
const validHeritages = new Set(zHeritage.options);
const validRegions = new Set(zUkRegion.options);
const validDistricts = new Set(zDistrict.options);
const validReligions = new Set(zReligion.options);
const validMarital = new Set(zMaritalStatus.options);
const validEducation = new Set(zEducation.options);
const validDiets = new Set(zDiet.options);
const validResidency = new Set(zResidencyStatus.options);
const validIntents = new Set(zIntent.options);

/** Drops anything the caller made up, so a bad chip never empties the results. */
const clean = (values: string[] | undefined, allowed: Set<string>): string[] =>
  (values ?? []).filter((v) => allowed.has(v));

type StoredPreference = {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  religions: string;
  ukRegions: string;
  maritalStatuses: string;
  educationLevels: string;
  diets: string;
  residencyStatuses: string;
  ancestralDistricts: string;
  intents: string;
  verifiedOnly: boolean;
  gurungHeritageOnly: boolean;
};

/** Inflates the JSON-in-text preference row into the shape the filter wants. */
function toFilterPreference(pref: StoredPreference | null) {
  if (!pref) return null;
  return {
    ageMin: pref.ageMin,
    ageMax: pref.ageMax,
    heightMinCm: pref.heightMinCm,
    heightMaxCm: pref.heightMaxCm,
    religions: parseList(pref.religions),
    ukRegions: parseList(pref.ukRegions),
    maritalStatuses: parseList(pref.maritalStatuses),
    educationLevels: parseList(pref.educationLevels),
    diets: parseList(pref.diets),
    residencyStatuses: parseList(pref.residencyStatuses),
    ancestralDistricts: parseList(pref.ancestralDistricts),
    intents: parseList(pref.intents),
    verifiedOnly: pref.verifiedOnly,
    gurungHeritageOnly: pref.gurungHeritageOnly,
  };
}

/**
 * Builds the SQL-level filter. These are *hard* filters — a profile excluded
 * here never reaches the scorer. Soft signals belong in `computeCompatibility`.
 */
export function buildDiscoveryWhere(
  input: SearchInput,
  viewer: {
    userId: string;
    gender: string;
    excludeUserIds: string[];
    preference?: ReturnType<typeof toFilterPreference>;
  },
): Prisma.ProfileWhereInput {
  const pref = input.usePreferences ? viewer.preference : null;

  const ageMin = input.ageMin ?? pref?.ageMin ?? undefined;
  const ageMax = input.ageMax ?? pref?.ageMax ?? undefined;

  const dob: Prisma.DateTimeFilter = {};
  if (ageMax != null) dob.gte = dobBoundForAge(ageMax, 'max');
  if (ageMin != null) dob.lte = dobBoundForAge(ageMin, 'min');

  const heightMin = input.heightMinCm ?? pref?.heightMinCm ?? undefined;
  const heightMax = input.heightMaxCm ?? pref?.heightMaxCm ?? undefined;

  const regions = clean(input.regions, validRegions);
  const prefRegions = pref?.ukRegions ?? [];
  const effectiveRegions = regions.length ? regions : prefRegions;

  const religions = clean(input.religions, validReligions);
  const effectiveReligions = religions.length ? religions : (pref?.religions ?? []);

  const marital = clean(input.maritalStatuses, validMarital);
  const effectiveMarital = marital.length ? marital : (pref?.maritalStatuses ?? []);

  const education = clean(input.educationLevels, validEducation);
  const effectiveEducation = education.length ? education : (pref?.educationLevels ?? []);

  const diets = clean(input.diets, validDiets);
  const effectiveDiets = diets.length ? diets : (pref?.diets ?? []);

  const residency = clean(input.residencyStatuses, validResidency);
  const effectiveResidency = residency.length ? residency : (pref?.residencyStatuses ?? []);

  const districts = clean(input.districts, validDistricts);
  const effectiveDistricts = districts.length ? districts : (pref?.ancestralDistricts ?? []);

  const intents = clean(input.intents, validIntents);
  const effectiveIntents = intents.length ? intents : (pref?.intents ?? []);

  const and: Prisma.ProfileWhereInput[] = [];

  // Opposite gender by default. This is a matrimony site for a community whose
  // members overwhelmingly expect that framing; an explicit `gender` filter
  // still overrides it, so nothing is hard-coded beyond the default.
  and.push({ gender: input.gender ?? (viewer.gender === 'MALE' ? 'FEMALE' : 'MALE') });

  and.push({ visibility: { in: ['PUBLIC', 'MEMBERS_ONLY'] } });
  and.push({ userId: { notIn: [viewer.userId, ...viewer.excludeUserIds] } });
  and.push({ user: { status: 'ACTIVE' } });

  if (Object.keys(dob).length) and.push({ dateOfBirth: dob });
  if (heightMin != null || heightMax != null) {
    and.push({
      heightCm: {
        ...(heightMin != null ? { gte: heightMin } : {}),
        ...(heightMax != null ? { lte: heightMax } : {}),
      },
    });
  }

  const clans = clean(input.clans, validClans);
  if (clans.length) and.push({ clan: { in: clans } });

  const excludeClans = clean(input.excludeClans, validClans);
  if (excludeClans.length) and.push({ clan: { notIn: excludeClans } });

  const clanGroups = (input.clanGroups ?? []).filter((g) =>
    ['CHAR_JAT', 'SOHRA_JAT', 'OTHER'].includes(g),
  );
  if (clanGroups.length) and.push({ clanGroup: { in: clanGroups } });

  const heritages = clean(input.heritages, validHeritages);
  if (heritages.length) and.push({ heritage: { in: heritages } });

  // Filters on the stated heritage, not on whether a profile is finished — a
  // member who has not got round to entering their thar is still Gurung.
  if (pref?.gurungHeritageOnly) and.push({ heritage: { in: [...GURUNG_HERITAGES] } });
  if (effectiveRegions.length) and.push({ ukRegion: { in: effectiveRegions } });
  if (effectiveReligions.length) and.push({ religion: { in: effectiveReligions } });
  if (effectiveMarital.length) and.push({ maritalStatus: { in: effectiveMarital } });
  if (effectiveEducation.length) and.push({ education: { in: effectiveEducation } });
  if (effectiveDiets.length) and.push({ diet: { in: effectiveDiets } });
  if (effectiveResidency.length) and.push({ residencyStatus: { in: effectiveResidency } });
  if (effectiveDistricts.length) and.push({ ancestralDistrict: { in: effectiveDistricts } });
  if (effectiveIntents.length) and.push({ intent: { in: effectiveIntents } });

  if (input.verifiedOnly ?? pref?.verifiedOnly) and.push({ verified: true });
  if (input.serviceFamily) and.push({ serviceFamily: true });
  if (input.withPhotoOnly) {
    and.push({ photos: { some: { moderationStatus: 'APPROVED' } } });
  }
  if (input.activeWithinDays) {
    const since = new Date(Date.now() - input.activeWithinDays * 24 * 60 * 60 * 1000);
    and.push({ user: { lastActiveAt: { gte: since } } });
  }

  // `languages` is a JSON string column, so membership is a substring match on
  // the quoted slug. Exact enough because slugs are a closed set.
  for (const lang of input.languages ?? []) {
    and.push({ languages: { contains: `"${lang}"` } });
  }

  if (input.q) {
    const q = input.q;
    and.push({
      OR: [
        { displayName: { contains: q } },
        { headline: { contains: q } },
        { about: { contains: q } },
        { occupation: { contains: q } },
        { city: { contains: q } },
        { interests: { contains: q } },
      ],
    });
  }

  return { AND: and };
}

discoveryRouter.get(
  '/search',
  requireActive,
  validate(searchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const input = validatedQuery<SearchInput>(req);
    const viewerId = req.user!.id;

    const viewerProfile = await prisma.profile.findUnique({
      where: { userId: viewerId },
      include: { preference: true },
    });
    if (!viewerProfile) {
      res.json({ results: [], page: 1, perPage: input.perPage, total: 0, totalPages: 0 });
      return;
    }

    const excludeUserIds = await blockedUserIds(viewerId);

    const where = buildDiscoveryWhere(input, {
      userId: viewerId,
      gender: viewerProfile.gender,
      excludeUserIds,
      preference: toFilterPreference(viewerProfile.preference),
    });

    const total = await prisma.profile.count({ where });

    // Compatibility sorting needs every candidate in memory to rank them, which
    // is fine at community scale. The cap keeps a pathological query bounded;
    // when the site outgrows it, this is the seam where a precomputed score
    // column or a search index goes in.
    const RANKING_CAP = 500;
    const sortingInMemory = input.sort === 'compatibility';

    const orderBy: Prisma.ProfileOrderByWithRelationInput[] = sortingInMemory
      ? [{ completeness: 'desc' }, { updatedAt: 'desc' }]
      : input.sort === 'recent'
        ? [{ createdAt: 'desc' }]
        : input.sort === 'complete'
          ? [{ completeness: 'desc' }, { updatedAt: 'desc' }]
          : [{ user: { lastActiveAt: 'desc' } }];

    const candidates = await prisma.profile.findMany({
      where,
      orderBy,
      include: { photos: true, preference: true, user: true },
      skip: sortingInMemory ? 0 : (input.page - 1) * input.perPage,
      take: sortingInMemory ? RANKING_CAP : input.perPage,
    });

    const [shortlisted, interests] = await Promise.all([
      prisma.shortlist.findMany({
        where: { ownerId: viewerId, targetId: { in: candidates.map((c) => c.userId) } },
        select: { targetId: true },
      }),
      prisma.interest.findMany({
        where: {
          OR: [
            { senderId: viewerId, receiverId: { in: candidates.map((c) => c.userId) } },
            { receiverId: viewerId, senderId: { in: candidates.map((c) => c.userId) } },
          ],
        },
      }),
    ]);
    const shortlistedIds = new Set(shortlisted.map((s) => s.targetId));
    const interestByUser = new Map(
      interests.map((i) => [i.senderId === viewerId ? i.receiverId : i.senderId, i.status]),
    );

    const viewerInput = { profile: viewerProfile, preference: viewerProfile.preference };

    let scored = candidates.map((candidate) => {
      const result = computeCompatibility(viewerInput, {
        profile: candidate,
        preference: candidate.preference,
      });
      const miles = distanceBetweenRegions(viewerProfile.ukRegion, candidate.ukRegion);
      return {
        ...profileCardDto(candidate, {
          compatibility: result.score,
          isShortlisted: shortlistedIds.has(candidate.userId),
          interestStatus: interestByUser.get(candidate.userId) ?? null,
        }),
        distanceMiles: miles,
        highlights: result.highlights.slice(0, 2),
        sharesClan: result.advisory.shared,
      };
    });

    // A distance cap is applied after scoring because it needs both centroids.
    const distanceCap = input.maxDistanceMiles;
    if (distanceCap != null) {
      scored = scored.filter((s) => s.distanceMiles == null || s.distanceMiles <= distanceCap);
    }

    let pageItems = scored;
    let effectiveTotal = total;

    if (sortingInMemory) {
      scored.sort(
        (a, b) =>
          (b.compatibility ?? 0) - (a.compatibility ?? 0) ||
          b.completeness - a.completeness ||
          (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0),
      );
      effectiveTotal = Math.min(total, scored.length);
      const start = (input.page - 1) * input.perPage;
      pageItems = scored.slice(start, start + input.perPage);
    } else if (distanceCap != null) {
      effectiveTotal = scored.length;
    }

    res.json({
      results: pageItems,
      page: input.page,
      perPage: input.perPage,
      total: effectiveTotal,
      totalPages: Math.ceil(effectiveTotal / input.perPage),
      ...(sortingInMemory && total > RANKING_CAP
        ? { note: `Ranking the ${RANKING_CAP} most complete profiles that matched. Narrow your filters to rank a different set.` }
        : {}),
    });
  }),
);

/**
 * The daily suggestions on the dashboard: preference-filtered, scored, and with
 * anyone already dealt with (interest sent/received, shortlisted) taken out, so
 * the list is always something new to look at.
 */
discoveryRouter.get(
  '/recommendations',
  requireActive,
  validate(z.object({ limit: z.coerce.number().int().min(1).max(24).default(8) }), 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = validatedQuery<{ limit: number }>(req);
    const viewerId = req.user!.id;

    const viewerProfile = await prisma.profile.findUnique({
      where: { userId: viewerId },
      include: { preference: true },
    });
    if (!viewerProfile) {
      res.json({ recommendations: [] });
      return;
    }

    const [blocked, existingInterests] = await Promise.all([
      blockedUserIds(viewerId),
      prisma.interest.findMany({
        where: { OR: [{ senderId: viewerId }, { receiverId: viewerId }] },
        select: { senderId: true, receiverId: true },
      }),
    ]);

    const seen = new Set<string>(blocked);
    for (const i of existingInterests) {
      seen.add(i.senderId === viewerId ? i.receiverId : i.senderId);
    }

    const where = buildDiscoveryWhere(
      { ...searchSchema.parse({}), usePreferences: true },
      {
        userId: viewerId,
        gender: viewerProfile.gender,
        excludeUserIds: [...seen],
        preference: toFilterPreference(viewerProfile.preference),
      },
    );

    const candidates = await prisma.profile.findMany({
      where,
      include: { photos: true, preference: true, user: true },
      orderBy: [{ completeness: 'desc' }],
      take: 200,
    });

    const viewerInput = { profile: viewerProfile, preference: viewerProfile.preference };

    const ranked = candidates
      .map((candidate) => {
        const result = computeCompatibility(viewerInput, {
          profile: candidate,
          preference: candidate.preference,
        });
        return {
          ...profileCardDto(candidate, { compatibility: result.score }),
          distanceMiles: distanceBetweenRegions(viewerProfile.ukRegion, candidate.ukRegion),
          highlights: result.highlights.slice(0, 3),
          sharesClan: result.advisory.shared,
        };
      })
      .sort((a, b) => (b.compatibility ?? 0) - (a.compatibility ?? 0))
      .slice(0, limit);

    res.json({ recommendations: ranked });
  }),
);
