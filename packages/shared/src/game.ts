// Game layer — streaks and badges. Rank/level progress now lives in
// points.ts (rankFor) since it replaced the percentile-cut tier ladder.
//
// This file used to say "never rank on a total" per spec §7.2. points.ts now
// does exactly that — a deliberate, documented deviation (see points.ts's own
// banner for the §7.5 degenerate-play counters). Badges stay ratio- and
// consistency-based regardless: "Ran 100 sessions" is still deliberately
// absent as a badge — that would be a second, undocumented total.

import type { SessionMetric } from './schema.ts';
import { sessionPoints } from './points.ts';

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

export type Badge = {
  id: string;
  label: string;
  earned: boolean;
  /** `have` is clamped to `need`, so have/need is a bar fraction. earned === (have >= need). */
  progress: { have: number; need: number };
  /** Imperative, one line. Never prints a rework ratio — that is the engine, not a readout. */
  requirement: string;
};

const DIAMOND_SESSION_POINTS = 100;
const STEADY_HAND_RATIO = 0.2;

function badge(id: string, label: string, requirement: string, have: number, need: number): Badge {
  const clamped = Math.max(0, Math.min(have, need));
  return { id, label, earned: clamped >= need, progress: { have: clamped, need }, requirement };
}

/**
 * Badges are ratio- or consistency-based, never volume-based. Fixed
 * thresholds now (points.ts killed the percentile cuts these used to read).
 *
 * Every badge also reports progress, so an unearned one can say "2 of 5"
 * instead of just "no". Two of the six are not naturally counters:
 *
 * - clean-run reports the BEST PARTIAL attempt — your cleanest session's edit
 *   count, and 0 for any session that re-touched a file. So "2 of 3" means one
 *   more clean edit in one session, not "two sessions down".
 * - steady-hand reports the CURRENT LEADING RUN, not "4 of your last 5". A run
 *   is monotone and predictive; a count sticks at 4/5 forever while the bad
 *   session sits in the middle.
 *
 * Both keep their original boolean exactly.
 */
export function badges(sessions: SessionMetric[], nowMs: number): Badge[] {
  // Sorted here, not trusted from the caller: the leading-run below is
  // order-dependent, and both callers only happen to pass newest-first today.
  const qualifying = sessions
    .filter((s) => s.qualifies && s.reworkRatio !== null)
    .sort((a, b) => b.startedMs - a.startedMs);
  const streak = currentStreak(qualifying, nowMs);

  const elite = qualifying.filter((s) => sessionPoints(s).total >= DIAMOND_SESSION_POINTS).length;
  const cleanest = qualifying.reduce((best, s) => Math.max(best, s.editsRework === 0 ? s.edits : 0), 0);

  let steadyRun = 0;
  for (const s of qualifying) {
    if ((s.reworkRatio as number) > STEADY_HAND_RATIO) break;
    steadyRun += 1;
  }

  return [
    badge('clean-run', 'Clean Run — a 3+ edit session with zero rework',
      'Land 3 edits in one session without re-touching a file.', cleanest, 3),
    badge('diamond-session', 'Diamond Session — a session scoring 100+ points',
      'Score 100 points in a single session.', elite, 1),
    badge('diamond-x5', 'Diamond x5 — five sessions scoring 100+ points',
      'Score 100+ points in five sessions.', elite, 5),
    badge('steady-hand', 'Steady Hand — last 5 sessions all low-rework',
      'Finish five sessions in a row with almost no re-edits.', steadyRun, 5),
    badge('streak-3', '3-Day Streak', 'Run the CLI three days running.', streak, 3),
    badge('streak-7', '7-Day Streak', 'Run the CLI seven days running.', streak, 7),
  ];
}

/**
 * The unearned badge closest to done — what to chase next. Strict `>` keeps the
 * first of a tie and badges() returns a fixed easiest-first order, so the answer
 * is stable across renders. Null once everything is earned.
 */
export function nextBadge(list: Badge[]): Badge | null {
  return list
    .filter((b) => !b.earned)
    .reduce<Badge | null>(
      (best, b) =>
        best === null || b.progress.have / b.progress.need > best.progress.have / best.progress.need ? b : best,
      null,
    );
}
