import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Option, ReferenceData } from './types';

/**
 * Every dropdown in the app is built from this one response, which the server
 * derives from the same constants its validators use. A form therefore cannot
 * offer a value the API would reject.
 */
export function useReference() {
  return useQuery({
    queryKey: ['reference'],
    queryFn: () => api<ReferenceData>('/reference'),
    // Reference data only changes on deploy.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** Looks up a display label, falling back to the raw value. */
export function labelFor(options: Option[] | undefined, value: string | null | undefined): string {
  if (!value) return '';
  return options?.find((o) => o.value === value)?.label ?? value;
}

/** Groups options by their `group` key, preserving the original order. */
export function groupOptions(options: Option[]): Array<[string, Option[]]> {
  const groups = new Map<string, Option[]>();
  for (const option of options) {
    const key = option.groupLabel ?? option.group ?? '';
    const existing = groups.get(key);
    if (existing) existing.push(option);
    else groups.set(key, [option]);
  }
  return [...groups.entries()];
}
