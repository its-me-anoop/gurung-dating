/**
 * Tamu (Gurung) reference data.
 *
 * A note on the clan list: Gurung clan (thar) names have many romanised
 * spellings, and which thars belong to the Char Jat ("four clans") versus the
 * Sohra Jat ("sixteen clans") is recorded differently from valley to valley and
 * lineage to lineage. This list is a starting point drawn from the commonly
 * cited groupings, with alternate spellings attached so search still finds a
 * clan when a member types the variant they grew up with. It is deliberately
 * data rather than logic: it should be reviewed with community elders before
 * launch, and `OTHER` always remains available so nobody is forced into a
 * bucket that does not fit them.
 *
 * The app never uses clan to gate access. It is used for two things only:
 * an optional discovery filter, and the exogamy advisory that flags when two
 * profiles share a thar (see `sharedClanAdvisory`).
 */

export type ClanGroup = 'CHAR_JAT' | 'SOHRA_JAT' | 'OTHER';

export interface Clan {
  slug: string;
  name: string;
  group: ClanGroup;
  /** Alternate romanisations, matched case-insensitively during search. */
  aka: string[];
}

export const CLANS: Clan[] = [
  // --- Char Jat -------------------------------------------------------------
  { slug: 'ghale', name: 'Ghale', group: 'CHAR_JAT', aka: ['Kle', 'Ghalé'] },
  { slug: 'ghotane', name: 'Ghotane', group: 'CHAR_JAT', aka: ['Ghodane', 'Ghotani'] },
  { slug: 'lama', name: 'Lama', group: 'CHAR_JAT', aka: ['Lamgi', 'Lam'] },
  { slug: 'lamichhane', name: 'Lamichhane', group: 'CHAR_JAT', aka: ['Lemgi', 'Lem', 'Lamichane'] },

  // --- Sohra Jat ------------------------------------------------------------
  { slug: 'kromchhe', name: 'Kromchhe', group: 'SOHRA_JAT', aka: ['Kromche', 'Kromje'] },
  { slug: 'toju', name: 'Toju', group: 'SOHRA_JAT', aka: ['Tohju', 'Todzo'] },
  { slug: 'pahim', name: 'Pahim', group: 'SOHRA_JAT', aka: ['Plon', 'Palmi'] },
  { slug: 'kyapchhe', name: 'Kyapchhe', group: 'SOHRA_JAT', aka: ['Kyabja', 'Kyapche'] },
  { slug: 'chyoje', name: 'Chyoje', group: 'SOHRA_JAT', aka: ['Chirmi', 'Chyome'] },
  { slug: 'lemchane', name: 'Lemchane', group: 'SOHRA_JAT', aka: ['Lemchhane'] },
  { slug: 'kugi', name: 'Kugi', group: 'SOHRA_JAT', aka: ['Kuji'] },
  { slug: 'neuchhe', name: 'Neuchhe', group: 'SOHRA_JAT', aka: ['Ngyoje', 'Newchhe'] },
  { slug: 'thagu', name: 'Thagu', group: 'SOHRA_JAT', aka: ['Thak'] },
  { slug: 'mudi', name: 'Mudi', group: 'SOHRA_JAT', aka: ['Mudee'] },
  { slug: 'chyapa', name: 'Chyapa', group: 'SOHRA_JAT', aka: ['Chapa'] },
  { slug: 'kyamje', name: 'Kyamje', group: 'SOHRA_JAT', aka: ['Kyamce'] },
  { slug: 'warchhe', name: 'Warchhe', group: 'SOHRA_JAT', aka: ['Warche'] },
  { slug: 'yoj', name: 'Yoj', group: 'SOHRA_JAT', aka: ['Yoje'] },
  { slug: 'mahar', name: 'Mahar', group: 'SOHRA_JAT', aka: ['Maharjan-Tamu'] },
  { slug: 'pachyu', name: 'Pachyu', group: 'SOHRA_JAT', aka: ['Paju'] },

  // --- Escape hatch ---------------------------------------------------------
  { slug: 'other', name: 'Other / not listed', group: 'OTHER', aka: [] },
  { slug: 'prefer-not-to-say', name: 'Prefer not to say', group: 'OTHER', aka: [] },
];

const CLAN_BY_SLUG = new Map(CLANS.map((c) => [c.slug, c]));

export function findClan(slug: string | null | undefined): Clan | undefined {
  if (!slug) return undefined;
  return CLAN_BY_SLUG.get(slug);
}

export function clanGroupOf(slug: string | null | undefined): ClanGroup | null {
  return findClan(slug)?.group ?? null;
}

export function clanLabel(slug: string | null | undefined): string | null {
  return findClan(slug)?.name ?? null;
}

/** Clan slugs that carry real lineage meaning — `other` and the opt-outs don't. */
export function isSpecificClan(slug: string | null | undefined): boolean {
  return Boolean(slug) && slug !== 'other' && slug !== 'prefer-not-to-say';
}

export interface SharedClanAdvisory {
  shared: boolean;
  /** `PATERNAL` when both list the same thar, `MATERNAL` when a maternal line matches. */
  kind: 'PATERNAL' | 'MATERNAL' | null;
  clan: string | null;
  message: string | null;
}

/**
 * Customarily, Gurungs marry outside their own thar, and a shared maternal line
 * is also worth knowing about. This returns an advisory, never a block: the app
 * surfaces it as a note on the profile and lets members decide for themselves.
 */
export function sharedClanAdvisory(
  a: { clan?: string | null; motherClan?: string | null },
  b: { clan?: string | null; motherClan?: string | null },
): SharedClanAdvisory {
  const none: SharedClanAdvisory = { shared: false, kind: null, clan: null, message: null };

  if (isSpecificClan(a.clan) && a.clan === b.clan) {
    return {
      shared: true,
      kind: 'PATERNAL',
      clan: a.clan!,
      message: `You both list ${clanLabel(a.clan)} as your thar. Many families prefer to marry outside their own clan — worth a conversation early on.`,
    };
  }

  const maternalMatch =
    (isSpecificClan(a.motherClan) && a.motherClan === b.motherClan) ||
    (isSpecificClan(a.motherClan) && a.motherClan === b.clan) ||
    (isSpecificClan(a.clan) && a.clan === b.motherClan);

  if (maternalMatch) {
    const clan = (isSpecificClan(a.motherClan) ? a.motherClan : a.clan) ?? null;
    return {
      shared: true,
      kind: 'MATERNAL',
      clan,
      message: `There is a shared maternal clan line (${clanLabel(clan)}). Customs on this vary between families — something to check with yours.`,
    };
  }

  return none;
}

// ---------------------------------------------------------------------------
// Ancestral districts in Nepal
// ---------------------------------------------------------------------------

export interface District {
  slug: string;
  name: string;
  /** Broad area, useful for grouping in the UI. */
  region: string;
}

export const ANCESTRAL_DISTRICTS: District[] = [
  { slug: 'gorkha', name: 'Gorkha', region: 'Gandaki' },
  { slug: 'lamjung', name: 'Lamjung', region: 'Gandaki' },
  { slug: 'kaski', name: 'Kaski (Pokhara)', region: 'Gandaki' },
  { slug: 'syangja', name: 'Syangja', region: 'Gandaki' },
  { slug: 'tanahun', name: 'Tanahun', region: 'Gandaki' },
  { slug: 'manang', name: 'Manang', region: 'Gandaki' },
  { slug: 'mustang', name: 'Mustang', region: 'Gandaki' },
  { slug: 'parbat', name: 'Parbat', region: 'Gandaki' },
  { slug: 'baglung', name: 'Baglung', region: 'Gandaki' },
  { slug: 'myagdi', name: 'Myagdi', region: 'Gandaki' },
  { slug: 'nawalparasi', name: 'Nawalparasi', region: 'Gandaki / Lumbini' },
  { slug: 'dhading', name: 'Dhading', region: 'Bagmati' },
  { slug: 'nuwakot', name: 'Nuwakot', region: 'Bagmati' },
  { slug: 'rasuwa', name: 'Rasuwa', region: 'Bagmati' },
  { slug: 'sindhupalchok', name: 'Sindhupalchok', region: 'Bagmati' },
  { slug: 'kathmandu', name: 'Kathmandu', region: 'Bagmati' },
  { slug: 'chitwan', name: 'Chitwan', region: 'Bagmati' },
  { slug: 'palpa', name: 'Palpa', region: 'Lumbini' },
  { slug: 'gulmi', name: 'Gulmi', region: 'Lumbini' },
  { slug: 'ilam', name: 'Ilam', region: 'Koshi' },
  { slug: 'sikkim-darjeeling', name: 'Sikkim / Darjeeling', region: 'India' },
  { slug: 'other', name: 'Other / not listed', region: 'Other' },
];

// ---------------------------------------------------------------------------
// UK regions — weighted towards where the Nepali/Gurkha community actually settled
// ---------------------------------------------------------------------------

export interface UkRegion {
  slug: string;
  name: string;
  nation: 'England' | 'Scotland' | 'Wales' | 'Northern Ireland';
  /** Rough centroid, used for the distance filter. */
  lat: number;
  lng: number;
}

export const UK_REGIONS: UkRegion[] = [
  { slug: 'greater-london', name: 'Greater London', nation: 'England', lat: 51.5074, lng: -0.1278 },
  { slug: 'hampshire', name: 'Hampshire (Aldershot & Farnborough)', nation: 'England', lat: 51.2483, lng: -0.7594 },
  { slug: 'kent', name: 'Kent (Folkestone & Ashford)', nation: 'England', lat: 51.0798, lng: 1.1699 },
  { slug: 'wiltshire', name: 'Wiltshire (Salisbury & Tidworth)', nation: 'England', lat: 51.2333, lng: -1.7947 },
  { slug: 'surrey', name: 'Surrey', nation: 'England', lat: 51.2362, lng: -0.5704 },
  { slug: 'berkshire', name: 'Berkshire (Reading & Bracknell)', nation: 'England', lat: 51.4543, lng: -0.9781 },
  { slug: 'oxfordshire', name: 'Oxfordshire', nation: 'England', lat: 51.752, lng: -1.2577 },
  { slug: 'buckinghamshire', name: 'Buckinghamshire', nation: 'England', lat: 51.8168, lng: -0.8124 },
  { slug: 'west-midlands', name: 'West Midlands (Birmingham & Coventry)', nation: 'England', lat: 52.4862, lng: -1.8904 },
  { slug: 'greater-manchester', name: 'Greater Manchester', nation: 'England', lat: 53.4808, lng: -2.2426 },
  { slug: 'merseyside', name: 'Merseyside (Liverpool)', nation: 'England', lat: 53.4084, lng: -2.9916 },
  { slug: 'west-yorkshire', name: 'West Yorkshire (Leeds & Bradford)', nation: 'England', lat: 53.8008, lng: -1.5491 },
  { slug: 'south-yorkshire', name: 'South Yorkshire (Sheffield)', nation: 'England', lat: 53.3811, lng: -1.4701 },
  { slug: 'tyne-and-wear', name: 'Tyne & Wear (Newcastle)', nation: 'England', lat: 54.9783, lng: -1.6178 },
  { slug: 'essex', name: 'Essex', nation: 'England', lat: 51.7343, lng: 0.4691 },
  { slug: 'hertfordshire', name: 'Hertfordshire', nation: 'England', lat: 51.8098, lng: -0.2377 },
  { slug: 'bedfordshire', name: 'Bedfordshire (Luton & Bedford)', nation: 'England', lat: 51.8787, lng: -0.4200 },
  { slug: 'cambridgeshire', name: 'Cambridgeshire', nation: 'England', lat: 52.2053, lng: 0.1218 },
  { slug: 'dorset', name: 'Dorset (Bournemouth & Poole)', nation: 'England', lat: 50.7192, lng: -1.8808 },
  { slug: 'devon', name: 'Devon (Plymouth & Exeter)', nation: 'England', lat: 50.3755, lng: -4.1427 },
  { slug: 'bristol-somerset', name: 'Bristol & Somerset', nation: 'England', lat: 51.4545, lng: -2.5879 },
  { slug: 'east-sussex', name: 'East Sussex (Brighton & Hastings)', nation: 'England', lat: 50.8225, lng: -0.1372 },
  { slug: 'west-sussex', name: 'West Sussex (Crawley & Chichester)', nation: 'England', lat: 50.9097, lng: -0.7500 },
  { slug: 'norfolk-suffolk', name: 'Norfolk & Suffolk', nation: 'England', lat: 52.6309, lng: 1.2974 },
  { slug: 'nottinghamshire', name: 'Nottinghamshire', nation: 'England', lat: 52.9548, lng: -1.1581 },
  { slug: 'leicestershire', name: 'Leicestershire', nation: 'England', lat: 52.6369, lng: -1.1398 },
  { slug: 'north-wales', name: 'North Wales', nation: 'Wales', lat: 53.2274, lng: -3.8266 },
  { slug: 'south-wales', name: 'South Wales (Cardiff & Newport)', nation: 'Wales', lat: 51.4816, lng: -3.1791 },
  { slug: 'central-scotland', name: 'Central Scotland (Glasgow & Edinburgh)', nation: 'Scotland', lat: 55.8642, lng: -4.2518 },
  { slug: 'north-scotland', name: 'North Scotland (Aberdeen & Inverness)', nation: 'Scotland', lat: 57.1497, lng: -2.0943 },
  { slug: 'northern-ireland', name: 'Northern Ireland', nation: 'Northern Ireland', lat: 54.5973, lng: -5.9301 },
  { slug: 'other-uk', name: 'Elsewhere in the UK', nation: 'England', lat: 52.3555, lng: -1.1743 },
];

const REGION_BY_SLUG = new Map(UK_REGIONS.map((r) => [r.slug, r]));

export function findRegion(slug: string | null | undefined): UkRegion | undefined {
  if (!slug) return undefined;
  return REGION_BY_SLUG.get(slug);
}

export function regionLabel(slug: string | null | undefined): string | null {
  return findRegion(slug)?.name ?? null;
}

/** Great-circle distance in miles between two UK region centroids. */
export function distanceBetweenRegions(a?: string | null, b?: string | null): number | null {
  const ra = findRegion(a);
  const rb = findRegion(b);
  if (!ra || !rb) return null;
  if (ra.slug === rb.slug) return 0;

  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(rb.lat - ra.lat);
  const dLng = toRad(rb.lng - ra.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(ra.lat)) * Math.cos(toRad(rb.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export const LANGUAGES = [
  { slug: 'gurung', name: 'Gurung (Tamu Kyi)' },
  { slug: 'nepali', name: 'Nepali' },
  { slug: 'english', name: 'English' },
  { slug: 'hindi', name: 'Hindi' },
  { slug: 'magar', name: 'Magar' },
  { slug: 'tamang', name: 'Tamang' },
  { slug: 'newari', name: 'Newari' },
  { slug: 'limbu', name: 'Limbu' },
  { slug: 'rai-bantawa', name: 'Rai (Bantawa)' },
  { slug: 'tibetan', name: 'Tibetan' },
  { slug: 'cantonese', name: 'Cantonese' },
  { slug: 'malay', name: 'Malay' },
  { slug: 'welsh', name: 'Welsh' },
  { slug: 'other', name: 'Other' },
] as const;
