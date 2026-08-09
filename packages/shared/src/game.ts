// Game layer — streaks, badges, XP-ish progress bars.
//
// Spec §7.2 says "never a total": you may not RANK on a count. Everything in
// here is display-only — it decorates a profile, it never feeds tierForValue()
// and never orders a leaderboard. Keep it that way; the moment a streak count
// decides standings, the metric has become "who ran the CLI most", which is the
// exact failure mode §7.2 exists to prevent.

import type { SessionMetric } from './schema.ts';
import type { TierCuts } from './season.ts';

const DAY_MS = 86_400_000;

function utcDay(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/**
 * Consecutive UTC days ending today (or yesterday — a streak isn't broken until
 * the day after the one you missed, otherwise everyone's streak dies at 00:00).
 */
export function currentStreak(sessions: { startedMs: number }[], nowMs: number): number {
  const days = new Set(sessions.map((s) => utcDay(s.startedMs)));
  const today = utcDay(nowMs);
  let cursor = days.has(today) ? today : today - 1;
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export type Badge = { id: string; label: string; earned: boolean };

/**
 * Badges are ratio- or consistency-based, never volume-based. "Ran 100
 * sessions" is deliberately absent — that is a total wearing a medal.
 */
export function badges(sessions: SessionMetric[], cuts: TierCuts, nowMs: number): Badge[] {
  const qualifying = sessions.filter((s) => s.qualifies && s.reworkRatio !== null);
  const ratios = qualifying.map((s) => s.reworkRatio as number);
  const streak = currentStreak(qualifying, nowMs);

  // Lower rework is better, so "beat p20" means <= p20.
  const elite = ratios.filter((r) => r <= cuts.p20).length;
  const cleanRun = qualifying.some((s) => s.editsRework === 0 && s.edits >= 3);
  const lastFive = qualifying.slice(0, 5).map((s) => s.reworkRatio as number);
  const consistent = lastFive.length === 5 && lastFive.every((r) => r <= cuts.p50);

  return [
    { id: 'clean-run', label: 'Clean Run — a 3+ edit session with zero rework', earned: cleanRun },
    { id: 'diamond-session', label: 'Diamond Session — a session at or under season p20', earned: elite >= 1 },
    { id: 'diamond-x5', label: 'Diamond x5 — five sessions at or under season p20', earned: elite >= 5 },
    { id: 'steady-hand', label: 'Steady Hand — last 5 sessions all at or under season p50', earned: consistent },
    { id: 'streak-3', label: '3-Day Streak', earned: streak >= 3 },
    { id: 'streak-7', label: '7-Day Streak', earned: streak >= 7 },
  ];
}

/**
 * Progress toward the next tier, 0..1, for a progress bar. Returns null when
 * there is nothing to climb (already Diamond) or no sample to compare against.
 *
 * Rework ratio is a lower-is-better metric, so "progress" means travelling DOWN
 * the value axis. The bar fills as the ratio drops toward the next cut.
 */
export function tierProgress(value: number, cuts: TierCuts): { next: string; pct: number } | null {
  const ladder: [string, number, number][] = [
    // [next tier, worse bound, target cut]
    ['Silver', Infinity, cuts.p95],
    ['Gold', cuts.p95, cuts.p80],
    ['Platinum', cuts.p80, cuts.p50],
    ['Diamond', cuts.p50, cuts.p20],
  ];
  for (const [next, worse, target] of ladder) {
    if (value > target && value <= worse) {
      // ponytail: an unbounded top band (value > p95) has no meaningful
      // denominator, so it reports 0% rather than inventing a scale.
      if (!Number.isFinite(worse)) return { next, pct: 0 };
      const span = worse - target;
      if (span <= 0) return { next, pct: 0 };
      return { next, pct: Math.min(1, Math.max(0, (worse - value) / span)) };
    }
  }
  return null; // at or under p20 — already Diamond
}
