'use client';

// Screen `Light / 01 Home` (129:2) and its dark twin (133:1053).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { tierForValue, type Tier } from '@kerf/shared';
import {
  api,
  ApiError,
  type LiveSessionJson,
  type MeSessions,
  type ProjectJson,
  type SeasonCurrent,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BadgeArt, LeagueArt } from '@/components/kerf/artwork';
import { PageHeader, PageSkeleton, Panel, SectionLabel, StatCard } from '@/components/kerf/ui';
import { EmptySeason } from '@/components/kerf/empty-season';

// The ladder always reads Bronze → Diamond left to right; because a lower
// rework ratio is better, each chip is labelled with the cut it sits under and
// Diamond is simply "best" (§7.2 — the ladder inverts, the UI must not re-sort).
const LADDER: { tier: Tier; cut: keyof SeasonCurrent['cuts'] | null }[] = [
  { tier: 'Bronze', cut: 'p95' },
  { tier: 'Silver', cut: 'p80' },
  { tier: 'Gold', cut: 'p50' },
  { tier: 'Platinum', cut: 'p20' },
  { tier: 'Diamond', cut: null },
];

// ponytail: seasons are UTC calendar months and the first one is 2026-08, so
// the ordinal is derivable without a persisted season row. Swap for the
// season's own id when close-out lands (see prisma/schema.prisma header).
const FIRST_SEASON = { year: 2026, month: 7 };

function seasonNumber(now = new Date()): number {
  return (now.getUTCFullYear() - FIRST_SEASON.year) * 12 + (now.getUTCMonth() - FIRST_SEASON.month) + 1;
}

function LiveTile({ s, projectName }: { s: LiveSessionJson; projectName: string | null }) {
  return (
    <div className="rounded-[16px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-live" />
        <Link href={`/people/${s.handle}`} className="text-[14px] font-semibold text-foreground hover:underline">
          @{s.handle}
        </Link>
      </div>
      <p className="mt-[10px] text-[12px] leading-[15px] text-muted-foreground">{projectName ?? 'private'}</p>
      <p className="mt-[13px] font-mono text-[12px] leading-[15px] text-muted-foreground">
        {s.turns} turns · {s.edits} edits
      </p>
      <p className="mt-[9px] text-[10px] font-semibold leading-[13px] text-foreground">rework so far</p>
      <div className="mt-[3px] flex items-center gap-4">
        <p className="font-mono text-[20px] leading-[25px] text-foreground">
          {s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(2)}
        </p>
        <div className="ml-auto h-[6px] w-[126px] rounded-[3px] bg-secondary" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { auth, getToken } = useAuth();
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [live, setLive] = useState<LiveSessionJson[] | null>(null);
  const [projects, setProjects] = useState<ProjectJson[]>([]);
  const [me, setMe] = useState<MeSessions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load season'));
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => setLive([]));
    api.projects().then((r) => setProjects(r.projects)).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!auth) {
      setMe(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setMe) : null)).catch(() => setMe(null));
  }, [auth, getToken]);

  if (error) return <p className="text-[14px] text-destructive">{error}</p>;
  if (!season) return <PageSkeleton />;
  if (season.sampleSize === 0) return <EmptySeason />;

  const { cuts, standings } = season;
  const mine = auth ? standings.find((s) => s.handle === auth.handle) ?? null : null;
  const myScore = mine?.score ?? null;
  const myTier = myScore === null ? null : tierForValue(myScore, cuts, false);
  const qualifying = me?.sessions.filter((s) => s.qualifies).length ?? null;
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? null : null);

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title={`Season ${seasonNumber()} — rework ratio`}
        subtitle={`Lower is better. ${season.sampleSize} qualifying session${season.sampleSize === 1 ? '' : 's'} across ${standings.length} player${standings.length === 1 ? '' : 's'}. Ranking is on ratio only — never a total.`}
      />

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="YOUR REWORK RATIO"
          value={myScore === null ? '—' : myScore.toFixed(3)}
          foot={mine ? `season score over ${mine.sessionCount} sessions` : 'connect your CLI to rank'}
        />
        <StatCard
          label="TIER"
          value={myTier ?? '—'}
          foot={`p20 cut is ${cuts.p20.toFixed(2)}`}
          art={myTier && <LeagueArt tier={myTier} size={56} />}
        />
        <StatCard
          label="STREAK"
          value={me ? `${me.streak} days` : '—'}
          foot="display only, never ranked"
          art={me && me.streak > 0 ? <BadgeArt id="streak-3" size={56} /> : undefined}
        />
        <StatCard
          label="QUALIFYING"
          value={me ? `${qualifying} / ${me.sessions.length}` : '—'}
          foot="floor: 3 turns + 1 edit"
        />
      </div>

      <Panel>
        <SectionLabel>TIER LADDER</SectionLabel>
        <div className="mt-[12px] grid grid-cols-5 gap-3">
          {LADDER.map(({ tier, cut }) => {
            const active = myTier === tier;
            return (
              <div key={tier}>
                <div
                  className={`flex h-[44px] items-center justify-between rounded-[12px] px-[14px] ${
                    active ? 'bg-accent' : 'border border-border bg-card'
                  }`}
                >
                  <span
                    className={`text-[13px] ${active ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'}`}
                  >
                    {tier}
                  </span>
                  <LeagueArt tier={tier} size={40} />
                </div>
                <p className="mt-[10px] font-mono text-[11px] leading-[14px] text-muted-foreground">
                  {cut ? `${cut}  ${cuts[cut].toFixed(2)}` : 'best'}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-[10px] text-[12px] leading-[15px] text-muted-foreground">
          {myScore === null
            ? 'The ladder inverts for rework ratio: lower is better.'
            : `You sit at ${myScore.toFixed(3)} — inside the ${myTier} band. The ladder inverts for rework ratio: lower is better.`}
        </p>
      </Panel>

      <Panel>
        <div className="flex items-start justify-between">
          <SectionLabel>
            LIVE NOW — {live?.length ?? 0} SESSION{live?.length === 1 ? '' : 'S'}
          </SectionLabel>
          <Link href="/live" className="text-[12px] font-medium leading-[13px] text-foreground hover:underline">
            Watch all
          </Link>
        </div>
        <div className="mt-[10px] grid grid-cols-3 gap-4">
          {(live ?? []).slice(0, 3).map((s) => (
            <LiveTile key={s.sessionId} s={s} projectName={projectName(s.projectId)} />
          ))}
        </div>
        {live !== null && live.length === 0 && (
          <p className="mt-[10px] text-[12px] text-muted-foreground">No one is live right now.</p>
        )}
      </Panel>

      {me && (
        <Panel>
          <SectionLabel>BADGES — DISPLAY ONLY, NEVER RANKED</SectionLabel>
          <div className="mt-[12px] grid grid-cols-6 gap-3">
            {me.badges.map((b) => (
              <div
                key={b.id}
                className={`relative flex h-[58px] flex-col justify-center rounded-[12px] px-[14px] ${
                  b.earned ? 'bg-accent' : 'border border-border bg-card'
                }`}
              >
                <p
                  className={`text-[12px] leading-[15px] ${
                    b.earned ? 'font-medium text-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {b.id}
                </p>
                <p
                  className={`text-[10px] leading-[13px] ${b.earned ? 'text-accent-foreground' : 'text-muted-foreground'}`}
                >
                  {b.earned ? 'earned' : 'locked'}
                </p>
                <div className="absolute right-[6px] top-[7px]">
                  <BadgeArt id={b.id} size={44} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <SectionLabel>STANDINGS — SEASON SCORE PER PLAYER</SectionLabel>
        <table className="mt-[10px] w-full table-fixed">
          <thead>
            <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[10px] [&>th]:font-semibold [&>th]:leading-[13px] [&>th]:text-primary">
              <th className="w-[60px]">#</th>
              <th>PLAYER</th>
              <th className="w-[260px]">SCORE</th>
              <th className="w-[220px]">TIER</th>
              <th className="w-[100px]">SESSIONS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const own = auth?.handle === s.handle;
              const tone = own ? 'font-medium text-foreground' : 'text-muted-foreground';
              return (
                <tr key={s.handle}>
                  <td className={`py-[9px] font-mono text-[13px] ${tone}`}>{i + 1}</td>
                  <td className={`py-[9px] text-[13px] ${tone}`}>
                    <Link href={`/people/${s.handle}`} className="hover:underline">
                      @{s.handle}
                    </Link>
                  </td>
                  <td className={`py-[9px] font-mono text-[13px] ${tone}`}>{s.score.toFixed(3)}</td>
                  <td className={`py-[9px] text-[13px] ${tone}`}>{s.tier ?? '—'}</td>
                  <td className={`py-[9px] font-mono text-[13px] ${tone}`}>{s.sessionCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
