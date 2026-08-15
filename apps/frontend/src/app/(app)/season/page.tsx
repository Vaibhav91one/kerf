'use client';

// Screen `Light / 07 Season` (131:122) and its dark twin (133:1858).
//
// The comp's TIER CUTS table printed percentiles ("p80 · 0.62 · Silver"), which
// only meant something to whoever wrote the spec. Levels are fixed point
// thresholds now, so the table states the price of each crest. The distribution
// histogram is gone with the cuts it described.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { SESSION_MIN_EDITS, SESSION_MIN_TURNS } from '@kerf/shared';
import { api, type MeSessions, type SeasonCurrent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/hooks/use-refresh';
import { BadgeArt, LeagueArt } from '@/components/kerf/artwork';
import { EmptyState } from '@/components/kerf/empty-state';
import { CommandBlock, PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { Button } from '@/components/ui/button';
import { seasonNumber } from '@/lib/time';

export default function SeasonPage() {
  const { auth, signedIn, clerkEnabled, getToken } = useAuth();
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [me, setMe] = useState<MeSessions | null>(null);
  // Without this a backend failure holds the skeleton forever — the 30s poll
  // below will eventually recover on its own once the backend does, but the
  // first failed attempt should say so rather than pulse silently.
  const [failed, setFailed] = useState(false);

  // The board is the one screen where "the number I am looking at is current"
  // is the whole product, and it used to be frozen at page load.
  const { tick } = useRefresh();

  useEffect(() => {
    api
      .seasonCurrent()
      .then((s) => {
        setSeason(s);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [tick]);

  useEffect(() => {
    if (!auth) {
      setMe(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setMe) : null)).catch(() => setMe(null));
  }, [auth, getToken, tick]);

  if (failed && !season) {
    return <p className="text-[16px] text-muted-foreground">Could not load the season board. Retrying…</p>;
  }
  if (!season) return <PageSkeleton />;
  const { levels, standings } = season;
  const mine = auth ? standings.find((s) => s.handle === auth.handle) ?? null : null;

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title={`Season ${seasonNumber()}`}
        subtitle={`${standings.length} player${standings.length === 1 ? '' : 's'} this month.`}
      />

      {/* Where the viewer stands relative to the board. Public page, so it has
          to say something useful signed out too. */}
      <Panel>
        {mine ? (
          <>
            <SectionLabel>YOUR STANDING</SectionLabel>
            {mine.qualified ? (
              <p className="mt-[10px] text-[16px] leading-[23px] text-foreground">
                #{standings.filter((s) => s.qualified).indexOf(mine) + 1} of{' '}
                {standings.filter((s) => s.qualified).length} with {mine.monthPoints.toLocaleString('en-GB')} points
                this month.
              </p>
            ) : (
              <>
                <p className="mt-[10px] text-[16px] leading-[23px] text-foreground">
                  Not yet ranked — a place on the board needs both halves of the floor.
                </p>
                <p className="mt-[6px] text-[14px] leading-[18px] text-muted-foreground">
                  {mine.seasonSessions} of {season.floor.sessions} qualifying sessions · {mine.seasonCommits} of{' '}
                  {season.floor.commits} commits this month.
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <SectionLabel>YOU ARE NOT ON THIS BOARD YET</SectionLabel>
            <p className="mt-[10px] max-w-[720px] text-[16px] leading-[23px] text-muted-foreground">
              {auth
                ? 'Connect the CLI and sync a session to take a place on the board.'
                : 'Sign in and connect the CLI to take a place on the board.'}
            </p>
            <div className="mt-[16px]">
              {auth || !clerkEnabled || signedIn ? (
                <Button nativeButton={false} render={<Link href="/me" />}>
                  {auth ? 'Connect your CLI' : 'Sign in'}
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button>Sign in</Button>
                </SignInButton>
              )}
            </div>
            <CommandBlock
              className="mt-[18px] max-w-[620px]"
              lines={[['kerf login'], ['kerf sync', '# upload session history']]}
            />
          </>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-5">
        <Panel className="min-h-[330px]">
          <SectionLabel>LEVELS</SectionLabel>
          <table className="mt-[12px] w-full table-fixed">
            <thead>
              <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[12px] [&>th]:font-semibold [&>th]:leading-[16px] [&>th]:text-primary">
                <th className="w-[80px]">CREST</th>
                <th>LEVEL</th>
                <th className="w-[180px]">POINTS</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.tier}>
                  <td className="py-[11px]">
                    <LeagueArt tier={l.tier} size={32} />
                  </td>
                  <td className="py-[11px] text-[15px] text-muted-foreground">{l.tier}</td>
                  <td className="py-[11px] font-mono text-[15px] text-muted-foreground">
                    {l.min === 0 ? 'from the first session' : `${l.min.toLocaleString('en-GB')}+`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="min-h-[330px]">
          <SectionLabel>HOW POINTS ARE EARNED</SectionLabel>
          <div className="mt-[16px] space-y-[14px] text-[15px] leading-[20px] text-muted-foreground">
            <p>
              <span className="text-foreground">Edits that stick.</span> An edit you never have to redo is worth more
              than three you do. The count grows on a log scale, so a huge session cannot bury a careful one.
            </p>
            <p>
              <span className="text-foreground">Precision.</span> The share of your edits that landed first time. This
              is the largest part of a session&apos;s score.
            </p>
            <p>
              <span className="text-foreground">Focus.</span> How much lands per prompt, capped — one enormous write
              hits the ceiling instead of running away with the board.
            </p>
            <p className="text-[13px]">
              A session must clear the floor ({SESSION_MIN_TURNS} human turns, {SESSION_MIN_EDITS} edit) to score at
              all, and each day&apos;s points are capped. Running the CLI more is not a strategy.
            </p>
          </div>
        </Panel>
      </div>

      {me && (
        <Panel>
          <SectionLabel>BADGES</SectionLabel>
          <p className="mt-[6px] text-[13px] text-muted-foreground">
            The full ladder. Home shows only the next one.
          </p>
          <div className="mt-[16px] grid grid-cols-3 gap-4">
            {me.badges.map((b) => {
              const pct = Math.round((b.progress.have / b.progress.need) * 100);
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-4 rounded-[16px] border border-border p-4 ${b.earned ? '' : 'opacity-70'}`}
                >
                  <BadgeArt id={b.id} size={48} className={b.earned ? 'shrink-0' : 'shrink-0 opacity-60'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">{b.id}</p>
                    <p className="mt-[4px] text-[13px] leading-[17px] text-muted-foreground">{b.requirement}</p>
                    <div className="mt-[8px] h-[6px] overflow-hidden rounded-[3px] bg-secondary">
                      <div className="h-[6px] rounded-[3px] bg-primary" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <p className="mt-[6px] font-mono text-[12px] text-muted-foreground">
                      {b.earned ? 'earned' : `${b.progress.have} of ${b.progress.need}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel>
        <SectionLabel>STANDINGS</SectionLabel>
        {standings.length === 0 ? (
          <EmptyState
            illustration="insights"
            title="No one has scored this month"
            action={
              <Button nativeButton={false} render={<Link href="/me" />}>
                Connect your CLI
              </Button>
            }
          >
            The board fills up as soon as someone syncs a qualifying session.
          </EmptyState>
        ) : (
        <table className="mt-[16px] w-full table-fixed">
          <thead>
            <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[12px] [&>th]:font-semibold [&>th]:leading-[16px] [&>th]:text-primary">
              <th className="w-[60px]">#</th>
              <th>PLAYER</th>
              <th className="w-[100px]">LEVEL</th>
              <th className="w-[180px]">POINTS THIS MONTH</th>
              <th className="w-[140px]">SESSIONS</th>
              <th className="w-[100px]">STREAK</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Rank counts only qualified rows — standings is already sorted
              // qualified-first (index.ts), so an unqualified player never
              // occupies a rank number the way a real Nth place would.
              let qualifiedRank = 0;
              return standings.map((s) => {
                const own = auth?.handle === s.handle;
                const tone = own ? 'font-medium text-foreground' : 'text-muted-foreground';
                if (s.qualified) qualifiedRank += 1;
                return (
                  // Same vocabulary as SessionTable's non-qualifying rows: greyed,
                  // not hidden — the floor should be visible, not filtered away.
                  <tr key={s.handle} className={own ? 'bg-card' : s.qualified ? undefined : 'opacity-60'}>
                    <td className={`rounded-l-[12px] py-[11px] font-mono text-[15px] ${tone}`}>
                      {s.qualified ? qualifiedRank : '—'}
                    </td>
                    <td className={`py-[11px] text-[15px] ${tone}`}>
                      <Link href={`/people/${s.handle}`} className="hover:underline">
                        @{s.handle}
                      </Link>
                    </td>
                    <td className="py-[11px]">
                      <LeagueArt tier={s.tier} size={28} />
                    </td>
                    <td className={`py-[11px] font-mono text-[15px] ${tone}`}>{s.monthPoints.toLocaleString('en-GB')}</td>
                    <td className={`py-[11px] font-mono text-[15px] ${tone}`}>{s.sessionCount}</td>
                    <td className={`rounded-r-[12px] py-[11px] font-mono text-[15px] ${tone}`}>{s.streak}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        )}
      </Panel>
    </div>
  );
}
