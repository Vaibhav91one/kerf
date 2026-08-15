'use client';

// Screen `Light / 06 Me` (131:2) and its dark twin (133:1761).
//
// The comp predates Clerk: it shows a handle claim, a token printed on screen
// and an exported KERF_TOKEN. The shipped flow mints the token during
// `kerf login` and never displays it, so the three steps keep the comp's shape
// but describe what actually happens.

import Link from 'next/link';
import { formatDateTime } from '@/lib/time';
import { useEffect, useState, type FormEvent } from 'react';
import { SignInButton, SignOutButton, useAuth as useClerkAuth, useClerk, useUser } from '@clerk/nextjs';
import { LIMITS, SEASON_MIN_COMMITS, SEASON_MIN_SESSIONS } from '@kerf/shared';
import {
  api,
  type ApiTokenJson,
  type LiveSessionJson,
  type MeSessions,
  type ProjectJson,
  type PublicProfile,
  type SkillJson,
} from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/hooks/use-refresh';
import { Illustration } from '@/components/kerf/artwork';
import { TerminalIcon } from '@/components/kerf/icons';
import { ConfirmDialog } from '@/components/kerf/confirm-dialog';
import {
  BuildingInPublicPanel,
  ProfileHeader,
  SessionsPanel,
  SkillsUsedPanel,
  TipsPanel,
  ToolkitPanel,
} from '@/components/kerf/profile-view';
import { Spinner } from '@/components/kerf/spinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ActionCard, CommandBlock, PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Fires the Clerk dialog once on mount. `useClerk` lives in here, not in the
 * page, because it throws without a <ClerkProvider> — and this component is
 * only ever rendered on the branch where Clerk is configured.
 */
function OpenSignIn() {
  const clerk = useClerk();
  useEffect(() => {
    clerk.openSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-[20px] shrink-0 font-mono text-[23px] leading-[28px] text-foreground">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-medium leading-[22px] text-foreground">{title}</p>
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
        aria-label="Handle"
        placeholder="ada"
        className="h-[38px] w-full max-w-[500px] rounded-[12px] border border-border bg-card px-[14px] font-mono text-[15px] text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={LIMITS.displayName}
        required
        placeholder="Display name"
        className="h-[38px] w-full max-w-[500px] rounded-[12px] border border-border bg-card px-[14px] text-[15px] text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-[38px] rounded-[12px] bg-primary px-6 text-[15px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? 'Claiming…' : 'Claim handle'}
      </button>
    </form>
  );
}

// Published inventory. Nothing on your machine is scanned or uploaded to build
// these lists — they are what you explicitly published, and the command block
// under each is how you publish more. Unpublishing is a delete.
//
// They are components rather than inline JSX because the pair used to sit in
// one two-column grid and now lives in two different tabs.
function PublishedSkillsPanel({
  skills,
  onUnpublish,
  onSetPublic,
}: {
  skills: SkillJson[];
  onUnpublish: (id: string) => void;
  onSetPublic: (id: string, next: boolean) => void;
}) {
  return (
    <Panel className="min-h-[260px]">
      <SectionLabel>YOUR PUBLISHED SKILLS</SectionLabel>
      <div className="mt-[16px] max-h-[260px] space-y-[10px] overflow-y-auto pr-1">
        {skills.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-[10px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">{s.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                ★ {s.starCount} · {s.installCount} installs
              </p>
            </div>
            {/* Visibility before Unpublish, so the destructive control stays
                last on the row — same order in both panels. */}
            <VisibilityToggle
              isPublic={s.isPublic}
              label={`${s.name} is public`}
              onChange={(next) => onSetPublic(s.id, next)}
            />
            <ConfirmDialog
              title="Unpublish this skill?"
              description={`"${s.name}" is removed from the shared library. Your copy in ~/.claude/skills is untouched, and you can publish it again.`}
              confirmLabel="Unpublish"
              destructive
              onConfirm={() => onUnpublish(s.id)}
              trigger={
                <button type="button" className="shrink-0 text-[13px] text-muted-foreground hover:text-destructive">
                  Unpublish
                </button>
              }
            />
          </div>
        ))}
        {skills.length === 0 && (
          <p className="text-[15px] text-muted-foreground">Nothing published. Your skills stay on your machine.</p>
        )}
      </div>
      <CommandBlock className="mt-[16px]" lines={[['kerf skills'], ['kerf skills publish <slug>']]} />
    </Panel>
  );
}

/**
 * Sign out, for the header of the one page that is about your account.
 *
 * Two auth modes, so two implementations: Clerk owns the session cookie and has
 * to end it itself, while the legacy provider's whole session is a localStorage
 * entry. Rendering Clerk's component only on the Clerk branch is deliberate —
 * its hooks throw outside a ClerkProvider, which is the same reason `useClerk`
 * lives in a child component elsewhere in this file.
 *
 * Red on request. Still not a ConfirmDialog, though: signing out destroys
 * nothing — the CLI token on this machine is untouched and `kerf sync` keeps
 * working. The colour marks it as the one control here that ends something,
 * which is why it is `destructive` (red on a tinted ground) rather than a solid
 * fill competing with the page's primary actions.
 */
function SignOutAction({ clerkEnabled, onDisconnect }: { clerkEnabled: boolean; onDisconnect: () => void }) {
  if (clerkEnabled) {
    return (
      // Home rather than /me: staying here would bounce straight into the
      // sign-in gate, which reads as the sign-out having failed.
      <SignOutButton redirectUrl="/">
        <Button variant="destructive">Sign out</Button>
      </SignOutButton>
    );
  }
  return (
    <Button variant="destructive" onClick={onDisconnect}>
      Sign out
    </Button>
  );
}

/**
 * What /me shows when there is no usable session. Three different situations
 * reach here and they need three different sentences — telling someone to sign
 * in when they already are is how the outage in BUILD_LOG.md stayed puzzling.
 *
 *   signed out            → sign in
 *   signed in, no handle  → claim one
 *   signed in, API said no → a server problem, say so and offer a retry
 *
 * The last two are indistinguishable from `auth === null` alone, so this asks
 * the API directly. Its own component so the effect is not a conditional hook
 * in MePage, which returns early above it.
 */
function AccountGate({
  clerkEnabled,
  signedIn,
  onRetry,
}: {
  clerkEnabled: boolean;
  signedIn: boolean;
  onRetry: () => Promise<unknown>;
}) {
  const { getToken, disconnect } = useAuth();
  const [reason, setReason] = useState<'checking' | 'no-profile' | 'rejected'>('checking');

  useEffect(() => {
    if (!clerkEnabled || !signedIn) return;
    let live = true;
    void getToken()
      .then((t) => (t ? api.clerkMe(t) : Promise.reject(new Error('no token'))))
      // A 200 with profile: null means Clerk verified us fine and we simply
      // have not claimed a handle yet. Anything else is the API refusing us.
      .then(() => live && setReason('no-profile'))
      .catch(() => live && setReason('rejected'));
    return () => {
      live = false;
    };
  }, [clerkEnabled, signedIn, getToken]);

  const body =
    !clerkEnabled
      ? 'Connect this machine from the CLI to see your account.'
      : !signedIn
        ? 'Sign in to claim a handle, connect the CLI, and see what you have published.'
        : reason === 'no-profile'
          ? 'You are signed in. Claim a handle to finish setting up your account.'
          : reason === 'rejected'
            ? 'You are signed in, but we could not verify your session with the Kerf API. That is a server problem, not something you did.'
            : 'Checking your session…';

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Your account"
        // Signed in but stuck — wrong Google account, or a session the API
        // will not take. Without this the only way out is clearing cookies.
        action={
          signedIn ? <SignOutAction clerkEnabled={clerkEnabled} onDisconnect={disconnect} /> : undefined
        }
      />
      <Panel className="min-h-[220px]">
        <p className="max-w-[640px] text-[16px] leading-[23px] text-muted-foreground">{body}</p>
        <div className="mt-[18px]">
          {!clerkEnabled ? (
            <CommandBlock lines={[['kerf login']]} />
          ) : !signedIn ? (
            <SignInButton mode="modal">
              <Button>Continue with Google</Button>
            </SignInButton>
          ) : reason === 'no-profile' ? (
            <Button nativeButton={false} render={<Link href="/cli/connect" />}>
              Claim your handle
            </Button>
          ) : reason === 'rejected' ? (
            <Button onClick={() => void onRetry()}>Try again</Button>
          ) : (
            <Spinner />
          )}
        </div>
      </Panel>
      {/* Auto-open the dialog only when signing in is actually the fix. */}
      {clerkEnabled && !signedIn && <OpenSignIn />}
    </div>
  );
}

/**
 * Public/private for one published row. The word beside the switch is the only
 * place either word appears as a state label, so it matches SHOW MY SKILLS.
 */
function VisibilityToggle({
  isPublic,
  label,
  onChange,
}: {
  isPublic: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-[13px] text-muted-foreground">{isPublic ? 'Public' : 'Private'}</span>
      <Switch checked={isPublic} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function PublishedProjectsPanel({
  projects,
  onUnpublish,
  onSetPublic,
}: {
  projects: ProjectJson[];
  onUnpublish: (id: string) => void;
  onSetPublic: (id: string, next: boolean) => void;
}) {
  return (
    <Panel className="min-h-[260px]">
      <SectionLabel>YOUR PUBLISHED PROJECTS</SectionLabel>
      <div className="mt-[16px] max-h-[260px] space-y-[10px] overflow-y-auto pr-1">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-[10px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">{p.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{p.sessionCount ?? 0} sessions linked</p>
            </div>
            <VisibilityToggle
              isPublic={p.isPublic}
              label={`${p.name} is public`}
              onChange={(next) => onSetPublic(p.id, next)}
            />
            <ConfirmDialog
              title="Unpublish this project?"
              description={`"${p.name}" stops appearing on /projects and its page goes away. The sessions behind it are untouched, and you can publish it again.`}
              confirmLabel="Unpublish"
              destructive
              onConfirm={() => onUnpublish(p.id)}
              trigger={
                <button type="button" className="shrink-0 text-[13px] text-muted-foreground hover:text-destructive">
                  Unpublish
                </button>
              }
            />
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-[15px] text-muted-foreground">
            Nothing published. Publish one on <Link href="/projects" className="underline">/projects</Link> or from
            the CLI.
          </p>
        )}
      </div>
      <CommandBlock className="mt-[16px]" lines={[['kerf projects'], ['kerf projects publish --name <name>']]} />
      <p className="mt-[12px] text-[13px] leading-[17px] text-muted-foreground">
        The listing commands print to your terminal only. Nothing transmits until you run publish.
      </p>
    </Panel>
  );
}

/**
 * Every CLI credential this account has minted, and the only way to kill one.
 * Never shows the token itself — only a sha256 digest is ever stored server-
 * side, so there is nothing to show even if this wanted to. Revoking is a
 * ConfirmDialog, not a plain button: unlike sign-out (which destroys nothing),
 * revoking the token a machine is actively using locks that machine out until
 * `kerf login` runs again there.
 */
function TokensPanel({ tokens, onRevoke }: { tokens: ApiTokenJson[]; onRevoke: (id: string) => void }) {
  return (
    <Panel className="min-h-[160px]">
      <SectionLabel>CONNECTED DEVICES</SectionLabel>
      <div className="mt-[16px] space-y-[10px]">
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-[10px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">{t.label}</p>
              <p className="truncate text-[13px] text-muted-foreground">connected {formatDateTime(t.createdAtMs)}</p>
            </div>
            <ConfirmDialog
              title="Revoke this token?"
              description={`This machine will lose access immediately — \`kerf sync\` and \`kerf live\` there will fail until it runs \`kerf login\` again.`}
              confirmLabel="Revoke"
              destructive
              onConfirm={() => onRevoke(t.id)}
              trigger={
                <button type="button" className="shrink-0 text-[13px] text-muted-foreground hover:text-destructive">
                  Revoke
                </button>
              }
            />
          </div>
        ))}
        {tokens.length === 0 && <p className="text-[15px] text-muted-foreground">No CLI tokens yet.</p>}
      </div>
    </Panel>
  );
}

export default function MePage() {
  const { auth, ready, signedIn, clerkEnabled, refresh, getToken, disconnect } = useAuth();
  const [me, setMe] = useState<MeSessions | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [myProjects, setMyProjects] = useState<ProjectJson[]>([]);
  const [mySkills, setMySkills] = useState<SkillJson[]>([]);
  const [myTokens, setMyTokens] = useState<ApiTokenJson[]>([]);
  const [saving, setSaving] = useState(false);
  // One timer for both: `tick` refetches the numbers, `nowMs` moves the
  // "last beat Ns ago" label that used to freeze at page-load time beside them.
  const { tick, nowMs } = useRefresh();
  // Bumped by a mutation that changes something the fetches above return.
  // `refresh()` only re-reads /api/clerk/me, so without this the ProfileHeader
  // keeps rendering the pre-toggle profile until the next 30s tick — which
  // reads as the switch not having worked.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!auth) return;
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
    api.profile(auth.handle).then(setProfile).catch(() => {});
    // One token for all three: the two inventory lists are the PUBLIC list
    // routes filtered by handle, so without a bearer the owner's own private
    // rows are absent from the one screen that exists to manage them.
    void getToken()
      .then((t) => {
        if (!t) return;
        void api.mySessions(t).then(setMe).catch(() => {});
        void api
          .projects(t)
          .then((r) => setMyProjects(r.projects.filter((p) => p.handle === auth.handle)))
          .catch(() => {});
        void api
          .skillLibrary('recent', t)
          .then((r) => setMySkills(r.skills.filter((s) => s.handle === auth.handle)))
          .catch(() => {});
        void api
          .myTokens(t)
          .then((r) => setMyTokens(r.tokens))
          .catch(() => {});
      })
      .catch(() => {});
  }, [auth, getToken, tick, reloadKey]);

  async function revokeToken(id: string) {
    const token = await getToken();
    if (!token) return;
    await api.revokeToken(token, id);
    setMyTokens((prev) => prev.filter((t) => t.id !== id));
    toast.success('Token revoked — that machine will need `kerf login` again');
  }

  if (!ready) return <PageSkeleton />;

  // The gate turns on `auth`, not on `signedIn`. Those are not the same thing,
  // and the difference is what let this page render signed out:
  //
  //   - `clerkEnabled` false (no publishable key in the build) skipped the gate
  //     entirely, so a signed-out visitor got the whole account page.
  //   - `signedIn` true with `auth` null is the state a Clerk secret/publishable
  //     mismatch produces: the browser has a session, the backend rejects the
  //     JWT, and the page rendered a complete, plausible, empty account —
  //     "Not connected", zero sessions — with nothing saying why. That is
  //     exactly how the outage in BUILD_LOG.md presented.
  //
  // `auth` is only set once /api/clerk/me has confirmed a profile, so it is the
  // one value that means "this page can actually do something".
  // Gate on `auth`, not on `signedIn`. Those are different, and the difference
  // is exactly how this page rendered signed out: a build without a publishable
  // key made `clerkEnabled` false and skipped the gate entirely, and a Clerk
  // session the API rejects leaves `signedIn` true with `auth` null. `auth` is
  // set only once /api/clerk/me has returned a profile, so it is the one value
  // that means this page can actually do something.
  if (!auth) return <AccountGate clerkEnabled={clerkEnabled} signedIn={signedIn} onRetry={refresh} />;

  // From the owner-scoped route, not the public feed: a session in a PRIVATE
  // project is absent from /api/live/sessions for everyone, so deriving this
  // from `live` would blank your own status while you work on your own project.
  const liveCount = me?.liveSessions ?? 0;
  const lastBeat = me?.lastBeatMs ?? null;
  const qualifying = me?.sessions.filter((s) => s.qualifies).length ?? 0;
  // NOT Boolean(auth) — auth is always truthy this far past the early return
  // above, which made this card show "Connected" for a signed-in account that
  // has claimed a handle but never run `kerf login`. hasCliToken is the actual
  // signal, already used correctly elsewhere on this page and on Home.
  const connected = Boolean(me?.hasCliToken);

  async function unpublishProject(id: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteProject(token, id);
      setMyProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project unpublished');
    } catch {
      toast.error('Could not unpublish that project');
    }
  }

  async function unpublishSkill(id: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteSkill(token, id);
      setMySkills((prev) => prev.filter((s) => s.id !== id));
      toast.success('Skill unpublished');
    } catch {
      toast.error('Could not unpublish that skill');
    }
  }

  // Optimistic, then reconciled from the response: a switch that waits for a
  // round-trip before moving reads as broken. A failure toasts and reverts.
  async function setProjectPublic(id: string, next: boolean) {
    const token = await getToken();
    if (!token) return;
    setMyProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isPublic: next } : p)));
    try {
      await api.setProjectVisibility(token, id, next);
      toast.success(next ? 'Project is public' : 'Project is private');
    } catch {
      setMyProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isPublic: !next } : p)));
      toast.error('Could not change who can see it');
    }
  }

  async function setSkillPublic(id: string, next: boolean) {
    const token = await getToken();
    if (!token) return;
    setMySkills((prev) => prev.map((s) => (s.id === id ? { ...s, isPublic: next } : s)));
    try {
      await api.setSkillVisibility(token, id, next);
      toast.success(next ? 'Skill is public' : 'Skill is private');
    } catch {
      setMySkills((prev) => prev.map((s) => (s.id === id ? { ...s, isPublic: !next } : s)));
      toast.error('Could not change who can see it');
    }
  }

  async function toggleHiddenSkill(key: string, hidden: boolean) {
    if (!auth) return;
    const token = await getToken();
    if (!token) return;
    // ponytail: the route replaces the whole array, so two tabs racing means
    // last write wins on one person's own preference. A {key, hidden} delta
    // endpoint is the upgrade, and it costs a read per write.
    const current = auth.profile.hiddenSkills ?? [];
    const next = hidden ? [...new Set([...current, key])] : current.filter((k) => k !== key);
    try {
      await api.setHiddenSkills(token, next);
      await refresh();
      // The public profile above is a separate fetch; refresh() only re-reads
      // /api/clerk/me, so it would otherwise still show the hidden skill.
      setReloadKey((k) => k + 1);
      toast.success(hidden ? 'Hidden from your profile and the league totals' : 'Visible again');
    } catch {
      toast.error('Could not change that');
    }
  }

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
      // Flipping this changes what /api/profiles/:handle returns, and that is a
      // different fetch from the one refresh() re-reads.
      setReloadKey((k) => k + 1);
      toast.success(next ? 'Your skills are public now' : 'Your skills are private again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Your account"
        subtitle="Your handle, your CLI connection, and what you have published."
        action={<SignOutAction clerkEnabled={clerkEnabled} onDisconnect={disconnect} />}
      />

      {/* Who you are and where you stand comes first — the account plumbing
          below is the part you touch once. */}
      {profile && <ProfileHeader profile={profile} live={live} isOwn />}

      {/* Eleven stacked sections became four tabs, below the profile and rank
          slips. Two deviations from /projects/[id]'s pattern, both deliberate:
          each TabsContent wraps a plain div rather than one <Panel>, because
          three panels inside a Panel draws a border around a border; and all
          four triggers are unconditional, because past the sign-in gate above
          there is always an account, and a tab that pops into existence after
          the first sync is jumpier than an empty table. */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="mt-4 space-y-[28px]">
            {/* CLI status stands alone now — the visibility rows below became
                cards of their own. */}
            <Panel
              className={`flex min-h-[200px] items-stretch gap-4 overflow-hidden border-0 ${connected ? 'bg-success-container' : 'border border-border bg-card'}`}
            >
              <div className="min-w-0 flex-1">
              <SectionLabel>CLI STATUS</SectionLabel>
              <div className="mt-[14px] flex items-center gap-[10px]">
                <span className={`size-[10px] rounded-full ${connected ? 'bg-primary' : 'bg-muted-foreground'}`} />
                <p className={`text-[18px] font-semibold ${connected ? 'text-on-success-container' : 'text-foreground'}`}>
                  {connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              <p className={`mt-[10px] text-[14px] ${connected ? 'text-on-success-container' : 'text-muted-foreground'}`}>
                {!connected
                  ? 'run kerf login to connect'
                  : lastBeat && nowMs
                    ? `last beat ${Math.max(0, Math.round((nowMs - lastBeat) / 1000))}s ago · ${liveCount} live session${liveCount === 1 ? '' : 's'}`
                    : 'no live session right now'}
              </p>
              <div className="mt-[14px] flex gap-[82px]">
                <div>
                  <p className={`text-[12px] font-semibold ${connected ? 'text-on-success-container' : 'text-primary'}`}>
                    sessions uploaded
                  </p>
                  <p
                    className={`mt-[3px] font-mono text-[28px] ${connected ? 'text-on-success-container' : 'text-foreground'}`}
                  >
                    {me?.sessions.length ?? 0}
                  </p>
                </div>
                <div>
                  <p className={`text-[12px] font-semibold ${connected ? 'text-on-success-container' : 'text-primary'}`}>
                    qualifying
                  </p>
                  <p
                    className={`mt-[3px] font-mono text-[28px] ${connected ? 'text-on-success-container' : 'text-foreground'}`}
                  >
                    {qualifying}
                  </p>
                </div>
              </div>
              {/* §7.4's season floor is a DIFFERENT gate than the per-session
                  qualifying count above it — clearing it is what earns a place
                  on /season's board this month, not just points on this page. */}
              {me && !me.seasonQualification.qualified && (
                <p className={`mt-[10px] text-[13px] ${connected ? 'text-on-success-container' : 'text-muted-foreground'}`}>
                  {me.seasonQualification.sessions} of {SEASON_MIN_SESSIONS} qualifying sessions ·{' '}
                  {me.seasonQualification.commits} of {SEASON_MIN_COMMITS} commits this month.
                </p>
              )}
              </div>
              {/* A real column, not a 93px decoration pinned to the corner — the
                  panel went full-width when the visibility rows moved out. */}
              <Illustration name="cli-sync" width={260} className="-my-5 -mr-[18px] h-auto w-[34%] shrink-0 self-center" />
            </Panel>


            {/* The visibility rows as cards. Only the first is a stored preference —
                a live tile exists only while `kerf live` runs and a project is
                visible because you published it, so those two get an action rather
                than a switch that would flip nothing. */}
            <div className="grid grid-cols-4 items-start gap-5">
              <ActionCard
                label="SHOW MY SKILLS"
                action={
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      {saving && <Spinner />}
                      {auth?.profile.publicSkills ? 'Public' : 'Private'}
                    </span>
                    <Switch
                      checked={auth?.profile.publicSkills ?? false}
                      disabled={!auth || saving}
                      onCheckedChange={(next) => togglePublicSkills(next)}
                      aria-label="Show my skills publicly"
                      className="shrink-0"
                    />
                  </div>
                }
              >
                Tool and skill names only, never their arguments. Off by default.
              </ActionCard>

              <ActionCard
                label="LIVE FEED"
                action={
                  <Button nativeButton={false} variant="outline" render={<Link href="/live" />}>
                    Watch the feed
                  </Button>
                }
              >
                You appear only while <span className="font-mono">kerf live</span> is running. Stop it and the tile is gone
                in 60s.
              </ActionCard>

              <ActionCard
                label="MY PROJECTS"
                action={
                  <Button nativeButton={false} variant="outline" render={<Link href="/projects" />}>
                    Manage projects
                  </Button>
                }
              >
                Only the ones you published are visible. Unpublishing removes them.
              </ActionCard>

              <ActionCard label="APPEARANCE" action={<ThemeToggle />}>
                Dark by default. Your choice is remembered on this device.
              </ActionCard>
            </div>

            {/* Connecting is a one-time job, so it sits last and disappears
                entirely once a token exists. */}
            <div className="grid gap-5">
              {!me?.hasCliToken && (
              <Panel className="min-h-[560px]">
                <SectionLabel>CONNECT IN THREE STEPS</SectionLabel>

                <div className="mt-[18px] space-y-[34px]">
                  <Step n={1} title="Claim a handle">
                    {!clerkEnabled ? (
                      <p className="mt-[8px] text-[13px] leading-[17px] text-muted-foreground">
                        Clerk is not configured in this environment.
                      </p>
                    ) : !signedIn ? (
                      <div className="mt-[10px]">
                        <SignInButton mode="modal">
                          <button
                            type="button"
                            className="h-[38px] rounded-[12px] bg-primary px-6 text-[15px] font-medium text-primary-foreground"
                          >
                            Continue with Google
                          </button>
                        </SignInButton>
                      </div>
                    ) : !auth ? (
                      <ClaimHandle />
                    ) : (
                      <div className="mt-[10px] flex h-[38px] max-w-[500px] items-center rounded-[12px] border border-border px-[14px] font-mono text-[15px] text-muted-foreground">
                        {auth.handle}
                      </div>
                    )}
                    <p className="mt-[10px] text-[13px] leading-[17px] text-muted-foreground">
                      3–32 chars, a–z 0–9 and dashes. This is the only name anyone sees.
                    </p>
                  </Step>

                  <Step n={2} title="Authorise the CLI — the token is never shown">
                    <div className="mt-[10px] flex h-[38px] max-w-[500px] items-center rounded-[12px] border border-border px-[14px] font-mono text-[15px] text-muted-foreground">
                      kerf login
                    </div>
                    <p className="mt-[10px] max-w-[600px] text-[13px] leading-[17px] text-muted-foreground">
                      The browser hands the CLI a token and it lands in <span className="font-mono">~/.kerf/config.json</span>.
                      Only its sha256 digest reaches the server — nobody, including this page, can read it back to you.
                    </p>
                  </Step>

                  <Step n={3} title="Run the CLI where you already work">
                    <CommandBlock
                      className="mt-[10px]"
                      lines={[
                        ['kerf login', '# opens this dashboard, stores the token'],
                        ['kerf sync', '# upload session history'],
                        ['kerf live', '# heartbeat every 15s'],
                      ]}
                    />
                    <p className="mt-[10px] max-w-[620px] text-[13px] leading-[17px] text-muted-foreground">
                      It reads <span className="font-mono">~/.claude/projects</span> on your machine. Nothing else, and
                      nothing is written back.
                    </p>
                  </Step>
                </div>
                <TerminalIcon size={20} className="mt-6 text-muted-foreground" />
              </Panel>
              )}
              {me?.hasCliToken && <TokensPanel tokens={myTokens} onRevoke={revokeToken} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="mt-4 space-y-[28px]">
            {profile && <BuildingInPublicPanel projects={profile.projects} live={live} isOwn />}
            {/* Signed out there is nothing to publish from. */}
            {auth && (
              <PublishedProjectsPanel
                projects={myProjects}
                onUnpublish={unpublishProject}
                onSetPublic={setProjectPublic}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="skills">
          <div className="mt-4 space-y-[28px]">
            {profile && <SkillsUsedPanel skills={profile.skills} isOwn publicSkills={profile.publicSkills} />}
            <ToolkitPanel
              toolTotals={me?.toolTotals}
              hiddenSkills={auth?.profile.hiddenSkills}
              onToggleHidden={auth ? toggleHiddenSkill : undefined}
            />
            {auth && (
              <PublishedSkillsPanel skills={mySkills} onUnpublish={unpublishSkill} onSetPublic={setSkillPublic} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="mt-4 space-y-[28px]">
            <SessionsPanel sessions={me?.sessions ?? null} />
            {/* Tips are derived from those sessions, so they read as a footnote
                to the table rather than a section of their own. */}
            {me && <TipsPanel sessions={me.sessions} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
