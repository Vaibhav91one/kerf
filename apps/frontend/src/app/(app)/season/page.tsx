'use client';

// Screen `Light / 07 Season` (131:122) and its dark twin (133:1858).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type SeasonCurrent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';

// Read down the table: each percentile is the worst ratio still inside that
// tier. Diamond has no cut above it — it is simply everything below p20.
const CUT_ROWS = [
  { pct: 'p95', key: 'p95', tier: 'Bronze' },
  { pct: 'p80', key: 'p80', tier: 'Silver' },
  { pct: 'p50', key: 'p50', tier: 'Gold' },
  { pct: 'p20', key: 'p20', tier: 'Platinum' },
] as const;

export default function SeasonPage() {
  const { auth } = useAuth();
  const [season, setSeason] = useState<SeasonCurrent | null>(null);

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch(() => {});
  }, []);

  if (!season) return <PageSkeleton />;
  const { cuts, standings, histogram, ghosts } = season;

  const mine = auth ? standings.find((s) => s.handle === auth.handle) ?? null : null;
  const buckets = histogram ?? [];
  const peak = Math.max(1, ...buckets);
  // Which band you sit in, so the chart can mark it the way the comp does.
  const myBucket =
    mine === null ? -1 : Math.min(buckets.length - 1, Math.max(0, Math.floor(mine.score * buckets.length)));

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Season 1"
        subtitle={`Metric: rework ratio, lower is better. Cuts recompute from the live distribution of ${season.sampleSize} qualifying session${season.sampleSize === 1 ? '' : 's'}.`}
      />

      <div className="grid grid-cols-2 gap-5">
        <Panel className="min-h-[330px]">
          <SectionLabel>TIER CUTS</SectionLabel>
          <table className="mt-[12px] w-full table-fixed">
            <thead>
              <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[10px] [&>th]:font-semibold [&>th]:leading-[13px] [&>th]:text-primary">
                <th className="w-[200px]">PERCENTILE</th>
                <th className="w-[160px]">RATIO AT CUT</th>
                <th>TIER AT OR BELOW</th>
              </tr>
            </thead>
            <tbody>
              {CUT_ROWS.map((r) => (
                <tr key={r.pct}>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{r.pct}</td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{cuts[r.key].toFixed(2)}</td>
                  <td className="py-[13px] text-[13px] text-muted-foreground">{r.tier}</td>
                </tr>
              ))}
              <tr>
                <td className="py-[13px] font-mono text-[13px] font-medium text-foreground">—</td>
                <td className="py-[13px] font-mono text-[13px] font-medium text-foreground">
                  below {cuts.p20.toFixed(2)}
                </td>
                <td className="py-[13px] text-[13px] font-medium text-foreground">Diamond</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-[10px] max-w-[500px] text-[11px] leading-[14px] text-muted-foreground">
            Higher percentile means a worse ratio — the ladder inverts for this metric.
          </p>
        </Panel>

        <Panel className="flex min-h-[330px] flex-col">
          <SectionLabel>
            DISTRIBUTION — {season.sampleSize} QUALIFYING SESSION{season.sampleSize === 1 ? '' : 'S'}
          </SectionLabel>
          <div className="mt-4 flex flex-1 items-end gap-3 px-[14px]">
            {buckets.map((count, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`w-full rounded-[4px] ${i === myBucket ? 'bg-primary' : 'bg-secondary'}`}
                  style={{ height: `${Math.max(6, (count / peak) * 216)}px` }}
                />
                <span className="font-mono text-[10px] text-primary">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-[6px] flex justify-between font-mono text-[10px] text-primary">
            <span>0.0</span>
            <span>1.0</span>
          </div>
          <p className="mt-[12px] max-w-[500px] text-[11px] leading-[14px] text-muted-foreground">
            {myBucket >= 0
              ? `Your band holds ${buckets[myBucket]} session${buckets[myBucket] === 1 ? '' : 's'}. The bar is where you sit, not where you rank.`
              : 'The bar is where a ratio sits, not where anyone ranks.'}
          </p>
        </Panel>
      </div>

      <Panel>
        <SectionLabel>STANDINGS</SectionLabel>
        <p className="mt-[6px] text-[11px] leading-[14px] text-muted-foreground">
          Ranked on each player&apos;s winsorised median (§7.2). A session count never moves anyone up.
        </p>
        <table className="mt-[16px] w-full table-fixed">
          <thead>
            <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[10px] [&>th]:font-semibold [&>th]:leading-[13px] [&>th]:text-primary">
              <th className="w-[60px]">#</th>
              <th>PLAYER</th>
              <th className="w-[220px]">SCORE</th>
              <th className="w-[200px]">TIER</th>
              <th className="w-[140px]">SESSIONS</th>
              <th className="w-[100px]">STREAK</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const own = auth?.handle === s.handle;
              const tone = own ? 'font-medium text-foreground' : 'text-muted-foreground';
              return (
                <tr key={s.handle} className={own ? 'bg-card' : undefined}>
                  <td className={`rounded-l-[12px] py-[11px] font-mono text-[13px] ${tone}`}>{i + 1}</td>
                  <td className={`py-[11px] text-[13px] ${tone}`}>
                    <Link href={`/people/${s.handle}`} className="hover:underline">
                      @{s.handle}
                    </Link>
                  </td>
                  <td className={`py-[11px] font-mono text-[13px] ${tone}`}>{s.score.toFixed(3)}</td>
                  <td className={`py-[11px] text-[13px] ${tone}`}>{s.tier ?? '—'}</td>
                  <td className={`py-[11px] font-mono text-[13px] ${tone}`}>{s.sessionCount}</td>
                  <td className={`rounded-r-[12px] py-[11px] font-mono text-[13px] ${tone}`}>{s.streak}</td>
                </tr>
              );
            })}
            {/* A ghost is a pace marker from a closed season. None exist until a
                season closes out, so the row simply does not appear. */}
            {(ghosts as { label?: string; score?: number; tier?: string }[]).map((g, i) => (
              <tr key={`ghost-${i}`}>
                <td className="py-[11px] font-mono text-[13px] text-muted-foreground">—</td>
                <td className="py-[11px] text-[13px] text-muted-foreground">{g.label ?? 'ghost'}</td>
                <td className="py-[11px] font-mono text-[13px] text-muted-foreground">
                  {g.score?.toFixed(3) ?? '—'}
                </td>
                <td className="py-[11px] text-[13px] text-muted-foreground">{g.tier ?? '—'}</td>
                <td className="py-[11px] font-mono text-[13px] text-muted-foreground">—</td>
                <td className="py-[11px] font-mono text-[13px] text-muted-foreground">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-[22px] text-[11px] leading-[14px] text-muted-foreground">
          Ghosts are a pace marker, not a player. They never occupy a rank.
        </p>
        <p className="mt-[10px] text-[11px] leading-[14px] text-muted-foreground">
          Spec §7.2 — ranking is on a ratio. Totals, streaks and badges are shown but never ordered on.
        </p>
      </Panel>
    </div>
  );
}
