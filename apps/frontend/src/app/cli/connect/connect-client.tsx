'use client';

// The page `kerf login` opens. Not one of the nine boards, but it is the first
// thing a new account sees, so it uses the same surfaces and type as the rest
// of the platform rather than the stock shadcn card it started as.

import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, UserButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { LIMITS } from '@kerf/shared';
import { api, ApiError } from '@/lib/api';
import { KerfLogo } from '@/components/kerf/icons';
import { Illustration } from '@/components/kerf/artwork';

const FIELD =
  'h-[38px] w-full rounded-[12px] border border-border bg-card px-[14px] text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring';
const PRIMARY =
  'h-[40px] rounded-[12px] bg-primary px-6 text-[13px] font-medium text-primary-foreground disabled:opacity-60';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-[520px] rounded-[16px] border border-border bg-card px-8 py-8">
        <div className="flex items-center gap-2.5">
          <KerfLogo size={32} className="text-primary" />
          <div className="grid leading-tight">
            <span className="text-[18px] font-bold text-foreground">kerf</span>
            <span className="text-[11px] text-muted-foreground">season 1 · rework ratio</span>
          </div>
        </div>
        <h1 className="mt-7 text-[26px] font-semibold leading-[32px] text-foreground">{title}</h1>
        <p className="mt-[8px] text-[14px] leading-[18px] text-muted-foreground">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

export function CliConnectClient({ code }: { code: string }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState(user?.fullName ?? user?.firstName ?? '');
  const [hasProfile, setHasProfile] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tokenOrThrow() {
    const token = await getToken();
    if (!token) throw new Error('missing Clerk token');
    return token;
  }

  async function refreshProfile() {
    if (!isLoaded || !isSignedIn) return;
    try {
      const { profile } = await api.clerkMe(await tokenOrThrow());
      setHasProfile(Boolean(profile));
      if (profile) {
        setHandle(profile.handle);
        setDisplayName(profile.displayName);
      }
    } catch {
      setHasProfile(false);
    }
  }

  async function claim() {
    setError(null);
    setBusy(true);
    try {
      await api.claimCliLogin(await tokenOrThrow(), code);
      setClaimed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to connect CLI');
    } finally {
      setBusy(false);
    }
  }

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.upsertClerkProfile(await tokenOrThrow(), { handle, displayName });
      setHasProfile(true);
      await claim();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to claim profile');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  if (!code) {
    return <Shell title="Missing CLI code" subtitle="Run `kerf login` again to generate a fresh connection link." />;
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-[320px] w-full max-w-[520px] animate-pulse rounded-[16px] border border-border bg-card" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <Shell
        title="Connect Kerf CLI"
        subtitle="Sign in with Google, then this browser session will authorise your terminal."
      >
        <div className="mt-7">
          <SignInButton mode="modal">
            <button type="button" className={PRIMARY}>
              Continue with Google
            </button>
          </SignInButton>
        </div>
      </Shell>
    );
  }

  if (claimed) {
    return (
      <Shell title="CLI connected" subtitle="You can close this tab and return to your terminal.">
        <div className="mt-7 flex items-center justify-between">
          <UserButton />
          <Illustration name="cli-sync" width={120} />
        </div>
      </Shell>
    );
  }

  if (!hasProfile) {
    return (
      <Shell title="Claim your Kerf handle" subtitle="This handle owns the CLI token that `kerf login` will store.">
        <form onSubmit={createProfile} className="mt-7 space-y-4">
          <div>
            <label htmlFor="handle" className="block text-[11px] font-medium text-foreground">
              Handle
            </label>
            <input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={LIMITS.handle}
              placeholder="ada"
              required
              className={`mt-[7px] font-mono ${FIELD}`}
            />
            <p className="mt-[7px] text-[10px] text-muted-foreground">
              3–32 chars, a–z 0–9 and dashes. This is the only name anyone sees.
            </p>
          </div>
          <div>
            <label htmlFor="displayName" className="block text-[11px] font-medium text-foreground">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={LIMITS.displayName}
              required
              className={`mt-[7px] ${FIELD}`}
            />
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Connecting…' : 'Claim and connect CLI'}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Authorise this CLI?" subtitle={`Signed in as @${handle}. This mints a Kerf token for sync and live.`}>
      <div className="mt-7 space-y-3">
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <button type="button" onClick={claim} disabled={busy} className={PRIMARY}>
          {busy ? 'Connecting…' : 'Connect CLI'}
        </button>
        <p className="text-[11px] text-muted-foreground">
          The token goes straight to your terminal and is stored as a sha256 digest here — this page never shows it.
        </p>
      </div>
    </Shell>
  );
}
