import { describe, expect, it } from 'vitest';
import {
  clanGroupOf,
  distanceBetweenRegions,
  sharedClanAdvisory,
} from '../src/domain/gurung.js';
import { ageFrom, computeCompatibility, type ScorablePreference, type ScorableProfile } from '../src/domain/matching.js';

function profile(overrides: Partial<ScorableProfile> = {}): ScorableProfile {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 30);
  dob.setDate(dob.getDate() - 10);

  return {
    gender: 'FEMALE',
    dateOfBirth: dob,
    heightCm: 160,
    maritalStatus: 'NEVER_MARRIED',
    clan: 'ghale',
    motherClan: 'toju',
    clanGroup: 'CHAR_JAT',
    ancestralDistrict: 'lamjung',
    religion: 'BUDDHIST',
    gurungFluency: 'CONVERSATIONAL',
    languages: JSON.stringify(['nepali', 'english', 'gurung']),
    ukRegion: 'hampshire',
    residencyStatus: 'BRITISH_CITIZEN',
    education: 'BACHELORS',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyValues: 'MODERATE',
    intent: 'MARRIAGE',
    interests: JSON.stringify(['hiking', 'cooking', 'travel']),
    verified: false,
    willingToRelocate: false,
    ...overrides,
  };
}

function preference(overrides: Partial<ScorablePreference> = {}): ScorablePreference {
  return {
    ageMin: 25,
    ageMax: 38,
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
    ...overrides,
  };
}

describe('ageFrom', () => {
  it('does not count a birthday that has not happened yet this year', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    const dob = new Date('1996-06-15T00:00:00Z');
    expect(ageFrom(dob, now)).toBe(29);
  });

  it('counts the birthday on the day itself', () => {
    const now = new Date('2026-06-15T00:00:00Z');
    const dob = new Date('1996-06-15T00:00:00Z');
    expect(ageFrom(dob, now)).toBe(30);
  });
});

describe('computeCompatibility', () => {
  it('is symmetric — A scoring B equals B scoring A', () => {
    const a = { profile: profile({ gender: 'FEMALE' }), preference: preference() };
    const b = {
      profile: profile({ gender: 'MALE', clan: 'toju', motherClan: 'kugi', ukRegion: 'kent' }),
      preference: preference({ ageMin: 24, ageMax: 34 }),
    };

    expect(computeCompatibility(a, b).score).toBe(computeCompatibility(b, a).score);
  });

  it('scores a well-aligned pair far above a poorly-aligned one', () => {
    const self = { profile: profile(), preference: preference() };

    const aligned = {
      profile: profile({
        gender: 'MALE',
        clan: 'lama',
        motherClan: 'kugi',
        ukRegion: 'hampshire',
        interests: JSON.stringify(['hiking', 'cooking', 'travel']),
      }),
      preference: preference(),
    };

    const misaligned = {
      profile: profile({
        gender: 'MALE',
        clan: 'lama',
        motherClan: 'kugi',
        ukRegion: 'north-scotland',
        religion: 'CHRISTIAN',
        familyValues: 'TRADITIONAL',
        diet: 'VEGAN',
        intent: 'FRIENDSHIP_FIRST',
        interests: JSON.stringify(['darts']),
        languages: JSON.stringify(['english']),
      }),
      preference: preference({ ageMin: 18, ageMax: 22 }),
    };

    const good = computeCompatibility(self, aligned).score;
    const bad = computeCompatibility(self, misaligned).score;

    expect(good).toBeGreaterThan(bad + 20);
  });

  it('skips factors with no data rather than scoring them zero', () => {
    const rich = { profile: profile(), preference: preference() };
    const sparse = {
      profile: profile({
        gender: 'MALE',
        clan: null,
        motherClan: null,
        religion: null,
        diet: null,
        education: null,
        familyValues: null,
        ukRegion: null,
        residencyStatus: null,
        heightCm: null,
        interests: '[]',
        languages: '[]',
        gurungFluency: null,
        ancestralDistrict: null,
      }),
      preference: null,
    };

    const result = computeCompatibility(rich, sparse);

    // Coverage falls because little was stated, but the score is not dragged
    // to the floor by the absence of data.
    expect(result.coverage).toBeLessThan(60);
    expect(result.score).toBeGreaterThan(30);
    expect(result.factors.filter((f) => f.score === null).length).toBeGreaterThan(4);
  });

  it('penalises a shared thar when either side observes clan exogamy', () => {
    const self = { profile: profile({ clan: 'ghale' }), preference: preference() };

    const sameClan = {
      profile: profile({ gender: 'MALE', clan: 'ghale', motherClan: 'kugi' }),
      preference: preference(),
    };
    const differentClan = {
      profile: profile({ gender: 'MALE', clan: 'lama', motherClan: 'kugi' }),
      preference: preference(),
    };

    const shared = computeCompatibility(self, sameClan);
    const distinct = computeCompatibility(self, differentClan);

    expect(shared.advisory.shared).toBe(true);
    expect(shared.advisory.kind).toBe('PATERNAL');
    expect(shared.score).toBeLessThan(distinct.score);
  });

  it('does not penalise a shared thar when both sides have switched exogamy off', () => {
    const pref = preference({ observeClanExogamy: false });
    const self = { profile: profile({ clan: 'ghale', motherClan: 'kugi' }), preference: pref };
    const other = {
      profile: profile({ gender: 'MALE', clan: 'ghale', motherClan: 'kugi' }),
      preference: pref,
    };

    const clanFactor = computeCompatibility(self, other).factors.find((f) => f.key === 'clan');
    expect(clanFactor?.score).toBe(0.5);
  });

  it('never returns a score outside 0-100', () => {
    const extremes = [
      computeCompatibility(
        { profile: profile({ verified: true }), preference: preference() },
        { profile: profile({ gender: 'MALE', verified: true, clan: 'lama' }), preference: preference() },
      ),
      computeCompatibility(
        { profile: profile(), preference: preference({ ageMin: 60, ageMax: 65 }) },
        { profile: profile({ gender: 'MALE' }), preference: preference({ ageMin: 60, ageMax: 65 }) },
      ),
    ];

    for (const r of extremes) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('sharedClanAdvisory', () => {
  it('flags a shared paternal thar', () => {
    const result = sharedClanAdvisory({ clan: 'ghale' }, { clan: 'ghale' });
    expect(result).toMatchObject({ shared: true, kind: 'PATERNAL', clan: 'ghale' });
    expect(result.message).toContain('Ghale');
  });

  it('flags a maternal line crossing a paternal one', () => {
    const result = sharedClanAdvisory({ motherClan: 'toju' }, { clan: 'toju' });
    expect(result).toMatchObject({ shared: true, kind: 'MATERNAL' });
  });

  it('ignores the placeholder clan values', () => {
    expect(sharedClanAdvisory({ clan: 'other' }, { clan: 'other' }).shared).toBe(false);
    expect(
      sharedClanAdvisory({ clan: 'prefer-not-to-say' }, { clan: 'prefer-not-to-say' }).shared,
    ).toBe(false);
  });

  it('reports nothing for unrelated clans', () => {
    expect(sharedClanAdvisory({ clan: 'ghale' }, { clan: 'toju' }).shared).toBe(false);
  });
});

describe('reference data', () => {
  it('maps clans to their jat grouping', () => {
    expect(clanGroupOf('ghale')).toBe('CHAR_JAT');
    expect(clanGroupOf('kromchhe')).toBe('SOHRA_JAT');
    expect(clanGroupOf('nonsense')).toBeNull();
  });

  it('measures distance between UK regions', () => {
    expect(distanceBetweenRegions('hampshire', 'hampshire')).toBe(0);
    expect(distanceBetweenRegions('greater-london', 'central-scotland')).toBeGreaterThan(300);
    expect(distanceBetweenRegions('greater-london', undefined)).toBeNull();
  });
});
