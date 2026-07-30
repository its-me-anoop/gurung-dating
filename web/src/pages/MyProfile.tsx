import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  PageLoader,
  ProgressRing,
  Select,
  Textarea,
  cx,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { groupOptions, useReference } from '../lib/reference';
import type { OwnProfile } from '../lib/types';

/** Every editable field, in the shape the PATCH endpoint expects. */
interface Draft {
  displayName: string;
  heightCm: string;
  maritalStatus: string;
  hasChildren: boolean;
  childrenLivingStatus: string;
  heritage: string;
  clan: string;
  motherClan: string;
  ancestralDistrict: string;
  religion: string;
  motherTongue: string;
  gurungFluency: string;
  languages: string[];
  ukRegion: string;
  city: string;
  postcodeArea: string;
  residencyStatus: string;
  yearsInUk: string;
  raisedIn: string;
  serviceFamily: boolean;
  willingToRelocate: boolean;
  education: string;
  fieldOfStudy: string;
  occupation: string;
  incomeBand: string;
  employmentStatus: string;
  diet: string;
  smoking: string;
  drinking: string;
  familyType: string;
  familyValues: string;
  fatherOccupation: string;
  motherOccupation: string;
  brothers: string;
  sisters: string;
  familyBasedIn: string;
  headline: string;
  about: string;
  interests: string;
  lookingFor: string;
  intent: string;
  visibility: string;
  profileManagedBy: string;
}

function toDraft(p: OwnProfile): Draft {
  return {
    displayName: p.displayName ?? '',
    heightCm: p.heightCm?.toString() ?? '',
    maritalStatus: p.maritalStatus ?? 'NEVER_MARRIED',
    hasChildren: p.hasChildren ?? false,
    childrenLivingStatus: p.childrenLivingStatus ?? '',
    heritage: p.heritage ?? 'GURUNG',
    clan: p.clan ?? '',
    motherClan: p.motherClan ?? '',
    ancestralDistrict: p.ancestralDistrict ?? '',
    religion: p.religion ?? '',
    motherTongue: p.motherTongue ?? '',
    gurungFluency: p.gurungFluency ?? '',
    languages: p.languages ?? [],
    ukRegion: p.ukRegion ?? '',
    city: p.city ?? '',
    postcodeArea: p.postcodeArea ?? '',
    residencyStatus: p.residencyStatus ?? '',
    yearsInUk: p.yearsInUk?.toString() ?? '',
    raisedIn: p.raisedIn ?? '',
    serviceFamily: p.serviceFamily ?? false,
    willingToRelocate: p.willingToRelocate ?? false,
    education: p.education ?? '',
    fieldOfStudy: p.fieldOfStudy ?? '',
    occupation: p.occupation ?? '',
    incomeBand: p.incomeBand ?? '',
    employmentStatus: p.employmentStatus ?? '',
    diet: p.diet ?? '',
    smoking: p.smoking ?? '',
    drinking: p.drinking ?? '',
    familyType: p.familyType ?? '',
    familyValues: p.familyValues ?? '',
    fatherOccupation: p.fatherOccupation ?? '',
    motherOccupation: p.motherOccupation ?? '',
    brothers: p.brothers?.toString() ?? '',
    sisters: p.sisters?.toString() ?? '',
    familyBasedIn: p.familyBasedIn ?? '',
    headline: p.headline ?? '',
    about: p.about ?? '',
    interests: (p.interests ?? []).join(', '),
    lookingFor: p.lookingFor ?? '',
    intent: p.intent ?? 'MARRIAGE',
    visibility: p.visibility ?? 'MEMBERS_ONLY',
    profileManagedBy: p.profileManagedBy ?? 'SELF',
  };
}

/**
 * Turns the string-shaped form state into the API payload: empty strings become
 * null (so blanking a field really clears it), numbers are parsed, and the
 * comma-separated interests box becomes an array.
 */
function toPayload(draft: Draft): Record<string, unknown> {
  const text = (v: string) => (v.trim() === '' ? null : v.trim());
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  return {
    displayName: draft.displayName.trim(),
    heightCm: num(draft.heightCm),
    maritalStatus: draft.maritalStatus,
    hasChildren: draft.hasChildren,
    childrenLivingStatus: draft.hasChildren ? text(draft.childrenLivingStatus) : null,
    heritage: draft.heritage,
    clan: text(draft.clan),
    motherClan: text(draft.motherClan),
    ancestralDistrict: text(draft.ancestralDistrict),
    religion: text(draft.religion),
    motherTongue: text(draft.motherTongue),
    gurungFluency: text(draft.gurungFluency),
    languages: draft.languages,
    ukRegion: text(draft.ukRegion),
    city: text(draft.city),
    postcodeArea: text(draft.postcodeArea),
    residencyStatus: text(draft.residencyStatus),
    yearsInUk: num(draft.yearsInUk),
    raisedIn: text(draft.raisedIn),
    serviceFamily: draft.serviceFamily,
    willingToRelocate: draft.willingToRelocate,
    education: text(draft.education),
    fieldOfStudy: text(draft.fieldOfStudy),
    occupation: text(draft.occupation),
    incomeBand: text(draft.incomeBand),
    employmentStatus: text(draft.employmentStatus),
    diet: text(draft.diet),
    smoking: text(draft.smoking),
    drinking: text(draft.drinking),
    familyType: text(draft.familyType),
    familyValues: text(draft.familyValues),
    fatherOccupation: text(draft.fatherOccupation),
    motherOccupation: text(draft.motherOccupation),
    brothers: num(draft.brothers),
    sisters: num(draft.sisters),
    familyBasedIn: text(draft.familyBasedIn),
    headline: text(draft.headline),
    about: text(draft.about),
    interests: draft.interests
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 20),
    lookingFor: text(draft.lookingFor),
    intent: draft.intent,
    visibility: draft.visibility,
    profileManagedBy: draft.profileManagedBy,
  };
}

const SECTIONS = [
  { id: 'words', label: 'In your words' },
  { id: 'heritage', label: 'Heritage' },
  { id: 'uk', label: 'Life in the UK' },
  { id: 'work', label: 'Education & work' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'family', label: 'Family' },
  { id: 'privacy', label: 'Privacy' },
] as const;

export function MyProfile() {
  const queryClient = useQueryClient();
  const { data: reference } = useReference();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [section, setSection] = useState<(typeof SECTIONS)[number]['id']>('words');
  const [saved, setSaved] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<{ profile: OwnProfile }>('/profiles/me').then((r) => r.profile),
  });

  useEffect(() => {
    if (profileQuery.data && !draft) setDraft(toDraft(profileQuery.data));
  }, [profileQuery.data, draft]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<{ profile: OwnProfile }>('/profiles/me', { method: 'PATCH', body: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(['my-profile'], data.profile);
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (profileQuery.isLoading || !draft) return <PageLoader />;

  const profile = profileQuery.data!;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate(toPayload(draft));
  };

  const error = save.error;
  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Your profile</h1>
          <p className="mt-1 text-sm text-ink-500">
            The fuller this is, the better your matches — and the more people write back.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <ProgressRing
              value={profile.completeness}
              tone={profile.completeness >= 80 ? 'green' : 'marigold'}
              label={`${profile.completeness}% complete`}
            />
            <Link to="/profile/photos" className="text-sm text-crimson-700 hover:underline">
              Manage photos →
            </Link>
          </div>
        </div>
      </div>

      {profile.completenessSuggestions.length > 0 && (
        <div className="mb-6">
          <Alert tone="warning" title="Worth adding">
            <ul className="mt-1 list-inside list-disc space-y-1">
              {profile.completenessSuggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {/* Section tabs */}
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-paper-300" aria-label="Profile sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cx(
              'border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              section === s.id
                ? 'border-crimson-700 text-crimson-800'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
            aria-current={section === s.id ? 'page' : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert tone="error">
            {error instanceof Error ? error.message : 'We could not save your changes.'}
          </Alert>
        )}
        {saved && <Alert tone="success">Saved.</Alert>}

        {section === 'words' && (
          <div className="card space-y-5 p-6">
            <Field label="Display name" htmlFor="displayName" required error={fieldError('displayName')}>
              <Input
                id="displayName"
                value={draft.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                maxLength={60}
              />
            </Field>

            <Field
              label="Headline"
              htmlFor="headline"
              hint="One line that sounds like you. It shows on every card."
            >
              <Input
                id="headline"
                value={draft.headline}
                onChange={(e) => set('headline', e.target.value)}
                maxLength={120}
                placeholder="Nurse, hill-walker, and my aama's harshest cooking critic"
              />
            </Field>

            <Field
              label="About you"
              htmlFor="about"
              hint={`${draft.about.length} / 3000 characters. Profiles with 150+ characters get noticeably more interest.`}
            >
              <Textarea
                id="about"
                rows={7}
                maxLength={3000}
                value={draft.about}
                onChange={(e) => set('about', e.target.value)}
                placeholder="Where you grew up, what your days look like, what makes you laugh…"
              />
            </Field>

            <Field
              label="What you are looking for"
              htmlFor="lookingFor"
              hint="Being specific here saves everyone time."
            >
              <Textarea
                id="lookingFor"
                rows={4}
                maxLength={2000}
                value={draft.lookingFor}
                onChange={(e) => set('lookingFor', e.target.value)}
              />
            </Field>

            <Field
              label="Interests"
              htmlFor="interests"
              hint="Separate with commas. These are the easiest conversation starters on the site."
            >
              <Input
                id="interests"
                value={draft.interests}
                onChange={(e) => set('interests', e.target.value)}
                placeholder="hiking, cooking, badminton, volunteering"
              />
            </Field>

            <Field label="I am here for" htmlFor="intent">
              <Select
                id="intent"
                value={draft.intent}
                onChange={(e) => set('intent', e.target.value)}
                options={reference?.intents ?? []}
              />
            </Field>
          </div>
        )}

        {section === 'heritage' && (
          <div className="card space-y-5 p-6">
            <Field
              label="Heritage"
              htmlFor="heritage"
              hint="Members can filter on this. It is separate from your thar."
            >
              <Select
                id="heritage"
                value={draft.heritage}
                onChange={(e) => set('heritage', e.target.value)}
                options={reference?.heritages ?? []}
              />
            </Field>

            <Field
              label="Your thar (clan)"
              htmlFor="clan"
              hint="Used for the clan advisory on matches. Spellings vary — pick the closest."
            >
              <select
                id="clan"
                className="input"
                value={draft.clan}
                onChange={(e) => set('clan', e.target.value)}
              >
                <option value="">Not set</option>
                {groupOptions(reference?.clans ?? []).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                        {o.aka && o.aka.length > 0 ? ` (${o.aka.join(', ')})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field
              label="Your mother's thar"
              htmlFor="motherClan"
              hint="Some families pay attention to the maternal line too."
            >
              <select
                id="motherClan"
                className="input"
                value={draft.motherClan}
                onChange={(e) => set('motherClan', e.target.value)}
              >
                <option value="">Not set</option>
                {groupOptions(reference?.clans ?? []).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Ancestral district" htmlFor="ancestralDistrict">
              <select
                id="ancestralDistrict"
                className="input"
                value={draft.ancestralDistrict}
                onChange={(e) => set('ancestralDistrict', e.target.value)}
              >
                <option value="">Not set</option>
                {groupOptions(reference?.ancestralDistricts ?? []).map(([region, options]) => (
                  <optgroup key={region} label={region}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Faith" htmlFor="religion">
              <Select
                id="religion"
                value={draft.religion}
                onChange={(e) => set('religion', e.target.value)}
                options={reference?.religions ?? []}
                placeholder="Not set"
              />
            </Field>

            <Field label="Tamu Kyi (Gurung language)" htmlFor="gurungFluency">
              <Select
                id="gurungFluency"
                value={draft.gurungFluency}
                onChange={(e) => set('gurungFluency', e.target.value)}
                options={reference?.gurungFluency ?? []}
                placeholder="Not set"
              />
            </Field>

            <Field label="Languages you speak">
              <div className="flex flex-wrap gap-2">
                {(reference?.languages ?? []).map((lang) => {
                  const active = draft.languages.includes(lang.value);
                  return (
                    <button
                      key={lang.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        set(
                          'languages',
                          active
                            ? draft.languages.filter((l) => l !== lang.value)
                            : [...draft.languages, lang.value],
                        )
                      }
                      className={cx(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-crimson-600 bg-crimson-700 text-white'
                          : 'border-paper-300 bg-white text-ink-600 hover:border-crimson-300',
                      )}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Language spoken at home" htmlFor="motherTongue">
              <Select
                id="motherTongue"
                value={draft.motherTongue}
                onChange={(e) => set('motherTongue', e.target.value)}
                options={reference?.languages ?? []}
                placeholder="Not set"
              />
            </Field>
          </div>
        )}

        {section === 'uk' && (
          <div className="card space-y-5 p-6">
            <Field label="Region" htmlFor="ukRegion">
              <select
                id="ukRegion"
                className="input"
                value={draft.ukRegion}
                onChange={(e) => set('ukRegion', e.target.value)}
              >
                <option value="">Not set</option>
                {groupOptions(reference?.ukRegions ?? []).map(([nation, options]) => (
                  <optgroup key={nation} label={nation}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Town or city" htmlFor="city">
                <Input
                  id="city"
                  value={draft.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Aldershot"
                />
              </Field>

              <Field
                label="Postcode area"
                htmlFor="postcodeArea"
                hint="Just the first part, e.g. GU11. Never your full postcode."
                error={fieldError('postcodeArea')}
              >
                <Input
                  id="postcodeArea"
                  value={draft.postcodeArea}
                  onChange={(e) => set('postcodeArea', e.target.value.toUpperCase())}
                  placeholder="GU11"
                  maxLength={4}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Status in the UK" htmlFor="residencyStatus">
                <Select
                  id="residencyStatus"
                  value={draft.residencyStatus}
                  onChange={(e) => set('residencyStatus', e.target.value)}
                  options={reference?.residencyStatuses ?? []}
                  placeholder="Not set"
                />
              </Field>

              <Field label="Years in the UK" htmlFor="yearsInUk">
                <Input
                  id="yearsInUk"
                  type="number"
                  min={0}
                  max={90}
                  value={draft.yearsInUk}
                  onChange={(e) => set('yearsInUk', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Where you grew up" htmlFor="raisedIn">
              <Select
                id="raisedIn"
                value={draft.raisedIn}
                onChange={(e) => set('raisedIn', e.target.value)}
                options={reference?.raisedIn ?? []}
                placeholder="Not set"
              />
            </Field>

            <div className="space-y-3 border-t border-paper-200 pt-4">
              <Checkbox
                checked={draft.serviceFamily}
                onChange={(v) => set('serviceFamily', v)}
                label="Mine is a service (Gurkha) family"
                hint="A shared thread for many families here, and something people like to filter on."
              />
              <Checkbox
                checked={draft.willingToRelocate}
                onChange={(v) => set('willingToRelocate', v)}
                label="I would consider moving for the right person"
              />
            </div>
          </div>
        )}

        {section === 'work' && (
          <div className="card space-y-5 p-6">
            <Field label="Education" htmlFor="education">
              <Select
                id="education"
                value={draft.education}
                onChange={(e) => set('education', e.target.value)}
                options={reference?.educationLevels ?? []}
                placeholder="Not set"
              />
            </Field>

            <Field label="What you studied" htmlFor="fieldOfStudy">
              <Input
                id="fieldOfStudy"
                value={draft.fieldOfStudy}
                onChange={(e) => set('fieldOfStudy', e.target.value)}
                placeholder="Adult Nursing"
              />
            </Field>

            <Field label="What you do" htmlFor="occupation">
              <Input
                id="occupation"
                value={draft.occupation}
                onChange={(e) => set('occupation', e.target.value)}
                placeholder="Staff nurse, NHS"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Employment" htmlFor="employmentStatus">
                <Select
                  id="employmentStatus"
                  value={draft.employmentStatus}
                  onChange={(e) => set('employmentStatus', e.target.value)}
                  options={reference?.employmentStatuses ?? []}
                  placeholder="Not set"
                />
              </Field>

              <Field
                label="Income"
                htmlFor="incomeBand"
                hint="Only a band, and you can keep it private."
              >
                <Select
                  id="incomeBand"
                  value={draft.incomeBand}
                  onChange={(e) => set('incomeBand', e.target.value)}
                  options={reference?.incomeBands ?? []}
                  placeholder="Not set"
                />
              </Field>
            </div>
          </div>
        )}

        {section === 'lifestyle' && (
          <div className="card space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Height (cm)" htmlFor="heightCm">
                <Input
                  id="heightCm"
                  type="number"
                  min={120}
                  max={230}
                  value={draft.heightCm}
                  onChange={(e) => set('heightCm', e.target.value)}
                />
              </Field>

              <Field label="Marital status" htmlFor="maritalStatus">
                <Select
                  id="maritalStatus"
                  value={draft.maritalStatus}
                  onChange={(e) => set('maritalStatus', e.target.value)}
                  options={reference?.maritalStatuses ?? []}
                />
              </Field>
            </div>

            <div className="space-y-3">
              <Checkbox
                checked={draft.hasChildren}
                onChange={(v) => set('hasChildren', v)}
                label="I have children"
              />
              {draft.hasChildren && (
                <Field label="They are" htmlFor="childrenLivingStatus">
                  <Select
                    id="childrenLivingStatus"
                    value={draft.childrenLivingStatus}
                    onChange={(e) => set('childrenLivingStatus', e.target.value)}
                    options={reference?.childrenLivingStatuses ?? []}
                    placeholder="Select…"
                  />
                </Field>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Diet" htmlFor="diet">
                <Select
                  id="diet"
                  value={draft.diet}
                  onChange={(e) => set('diet', e.target.value)}
                  options={reference?.diets ?? []}
                  placeholder="Not set"
                />
              </Field>

              <Field label="Smoking" htmlFor="smoking">
                <Select
                  id="smoking"
                  value={draft.smoking}
                  onChange={(e) => set('smoking', e.target.value)}
                  options={reference?.habits ?? []}
                  placeholder="Not set"
                />
              </Field>

              <Field label="Drinking" htmlFor="drinking">
                <Select
                  id="drinking"
                  value={draft.drinking}
                  onChange={(e) => set('drinking', e.target.value)}
                  options={reference?.habits ?? []}
                  placeholder="Not set"
                />
              </Field>
            </div>
          </div>
        )}

        {section === 'family' && (
          <div className="card space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Family type" htmlFor="familyType">
                <Select
                  id="familyType"
                  value={draft.familyType}
                  onChange={(e) => set('familyType', e.target.value)}
                  options={reference?.familyTypes ?? []}
                  placeholder="Not set"
                />
              </Field>

              <Field label="Family values" htmlFor="familyValues">
                <Select
                  id="familyValues"
                  value={draft.familyValues}
                  onChange={(e) => set('familyValues', e.target.value)}
                  options={reference?.familyValues ?? []}
                  placeholder="Not set"
                />
              </Field>
            </div>

            <Field label="Where your family is based" htmlFor="familyBasedIn">
              <Input
                id="familyBasedIn"
                value={draft.familyBasedIn}
                onChange={(e) => set('familyBasedIn', e.target.value)}
                placeholder="Aldershot, Hampshire"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Father's occupation" htmlFor="fatherOccupation">
                <Input
                  id="fatherOccupation"
                  value={draft.fatherOccupation}
                  onChange={(e) => set('fatherOccupation', e.target.value)}
                />
              </Field>

              <Field label="Mother's occupation" htmlFor="motherOccupation">
                <Input
                  id="motherOccupation"
                  value={draft.motherOccupation}
                  onChange={(e) => set('motherOccupation', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Brothers" htmlFor="brothers">
                <Input
                  id="brothers"
                  type="number"
                  min={0}
                  max={20}
                  value={draft.brothers}
                  onChange={(e) => set('brothers', e.target.value)}
                />
              </Field>

              <Field label="Sisters" htmlFor="sisters">
                <Input
                  id="sisters"
                  type="number"
                  min={0}
                  max={20}
                  value={draft.sisters}
                  onChange={(e) => set('sisters', e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Who manages this profile"
              htmlFor="profileManagedBy"
              hint="Plenty of profiles here are set up by a parent or sibling. Saying so is honest and normal."
            >
              <Select
                id="profileManagedBy"
                value={draft.profileManagedBy}
                onChange={(e) => set('profileManagedBy', e.target.value)}
                options={reference?.profileManagedBy ?? []}
              />
            </Field>
          </div>
        )}

        {section === 'privacy' && (
          <div className="card space-y-5 p-6">
            <Field
              label="Who can see your profile"
              htmlFor="visibility"
              hint="Photos have their own setting on the photos page."
            >
              <Select
                id="visibility"
                value={draft.visibility}
                onChange={(e) => set('visibility', e.target.value)}
                options={reference?.visibilities ?? []}
              />
            </Field>

            <Alert tone="info">
              Your email address and date of birth are never shown to other members — only your age.
              Your postcode area is shown as the outward part only.
            </Alert>

            <div className="border-t border-paper-200 pt-5">
              <Link to="/settings" className="text-sm text-crimson-700 hover:underline">
                Account settings, blocked members and deletion →
              </Link>
            </div>
          </div>
        )}

        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-30">
          <div className="card flex items-center justify-between gap-4 p-4 shadow-lg">
            <p className="text-sm text-ink-500">
              {saved ? 'All changes saved.' : 'Changes are saved when you press save.'}
            </p>
            <Button type="submit" loading={save.isPending} size="lg">
              Save profile
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
