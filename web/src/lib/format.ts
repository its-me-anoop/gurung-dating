/** Small display helpers, all UK-flavoured (metric height shown with imperial). */

export function heightLabel(cm: number | null | undefined): string {
  if (!cm) return '—';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // Rounding can push inches to 12; carry it into the feet.
  const [ft, inch] = inches === 12 ? [feet + 1, 0] : [feet, inches];
  return `${cm} cm (${ft}′ ${inch}″)`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 31) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export function activityLabel(iso: string | null | undefined): string {
  if (!iso) return 'Not active recently';
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'Active now';
  if (hours < 24) return 'Active today';
  if (hours < 24 * 7) return 'Active this week';
  if (hours < 24 * 31) return 'Active this month';
  return 'Not active recently';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function distanceLabel(miles: number | null | undefined): string | null {
  if (miles == null) return null;
  if (miles === 0) return 'Same area';
  if (miles < 10) return 'Under 10 miles away';
  return `${miles} miles away`;
}

/** "Sunita, 28" style heading. */
export function nameAndAge(name: string, age: number): string {
  return `${name}, ${age}`;
}

/** Initials for the avatar fallback. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Turns a compatibility score into a short, honest description. */
export function compatibilityLabel(score: number): string {
  if (score >= 85) return 'Very strong match';
  if (score >= 70) return 'Strong match';
  if (score >= 55) return 'Good match';
  if (score >= 40) return 'Some things in common';
  return 'Not much overlap';
}
