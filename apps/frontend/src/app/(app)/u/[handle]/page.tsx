'use client';

// Screen `Light / 03 Profile` (130:181) and its dark twin (133:1370) — the
// People destination in the rail.

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { tierForValue } from '@kerf/shared';
import {
  api,
  ApiError,
  type LiveSessionJson,
  type MeSessions,
  type PublicProfile,
  type SeasonCurrent,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar, BadgeArt, LeagueArt } from '@/components/kerf/artwork';
import { PageSkeleton, Panel, SectionLabel, StatCard } from '@/components/kerf/ui';

function SkillBar({ name, count, max }: { name: string; count: number; max: number }) {
  return (
    <div className="mt-[10px] first:mt-0">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">{name}</span>
        <span className="font-mono text-[13px] text-muted-foreground">{count}</span>
      </div>
      <div className="mt-[9px] h-[8px] rounded-[4px] bg-secondary">
        <div className="h-[8px] rounded-[4px] bg-primary" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function ProfilePage({ params }: PageProps<'/u/[handle]'>) {
  const { handle } = use(params);
  const { auth, getToken } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [mine, setMine] = useState<MeSessions | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api
      .profile(handle)
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
      });
    api.seasonCurrent().then(setSeason).catch(() => {});
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
  }, [handle]);

  const isOwn = auth?.handle === handle;
  useEffect(() => {
    if (!auth || !isOwn) {
      setMine(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setMine) : null)).catch(() => {});
  }, [auth, isOwn, getToken]);

  if (missing) return <p className="text-[14px] text-muted-foreground">No profile at @{handle}.</p>;
  if (!profile) return <PageSkeleton />;

  const { standing, badges, projects, skills } = profile;
  const rank = season ? season.standings.findIndex((s) => s.handle === handle) : -1;
  const earned = badges.filter((b) => b.earned).length;
  const firstLocked = badges.find((b) => !b.earned);
  const liveHere = live.filter((s) => s.handle === handle);
  const skillRows = Object.entries(skills ?? {}).sort((a, b) => b[1] - a[1]);
  const maxSkill = skillRows.length > 0 ? skillRows[0][1] : 1;
  const joined = new Date(profile.createdAtMs).toISOString().slice(0, 10);

  // The comp shows two identity chips. Neither is a stored field, so both are
  // derived from what the account has actually published.
  const tags = [
    projects.length > 0 ? 'Building in public' : null,
    projects.some((p) => p.repoUrl) ? 'Open source' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-[28px]">
      <Panel className="relative h-[170px] px-[22px] py-[22px]">
        <div className="flex gap-5">
          <Avatar handle={handle} size={72} className="shrink-0 rounded-full" />
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-[32px] text-foreground">{profile.displayName}</h1>
            <p className="mt-[6px] text-[12px] leading-[15px] text-muted-foreground">
              @{profile.handle} · joined {joined}
            </p>
            {profile.bio && (
              <p className="mt-[8px] max-w-[640px] text-[14px] leading-[18px] text-muted-foreground">{profile.bio}</p>
            )}
            <div className="mt-[10px] flex gap-3">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex h-[30px] items-center rounded-[15px] border border-border px-4 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute right-[22px] top-[32px] text-right">
          {/* No follow graph exists in the API; the control is shown as the comp
              draws it but cannot pretend to work. */}
          <button
            type="button"
            disabled
            title="Following is not built yet"
            className="h-[40px] w-[128px] cursor-not-allowed rounded-[12px] bg-primary text-[13px] font-medium text-primary-foreground opacity-60"
          >
            Follow
          </button>
          {liveHere.length > 0 && (
            <p className="mt-[12px] text-[11px] font-semibold text-foreground">live now</p>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="SEASON SCORE"
          value={standing.score === null ? '—' : standing.score.toFixed(3)}
          foot={`season 1, ${standing.sessionCount} session${standing.sessionCount === 1 ? '' : 's'}`}
        />
        <StatCard
          label="TIER"
          value={standing.tier ?? 'Unranked'}
          foot={rank >= 0 ? `rank ${rank + 1} of ${season?.standings.length}` : 'not in this season'}
          art={standing.tier && <LeagueArt tier={standing.tier} size={56} />}
        />
        <StatCard
          label="STREAK"
          value={`${profile.streak} day${profile.streak === 1 ? '' : 's'}`}
          foot="display only, never ranked"
          art={profile.streak > 0 ? <BadgeArt id="streak-3" size={56} /> : undefined}
        />
        <StatCard
          label="BADGES"
          value={`${earned} / ${badges.length}`}
          foot={firstLocked ? `${firstLocked.id} locked` : 'all earned'}
          art={firstLocked ? <BadgeArt id={firstLocked.id} size={56} /> : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Panel className="min-h-[420px]">
          <SectionLabel>SKILLS &amp; TOOLS THEY USE</SectionLabel>
          <p className="mt-[6px] max-w-[500px] text-[11px] leading-[14px] text-muted-foreground">
            {profile.publicSkills
              ? `Visible because @${profile.handle} turned on public skills. Off by default.`
              : `@${profile.handle} has public skills turned off. It is off by default.`}
          </p>
          <div className="mt-[22px]">
            {skillRows.map(([name, count]) => (
              <SkillBar key={name} name={name} count={count} max={maxSkill} />
            ))}
            {skillRows.length === 0 && <p className="text-[13px] text-muted-foreground">Nothing shared.</p>}
          </div>
          <p className="mt-[22px] text-[11px] leading-[14px] text-muted-foreground">
            Tool and skill names only — never their arguments.
          </p>
        </Panel>

        <Panel className="min-h-[420px]">
          <SectionLabel>BUILDING IN PUBLIC</SectionLabel>
          <div className="mt-[22px] space-y-5">
            {projects.map((p) => {
              const sessions = live.filter((s) => s.projectId === p.id).length;
              return (
                <div key={p.id} className="rounded-[16px] border border-border p-5">
                  <p className="text-[16px] font-semibold leading-[20px] text-foreground">{p.name}</p>
                  {p.description && (
                    <p className="mt-[6px] max-w-[460px] text-[13px] leading-[17px] text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  {p.repoUrl && (
                    <a
                      href={p.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-[10px] block font-mono text-[12px] text-muted-foreground hover:underline"
                    >
                      {p.repoUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <p className="mt-[14px] text-[11px] font-medium text-foreground">
                    {sessions > 0 ? `${sessions} live session${sessions === 1 ? '' : 's'}` : 'idle'}
                  </p>
                </div>
              );
            })}
            {projects.length === 0 && <p className="text-[13px] text-muted-foreground">No published projects.</p>}
          </div>
          <p className="mt-[22px] max-w-[500px] text-[11px] leading-[14px] text-muted-foreground">
            A project is linked to sessions by hash. The path never leaves their machine.
          </p>
        </Panel>
      </div>

      <Panel className={isOwn && mine ? 'min-h-[400px]' : undefined}>
        <SectionLabel>RECENT SESSIONS — NUMBERS ONLY</SectionLabel>
        {isOwn && mine ? (
          <table className="mt-[18px] w-full table-fixed">
            <thead>
              <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[10px] [&>th]:font-semibold [&>th]:leading-[13px] [&>th]:text-primary">
                <th>STARTED</th>
                <th className="w-[160px]">TURNS</th>
                <th className="w-[160px]">EDITS</th>
                <th className="w-[200px]">REWORK</th>
                <th className="w-[160px]">TIER</th>
              </tr>
            </thead>
            <tbody>
              {mine.sessions.slice(0, 6).map((s) => (
                <tr key={s.sessionId}>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">
                    {new Date(s.startedMs).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{s.turns}</td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{s.edits}</td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">
                    {s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(2)}
                  </td>
                  <td className="py-[13px] text-[13px] text-muted-foreground">
                    {season && s.reworkRatio !== null ? tierForValue(s.reworkRatio, season.cuts, false) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // §6: the API deliberately serves no per-session detail for someone
          // else's account, so this table only exists on your own profile.
          <p className="mt-[18px] max-w-[900px] text-[13px] leading-[17px] text-muted-foreground">
            Session-level history stays with its owner. A visitor sees the standing, the badges and the published
            projects — never the individual sessions behind them.
          </p>
        )}
        <p className="mt-[22px] text-[11px] leading-[14px] text-muted-foreground">
          No prompt text, no file names, no diffs — not stored, not transmitted, not renderable.
        </p>
      </Panel>
    </div>
  );
}
