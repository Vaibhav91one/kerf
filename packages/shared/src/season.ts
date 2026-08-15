// Rank tiers — kerf-spec.md §7.3, superseded from percentile cuts to fixed
// point thresholds by points.ts. Only the tier name type survives from that;
// LEVELS/rankFor live in points.ts.

import type { SessionMetric } from './schema.ts';

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

// §7.4's SEASON floor. metrics.ts's SESSION_MIN_TURNS/SESSION_MIN_EDITS gate
// SCORING for one session; this one gates RANKING for the season and is a
// cross-session, per-UTC-month predicate — which is why it can never be a
// boolean column on an uploaded row the way the per-session floor is.
export const SEASON_MIN_SESSIONS = 10;
export const SEASON_MIN_COMMITS = 5;

/** Start of the UTC calendar month `nowMs` falls in — the season boundary. */
export function monthStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Start of the month AFTER `nowMs`'s — the exclusive upper bound. */
export function monthEndMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export type SeasonQualification = { qualified: boolean; sessions: number; commits: number };

/**
 * Whether an account has cleared the season floor for the UTC month `nowMs`
 * falls in. `sessions` counts only rows that already cleared metrics.ts's
 * own per-session floor (`qualifies`) — a session that never scored can't
 * help you onto the board either.
 */
export function seasonQualification(sessions: SessionMetric[], commits: number, nowMs: number): SeasonQualification {
  const start = monthStartMs(nowMs);
  const end = monthEndMs(nowMs);
  const count = sessions.filter((s) => s.qualifies && s.startedMs >= start && s.startedMs < end).length;
  return {
    qualified: count >= SEASON_MIN_SESSIONS && commits >= SEASON_MIN_COMMITS,
    sessions: count,
    commits,
  };
}
