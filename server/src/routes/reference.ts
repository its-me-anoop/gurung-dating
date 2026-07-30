import { Router } from 'express';
import { ANCESTRAL_DISTRICTS, CLANS, LANGUAGES, UK_REGIONS } from '../domain/gurung.js';
import {
  CHILDREN_LIVING_STATUSES,
  DIETS,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  FAMILY_TYPES,
  FAMILY_VALUES,
  FLUENCY_LEVELS,
  GENDERS,
  HABIT_LEVELS,
  HERITAGES,
  INCOME_BANDS,
  INTENTS,
  LABELS,
  MARITAL_STATUSES,
  PHOTO_VISIBILITIES,
  PROFILE_MANAGED_BY,
  RAISED_IN,
  RELIGIONS,
  REPORT_REASONS,
  RESIDENCY_STATUSES,
  VISIBILITIES,
} from '../domain/vocab.js';

export const referenceRouter = Router();

/** Turns a value tuple into `[{ value, label }]` using the shared label map. */
function options(kind: string, values: readonly string[]) {
  return values.map((value) => ({ value, label: LABELS[kind]?.[value] ?? value }));
}

/**
 * Everything the frontend needs to render its dropdowns. Served from the same
 * constants the validators are built from, so a form can never offer a value
 * the API would then reject. Cached hard — this changes only on deploy.
 */
referenceRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    clans: CLANS.map((c) => ({
      value: c.slug,
      label: c.name,
      group: c.group,
      groupLabel: LABELS.clanGroup?.[c.group] ?? c.group,
      aka: c.aka,
    })),
    clanGroups: options('clanGroup', ['CHAR_JAT', 'SOHRA_JAT', 'OTHER']),
    ancestralDistricts: ANCESTRAL_DISTRICTS.map((d) => ({
      value: d.slug,
      label: d.name,
      group: d.region,
    })),
    ukRegions: UK_REGIONS.map((r) => ({ value: r.slug, label: r.name, group: r.nation })),
    languages: LANGUAGES.map((l) => ({ value: l.slug, label: l.name })),

    genders: options('gender', GENDERS),
    maritalStatuses: options('maritalStatus', MARITAL_STATUSES),
    religions: options('religion', RELIGIONS),
    heritages: options('heritage', HERITAGES),
    gurungFluency: options('gurungFluency', FLUENCY_LEVELS),
    residencyStatuses: options('residencyStatus', RESIDENCY_STATUSES),
    raisedIn: options('raisedIn', RAISED_IN),
    educationLevels: options('education', EDUCATION_LEVELS),
    employmentStatuses: options('employmentStatus', EMPLOYMENT_STATUSES),
    incomeBands: options('incomeBand', INCOME_BANDS),
    diets: options('diet', DIETS),
    habits: options('habit', HABIT_LEVELS),
    familyTypes: options('familyType', FAMILY_TYPES),
    familyValues: options('familyValues', FAMILY_VALUES),
    intents: options('intent', INTENTS),
    visibilities: options('visibility', VISIBILITIES),
    photoVisibilities: options('photoVisibility', PHOTO_VISIBILITIES),
    profileManagedBy: options('profileManagedBy', PROFILE_MANAGED_BY),
    childrenLivingStatuses: options('childrenLivingStatus', CHILDREN_LIVING_STATUSES),
    reportReasons: options('reportReason', REPORT_REASONS),
  });
});
