import type { Photo, Preference, Profile, User } from '@prisma/client';
import { parseList } from '../lib/json.js';
import { clanGroupOf, clanLabel, regionLabel } from './gurung.js';
import { ageFrom } from './matching.js';
import { label } from './vocab.js';

/**
 * Profile completeness, 0-100.
 *
 * The weights say what a profile needs to be genuinely useful to someone
 * reading it — a photo and a few sentences of writing count for far more than
 * another dropdown. Members see this as a progress ring, and it breaks ties in
 * discovery ranking so half-finished profiles don't crowd out real ones.
 */
const COMPLETENESS_FIELDS: Array<{ weight: number; has: (p: ProfileWithPhotos) => boolean }> = [
  { weight: 6, has: (p) => Boolean(p.displayName) },
  { weight: 6, has: (p) => Boolean(p.dateOfBirth) },
  { weight: 12, has: (p) => (p.photos?.length ?? 0) > 0 },
  { weight: 5, has: (p) => (p.photos?.length ?? 0) >= 3 },
  { weight: 12, has: (p) => (p.about?.trim().length ?? 0) >= 120 },
  { weight: 6, has: (p) => (p.headline?.trim().length ?? 0) >= 10 },
  { weight: 6, has: (p) => (p.lookingFor?.trim().length ?? 0) >= 60 },
  { weight: 5, has: (p) => parseList(p.interests).length >= 3 },
  { weight: 5, has: (p) => Boolean(p.clan) },
  { weight: 3, has: (p) => Boolean(p.ancestralDistrict) },
  { weight: 5, has: (p) => Boolean(p.ukRegion) },
  { weight: 3, has: (p) => Boolean(p.city) },
  { weight: 4, has: (p) => Boolean(p.occupation) },
  { weight: 4, has: (p) => Boolean(p.education) },
  { weight: 3, has: (p) => Boolean(p.heightCm) },
  { weight: 3, has: (p) => Boolean(p.religion) },
  { weight: 3, has: (p) => parseList(p.languages).length > 0 },
  { weight: 3, has: (p) => Boolean(p.diet) },
  { weight: 3, has: (p) => Boolean(p.residencyStatus) },
  { weight: 3, has: (p) => Boolean(p.familyType) || Boolean(p.familyBasedIn) },
];

type ProfileWithPhotos = Profile & { photos?: Photo[] };

export function computeCompleteness(profile: ProfileWithPhotos): number {
  const total = COMPLETENESS_FIELDS.reduce((s, f) => s + f.weight, 0);
  const earned = COMPLETENESS_FIELDS.reduce((s, f) => (f.has(profile) ? s + f.weight : s), 0);
  return Math.round((earned / total) * 100);
}

/** The next few things a member could do to improve their profile. */
export function completenessSuggestions(profile: ProfileWithPhotos): string[] {
  const out: string[] = [];
  if ((profile.photos?.length ?? 0) === 0) out.push('Add a photo — profiles with photos get far more interest.');
  else if ((profile.photos?.length ?? 0) < 3) out.push('Add a couple more photos so people get a fuller picture.');
  if ((profile.about?.trim().length ?? 0) < 120) out.push('Write a little more in your “About me”.');
  if ((profile.lookingFor?.trim().length ?? 0) < 60) out.push('Say what you’re looking for in a partner.');
  if (parseList(profile.interests).length < 3) out.push('Add a few interests — they’re the easiest conversation starter.');
  if (!profile.clan) out.push('Add your thar so clan-aware matching works.');
  if (!profile.ukRegion) out.push('Set where in the UK you live.');
  if (!profile.occupation) out.push('Add what you do for work.');
  return out.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export interface PhotoDto {
  id: string;
  url: string;
  thumbnail: string | null;
  caption: string | null;
  isPrimary: boolean;
  visibility: string;
  moderationStatus: string;
  position: number;
}

export function photoDto(photo: Photo): PhotoDto {
  return {
    id: photo.id,
    url: `/api/photos/${photo.id}/file`,
    thumbnail: photo.thumbnail,
    caption: photo.caption,
    isPrimary: photo.isPrimary,
    visibility: photo.visibility,
    moderationStatus: photo.moderationStatus,
    position: photo.position,
  };
}

export type ProfileRecord = Profile & {
  photos?: Photo[];
  user?: Pick<User, 'id' | 'lastActiveAt' | 'status' | 'createdAt'>;
  preference?: Preference | null;
};

/** Fields any signed-in member may see. Contact details are never included. */
export function publicProfileDto(p: ProfileRecord, viewerCanSeeConnectionPhotos = false) {
  const photos = (p.photos ?? [])
    .filter((ph) => ph.moderationStatus === 'APPROVED')
    .filter((ph) => ph.visibility !== 'CONNECTIONS' || viewerCanSeeConnectionPhotos)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
    .map(photoDto);

  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    gender: p.gender,
    age: ageFrom(p.dateOfBirth),
    heightCm: p.heightCm,
    maritalStatus: p.maritalStatus,
    maritalStatusLabel: label('maritalStatus', p.maritalStatus),
    hasChildren: p.hasChildren,
    childrenLivingStatus: p.childrenLivingStatus,

    heritage: p.heritage,
    heritageLabel: label('heritage', p.heritage),
    clan: p.clan,
    clanLabel: clanLabel(p.clan),
    clanGroup: p.clanGroup,
    motherClan: p.motherClan,
    motherClanLabel: clanLabel(p.motherClan),
    ancestralDistrict: p.ancestralDistrict,
    religion: p.religion,
    religionLabel: label('religion', p.religion),
    motherTongue: p.motherTongue,
    gurungFluency: p.gurungFluency,
    gurungFluencyLabel: label('gurungFluency', p.gurungFluency),
    languages: parseList(p.languages),

    ukRegion: p.ukRegion,
    ukRegionLabel: regionLabel(p.ukRegion),
    city: p.city,
    postcodeArea: p.postcodeArea,
    residencyStatus: p.residencyStatus,
    residencyStatusLabel: label('residencyStatus', p.residencyStatus),
    yearsInUk: p.yearsInUk,
    raisedIn: p.raisedIn,
    raisedInLabel: label('raisedIn', p.raisedIn),
    serviceFamily: p.serviceFamily,
    willingToRelocate: p.willingToRelocate,

    education: p.education,
    educationLabel: label('education', p.education),
    fieldOfStudy: p.fieldOfStudy,
    occupation: p.occupation,
    employmentStatus: p.employmentStatus,
    employmentStatusLabel: label('employmentStatus', p.employmentStatus),
    incomeBand: p.incomeBand === 'PREFER_NOT_TO_SAY' ? null : p.incomeBand,
    incomeBandLabel: p.incomeBand === 'PREFER_NOT_TO_SAY' ? null : label('incomeBand', p.incomeBand),

    diet: p.diet,
    dietLabel: label('diet', p.diet),
    smoking: p.smoking,
    smokingLabel: label('habit', p.smoking),
    drinking: p.drinking,
    drinkingLabel: label('habit', p.drinking),

    familyType: p.familyType,
    familyTypeLabel: label('familyType', p.familyType),
    familyValues: p.familyValues,
    familyValuesLabel: label('familyValues', p.familyValues),
    fatherOccupation: p.fatherOccupation,
    motherOccupation: p.motherOccupation,
    brothers: p.brothers,
    sisters: p.sisters,
    familyBasedIn: p.familyBasedIn,

    headline: p.headline,
    about: p.about,
    interests: parseList(p.interests),
    lookingFor: p.lookingFor,

    intent: p.intent,
    intentLabel: label('intent', p.intent),
    profileManagedBy: p.profileManagedBy,
    verified: p.verified,
    completeness: p.completeness,
    photos,
    primaryPhoto: photos.find((ph) => ph.isPrimary) ?? photos[0] ?? null,
    lastActiveAt: p.user?.lastActiveAt ?? null,
    memberSince: p.user?.createdAt ?? p.createdAt,
  };
}

/** Everything above plus the private fields the owner needs to edit. */
export function ownProfileDto(p: ProfileRecord) {
  const base = publicProfileDto(p, true);
  return {
    ...base,
    dateOfBirth: p.dateOfBirth,
    incomeBand: p.incomeBand,
    incomeBandLabel: label('incomeBand', p.incomeBand),
    visibility: p.visibility,
    // Owners see their pending/rejected photos too, so they know what happened.
    photos: (p.photos ?? [])
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
      .map(photoDto),
    completenessSuggestions: completenessSuggestions(p),
    preference: p.preference ? preferenceDto(p.preference) : null,
  };
}

export function preferenceDto(pref: Preference) {
  return {
    ageMin: pref.ageMin,
    ageMax: pref.ageMax,
    heightMinCm: pref.heightMinCm,
    heightMaxCm: pref.heightMaxCm,
    maritalStatuses: parseList(pref.maritalStatuses),
    religions: parseList(pref.religions),
    ukRegions: parseList(pref.ukRegions),
    educationLevels: parseList(pref.educationLevels),
    diets: parseList(pref.diets),
    residencyStatuses: parseList(pref.residencyStatuses),
    ancestralDistricts: parseList(pref.ancestralDistricts),
    clanGroups: parseList(pref.clanGroups),
    intents: parseList(pref.intents),
    maxSmoking: pref.maxSmoking,
    maxDrinking: pref.maxDrinking,
    gurungHeritageOnly: pref.gurungHeritageOnly,
    observeClanExogamy: pref.observeClanExogamy,
    verifiedOnly: pref.verifiedOnly,
    ukBasedFamilyOnly: pref.ukBasedFamilyOnly,
    maxDistanceMiles: pref.maxDistanceMiles,
  };
}

/** Compact shape for grids and lists. */
export function profileCardDto(
  p: ProfileRecord,
  extras: { compatibility?: number; isShortlisted?: boolean; interestStatus?: string | null } = {},
) {
  const full = publicProfileDto(p);
  return {
    id: full.id,
    userId: full.userId,
    displayName: full.displayName,
    age: full.age,
    heightCm: full.heightCm,
    clan: full.clan,
    clanLabel: full.clanLabel,
    ukRegion: full.ukRegion,
    ukRegionLabel: full.ukRegionLabel,
    city: full.city,
    occupation: full.occupation,
    education: full.education,
    educationLabel: full.educationLabel,
    religionLabel: full.religionLabel,
    intent: full.intent,
    intentLabel: full.intentLabel,
    headline: full.headline,
    interests: full.interests.slice(0, 5),
    verified: full.verified,
    completeness: full.completeness,
    primaryPhoto: full.primaryPhoto,
    photoCount: full.photos.length,
    lastActiveAt: full.lastActiveAt,
    ...extras,
  };
}

/** Derive the denormalised clanGroup column whenever `clan` is written. */
export function deriveClanGroup(clan: string | null | undefined): string | null {
  return clanGroupOf(clan);
}

/** Members must be at least this old; enforced on registration and on edit. */
export function isOldEnough(dateOfBirth: Date, minAge: number, now = new Date()): boolean {
  return ageFrom(dateOfBirth, now) >= minAge;
}
