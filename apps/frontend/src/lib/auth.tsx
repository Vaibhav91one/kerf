'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'kerf.auth';

type Auth = { handle: string; token: string };

type AuthContextValue = {
  auth: Auth | null;
  ready: boolean;
  connect: (auth: Auth) => void;
  disconnect: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setAuth(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  function connect(next: Auth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  }

  function disconnect() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, ready, connect, disconnect }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
