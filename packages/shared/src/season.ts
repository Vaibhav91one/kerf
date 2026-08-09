// Season scoring — kerf-spec.md §7.2, §7.3. No I/O. Amendment F.

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Median of values winsorised at p5/p95 — kerf-spec.md §7.2.
export function seasonScore(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p5 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  const clamped = sorted.map((v) => Math.min(Math.max(v, p5), p95));
  return percentile(clamped, 0.5);
}

export type TierCuts = { p20: number; p50: number; p80: number; p95: number };

export function tierCuts(values: number[]): TierCuts {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p20: percentile(sorted, 0.2),
    p50: percentile(sorted, 0.5),
    p80: percentile(sorted, 0.8),
    p95: percentile(sorted, 0.95),
  };
}

// higherIsBetter=false for metrics like rework ratio, where a lower value is
// the better outcome — the tier ladder still runs Bronze -> Diamond, but the
// cut direction inverts.
export function tierForValue(value: number, cuts: TierCuts, higherIsBetter = true): Tier {
  const rank = value <= cuts.p20 ? 0 : value <= cuts.p50 ? 1 : value <= cuts.p80 ? 2 : value <= cuts.p95 ? 3 : 4;
  const tiers: Tier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  return higherIsBetter ? tiers[rank] : tiers[4 - rank];
}
