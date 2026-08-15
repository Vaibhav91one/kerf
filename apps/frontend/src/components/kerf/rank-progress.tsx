// The merged rank card: current crest, points, and the bar to the next level.
// Replaces the Home screen's four stat cards plus the whole tier-ladder panel —
// a percentile cut ("p20 is 0.31") told a visitor nothing, and there is a fixed
// target to fill a bar against now.

import { LeagueArt } from '@/components/kerf/artwork';
import { Progress } from '@/components/ui/progress';
import type { Rank } from '@/lib/api';

export function RankProgress({
  points,
  rank,
  streak,
  sessionCount,
}: {
  points: number;
  rank: Rank;
  streak?: number;
  sessionCount?: number;
}) {
  const remaining = rank.nextAt === null ? null : Math.max(0, rank.nextAt - points);

  return (
    <section className="rounded-[16px] border border-border bg-card px-[18px] py-5">
      <div className="flex items-start gap-[18px]">
        <LeagueArt tier={rank.tier} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-[23px] font-semibold leading-[29px] text-foreground">{rank.tier}</p>
          <p className="mt-[4px] text-[14px] leading-[18px] text-muted-foreground">
            {[
              streak === undefined ? null : `${streak} day streak`,
              sessionCount === undefined ? null : `${sessionCount} qualifying session${sessionCount === 1 ? '' : 's'}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'no sessions yet'}
          </p>
        </div>
        <div className="flex items-center gap-[14px]">
          <p className="font-mono text-[23px] leading-[29px] text-foreground">
            {points.toLocaleString('en-GB')}
            {rank.nextAt !== null && (
              <span className="text-muted-foreground"> / {rank.nextAt.toLocaleString('en-GB')}</span>
            )}
          </p>
          {rank.next && <LeagueArt tier={rank.next} size={48} />}
        </div>
      </div>

      <Progress value={rank.pct * 100} className="mt-[18px]" />
      <p className="mt-[10px] text-[14px] leading-[18px] text-muted-foreground">
        {remaining === null
          ? 'Diamond — the top level. Points keep accruing.'
          : `${remaining.toLocaleString('en-GB')} points to ${rank.next}. Points come from edits that stick, not from how much you run the CLI.`}
      </p>
    </section>
  );
}
