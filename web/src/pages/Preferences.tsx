import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  ChipSelect,
  Field,
  Input,
  PageLoader,
  SectionHeading,
  Select,
} from '../components/ui';
import { api } from '../lib/api';
import { useReference } from '../lib/reference';
import type { OwnProfile, Preference } from '../lib/types';

const BLANK: Preference = {
  ageMin: null,
  ageMax: null,
  heightMinCm: null,
  heightMaxCm: null,
  maritalStatuses: [],
  religions: [],
  ukRegions: [],
  educationLevels: [],
  diets: [],
  residencyStatuses: [],
  ancestralDistricts: [],
  clanGroups: [],
  intents: [],
  maxSmoking: null,
  maxDrinking: null,
  gurungHeritageOnly: true,
  observeClanExogamy: true,
  verifiedOnly: false,
  ukBasedFamilyOnly: false,
  maxDistanceMiles: null,
};

export function Preferences() {
  const queryClient = useQueryClient();
  const { data: reference } = useReference();
  const [prefs, setPrefs] = useState<Preference | null>(null);
  const [saved, setSaved] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<{ profile: OwnProfile }>('/profiles/me').then((r) => r.profile),
  });

  useEffect(() => {
    if (profileQuery.data && !prefs) setPrefs(profileQuery.data.preference ?? BLANK);
  }, [profileQuery.data, prefs]);

  const save = useMutation({
    mutationFn: (payload: Preference) =>
      api<{ preference: Preference }>('/profiles/me/preferences', { method: 'PUT', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (profileQuery.isLoading || !prefs) return <PageLoader />;

  const set = <K extends keyof Preference>(key: K, value: Preference[K]) =>
    setPrefs((p) => (p ? { ...p, [key]: value } : p));

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Match preferences</h1>
      <p className="mt-2 text-ink-500">
        These shape your suggestions and can be applied to any search. Leave something blank and we
        will treat it as “no strong feelings” rather than a requirement.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(prefs);
        }}
        className="mt-8 space-y-6"
      >
        {save.isError && (
          <Alert tone="error">
            {save.error instanceof Error ? save.error.message : 'We could not save your preferences.'}
          </Alert>
        )}
        {saved && <Alert tone="success">Preferences saved.</Alert>}

        <section className="card p-6">
          <SectionHeading title="The basics" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Age from" htmlFor="ageMin">
              <Input
                id="ageMin"
                type="number"
                min={18}
                max={99}
                value={prefs.ageMin ?? ''}
                onChange={(e) => set('ageMin', num(e.target.value))}
                placeholder="Any"
              />
            </Field>
            <Field label="Age to" htmlFor="ageMax">
              <Input
                id="ageMax"
                type="number"
                min={18}
                max={99}
                value={prefs.ageMax ?? ''}
                onChange={(e) => set('ageMax', num(e.target.value))}
                placeholder="Any"
              />
            </Field>
            <Field label="Height from (cm)" htmlFor="heightMinCm">
              <Input
                id="heightMinCm"
                type="number"
                min={120}
                max={230}
                value={prefs.heightMinCm ?? ''}
                onChange={(e) => set('heightMinCm', num(e.target.value))}
                placeholder="Any"
              />
            </Field>
            <Field label="Height to (cm)" htmlFor="heightMaxCm">
              <Input
                id="heightMaxCm"
                type="number"
                min={120}
                max={230}
                value={prefs.heightMaxCm ?? ''}
                onChange={(e) => set('heightMaxCm', num(e.target.value))}
                placeholder="Any"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label="How far are you willing to travel?"
              htmlFor="maxDistanceMiles"
              hint="Measured between the centres of your regions, so treat it as a guide."
            >
              <Select
                id="maxDistanceMiles"
                value={prefs.maxDistanceMiles?.toString() ?? ''}
                onChange={(e) => set('maxDistanceMiles', num(e.target.value))}
                placeholder="Anywhere in the UK"
                options={[
                  { value: '25', label: 'Within 25 miles' },
                  { value: '50', label: 'Within 50 miles' },
                  { value: '100', label: 'Within 100 miles' },
                  { value: '200', label: 'Within 200 miles' },
                ]}
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="They should be looking for">
              <ChipSelect
                options={reference?.intents ?? []}
                selected={prefs.intents}
                onChange={(v) => set('intents', v)}
                emptyMeans="Open to anyone, whatever they are looking for."
              />
            </Field>
          </div>
        </section>

        <section className="card p-6">
          <SectionHeading
            title="Community & clan"
            description="The part that makes this site different from a general dating app."
          />

          <div className="space-y-4">
            <Checkbox
              checked={prefs.gurungHeritageOnly}
              onChange={(v) => set('gurungHeritageOnly', v)}
              label="Only show members of Gurung heritage"
              hint="Includes members who are part Gurung. Turn this off to meet people from the wider Nepali community and beyond."
            />

            <Checkbox
              checked={prefs.observeClanExogamy}
              onChange={(v) => set('observeClanExogamy', v)}
              label="Take clan into account when matching"
              hint="Lowers the score for profiles sharing your thar or maternal line, in keeping with the customary preference for marrying outside one's own clan. You will still see them, with a note."
            />

            <Checkbox
              checked={prefs.verifiedOnly}
              onChange={(v) => set('verifiedOnly', v)}
              label="Only show ID-verified profiles"
              hint="Fewer results, but every one has been checked by a moderator."
            />
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Clan groupings">
              <ChipSelect
                options={reference?.clanGroups ?? []}
                selected={prefs.clanGroups}
                onChange={(v) => set('clanGroups', v)}
                emptyMeans="Open to all clan groupings."
              />
            </Field>

            <Field label="Ancestral districts">
              <ChipSelect
                options={(reference?.ancestralDistricts ?? []).slice(0, 14)}
                selected={prefs.ancestralDistricts}
                onChange={(v) => set('ancestralDistricts', v)}
                emptyMeans="Any district."
              />
            </Field>

            <Field label="Faith">
              <ChipSelect
                options={reference?.religions ?? []}
                selected={prefs.religions}
                onChange={(v) => set('religions', v)}
                emptyMeans="Any faith."
              />
            </Field>
          </div>
        </section>

        <section className="card p-6">
          <SectionHeading title="Where they live" />
          <Field label="UK regions">
            <ChipSelect
              options={reference?.ukRegions ?? []}
              selected={prefs.ukRegions}
              onChange={(v) => set('ukRegions', v)}
              emptyMeans="Anywhere in the UK."
            />
          </Field>

          <div className="mt-5">
            <Field label="Status in the UK">
              <ChipSelect
                options={reference?.residencyStatuses ?? []}
                selected={prefs.residencyStatuses}
                onChange={(v) => set('residencyStatuses', v)}
                emptyMeans="Any status."
              />
            </Field>
          </div>
        </section>

        <section className="card p-6">
          <SectionHeading title="Background & lifestyle" />

          <div className="space-y-5">
            <Field label="Marital status">
              <ChipSelect
                options={reference?.maritalStatuses ?? []}
                selected={prefs.maritalStatuses}
                onChange={(v) => set('maritalStatuses', v)}
                emptyMeans="Open to everyone."
              />
            </Field>

            <Field label="Education">
              <ChipSelect
                options={reference?.educationLevels ?? []}
                selected={prefs.educationLevels}
                onChange={(v) => set('educationLevels', v)}
                emptyMeans="Any level of education."
              />
            </Field>

            <Field label="Diet">
              <ChipSelect
                options={reference?.diets ?? []}
                selected={prefs.diets}
                onChange={(v) => set('diets', v)}
                emptyMeans="Any diet."
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Smoking, at most" htmlFor="maxSmoking">
                <Select
                  id="maxSmoking"
                  value={prefs.maxSmoking ?? ''}
                  onChange={(e) => set('maxSmoking', e.target.value || null)}
                  options={reference?.habits ?? []}
                  placeholder="No preference"
                />
              </Field>

              <Field label="Drinking, at most" htmlFor="maxDrinking">
                <Select
                  id="maxDrinking"
                  value={prefs.maxDrinking ?? ''}
                  onChange={(e) => set('maxDrinking', e.target.value || null)}
                  options={reference?.habits ?? []}
                  placeholder="No preference"
                />
              </Field>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 z-30">
          <div className="card flex items-center justify-between gap-4 p-4 shadow-lg">
            <p className="text-sm text-ink-500">
              {saved ? 'Saved — your suggestions will update.' : 'Save to update your suggestions.'}
            </p>
            <Button type="submit" size="lg" loading={save.isPending}>
              Save preferences
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
