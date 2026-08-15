'use client';

// New route — no comp to match, since Rivals was reopened scope after the
// hackathon (kerf-spec.md §8 picks it as the retention mechanic over a global
// board). Built from existing house pieces: StatCard (documented in ui.tsx as
// "kept for the next stats surface" — this is that surface), the follow list
// from GET /api/me/follows, and the season standings everything else already
// derives points from.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { MAX_RIVALS } from '@kerf/shared';
import { api, type FollowEdge, type PublicProfileSummary, type SeasonCurrent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/hooks/use-refresh';
import { Avatar, LeagueArt } from '@/components/kerf/artwork';
import { EmptyState } from '@/components/kerf/empty-state';
import { PageHeader, Panel, PageSkeleton, SectionLabel, StatCard } from '@/components/kerf/ui';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function monthPointsFor(standings: SeasonCurrent['standings'], handle: string): number | null {
  return standings.find((s) => s.handle === handle)?.monthPoints ?? null;
}

export default function RivalsPage() {
  const { auth, signedIn, clerkEnabled, getToken } = useAuth();
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [profiles, setProfiles] = useState<PublicProfileSummary[]>([]);
  const [following, setFollowing] = useState<FollowEdge[]>([]);
  const { tick } = useRefresh();

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch(() => {});
    api.profiles().then((r) => setProfiles(r.profiles)).catch(() => {});
  }, [tick]);

  useEffect(() => {
    if (!auth) {
      setFollowing([]);
      return;
    }
    void getToken()
      .then((t) => (t ? api.myFollows(t).then((r) => setFollowing(r.following)) : null))
      .catch(() => {});
  }, [auth, getToken, tick]);

  async function setRival(handle: string, next: boolean) {
    const token = await getToken();
    if (!token) return;
    setFollowing((prev) => prev.map((f) => (f.handle === handle ? { ...f, isRival: next } : f)));
    try {
      await api.setRival(token, handle, next);
      toast.success(next ? 'Rival added' : 'Rival removed');
    } catch {
      setFollowing((prev) => prev.map((f) => (f.handle === handle ? { ...f, isRival: !next } : f)));
      toast.error(next ? `Could not add rival — at most ${MAX_RIVALS} at a time` : 'Could not update rival');
    }
  }

  if (!season) return <PageSkeleton />;

  const displayNameFor = (handle: string) => profiles.find((p) => p.handle === handle)?.displayName ?? handle;
  const rivalCount = following.filter((f) => f.isRival).length;
  const mine = auth ? season.standings.find((s) => s.handle === auth.handle) : undefined;
  const rivals = following.filter((f) => f.isRival);

  return (
    <div className="space-y-[28px]">
      <PageHeader title="Rivals" subtitle="Up to three people you are racing this month." />

      {!auth ? (
        <Panel>
          <EmptyState
            illustration="insights"
            title="Sign in to pick your rivals"
            action={
              clerkEnabled && !signedIn ? (
                <SignInButton mode="modal">
                  <Button>Sign in</Button>
                </SignInButton>
              ) : (
                <Button nativeButton={false} render={<Link href="/me" />}>
                  Go to your account
                </Button>
              )
            }
          >
            Rivals are drawn from who you follow — sign in to start following people.
          </EmptyState>
        </Panel>
      ) : following.length === 0 ? (
        <Panel>
          <EmptyState
            illustration="insights"
            title="You are not following anyone yet"
            action={
              <Button nativeButton={false} render={<Link href="/people" />}>
                Find people
              </Button>
            }
          >
            Follow a few people, then mark up to {MAX_RIVALS} of them as rivals.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard
              label={`YOU · ${mine?.tier ?? 'BRONZE'}`}
              value={(mine?.monthPoints ?? 0).toLocaleString('en-GB')}
              foot="points this month"
              art={<LeagueArt tier={mine?.tier ?? 'Bronze'} size={40} />}
            />
            {rivals.slice(0, MAX_RIVALS).map((r) => {
              const points = monthPointsFor(season.standings, r.handle);
              const diff = points === null || !mine ? null : points - mine.monthPoints;
              return (
                <StatCard
                  key={r.handle}
                  label={`@${r.handle}`}
                  value={points === null ? '—' : points.toLocaleString('en-GB')}
                  foot={
                    diff === null
                      ? 'no qualifying sessions yet'
                      : diff === 0
                        ? 'tied with you'
                        : diff > 0
                          ? `${diff.toLocaleString('en-GB')} ahead of you`
                          : `${Math.abs(diff).toLocaleString('en-GB')} behind you`
                  }
                />
              );
            })}
          </div>

          <Panel>
            <SectionLabel>WHO YOU FOLLOW</SectionLabel>
            <div className="mt-[16px] space-y-[10px]">
              {following.map((f) => {
                const points = monthPointsFor(season.standings, f.handle);
                const disabled = !f.isRival && rivalCount >= MAX_RIVALS;
                return (
                  <div
                    key={f.handle}
                    className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-[10px]"
                  >
                    <Avatar handle={f.handle} size={32} className="shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${encodeURIComponent(f.handle)}`} className="block truncate text-[15px] font-medium text-foreground hover:underline">
                        {displayNameFor(f.handle)}
                      </Link>
                      <p className="truncate text-[13px] text-muted-foreground">
                        @{f.handle} · {points === null ? 'no qualifying sessions yet' : `${points.toLocaleString('en-GB')} pts this month`}
                      </p>
                    </div>
                    <Button
                      variant={f.isRival ? 'default' : 'outline'}
                      size="sm"
                      disabled={disabled}
                      title={disabled ? `Up to ${MAX_RIVALS} rivals — drop one first` : undefined}
                      onClick={() => void setRival(f.handle, !f.isRival)}
                    >
                      {f.isRival ? 'Rival' : 'Make rival'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
