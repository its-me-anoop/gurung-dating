/**
 * SQLite stores list columns as JSON text. Everything reading or writing those
 * columns goes through here so a hand-edited row or a legacy value can never
 * crash a request.
 */

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export function serialiseList(values: readonly string[] | null | undefined): string {
  if (!values || values.length === 0) return '[]';
  // De-duplicate while preserving the order the member chose.
  return JSON.stringify([...new Set(values)]);
}
