/**
 * Compatibility scoring.
 *
 * The score answers one question: "given what each of these two people said
 * they are looking for, how well do they line up?" It is symmetric — A's score
 * for B equals B's score for A — because a match that only works one way is not
 * a match. Every factor returns a 0..1 score plus a weight; the final number is
 * the weighted mean over the factors that actually had data on both sides.
 *
 * Two deliberate choices:
 *
 *  1. Missing data is *skipped*, never scored as zero. A member who has not
 *     filled in their diet should not be punished for it; the factor simply
 *     drops out of the average and the `coverage` figure tells the UI how much
 *     of the score is actually grounded in stated information.
 *
 *  2. Hard filters live in the query layer (`buildDiscoveryWhere`), not here.
 *     Scoring ranks candidates that already passed the filters; it never
 *     silently excludes anyone.
 */

import { parseList } from '../lib/json.js';
import {
  distanceBetweenRegions,
  isSpecificClan,
  sharedClanAdvisory,
  type SharedClanAdvisory,
} from './gurung.js';
import { EDUCATION_RANK, HABIT_RANK, type EDUCATION_LEVELS, type HABIT_LEVELS } from './vocab.js';

export interface ScorableProfile {
  gender: string;
  dateOfBirth: Date;
  heightCm: number | null;
  maritalStatus: string;
  clan: string | null;
  motherClan: string | null;
  clanGroup: string | null;
  ancestralDistrict: string | null;
  religion: string | null;
  gurungFluency: string | null;
  languages: string;
  ukRegion: string | null;
  residencyStatus: string | null;
  education: string | null;
  diet: string | null;
  smoking: string | null;
  drinking: string | null;
  familyValues: string | null;
  intent: string;
  interests: string;
  verified: boolean;
  willingToRelocate: boolean;
}

export interface ScorablePreference {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  maritalStatuses: string;
  religions: string;
  ukRegions: string;
  educationLevels: string;
  diets: string;
  residencyStatuses: string;
  ancestralDistricts: string;
  clanGroups: string;
  intents: string;
  maxSmoking: string | null;
  maxDrinking: string | null;
  observeClanExogamy: boolean;
  verifiedOnly: boolean;
  maxDistanceMiles: number | null;
}

export interface FactorScore {
  key: string;
  label: string;
  /** 0..1, or null when neither side stated enough to judge. */
  score: number | null;
  weight: number;
  /** Short sentence shown in the "why you match" breakdown. */
  detail: string;
}

export interface CompatibilityResult {
  /** 0..100. */
  score: number;
  /** Share of total weight that had data on both sides, 0..100. */
  coverage: number;
  factors: FactorScore[];
  /** The strongest few factors, ready to render as chips. */
  highlights: string[];
  advisory: SharedClanAdvisory;
}

export function ageFrom(dateOfBirth: Date, now = new Date()): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = now.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dateOfBirth.getDate())) age -= 1;
  return age;
}

/** 1 inside the range, tapering to 0 over `slack` units beyond either end. */
function rangeScore(
  value: number | null | undefined,
  min: number | null,
  max: number | null,
  slack: number,
): number | null {
  if (value == null) return null;
  if (min == null && max == null) return null;
  const lo = min ?? Number.NEGATIVE_INFINITY;
  const hi = max ?? Number.POSITIVE_INFINITY;
  if (value >= lo && value <= hi) return 1;
  const distance = value < lo ? lo - value : value - hi;
  return Math.max(0, 1 - distance / slack);
}

/** 1 when the value is in the accepted list; an empty list means "open to all". */
function listScore(value: string | null | undefined, accepted: string[]): number | null {
  if (accepted.length === 0) return null; // no stated preference — skip
  if (!value) return null; // nothing to judge against
  return accepted.includes(value) ? 1 : 0;
}

/** For "at most this much" habits: 1 if within, sliding down one step at a time. */
function habitScore(value: string | null | undefined, ceiling: string | null): number | null {
  if (!ceiling || !value) return null;
  const v = HABIT_RANK[value as (typeof HABIT_LEVELS)[number]];
  const c = HABIT_RANK[ceiling as (typeof HABIT_LEVELS)[number]];
  if (v == null || c == null) return null;
  if (v <= c) return 1;
  return Math.max(0, 1 - (v - c) * 0.5);
}

function overlapScore(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  const setB = new Set(b.map((x) => x.toLowerCase().trim()));
  const shared = a.filter((x) => setB.has(x.toLowerCase().trim()));
  // Jaccard-ish, but generous: sharing 3 of anything is already a strong signal.
  return Math.min(1, shared.length / Math.min(3, Math.max(a.length, b.length)));
}

/** Symmetric factor: run a one-directional check both ways and take the mean. */
function bothWays(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

export interface CompatibilityInput {
  profile: ScorableProfile;
  preference: ScorablePreference | null;
}

const NEUTRAL_PREFERENCE: ScorablePreference = {
  ageMin: null,
  ageMax: null,
  heightMinCm: null,
  heightMaxCm: null,
  maritalStatuses: '[]',
  religions: '[]',
  ukRegions: '[]',
  educationLevels: '[]',
  diets: '[]',
  residencyStatuses: '[]',
  ancestralDistricts: '[]',
  clanGroups: '[]',
  intents: '[]',
  maxSmoking: null,
  maxDrinking: null,
  observeClanExogamy: true,
  verifiedOnly: false,
  maxDistanceMiles: null,
};

export function computeCompatibility(
  self: CompatibilityInput,
  other: CompatibilityInput,
  now = new Date(),
): CompatibilityResult {
  const aP = self.profile;
  const bP = other.profile;
  const aPref = self.preference ?? NEUTRAL_PREFERENCE;
  const bPref = other.preference ?? NEUTRAL_PREFERENCE;

  const aAge = ageFrom(aP.dateOfBirth, now);
  const bAge = ageFrom(bP.dateOfBirth, now);

  const factors: FactorScore[] = [];
  const add = (key: string, label: string, score: number | null, weight: number, detail: string) =>
    factors.push({ key, label, score, weight, detail });

  // --- Age -----------------------------------------------------------------
  const ageFit = bothWays(
    rangeScore(bAge, aPref.ageMin, aPref.ageMax, 6),
    rangeScore(aAge, bPref.ageMin, bPref.ageMax, 6),
  );
  add(
    'age',
    'Age',
    ageFit,
    14,
    ageFit === 1
      ? 'You are both within each other’s stated age range.'
      : `There are ${Math.abs(aAge - bAge)} years between you.`,
  );

  // --- Intent — what each person is here for -------------------------------
  const intentFit =
    aP.intent === bP.intent
      ? 1
      : bothWays(
          listScore(bP.intent, parseList(aPref.intents)),
          listScore(aP.intent, parseList(bPref.intents)),
        ) ?? 0.4;
  add(
    'intent',
    'What you’re looking for',
    intentFit,
    16,
    aP.intent === bP.intent
      ? 'You are both looking for the same kind of relationship.'
      : 'You are looking for slightly different things.',
  );

  // --- Location ------------------------------------------------------------
  const miles = distanceBetweenRegions(aP.ukRegion, bP.ukRegion);
  let locationScore: number | null = null;
  let locationDetail = 'Neither of you has set a location yet.';
  if (miles != null) {
    const cap = Math.min(
      aPref.maxDistanceMiles ?? 200,
      bPref.maxDistanceMiles ?? 200,
    );
    const withinBoth = miles <= cap;
    const relocationHelps = aP.willingToRelocate || bP.willingToRelocate;
    locationScore = withinBoth ? 1 : Math.max(relocationHelps ? 0.45 : 0.15, 1 - miles / 400);
    locationDetail =
      miles === 0
        ? 'You are in the same part of the UK.'
        : `About ${miles} miles apart.${!withinBoth && relocationHelps ? ' One of you is open to relocating.' : ''}`;
  }
  const regionListFit = bothWays(
    listScore(bP.ukRegion, parseList(aPref.ukRegions)),
    listScore(aP.ukRegion, parseList(bPref.ukRegions)),
  );
  if (regionListFit != null) {
    locationScore = locationScore == null ? regionListFit : (locationScore + regionListFit) / 2;
  }
  add('location', 'Where you live', locationScore, 13, locationDetail);

  // --- Heritage: clan, district, language ----------------------------------
  const advisory = sharedClanAdvisory(aP, bP);
  const exogamyMatters = aPref.observeClanExogamy || bPref.observeClanExogamy;
  let clanScore: number | null = null;
  let clanDetail = 'Clan not shared by both of you.';
  if (isSpecificClan(aP.clan) && isSpecificClan(bP.clan)) {
    if (advisory.shared && advisory.kind === 'PATERNAL') {
      clanScore = exogamyMatters ? 0 : 0.5;
      clanDetail = 'You share a thar — see the note on this match.';
    } else if (advisory.shared) {
      clanScore = exogamyMatters ? 0.35 : 0.7;
      clanDetail = 'There is a shared maternal clan line.';
    } else {
      clanScore = 1;
      clanDetail = 'Different thars, which most families prefer.';
    }
  }
  add('clan', 'Clan (thar)', clanScore, 12, clanDetail);

  const districtFit = bothWays(
    listScore(bP.ancestralDistrict, parseList(aPref.ancestralDistricts)),
    listScore(aP.ancestralDistrict, parseList(bPref.ancestralDistricts)),
  );
  const sameDistrict =
    aP.ancestralDistrict && aP.ancestralDistrict === bP.ancestralDistrict && aP.ancestralDistrict !== 'other';
  add(
    'roots',
    'Family roots',
    districtFit ?? (sameDistrict ? 1 : aP.ancestralDistrict && bP.ancestralDistrict ? 0.6 : null),
    7,
    sameDistrict ? 'Your families come from the same district.' : 'Roots in different districts.',
  );

  const sharedLanguages = overlapScore(parseList(aP.languages), parseList(bP.languages));
  const fluencyPair =
    aP.gurungFluency && bP.gurungFluency
      ? aP.gurungFluency === bP.gurungFluency
        ? 1
        : 0.7
      : null;
  const languageScore = bothWays(sharedLanguages, fluencyPair);
  add(
    'language',
    'Language',
    languageScore,
    8,
    sharedLanguages && sharedLanguages > 0.5
      ? 'You speak several of the same languages.'
      : 'Some overlap in the languages you speak.',
  );

  // --- Faith & values ------------------------------------------------------
  const religionFit =
    aP.religion && aP.religion === bP.religion
      ? 1
      : bothWays(
          listScore(bP.religion, parseList(aPref.religions)),
          listScore(aP.religion, parseList(bPref.religions)),
        );
  add(
    'religion',
    'Faith',
    religionFit,
    9,
    aP.religion && aP.religion === bP.religion ? 'You share the same faith.' : 'Different faiths.',
  );

  let valuesScore: number | null = null;
  if (aP.familyValues && bP.familyValues) {
    const order = ['TRADITIONAL', 'MODERATE', 'LIBERAL'];
    const gap = Math.abs(order.indexOf(aP.familyValues) - order.indexOf(bP.familyValues));
    valuesScore = gap === 0 ? 1 : gap === 1 ? 0.6 : 0.2;
  }
  add(
    'values',
    'Family values',
    valuesScore,
    9,
    valuesScore === 1 ? 'You describe your family values the same way.' : 'Different outlooks on family life.',
  );

  // --- Education & life stage ---------------------------------------------
  const educationFit = bothWays(
    listScore(bP.education, parseList(aPref.educationLevels)),
    listScore(aP.education, parseList(bPref.educationLevels)),
  );
  let educationProximity: number | null = null;
  if (aP.education && bP.education) {
    const ra = EDUCATION_RANK[aP.education as (typeof EDUCATION_LEVELS)[number]] ?? 1;
    const rb = EDUCATION_RANK[bP.education as (typeof EDUCATION_LEVELS)[number]] ?? 1;
    educationProximity = Math.max(0, 1 - Math.abs(ra - rb) / 4);
  }
  add(
    'education',
    'Education',
    bothWays(educationFit, educationProximity),
    7,
    educationProximity === 1 ? 'Similar level of education.' : 'Different educational backgrounds.',
  );

  const maritalFit = bothWays(
    listScore(bP.maritalStatus, parseList(aPref.maritalStatuses)),
    listScore(aP.maritalStatus, parseList(bPref.maritalStatuses)),
  );
  add('marital', 'Marital status', maritalFit, 6, 'Marital status against stated preferences.');

  // --- Lifestyle -----------------------------------------------------------
  const dietFit = bothWays(
    listScore(bP.diet, parseList(aPref.diets)),
    listScore(aP.diet, parseList(bPref.diets)),
  );
  const dietSame = aP.diet && aP.diet === bP.diet ? 1 : null;
  add(
    'diet',
    'Diet',
    bothWays(dietFit, dietSame),
    5,
    dietSame ? 'You eat the same way.' : 'Different diets.',
  );

  const habitsFit = bothWays(
    bothWays(habitScore(bP.smoking, aPref.maxSmoking), habitScore(bP.drinking, aPref.maxDrinking)),
    bothWays(habitScore(aP.smoking, bPref.maxSmoking), habitScore(aP.drinking, bPref.maxDrinking)),
  );
  add('habits', 'Smoking & drinking', habitsFit, 6, 'Habits against each other’s comfort levels.');

  // --- Practicalities ------------------------------------------------------
  const residencyFit = bothWays(
    listScore(bP.residencyStatus, parseList(aPref.residencyStatuses)),
    listScore(aP.residencyStatus, parseList(bPref.residencyStatuses)),
  );
  add('residency', 'Status in the UK', residencyFit, 4, 'UK status against stated preferences.');

  const heightFit = bothWays(
    rangeScore(bP.heightCm, aPref.heightMinCm, aPref.heightMaxCm, 12),
    rangeScore(aP.heightCm, bPref.heightMinCm, bPref.heightMaxCm, 12),
  );
  add('height', 'Height', heightFit, 4, 'Height against stated preferences.');

  const interestOverlap = overlapScore(parseList(aP.interests), parseList(bP.interests));
  add(
    'interests',
    'Shared interests',
    interestOverlap,
    10,
    interestOverlap && interestOverlap > 0.5
      ? 'You have several interests in common.'
      : 'A little overlap in your interests.',
  );

  // --- Aggregate -----------------------------------------------------------
  const scored = factors.filter((f) => f.score != null);
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const scoredWeight = scored.reduce((sum, f) => sum + f.weight, 0);

  const weightedSum = scored.reduce((sum, f) => sum + (f.score as number) * f.weight, 0);
  const base = scoredWeight > 0 ? weightedSum / scoredWeight : 0;

  // A verified profile on either side is a small, honest bump — it says the
  // person went through ID checks, not that they are a better match.
  const verificationBonus = (bP.verified ? 0.02 : 0) + (aP.verified ? 0.01 : 0);

  const score = Math.round(Math.min(1, base + verificationBonus) * 100);
  const coverage = Math.round((scoredWeight / totalWeight) * 100);

  const highlights = scored
    .filter((f) => (f.score as number) >= 0.75)
    .sort((x, y) => (y.score as number) * y.weight - (x.score as number) * x.weight)
    .slice(0, 4)
    .map((f) => f.detail);

  return { score, coverage, factors, highlights, advisory };
}
