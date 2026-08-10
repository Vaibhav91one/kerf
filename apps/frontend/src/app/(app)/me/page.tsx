'use client';

// Screen `Light / 06 Me` (131:2) and its dark twin (133:1761).
//
// The comp predates Clerk: it shows a handle claim, a token printed on screen
// and an exported KERF_TOKEN. The shipped flow mints the token during
// `kerf login` and never displays it, so the three steps keep the comp's shape
// but describe what actually happens.

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { LIMITS } from '@kerf/shared';
import { api, type LiveSessionJson, type MeSessions } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Illustration } from '@/components/kerf/artwork';
import { TerminalIcon } from '@/components/kerf/icons';
import { PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';

// Exactly the keys validate.ts accepts on POST /api/metrics. Kept in this order
// so the list on screen and the schema-walk can be read side by side.
const PAYLOAD_FIELDS =
  'sessionId · projectHash · startedMs · endedMs · turns · edits · editsRework · reworkRatio · qualifies · toolCounts';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-[20px] shrink-0 font-mono text-[20px] leading-[24px] text-foreground">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-[19px] text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}

function ClaimHandle() {
  const clerk = useClerkAuth();
  const { user } = useUser();
  const { refresh } = useAuth();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const guess = user?.username ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '';
    setHandle(
      guess
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, LIMITS.handle),
    );
    setDisplayName(user?.fullName ?? user?.firstName ?? '');
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await clerk.getToken();
      if (!token) throw new Error('missing Clerk session token');
      await api.saveClerkProfile(token, { handle, displayName });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-[10px] space-y-[10px]">
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        maxLength={LIMITS.handle}
        required
        className="h-[38px] w-full max-w-[500px] rounded-[12px] border border-border bg-card px-[14px] font-mono text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={LIMITS.displayName}
        required
        placeholder="Display name"
        className="h-[38px] w-full max-w-[500px] rounded-[12px] border border-border bg-card px-[14px] text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-[38px] rounded-[12px] bg-primary px-6 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? 'Claiming…' : 'Claim handle'}
      </button>
    </form>
  );
}

export default function MePage() {
  const { auth, ready, signedIn, clerkEnabled, refresh, getToken } = useAuth();
  const [me, setMe] = useState<MeSessions | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [saving, setSaving] = useState(false);
  // Same reason as CliStatus: no Date.now() in a render body.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!auth) return;
    void getToken().then((t) => (t ? api.mySessions(t).then(setMe) : null)).catch(() => {});
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
    setNowMs(Date.now());
  }, [auth, getToken]);

  if (!ready) return <PageSkeleton />;

  const mineLive = auth ? live.filter((s) => s.handle === auth.handle) : [];
  const lastBeat = mineLive.length > 0 ? Math.max(...mineLive.map((s) => s.lastBeatMs)) : null;
  const qualifying = me?.sessions.filter((s) => s.qualifies).length ?? 0;
  const connected = Boolean(auth);

  async function togglePublicSkills(next: boolean) {
    if (!auth) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.updateMyProfile(token, {
        displayName: auth.profile.displayName,
        bio: auth.profile.bio ?? undefined,
        publicSkills: next,
        avatarUrl: auth.profile.avatarUrl ?? undefined,
        websiteUrl: auth.profile.websiteUrl ?? undefined,
        githubUrl: auth.profile.githubUrl ?? undefined,
        xUrl: auth.profile.xUrl ?? undefined,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Your account"
        subtitle="Kerf never signs in to Claude on your behalf. You run the CLI locally and it posts numbers with a token you hold."
      />

      <div className="grid grid-cols-[740fr_340fr] gap-5">
        <Panel className="min-h-[560px]">
          <SectionLabel>CONNECT IN THREE STEPS</SectionLabel>

          <div className="mt-[18px] space-y-[34px]">
            <Step n={1} title="Claim a handle">
              {!clerkEnabled ? (
                <p className="mt-[8px] text-[11px] leading-[14px] text-muted-foreground">
                  Clerk is not configured in this environment.
                </p>
              ) : !signedIn ? (
                <div className="mt-[10px]">
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="h-[38px] rounded-[12px] bg-primary px-6 text-[13px] font-medium text-primary-foreground"
                    >
                      Continue with Google
                    </button>
                  </SignInButton>
                </div>
              ) : !auth ? (
                <ClaimHandle />
              ) : (
                <div className="mt-[10px] flex h-[38px] max-w-[500px] items-center rounded-[12px] border border-border px-[14px] font-mono text-[13px] text-muted-foreground">
                  {auth.handle}
                </div>
              )}
              <p className="mt-[10px] text-[11px] leading-[14px] text-muted-foreground">
                3–32 chars, a–z 0–9 and dashes. This is the only name anyone sees.
              </p>
            </Step>

            <Step n={2} title="Authorise the CLI — the token is never shown">
              <div className="mt-[10px] flex h-[38px] max-w-[500px] items-center rounded-[12px] border border-border px-[14px] font-mono text-[13px] text-muted-foreground">
                kerf login
              </div>
              <p className="mt-[10px] max-w-[600px] text-[11px] leading-[14px] text-muted-foreground">
                The browser hands the CLI a token and it lands in <span className="font-mono">~/.kerf/config.json</span>.
                Only its sha256 digest reaches the server — nobody, including this page, can read it back to you.
              </p>
            </Step>

            <Step n={3} title="Run the CLI where you already work">
              <div className="mt-[10px] rounded-[16px] border border-border px-5 py-[18px]">
                {[
                  'kerf login        # opens this dashboard, stores the token',
                  'kerf sync         # upload session history',
                  'kerf live         # heartbeat every 15s',
                ].map((line) => (
                  <p key={line} className="whitespace-pre font-mono text-[13px] leading-[30px] text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
              <p className="mt-[10px] max-w-[620px] text-[11px] leading-[14px] text-muted-foreground">
                It reads <span className="font-mono">~/.claude/projects</span> on your machine. Nothing else, and
                nothing is written back.
              </p>
            </Step>
          </div>
          <TerminalIcon size={20} className="mt-6 text-muted-foreground" />
        </Panel>

        <div className="space-y-5">
          <Panel
            className={`relative h-[200px] border-0 ${connected ? 'bg-success-container' : 'border border-border bg-card'}`}
          >
            <SectionLabel>CLI STATUS</SectionLabel>
            <div className="mt-[14px] flex items-center gap-[10px]">
              <span className={`size-[10px] rounded-full ${connected ? 'bg-primary' : 'bg-muted-foreground'}`} />
              <p className={`text-[16px] font-semibold ${connected ? 'text-on-success-container' : 'text-foreground'}`}>
                {connected ? 'Connected' : 'Not connected'}
              </p>
            </div>
            <p className={`mt-[10px] text-[12px] ${connected ? 'text-on-success-container' : 'text-muted-foreground'}`}>
              {!connected
                ? 'run kerf login to connect'
                : lastBeat && nowMs
                  ? `last beat ${Math.max(0, Math.round((nowMs - lastBeat) / 1000))}s ago · ${mineLive.length} live session${mineLive.length === 1 ? '' : 's'}`
                  : 'no live session right now'}
            </p>
            <div className="mt-[14px] flex gap-[82px]">
              <div>
                <p className={`text-[10px] font-semibold ${connected ? 'text-on-success-container' : 'text-primary'}`}>
                  sessions uploaded
                </p>
                <p
                  className={`mt-[3px] font-mono text-[24px] ${connected ? 'text-on-success-container' : 'text-foreground'}`}
                >
                  {me?.sessions.length ?? 0}
                </p>
              </div>
              <div>
                <p className={`text-[10px] font-semibold ${connected ? 'text-on-success-container' : 'text-primary'}`}>
                  qualifying
                </p>
                <p
                  className={`mt-[3px] font-mono text-[24px] ${connected ? 'text-on-success-container' : 'text-foreground'}`}
                >
                  {qualifying}
                </p>
              </div>
            </div>
            <Illustration name="cli-sync" width={93} className="absolute right-[19px] top-[18px]" />
          </Panel>

          <Panel className="h-[340px]">
            <SectionLabel>WHAT OTHERS CAN SEE</SectionLabel>

            <div className="mt-[20px] flex items-start justify-between gap-4">
              <div>
                <p className="max-w-[220px] text-[13px] font-medium text-foreground">Show my skills publicly</p>
                <p className="mt-[8px] max-w-[240px] text-[11px] text-muted-foreground">tool and skill names only</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={auth?.profile.publicSkills ?? false}
                disabled={!auth || saving}
                onClick={() => togglePublicSkills(!auth?.profile.publicSkills)}
                className={`h-[28px] w-[52px] shrink-0 rounded-[14px] transition-colors disabled:opacity-60 ${
                  auth?.profile.publicSkills ? 'bg-primary' : 'border border-border bg-card'
                }`}
              >
                <span
                  className={`block size-[20px] rounded-[10px] transition-transform ${
                    auth?.profile.publicSkills ? 'translate-x-[28px] bg-card' : 'translate-x-[4px] bg-secondary'
                  }`}
                />
              </button>
            </div>

            {/* The comp draws switches for these two as well. Neither is a stored
                preference: a live tile exists only while `kerf live` runs, and a
                project is visible only because you published it. Showing a
                switch that flips nothing would be worse than saying so. */}
            <div className="mt-[24px]">
              <p className="text-[13px] font-medium text-foreground">Show me in the live feed</p>
              <p className="mt-[8px] max-w-[240px] text-[11px] text-muted-foreground">
                handle, counters, project — only while <span className="font-mono">kerf live</span> is running. Stop it
                and the tile is gone in 60s.
              </p>
            </div>

            <div className="mt-[20px]">
              <p className="text-[13px] font-medium text-foreground">Show my projects</p>
              <p className="mt-[8px] max-w-[240px] text-[11px] text-muted-foreground">
                only ones you published on <Link href="/projects" className="underline">/projects</Link>.
              </p>
            </div>

            <p className="mt-[20px] text-[11px] text-muted-foreground">Skills default to off.</p>
          </Panel>
        </div>
      </div>

      <Panel className="min-h-[160px]">
        <SectionLabel>WHAT LEAVES YOUR MACHINE</SectionLabel>
        <p className="mt-[12px] max-w-[1060px] font-mono text-[13px] leading-[20px] text-muted-foreground">
          {PAYLOAD_FIELDS}
        </p>
        <p className="mt-[22px] max-w-[1060px] text-[13px] leading-[17px] text-muted-foreground">
          That is the whole list. The backend walks every payload against it and rejects anything with an extra field —
          it does not strip and store, it refuses.
        </p>
      </Panel>

      <Panel className="min-h-[120px]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <SectionLabel>ROTATE TOKEN</SectionLabel>
            <p className="mt-[10px] max-w-[800px] text-[13px] leading-[17px] text-muted-foreground">
              Running <span className="font-mono">kerf login</span> again issues a fresh token and overwrites the one on
              disk. Your sessions and standing are untouched. Revoking the previous token is not built yet — it stays
              valid until that lands.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
