/**
 * API client.
 *
 * The access token is kept in memory only — never in localStorage, where any
 * injected script could read it. Durability comes from the httpOnly refresh
 * cookie: on a page reload the app calls `/auth/refresh` once and gets a new
 * access token, so the member stays signed in without the token ever touching
 * disk.
 */

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** The message for a specific form field, if the server flagged one. */
  fieldError(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message;
  }
}

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthenticatedHandler(handler: (() => void) | null) {
  onUnauthenticated = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the refresh-and-retry dance; used by the refresh call itself. */
  skipRetry?: boolean;
  signal?: AbortSignal;
}

export interface RefreshResult {
  accessToken: string;
  user: { id: string; email: string; role: string; status: string };
}

/**
 * In-flight refresh, shared so that concurrent callers collapse into a single
 * round trip.
 *
 * This matters more than it looks: refresh tokens rotate, so two simultaneous
 * refreshes would send the same token twice and the second would arrive holding
 * one the server had just retired. Everything that refreshes — the 401 retry
 * path and the sign-in bootstrap alike — goes through here.
 */
let refreshInFlight: Promise<RefreshResult | null> | null = null;

export function refreshSession(): Promise<RefreshResult | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as RefreshResult;
        accessToken = data.accessToken;
        return data;
      } catch {
        return null;
      } finally {
        // Cleared on the next tick so every caller awaiting this promise sees
        // the same result before a fresh attempt can start.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipRetry = false, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    signal,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipRetry) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, { ...options, skipRetry: true });
    onUnauthenticated?.();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload: unknown = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = (payload as { error?: { code: string; message: string; details?: ApiErrorDetail[] } })
      .error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong. Please try again.',
      err?.details,
    );
  }

  return payload as T;
}

/** Clears the in-memory token. The httpOnly cookie is cleared by the server. */
export function clearSession() {
  accessToken = null;
}

/** Builds a query string, dropping empties so the URL stays readable. */
export function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
    } else if (typeof value === 'boolean') {
      if (value) search.set(key, 'true');
    } else {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

