'use client';

// Home. Deliberately NOT a leaderboard — /season owns the board, and the two
// used to render the same standings table off the same fetch. Home answers
// "where do I stand and what is the place doing right now"; /season answers
// "who is winning and how does scoring work".

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { nextBadge } from '@kerf/shared';
import {
  api,
  ApiError,
  type LiveSessionJson,
  type MeSessions,
  type ProjectJson,
  type SkillsResponse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/hooks/use-refresh';
import { BadgeCarousel, BadgeProgress } from '@/components/kerf/badge-carousel';
import { LiveCard } from '@/components/kerf/live-card';
import { RankProgress } from '@/components/kerf/rank-progress';
import { SkillOfTheDay, TrendingSkills } from '@/components/kerf/trending-skills';
import { CommandBlock, PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { auth, signedIn, clerkEnabled, getToken } = useAuth();
  const [live, setLive] = useState<LiveSessionJson[] | null>(null);
  const [projects, setProjects] = useState<ProjectJson[]>([]);
  const [skills, setSkills] = useState<SkillsResponse | null>(null);
  const [me, setMe] = useState<MeSessions | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `tick` drives the refetches below; `nowMs` moves the elapsed labels on the
  // live tiles, which used to freeze at page-load time because it was set once
  // with no interval.
  const { tick, nowMs } = useRefresh();

  useEffect(() => {
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => setLive([]));
    api.projects().then((r) => setProjects(r.projects)).catch(() => setProjects([]));
    api
      .skills('7d')
      .then(setSkills)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load skills'));
  }, [tick]);

  useEffect(() => {
    if (!auth) {
      setMe(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setMe) : null)).catch(() => setMe(null));
  }, [auth, getToken, tick]);

  if (error) return <p className="text-[16px] text-destructive">{error}</p>;
  if (!skills) return <PageSkeleton />;

  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? null : null);
  const next = me ? nextBadge(me.badges) : null;
  const connected = Boolean(me?.hasCliToken);

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Kerf"
        subtitle="A league for coding-agent CLI users. Your transcripts stay on your machine; only numbers travel."
      />

      {/* Who you are, or how to become someone. Three states in one panel so a
          logged-out visitor gets a way in rather than an empty rank card. */}
      {me && connected ? (
        <Panel>
          <RankProgress
            points={me.totalPoints}
            rank={me.rank}
            streak={me.streak}
            sessionCount={me.sessions.filter((s) => s.qualifies).length}
          />
          <div className="mt-[18px]">
            <SectionLabel>YOUR BADGES</SectionLabel>
            <div className="mt-[10px]">
              <BadgeCarousel badges={me.badges} />
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <SectionLabel>{auth ? 'CONNECT YOUR CLI' : 'JOIN KERF'}</SectionLabel>
          <p className="mt-[10px] max-w-[720px] text-[16px] leading-[23px] text-muted-foreground">
            {auth
              ? 'Run kerf login once and your sessions start scoring. Nothing uploads until you do.'
              : 'Sign in, run the CLI where you already work, and your sessions start scoring.'}
          </p>
          <div className="mt-[16px]">
            {auth ? (
              <Button nativeButton={false} render={<Link href="/me" />}>
                Connect your CLI
              </Button>
            ) : clerkEnabled && !signedIn ? (
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
            ) : (
              <Button nativeButton={false} render={<Link href="/me" />}>
                Sign in
              </Button>
            )}
          </div>
          <CommandBlock
            className="mt-[18px] max-w-[620px]"
            lines={[
              ['npm i -g kerf'],
              ['kerf login', '# opens this dashboard, stores the token'],
              ['kerf sync', '# upload session history'],
            ]}
          />
        </Panel>
      )}

      {/* Only for someone who has something to progress — a bar with nobody's
          numbers in it is worse than no bar. */}
      {next && (
        <Panel>
          <SectionLabel>NEXT BADGE</SectionLabel>
          <div className="mt-[16px]">
            <BadgeProgress badge={next} />
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 items-start gap-5">
        <SkillOfTheDay skill={skills.skillOfTheDay} />
        <TrendingSkills skills={skills.skills} />
      </div>

      <Panel>
        <div className="flex items-start justify-between">
          <SectionLabel>
            LIVE NOW — {live?.length ?? 0} SESSION{live?.length === 1 ? '' : 'S'}
          </SectionLabel>
          <Link href="/live" className="text-[14px] font-medium leading-[16px] text-foreground hover:underline">
            Watch all
          </Link>
        </div>
        <div className="mt-[10px] grid grid-cols-3 gap-4">
          {(live ?? []).slice(0, 3).map((s) => (
            <LiveCard key={s.sessionId} session={s} projectName={projectName(s.projectId)} nowMs={nowMs} />
          ))}
        </div>
        {live !== null && live.length === 0 && (
          <p className="mt-[10px] text-[14px] text-muted-foreground">No one is live right now.</p>
        )}
      </Panel>
    </div>
  );
}
