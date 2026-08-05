import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProfileCard } from '../components/ProfileCard';
import {
  Alert,
  Button,
  Checkbox,
  ChipSelect,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Select,
  cx,
} from '../components/ui';
import { api, query } from '../lib/api';
import { groupOptions, useReference } from '../lib/reference';
import type { ProfileCard as Card } from '../lib/types';

interface SearchResponse {
  results: Card[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  note?: string;
}

interface Filters {
  q: string;
  ageMin: string;
  ageMax: string;
  regions: string[];
  clans: string[];
  religions: string[];
  educationLevels: string[];
  maritalStatuses: string[];
  intents: string[];
  diets: string[];
  heritages: string[];
  verifiedOnly: boolean;
  withPhotoOnly: boolean;
  serviceFamily: boolean;
  usePreferences: boolean;
  maxDistanceMiles: string;
  sort: string;
}

const EMPTY: Filters = {
  q: '',
  ageMin: '',
  ageMax: '',
  regions: [],
  clans: [],
  religions: [],
  educationLevels: [],
  maritalStatuses: [],
  intents: [],
  diets: [],
  heritages: [],
  verifiedOnly: false,
  withPhotoOnly: false,
  serviceFamily: false,
  usePreferences: true,
  maxDistanceMiles: '',
  sort: 'compatibility',
};

/** Counts everything the member has actively narrowed, for the filter badge. */
function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.ageMin || filters.ageMax) count += 1;
  if (filters.maxDistanceMiles) count += 1;
  for (const key of [
    'regions',
    'clans',
    'religions',
    'educationLevels',
    'maritalStatuses',
    'intents',
    'diets',
    'heritages',
  ] as const) {
    if (filters[key].length > 0) count += 1;
  }
  if (filters.verifiedOnly) count += 1;
  if (filters.withPhotoOnly) count += 1;
  if (filters.serviceFamily) count += 1;
  return count;
}

export function Browse() {
  const queryClient = useQueryClient();
  const { data: reference } = useReference();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);

  const page = Number(searchParams.get('page') ?? 1);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    // Any filter change invalidates the current page number.
    setSearchParams((p) => {
      p.delete('page');
      return p;
    });
  };

  const searchQuery = useQuery({
    queryKey: ['search', filters, page],
    queryFn: () =>
      api<SearchResponse>(
        `/discovery/search${query({
          q: filters.q,
          ageMin: filters.ageMin,
          ageMax: filters.ageMax,
          regions: filters.regions,
          clans: filters.clans,
          religions: filters.religions,
          educationLevels: filters.educationLevels,
          maritalStatuses: filters.maritalStatuses,
          intents: filters.intents,
          diets: filters.diets,
          heritages: filters.heritages,
          verifiedOnly: filters.verifiedOnly,
          withPhotoOnly: filters.withPhotoOnly,
          serviceFamily: filters.serviceFamily,
          usePreferences: filters.usePreferences,
          maxDistanceMiles: filters.maxDistanceMiles,
          sort: filters.sort,
          page,
          perPage: 24,
        })}`,
      ),
  });

  const sendInterest = useMutation({
    mutationFn: (userId: string) =>
      api('/interests', { method: 'POST', body: { receiverId: userId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['interest-summary'] });
    },
  });

  const toggleShortlist = useMutation({
    mutationFn: ({ userId, on }: { userId: string; on: boolean }) =>
      on
        ? api('/shortlist', { method: 'POST', body: { userId } })
        : api(`/shortlist/${userId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['search'] }),
  });

  const results = searchQuery.data;
  const filterCount = activeFilterCount(filters);

  const goToPage = (next: number) =>
    setSearchParams((p) => {
      p.set('page', String(next));
      return p;
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Browse members</h1>
          <p className="mt-1 text-sm text-ink-500">
            {results ? `${results.total} ${results.total === 1 ? 'member' : 'members'} match` : 'Searching…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Sort by"
            value={filters.sort}
            onChange={(e) => set('sort', e.target.value)}
            className="w-auto"
            options={[
              { value: 'compatibility', label: 'Best match' },
              { value: 'active', label: 'Recently active' },
              { value: 'recent', label: 'Newest members' },
              { value: 'complete', label: 'Most complete' },
            ]}
          />
          <Button variant="secondary" onClick={() => setShowFilters((s) => !s)}>
            Filters
            {filterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-700 px-1.5 text-xs text-white">
                {filterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filter panel */}
        <aside
          className={cx(
            'card h-fit space-y-5 p-5 lg:sticky lg:top-24 lg:block',
            showFilters ? 'block' : 'hidden',
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ ...EMPTY, sort: filters.sort })}
                className="text-sm text-crimson-700 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <Field label="Search" htmlFor="q">
            <Input
              id="q"
              value={filters.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Name, job, interest…"
            />
          </Field>

          <Checkbox
            checked={filters.usePreferences}
            onChange={(v) => set('usePreferences', v)}
            label="Apply my saved preferences"
            hint="Uses what you set on the preferences page as a starting point."
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Age from" htmlFor="ageMin">
              <Input
                id="ageMin"
                type="number"
                min={18}
                max={99}
                value={filters.ageMin}
                onChange={(e) => set('ageMin', e.target.value)}
                placeholder="18"
              />
            </Field>
            <Field label="to" htmlFor="ageMax">
              <Input
                id="ageMax"
                type="number"
                min={18}
                max={99}
                value={filters.ageMax}
                onChange={(e) => set('ageMax', e.target.value)}
                placeholder="99"
              />
            </Field>
          </div>

          <Field label="Within" htmlFor="distance" hint="Miles from your region.">
            <Select
              id="distance"
              value={filters.maxDistanceMiles}
              onChange={(e) => set('maxDistanceMiles', e.target.value)}
              placeholder="Any distance"
              options={[
                { value: '25', label: '25 miles' },
                { value: '50', label: '50 miles' },
                { value: '100', label: '100 miles' },
                { value: '200', label: '200 miles' },
              ]}
            />
          </Field>

          <Field label="Region">
            <select
              multiple
              size={6}
              className="input"
              value={filters.regions}
              onChange={(e) =>
                set(
                  'regions',
                  [...e.target.selectedOptions].map((o) => o.value),
                )
              }
            >
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

          <Field label="Thar (clan)">
            <select
              multiple
              size={6}
              className="input"
              value={filters.clans}
              onChange={(e) =>
                set(
                  'clans',
                  [...e.target.selectedOptions].map((o) => o.value),
                )
              }
            >
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

          <Field label="Looking for">
            <ChipSelect
              options={reference?.intents ?? []}
              selected={filters.intents}
              onChange={(v) => set('intents', v)}
              emptyMeans="Showing everyone."
            />
          </Field>

          <Field label="Faith">
            <ChipSelect
              options={reference?.religions ?? []}
              selected={filters.religions}
              onChange={(v) => set('religions', v)}
              emptyMeans="Showing all faiths."
            />
          </Field>

          <Field label="Marital status">
            <ChipSelect
              options={reference?.maritalStatuses ?? []}
              selected={filters.maritalStatuses}
              onChange={(v) => set('maritalStatuses', v)}
              emptyMeans="Showing everyone."
            />
          </Field>

          <Field label="Heritage">
            <ChipSelect
              options={reference?.heritages ?? []}
              selected={filters.heritages}
              onChange={(v) => set('heritages', v)}
              emptyMeans="Showing everyone."
            />
          </Field>

          <div className="space-y-3 border-t border-paper-200 pt-4">
            <Checkbox
              checked={filters.verifiedOnly}
              onChange={(v) => set('verifiedOnly', v)}
              label="Verified profiles only"
            />
            <Checkbox
              checked={filters.withPhotoOnly}
              onChange={(v) => set('withPhotoOnly', v)}
              label="With a photo"
            />
            <Checkbox
              checked={filters.serviceFamily}
              onChange={(v) => set('serviceFamily', v)}
              label="Service (Gurkha) family"
            />
          </div>
        </aside>

        {/* Results */}
        <div>
          {results?.note && (
            <div className="mb-4">
              <Alert tone="info">{results.note}</Alert>
            </div>
          )}

          {searchQuery.isLoading ? (
            <PageLoader />
          ) : searchQuery.isError ? (
            <Alert tone="error">
              We could not load members just now. Please refresh and try again.
            </Alert>
          ) : (results?.results.length ?? 0) === 0 ? (
            <EmptyState
              title="No members match those filters"
              description="Try widening the age range, adding regions, or turning off your saved preferences."
              action={
                <Button variant="secondary" onClick={() => setFilters({ ...EMPTY, sort: filters.sort })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results?.results.map((card) => (
                  <ProfileCard
                    key={card.userId}
                    profile={card}
                    actions={
                      <>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={Boolean(card.interestStatus) || sendInterest.isPending}
                          onClick={() => sendInterest.mutate(card.userId)}
                        >
                          {card.interestStatus === 'ACCEPTED'
                            ? 'Connected'
                            : card.interestStatus === 'PENDING'
                              ? 'Interest sent'
                              : card.interestStatus === 'DECLINED'
                                ? 'Answered'
                                : 'Express interest'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toggleShortlist.mutate({
                              userId: card.userId,
                              on: !card.isShortlisted,
                            })
                          }
                          aria-label={
                            card.isShortlisted
                              ? `Remove ${card.displayName} from shortlist`
                              : `Shortlist ${card.displayName}`
                          }
                        >
                          {card.isShortlisted ? '★' : '☆'}
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>

              {(results?.totalPages ?? 0) > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="px-3 text-sm text-ink-500">
                    Page {page} of {results?.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= (results?.totalPages ?? 1)}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
