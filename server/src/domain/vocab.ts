/**
 * Controlled vocabularies.
 *
 * SQLite has no enums, so these tuples are the single source of truth: zod
 * validators are derived from them, and the same lists are served to the
 * frontend from `/api/reference` so a dropdown can never drift from what the
 * API will accept.
 */

import { z } from 'zod';
import { ANCESTRAL_DISTRICTS, CLANS, LANGUAGES, UK_REGIONS } from './gurung.js';

/** Build a zod enum from a readonly tuple of options. */
function enumOf<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export const GENDERS = ['MALE', 'FEMALE'] as const;

export const MARITAL_STATUSES = [
  'NEVER_MARRIED',
  'DIVORCED',
  'WIDOWED',
  'SEPARATED',
  'ANNULLED',
] as const;

export const RELIGIONS = [
  'BUDDHIST',
  'HINDU',
  'BON',
  'CHRISTIAN',
  'SPIRITUAL',
  'NONE',
  'OTHER',
] as const;

export const FLUENCY_LEVELS = ['NATIVE', 'CONVERSATIONAL', 'BASIC', 'NONE'] as const;

export const HERITAGES = ['GURUNG', 'PART_GURUNG', 'OTHER_NEPALI', 'NOT_NEPALI'] as const;

/** The heritages the "Gurung heritage only" preference keeps. */
export const GURUNG_HERITAGES = ['GURUNG', 'PART_GURUNG'] as const;

export const RESIDENCY_STATUSES = [
  'BRITISH_CITIZEN',
  'SETTLED',
  'PRE_SETTLED',
  'SKILLED_WORKER',
  'STUDENT',
  'DEPENDANT',
  'OTHER',
] as const;

export const RAISED_IN = ['UK', 'NEPAL', 'HONG_KONG', 'BRUNEI', 'INDIA', 'OTHER'] as const;

export const EDUCATION_LEVELS = [
  'SECONDARY',
  'COLLEGE',
  'BACHELORS',
  'MASTERS',
  'DOCTORATE',
  'PROFESSIONAL',
  'OTHER',
] as const;

export const EMPLOYMENT_STATUSES = [
  'EMPLOYED',
  'SELF_EMPLOYED',
  'STUDENT',
  'BETWEEN_ROLES',
  'NOT_WORKING',
  'RETIRED',
] as const;

export const INCOME_BANDS = [
  'UNDER_25K',
  'K25_40',
  'K40_60',
  'K60_85',
  'K85_120',
  'OVER_120K',
  'PREFER_NOT_TO_SAY',
] as const;

export const DIETS = ['OMNIVORE', 'NO_BEEF', 'EGGETARIAN', 'VEGETARIAN', 'VEGAN'] as const;

export const HABIT_LEVELS = ['NEVER', 'OCCASIONALLY', 'SOCIALLY', 'REGULARLY'] as const;

export const FAMILY_TYPES = ['NUCLEAR', 'JOINT', 'LIVING_ALONE'] as const;

export const FAMILY_VALUES = ['TRADITIONAL', 'MODERATE', 'LIBERAL'] as const;

export const INTENTS = ['MARRIAGE', 'SERIOUS_RELATIONSHIP', 'FRIENDSHIP_FIRST'] as const;

export const VISIBILITIES = ['PUBLIC', 'MEMBERS_ONLY', 'CONNECTIONS_ONLY'] as const;

export const PHOTO_VISIBILITIES = ['EVERYONE', 'MEMBERS', 'CONNECTIONS'] as const;

export const PROFILE_MANAGED_BY = ['SELF', 'PARENT', 'SIBLING', 'RELATIVE', 'FRIEND'] as const;

export const CHILDREN_LIVING_STATUSES = ['LIVING_WITH_ME', 'NOT_LIVING_WITH_ME'] as const;

export const USER_ROLES = ['MEMBER', 'MODERATOR', 'ADMIN'] as const;

export const ACCOUNT_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
] as const;

export const INTEREST_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'] as const;

export const REPORT_REASONS = [
  'FAKE_PROFILE',
  'HARASSMENT',
  'INAPPROPRIATE_PHOTO',
  'SCAM',
  'UNDERAGE',
  'OTHER',
] as const;

export const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'] as const;

export const MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const NOTIFICATION_TYPES = [
  'INTEREST_RECEIVED',
  'INTEREST_ACCEPTED',
  'INTEREST_DECLINED',
  'NEW_MESSAGE',
  'PROFILE_VIEW',
  'PHOTO_APPROVED',
  'PHOTO_REJECTED',
  'PROFILE_VERIFIED',
  'SYSTEM',
] as const;

// --- zod validators ---------------------------------------------------------

export const zGender = enumOf(GENDERS);
export const zMaritalStatus = enumOf(MARITAL_STATUSES);
export const zReligion = enumOf(RELIGIONS);
export const zFluency = enumOf(FLUENCY_LEVELS);
export const zHeritage = enumOf(HERITAGES);
export const zResidencyStatus = enumOf(RESIDENCY_STATUSES);
export const zRaisedIn = enumOf(RAISED_IN);
export const zEducation = enumOf(EDUCATION_LEVELS);
export const zEmploymentStatus = enumOf(EMPLOYMENT_STATUSES);
export const zIncomeBand = enumOf(INCOME_BANDS);
export const zDiet = enumOf(DIETS);
export const zHabit = enumOf(HABIT_LEVELS);
export const zFamilyType = enumOf(FAMILY_TYPES);
export const zFamilyValues = enumOf(FAMILY_VALUES);
export const zIntent = enumOf(INTENTS);
export const zVisibility = enumOf(VISIBILITIES);
export const zPhotoVisibility = enumOf(PHOTO_VISIBILITIES);
export const zProfileManagedBy = enumOf(PROFILE_MANAGED_BY);
export const zChildrenLivingStatus = enumOf(CHILDREN_LIVING_STATUSES);
export const zReportReason = enumOf(REPORT_REASONS);
export const zReportStatus = enumOf(REPORT_STATUSES);
export const zModerationStatus = enumOf(MODERATION_STATUSES);
export const zAccountStatus = enumOf(ACCOUNT_STATUSES);
export const zUserRole = enumOf(USER_ROLES);

const clanSlugs = CLANS.map((c) => c.slug) as [string, ...string[]];
const districtSlugs = ANCESTRAL_DISTRICTS.map((d) => d.slug) as [string, ...string[]];
const regionSlugs = UK_REGIONS.map((r) => r.slug) as [string, ...string[]];
const languageSlugs = LANGUAGES.map((l) => l.slug) as [string, ...string[]];

export const zClan = enumOf(clanSlugs);
export const zDistrict = enumOf(districtSlugs);
export const zUkRegion = enumOf(regionSlugs);
export const zLanguage = enumOf(languageSlugs);

/** Ordinal rank for habit levels, so "at most SOCIALLY" is comparable. */
export const HABIT_RANK: Record<(typeof HABIT_LEVELS)[number], number> = {
  NEVER: 0,
  OCCASIONALLY: 1,
  SOCIALLY: 2,
  REGULARLY: 3,
};

/** Ordinal rank for education, used by the "similar or higher" preference. */
export const EDUCATION_RANK: Record<(typeof EDUCATION_LEVELS)[number], number> = {
  SECONDARY: 0,
  COLLEGE: 1,
  BACHELORS: 2,
  PROFESSIONAL: 3,
  MASTERS: 3,
  DOCTORATE: 4,
  OTHER: 1,
};

/**
 * Human-readable labels. The frontend gets these from `/api/reference` so that
 * one edit here changes every dropdown, filter chip and profile card at once.
 */
export const LABELS: Record<string, Record<string, string>> = {
  gender: { MALE: 'Male', FEMALE: 'Female' },
  maritalStatus: {
    NEVER_MARRIED: 'Never married',
    DIVORCED: 'Divorced',
    WIDOWED: 'Widowed',
    SEPARATED: 'Separated',
    ANNULLED: 'Annulled',
  },
  religion: {
    BUDDHIST: 'Buddhist',
    HINDU: 'Hindu',
    BON: 'Bon',
    CHRISTIAN: 'Christian',
    SPIRITUAL: 'Spiritual, not religious',
    NONE: 'Not religious',
    OTHER: 'Other',
  },
  heritage: {
    GURUNG: 'Gurung (Tamu)',
    PART_GURUNG: 'Part Gurung',
    OTHER_NEPALI: 'Nepali, not Gurung',
    NOT_NEPALI: 'Not Nepali',
  },
  gurungFluency: {
    NATIVE: 'Native / fluent',
    CONVERSATIONAL: 'Conversational',
    BASIC: 'A few words',
    NONE: 'Not at all',
  },
  residencyStatus: {
    BRITISH_CITIZEN: 'British citizen',
    SETTLED: 'Settled status / ILR',
    PRE_SETTLED: 'Pre-settled status',
    SKILLED_WORKER: 'Skilled worker visa',
    STUDENT: 'Student visa',
    DEPENDANT: 'Dependant visa',
    OTHER: 'Other',
  },
  raisedIn: {
    UK: 'The UK',
    NEPAL: 'Nepal',
    HONG_KONG: 'Hong Kong',
    BRUNEI: 'Brunei',
    INDIA: 'India',
    OTHER: 'Elsewhere',
  },
  education: {
    SECONDARY: 'Secondary school',
    COLLEGE: 'College / A-levels',
    BACHELORS: "Bachelor's degree",
    MASTERS: "Master's degree",
    DOCTORATE: 'Doctorate',
    PROFESSIONAL: 'Professional qualification',
    OTHER: 'Other',
  },
  employmentStatus: {
    EMPLOYED: 'Employed',
    SELF_EMPLOYED: 'Self-employed',
    STUDENT: 'Student',
    BETWEEN_ROLES: 'Between roles',
    NOT_WORKING: 'Not working',
    RETIRED: 'Retired',
  },
  incomeBand: {
    UNDER_25K: 'Under £25,000',
    K25_40: '£25,000 – £40,000',
    K40_60: '£40,000 – £60,000',
    K60_85: '£60,000 – £85,000',
    K85_120: '£85,000 – £120,000',
    OVER_120K: 'Over £120,000',
    PREFER_NOT_TO_SAY: 'Prefer not to say',
  },
  diet: {
    OMNIVORE: 'Eats everything',
    NO_BEEF: 'No beef',
    EGGETARIAN: 'Vegetarian + eggs',
    VEGETARIAN: 'Vegetarian',
    VEGAN: 'Vegan',
  },
  habit: {
    NEVER: 'Never',
    OCCASIONALLY: 'Occasionally',
    SOCIALLY: 'Socially',
    REGULARLY: 'Regularly',
  },
  familyType: { NUCLEAR: 'Nuclear family', JOINT: 'Joint family', LIVING_ALONE: 'Living alone' },
  familyValues: { TRADITIONAL: 'Traditional', MODERATE: 'Moderate', LIBERAL: 'Liberal' },
  intent: {
    MARRIAGE: 'Marriage',
    SERIOUS_RELATIONSHIP: 'A serious relationship',
    FRIENDSHIP_FIRST: 'Friendship first, see where it goes',
  },
  visibility: {
    PUBLIC: 'Anyone, including visitors',
    MEMBERS_ONLY: 'Signed-in members only',
    CONNECTIONS_ONLY: 'Only people I have connected with',
  },
  photoVisibility: {
    EVERYONE: 'Everyone',
    MEMBERS: 'Signed-in members',
    CONNECTIONS: 'Only my connections',
  },
  profileManagedBy: {
    SELF: 'Myself',
    PARENT: 'A parent',
    SIBLING: 'A sibling',
    RELATIVE: 'A relative',
    FRIEND: 'A friend',
  },
  childrenLivingStatus: {
    LIVING_WITH_ME: 'Living with me',
    NOT_LIVING_WITH_ME: 'Not living with me',
  },
  reportReason: {
    FAKE_PROFILE: 'Fake or impersonating profile',
    HARASSMENT: 'Harassment or abusive messages',
    INAPPROPRIATE_PHOTO: 'Inappropriate photo',
    SCAM: 'Scam or asking for money',
    UNDERAGE: 'Appears to be under 18',
    OTHER: 'Something else',
  },
  clanGroup: {
    CHAR_JAT: 'Char Jat',
    SOHRA_JAT: 'Sohra Jat',
    OTHER: 'Other',
  },
};

export function label(kind: string, value: string | null | undefined): string | null {
  if (!value) return null;
  return LABELS[kind]?.[value] ?? value;
}
