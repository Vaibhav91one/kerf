'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { api, ApiError, type OwnProfile } from '@/lib/api';

const STORAGE_KEY = 'kerf.auth';

type Auth = { handle: string; token: string; profile: OwnProfile };

type AuthContextValue = {
  auth: Auth | null;
  ready: boolean;
  signedIn: boolean;
  clerkEnabled: boolean;
  connect: (auth: { handle: string; token: string }) => void;
  refresh: () => Promise<Auth | null>;
  disconnect: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  if (disabled) return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
  return <ClerkBackedAuthProvider>{children}</ClerkBackedAuthProvider>;
}

function legacyProfile(handle: string): OwnProfile {
  return {
    handle,
    displayName: handle,
    bio: null,
    publicSkills: false,
    avatarUrl: null,
    websiteUrl: null,
    githubUrl: null,
    xUrl: null,
    createdAtMs: Date.now(),
  };
}

function LegacyAuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { handle: string; token: string };
        setAuth({ ...parsed, profile: legacyProfile(parsed.handle) });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  function connect(next: { handle: string; token: string }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth({ ...next, profile: legacyProfile(next.handle) });
  }

  function disconnect() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        ready,
        signedIn: false,
        clerkEnabled: false,
        connect,
        refresh: async () => auth,
        disconnect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ClerkBackedAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const [auth, setAuth] = useState<Auth | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<Auth | null> => {
    if (!isLoaded) {
      setReady(false);
      return null;
    }
    if (!isSignedIn) {
      setAuth(null);
      setReady(true);
      return null;
    }

    const token = await getToken();
    if (!token) {
      setAuth(null);
      setReady(true);
      return null;
    }

    try {
      const { profile } = await api.clerkMe(token);
      const next = profile ? { handle: profile.handle, token, profile } : null;
      setAuth(next);
      return next;
    } catch (err) {
      // A signed-in Clerk user without a Kerf profile is an expected state on
      // first visit. Other failures are still treated as "not connected" so
      // protected widgets fail closed instead of using stale credentials.
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
      setAuth(null);
      return null;
    } finally {
      setReady(true);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function disconnect() {
    setAuth(null);
  }

  function connect(next: { handle: string; token: string }) {
    setAuth({
      handle: next.handle,
      token: next.token,
      profile: {
        handle: next.handle,
        displayName: next.handle,
        bio: null,
        publicSkills: false,
        avatarUrl: null,
        websiteUrl: null,
        githubUrl: null,
        xUrl: null,
        createdAtMs: Date.now(),
      },
    });
  }

  return (
    <AuthContext.Provider value={{ auth, ready, signedIn: isSignedIn === true, clerkEnabled: true, connect, refresh, disconnect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
