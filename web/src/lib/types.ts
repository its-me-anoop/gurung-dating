/** Shapes returned by the API. Kept close to the server DTOs in `domain/profile.ts`. */

export interface Photo {
  id: string;
  url: string;
  thumbnail: string | null;
  caption: string | null;
  isPrimary: boolean;
  visibility: string;
  moderationStatus: string;
  position: number;
}

export interface ProfileCard {
  id: string;
  userId: string;
  displayName: string;
  age: number;
  heightCm: number | null;
  clan: string | null;
  clanLabel: string | null;
  ukRegion: string | null;
  ukRegionLabel: string | null;
  city: string | null;
  occupation: string | null;
  education: string | null;
  educationLabel: string | null;
  religionLabel: string | null;
  intent: string;
  intentLabel: string | null;
  headline: string | null;
  interests: string[];
  verified: boolean;
  completeness: number;
  primaryPhoto: Photo | null;
  photoCount: number;
  lastActiveAt: string | null;
  compatibility?: number;
  isShortlisted?: boolean;
  interestStatus?: string | null;
  distanceMiles?: number | null;
  highlights?: string[];
  sharesClan?: boolean;
}

export interface FullProfile extends ProfileCard {
  gender: string;
  maritalStatus: string;
  maritalStatusLabel: string | null;
  hasChildren: boolean;
  childrenLivingStatus: string | null;
  heritage: string;
  heritageLabel: string | null;
  clanGroup: string | null;
  motherClan: string | null;
  motherClanLabel: string | null;
  ancestralDistrict: string | null;
  religion: string | null;
  motherTongue: string | null;
  gurungFluency: string | null;
  gurungFluencyLabel: string | null;
  languages: string[];
  postcodeArea: string | null;
  residencyStatus: string | null;
  residencyStatusLabel: string | null;
  yearsInUk: number | null;
  raisedIn: string | null;
  raisedInLabel: string | null;
  serviceFamily: boolean;
  willingToRelocate: boolean;
  fieldOfStudy: string | null;
  employmentStatus: string | null;
  employmentStatusLabel: string | null;
  incomeBand: string | null;
  incomeBandLabel: string | null;
  diet: string | null;
  dietLabel: string | null;
  smoking: string | null;
  smokingLabel: string | null;
  drinking: string | null;
  drinkingLabel: string | null;
  familyType: string | null;
  familyTypeLabel: string | null;
  familyValues: string | null;
  familyValuesLabel: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  brothers: number | null;
  sisters: number | null;
  familyBasedIn: string | null;
  about: string | null;
  lookingFor: string | null;
  profileManagedBy: string;
  photos: Photo[];
  memberSince: string;
}

export interface OwnProfile extends FullProfile {
  dateOfBirth: string;
  visibility: string;
  completenessSuggestions: string[];
  preference: Preference | null;
}

export interface Preference {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  maritalStatuses: string[];
  religions: string[];
  ukRegions: string[];
  educationLevels: string[];
  diets: string[];
  residencyStatuses: string[];
  ancestralDistricts: string[];
  clanGroups: string[];
  intents: string[];
  maxSmoking: string | null;
  maxDrinking: string | null;
  gurungHeritageOnly: boolean;
  observeClanExogamy: boolean;
  verifiedOnly: boolean;
  ukBasedFamilyOnly: boolean;
  maxDistanceMiles: number | null;
}

export interface CompatibilityFactor {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  detail: string;
}

export interface Compatibility {
  score: number;
  coverage: number;
  highlights: string[];
  factors: CompatibilityFactor[];
}

export interface ClanAdvisory {
  shared: boolean;
  kind: 'PATERNAL' | 'MATERNAL' | null;
  clan: string | null;
  message: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface Option {
  value: string;
  label: string;
  group?: string;
  groupLabel?: string;
  aka?: string[];
}

export interface ReferenceData {
  clans: Option[];
  clanGroups: Option[];
  ancestralDistricts: Option[];
  ukRegions: Option[];
  languages: Option[];
  genders: Option[];
  maritalStatuses: Option[];
  religions: Option[];
  heritages: Option[];
  gurungFluency: Option[];
  residencyStatuses: Option[];
  raisedIn: Option[];
  educationLevels: Option[];
  employmentStatuses: Option[];
  incomeBands: Option[];
  diets: Option[];
  habits: Option[];
  familyTypes: Option[];
  familyValues: Option[];
  intents: Option[];
  visibilities: Option[];
  photoVisibilities: Option[];
  profileManagedBy: Option[];
  childrenLivingStatuses: Option[];
  reportReasons: Option[];
}

export interface InterestItem {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  profile: ProfileCard;
}

export interface ConnectionItem {
  id: string;
  connectedAt: string | null;
  profile: ProfileCard;
}

export interface ConversationSummary {
  id: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
  closed: boolean;
  participant: FullProfile;
}

export interface ChatMessage {
  id: string;
  body: string | null;
  deleted?: boolean;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
