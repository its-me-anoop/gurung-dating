import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, refreshSession, setAccessToken, setUnauthenticatedHandler } from './api';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  /** True until the initial refresh attempt has finished. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  gender: string;
  dateOfBirth: string;
  clan?: string;
  ukRegion?: string;
  acceptedTerms: true;
}

const AuthContext = createContext<AuthState | null>(null);

interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, trade the refresh cookie for an access token. This is what
  // keeps someone signed in across a page reload without storing anything.
  //
  // It goes through `refreshSession` rather than calling the endpoint directly
  // so that it shares the single-flight guard: React runs effects twice in
  // StrictMode, and rotating refresh tokens do not survive being spent twice.
  useEffect(() => {
    let cancelled = false;

    void refreshSession().then((result) => {
      if (cancelled) return;
      if (result) {
        setUser(result.user);
      } else {
        setAccessToken(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // When a refresh finally fails mid-session, drop back to signed-out state
  // rather than leaving the UI showing data it can no longer fetch.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api<SessionResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipRetry: true,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await api<SessionResponse>('/auth/register', {
      method: 'POST',
      body: input,
      skipRetry: true,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', skipRetry: true });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser }>('/auth/me');
      setUser(data.user);
    } catch {
      // Leave the current user in place; the next request will sort it out.
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signOut, refreshUser }),
    [user, loading, signIn, register, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
