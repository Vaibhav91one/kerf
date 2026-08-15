'use client';

// One profile body, two callers: /people/[handle] renders it from the public
// payload, /me renders it with `isOwn` above the account panels. They used to
// share nothing, which is why the same person looked like two different pages.
//
// The AVERAGE REWORK RATIO card the comp draws is gone — badges moved up into
// the hero, and the rank card carries the standing.
//
// The panels are exported one by one because /me spreads them across tabs while
// /people/[handle] renders the lot. `ProfileView` is now their composition and
// nothing else, so the public profile is byte-identical to what it was.

import Link from 'next/link';
import { useState } from 'react';
import { classifyTool } from '@kerf/shared';
import { Avatar, BadgeArt, Illustration } from '@/components/kerf/artwork';
import { BadgeCarousel } from '@/components/kerf/badge-carousel';
import { EmptyState } from '@/components/kerf/empty-state';
import { FollowButton } from '@/components/kerf/follow-button';
import { GithubIcon } from '@/components/kerf/icons';
import { RankProgress } from '@/components/kerf/rank-progress';
import { SessionTable } from '@/components/kerf/session-table';
import { SkillSheet, type SkillSheetSubject } from '@/components/kerf/skill-sheet';
import { Panel, SectionLabel, SkillBar } from '@/components/kerf/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/time';
import type { LiveSessionJson, MySession, ProjectJson, PublicProfile, Tip } from '@/lib/api';

/** Hero, rank slip and board line — everything above /me's tab bar. */
export function ProfileHeader({
  profile,
  live,
  isOwn,
  boardPosition,
  boardSize,
}: {
  profile: PublicProfile;
  live: LiveSessionJson[];
  isOwn: boolean;
  boardPosition?: number;
  boardSize?: number;
}) {
  const { handle, standing, badges, projects } = profile;
  const liveHere = live.filter((s) => s.handle === handle);

  // The comp shows two identity chips. Neither is a stored field, so both are
  // derived from what the account has actually published.
  const tags = [
    projects.length > 0 ? 'Building in public' : null,
    projects.some((p) => p.repoUrl) ? 'Open source' : null,
  ].filter(Boolean) as string[];

  return (
    <>
      {/* Flex row, not an absolutely-positioned right slot: that slot used to
          hold a 128px button, and the badge rail is up to 420px — it would sit
          on top of a long display name or bio. */}
      <Panel className="flex items-start gap-5 px-[22px] py-[22px]">
        <div className="flex min-w-0 flex-1 gap-5">
          <Avatar handle={handle} size={72} className="shrink-0 rounded-full" />
          <div className="min-w-0">
            <h1 className="text-[30px] font-semibold leading-[37px] text-foreground">{profile.displayName}</h1>
            <p className="mt-[6px] text-[14px] leading-[18px] text-muted-foreground">
              @{profile.handle} · joined {formatDate(profile.createdAtMs)}
            </p>
            {profile.bio && (
              <p className="mt-[8px] max-w-[640px] text-[16px] leading-[22px] text-muted-foreground">{profile.bio}</p>
            )}
            <div className="mt-[10px] flex flex-wrap items-center gap-3">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex h-[30px] items-center rounded-[15px] border border-border px-4 text-[13px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {profile.githubUrl && (
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub profile"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <GithubIcon size={20} />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isOwn ? (
            // Your own account has nobody to follow — the slot shows what you
            // have earned instead.
            <BadgeCarousel badges={badges} />
          ) : (
            <FollowButton
              handle={profile.handle}
              isFollowedByMe={profile.isFollowedByMe}
              followerCount={profile.followerCount}
            />
          )}
          {profile.isRivalOfMe && (
            <Badge variant="secondary" className="mt-[8px]">
              Rival
            </Badge>
          )}
          {liveHere.length > 0 && <p className="mt-[12px] text-[13px] font-semibold text-foreground">live now</p>}
        </div>
      </Panel>

      <RankProgress
        points={standing.points}
        rank={standing}
        streak={profile.streak}
        sessionCount={standing.sessionCount}
      />
      {boardPosition !== undefined && boardPosition >= 0 && (
        <p className="text-[14px] text-muted-foreground">
          Rank {boardPosition + 1} of {boardSize} on this month&apos;s board.
        </p>
      )}
    </>
  );
}

/**
 * What this account leans on, as far as anyone else may see it. The heading no
 * longer says "& TOOLS": /api/profiles/:handle drops every builtin, so a tool
 * can never appear in here.
 */
export function SkillsUsedPanel({
  skills,
  isOwn = false,
  publicSkills,
}: {
  skills: Record<string, number> | null;
  isOwn?: boolean;
  /** Distinguishes "opted out" from "opted in, nothing recorded yet". */
  publicSkills?: boolean;
}) {
  const [subject, setSubject] = useState<SkillSheetSubject | null>(null);
  const rows = Object.entries(skills ?? {}).sort((a, b) => b[1] - a[1]);
  const peak = rows.length > 0 ? rows[0][1] : 1;

  return (
    <Panel className="min-h-[420px]">
      <SectionLabel>{isOwn ? 'SKILLS YOU USE' : 'SKILLS THEY USE'}</SectionLabel>
      <div className="mt-[22px]">
        {rows.map(([name, count]) => (
          // No `kind`: /api/profiles/:handle discards it, and the sheet degrades
          // without one. The count is passed because the row just drew it —
          // a sheet saying "nothing recorded" beside a bar of 24 is a lie.
          <SkillBar
            key={name}
            name={name}
            count={count}
            max={peak}
            onClick={() => setSubject({ label: name, usage: { count, scope: isOwn ? 'in your sessions' : 'in their sessions' } })}
          />
        ))}
        {/* Opted out is a privacy state; opted in with nothing yet is an
            absence. Saying "private" for the second is simply wrong, and it is
            reachable now that a skill can be hidden one at a time. */}
        {rows.length === 0 && (
          <p className="text-[15px] text-muted-foreground">
            {publicSkills === false
              ? isOwn
                ? 'Your skills are private. Turn the switch on below to show them.'
                : 'Skills are private for this account.'
              : isOwn
                ? 'Nothing recorded yet. Run kerf sync to upload your sessions.'
                : 'Nothing recorded yet.'}
          </p>
        )}
      </div>
      {subject && <SkillSheet subject={subject} onClose={() => setSubject(null)} />}
    </Panel>
  );
}

export function BuildingInPublicPanel({
  projects,
  live,
  isOwn,
}: {
  projects: ProjectJson[];
  live: LiveSessionJson[];
  isOwn: boolean;
}) {
  return (
    <Panel className="min-h-[420px]">
      <SectionLabel>BUILDING IN PUBLIC</SectionLabel>
      <div className="mt-[22px] space-y-5">
        {projects.map((p) => {
          const sessions = live.filter((s) => s.projectId === p.id).length;
          return (
            <div key={p.id} className="flex items-start gap-4 rounded-[16px] border border-border p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-semibold leading-[23px] text-foreground">{p.name}</p>
                {p.description && (
                  <p className="mt-[6px] max-w-[460px] text-[15px] leading-[20px] text-muted-foreground">
                    {p.description}
                  </p>
                )}
                <div className="mt-[12px] flex items-center gap-3">
                  {p.repoUrl && (
                    // The URL text is gone: the mark says "repo" in less space
                    // and does not wrap mid-path.
                    <a
                      href={p.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${p.name} repository`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <GithubIcon size={20} />
                    </a>
                  )}
                  <span className="text-[13px] font-medium text-foreground">
                    {sessions > 0 ? `${sessions} live session${sessions === 1 ? '' : 's'}` : 'idle'}
                  </span>
                </div>
              </div>
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a remote logo on an arbitrary host; next/image would need every host allow-listed.
                <img src={p.logoUrl} alt="" width={64} height={64} className="size-[64px] shrink-0 rounded-[12px] object-contain" />
              ) : (
                <Illustration name="project-fallback" width={72} className="shrink-0" />
              )}
            </div>
          );
        })}
        {projects.length === 0 && (
          <EmptyState illustration="publish-project" title="No published projects">
            {isOwn ? 'Publish one from /projects or with kerf projects publish.' : 'Nothing published yet.'}
          </EmptyState>
        )}
      </div>
    </Panel>
  );
}

// The scroll container (`max-h-[520px] overflow-auto` below) already keeps a
// long table from pushing the page, but it doesn't stop the DOM from holding
// every row — a real account synced from a large real corpus renders ~5
// <td> per session with no windowing. `SESSIONS_PAGE` bounds the initial (and
// each incremental) render; "Show more" bumps it rather than rendering
// everything at once.
const SESSIONS_PAGE = 100;

/** Your own session history, or the §6 reason there is none for anyone else. */
export function SessionsPanel({ sessions }: { sessions: MySession[] | null }) {
  const [shown, setShown] = useState(SESSIONS_PAGE);

  if (!sessions) {
    return (
      <Panel>
        <SectionLabel>RECENT SESSIONS</SectionLabel>
        {/* §6: the API deliberately serves no per-session detail for someone
            else's account, so this only exists on your own profile. */}
        <p className="mt-[18px] max-w-[900px] text-[15px] leading-[20px] text-muted-foreground">
          Session history stays with its owner.{' '}
          <Link href="/privacy" className="underline">
            What leaves your machine
          </Link>
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionLabel>SESSIONS</SectionLabel>
      {/* Fixed height + both axes scrollable: a wide table must not push
          the panel out, and a long one must not push the page. */}
      <div className="mt-[12px] max-h-[520px] overflow-auto">
        <SessionTable sessions={sessions} limit={shown} />
      </div>
      <div className="mt-[16px] flex items-center justify-between">
        <p className="text-[13px] leading-[16px] text-muted-foreground">
          {Math.min(shown, sessions.length)} of {sessions.length} parsed ·{' '}
          {sessions.filter((x) => x.qualifies).length} qualifying
        </p>
        {shown < sessions.length && (
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + SESSIONS_PAGE)}>
            Show more
          </Button>
        )}
      </div>
    </Panel>
  );
}

/**
 * Your own tool histogram, split two ways. "YOUR TOOL USE" listed builtins,
 * skills and MCP servers in one column, so the skills you care about sat under
 * a thousand Bash calls. The toggle is two buttons rather than `Tabs` because
 * on /me this panel already lives inside a tab panel, and a nested TabsList
 * reads as a bug.
 */
export function ToolkitPanel({
  toolTotals,
  hiddenSkills,
  onToggleHidden,
}: {
  toolTotals?: Record<string, number>;
  /** `${kind}:${label}` keys the owner has hidden. Absent on a read-only render. */
  hiddenSkills?: string[];
  /** Given: the panel draws a Hide/Show control per row. Omitted: it stays read-only. */
  onToggleHidden?: (key: string, hidden: boolean) => void;
}) {
  const [tab, setTab] = useState<'skills' | 'tools'>('skills');
  const [subject, setSubject] = useState<SkillSheetSubject | null>(null);
  const hidden = new Set(hiddenSkills ?? []);

  // Folded on kind+label, the same key GET /api/skills aggregates on: this
  // histogram is keyed by raw tool name, so an MCP server arrives once per tool
  // it exposes and would otherwise draw one `figma` row per call site.
  const folded = new Map<string, { kind: 'skill' | 'mcp' | 'builtin'; label: string; count: number }>();
  for (const [name, count] of Object.entries(toolTotals ?? {})) {
    const { kind, label } = classifyTool(name);
    const row = folded.get(`${kind}:${label}`) ?? { kind, label, count: 0 };
    row.count += count;
    folded.set(`${kind}:${label}`, row);
  }
  const rows = [...folded.values()]
    .filter((r) => (tab === 'skills' ? r.kind !== 'builtin' : r.kind === 'builtin'))
    .sort((a, b) => b.count - a.count);
  // Per tab, not overall: scaled against Bash every skill bar is a stub.
  const peak = rows.length > 0 ? rows[0].count : 1;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>YOUR TOOLKIT</SectionLabel>
        <div className="flex gap-2">
          <Button
            variant={tab === 'skills' ? 'default' : 'outline'}
            size="sm"
            aria-pressed={tab === 'skills'}
            onClick={() => setTab('skills')}
          >
            Skills
          </Button>
          <Button
            variant={tab === 'tools' ? 'default' : 'outline'}
            size="sm"
            aria-pressed={tab === 'tools'}
            onClick={() => setTab('tools')}
          >
            Tools
          </Button>
        </div>
      </div>
      {/* A consent control states its consequence at the point of the click —
          and the consequence here is unusually strong, because hiding removes
          the skill from the league totals for everyone, not just from visitors. */}
      {onToggleHidden && tab === 'skills' && (
        <p className="mt-[10px] text-[13px] leading-[17px] text-muted-foreground">
          Hiding a skill drops it from your public profile and out of the league totals — for
          everyone, not just visitors. You still see it here.
        </p>
      )}
      <div className="mt-[18px] max-h-[520px] overflow-y-auto pr-1">
        {rows.map((r) => {
          const key = `${r.kind}:${r.label}`;
          const isHidden = hidden.has(key);
          return (
            <SkillBar
              key={key}
              name={r.label}
              count={r.count}
              max={peak}
              // Dimmed rather than removed: this is the one screen where you
              // need to see what you hid in order to un-hide it.
              className={isHidden ? 'opacity-60' : undefined}
              badge={r.kind === 'mcp' ? <Badge variant="secondary">MCP</Badge> : undefined}
              onClick={() => setSubject({ label: r.label, kind: r.kind, usage: { count: r.count, scope: 'in your sessions' } })}
              // Built-ins are already dropped from every public surface, so
              // hiding one is a no-op — the validator rejects `builtin:` keys.
              action={
                onToggleHidden && r.kind !== 'builtin' ? (
                  <button
                    type="button"
                    className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground"
                    onClick={() => onToggleHidden(key, !isHidden)}
                  >
                    {isHidden ? 'Show' : 'Hide'}
                  </button>
                ) : undefined
              }
            />
          );
        })}
        {/* A plain line, not EmptyState — its own banner warns against putting
            an illustration inside an overflow-y-auto rail. */}
        {rows.length === 0 && (
          <p className="text-[15px] text-muted-foreground">
            {tab === 'skills' ? 'No skills or MCP servers used yet.' : 'No built-in tool calls yet.'}
          </p>
        )}
      </div>
      {subject && <SkillSheet subject={subject} onClose={() => setSubject(null)} />}
    </Panel>
  );
}

/** Threshold-triggered advice. Renders nothing when no rule fired. */
export function TipsPanel({ sessions }: { sessions: MySession[] }) {
  // One card per distinct rule — the same tip firing on six sessions is one
  // thing to change, not six.
  const tips = [...new Map(sessions.flatMap((x) => x.tips).map((t: Tip) => [t.id, t])).values()];
  if (tips.length === 0) return null;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <SectionLabel>WHAT TO TRY NEXT</SectionLabel>
        <span className="text-[13px] text-muted-foreground">AI-powered insights — coming soon</span>
      </div>
      <div className="mt-[12px] space-y-4">
        {tips.map((t) => (
          <div key={t.id} className="flex min-h-[110px] items-center gap-6 rounded-[16px] border border-border p-5">
            <BadgeArt id={t.id === 'clean-run' ? 'clean-run' : 'steady-hand'} size={84} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-medium leading-[20px] text-foreground">{t.title}</p>
              <p className="mt-[6px] max-w-[800px] text-[15px] leading-[20px] text-muted-foreground">{t.message}</p>
            </div>
            <span className="shrink-0 font-mono text-[13px] leading-[20px] text-muted-foreground">{t.trigger}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ProfileView({
  profile,
  live,
  sessions,
  toolTotals,
  isOwn,
  boardPosition,
  boardSize,
}: {
  profile: PublicProfile;
  live: LiveSessionJson[];
  /** Own sessions only — the API serves none for someone else's account (§6). */
  sessions: MySession[] | null;
  /** Own tool histogram — the insights half of the profile. */
  toolTotals?: Record<string, number>;
  isOwn: boolean;
  boardPosition?: number;
  boardSize?: number;
}) {
  return (
    <div className="space-y-[28px]">
      <ProfileHeader
        profile={profile}
        live={live}
        isOwn={isOwn}
        boardPosition={boardPosition}
        boardSize={boardSize}
      />

      {/* The grid wrappers stay out here so /me can re-grid the same panels
          one per tab. */}
      <div className="grid grid-cols-2 gap-5">
        <SkillsUsedPanel skills={profile.skills} isOwn={isOwn} publicSkills={profile.publicSkills} />
        <BuildingInPublicPanel projects={profile.projects} live={live} isOwn={isOwn} />
      </div>

      {isOwn && sessions ? (
        // Insights live here now: your sessions, your toolkit, what to try
        // next. The right column sticks while the long left column scrolls.
        <div className="grid grid-cols-[740fr_340fr] items-start gap-5">
          <SessionsPanel sessions={sessions} />
          <ToolkitPanel toolTotals={toolTotals} />
        </div>
      ) : (
        <SessionsPanel sessions={null} />
      )}

      {isOwn && sessions && <TipsPanel sessions={sessions} />}
    </div>
  );
}
