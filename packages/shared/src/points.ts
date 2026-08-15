// Points and levels — replaces season.ts's percentile tiers. A raw rework
// ratio ("0.369") is not readable; a points total and a fixed-threshold rank
// is. No I/O.
//
// Deliberate deviation from kerf-spec.md §7.2 ("never rank on a total") and
// game.ts's own banner: cumulative points IS a total, and a total rewards
// volume. Shipped anyway because the user asked for leveling, with the §7.5
// degenerate-play audit this requires:
//
//   Degenerate play: run many trivial sessions to farm points.
//   Counter 1: non-qualifying sessions score 0 (floor unchanged, see metrics.ts).
//   Counter 2: DAILY_POINT_CAP — points per UTC day are capped, so a bot loop
//              plateaus instead of compounding.
//   Counter 3: the per-session award is sublinear in edit count and dominated
//              by the precision term, so padding a session with volume barely
//              moves it.

import type { SessionMetric } from './schema.ts';
import type { Tier } from './season.ts';

function utcDay(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

export type PointsBreakdown = { total: number; landed: number; precision: number; focus: number };

export const SESSION_POINT_CAP = 120;
export const DAILY_POINT_CAP = 300;

// Points for one session, derived entirely from columns already stored in
// SessionMetric — nothing new is uploaded, nothing new is validated.
export function sessionPoints(m: SessionMetric): PointsBreakdown {
  if (!m.qualifies) return { total: 0, landed: 0, precision: 0, focus: 0 };

  // landed: edits that stuck, sublinear so a 200-edit session can't dwarf a
  // 20-edit one.
  const netEdits = Math.max(0, m.edits - m.editsRework);
  const landed = Math.round(10 * Math.log2(1 + netEdits));

  // precision: the old rework-ratio metric, kept as the scoring engine and
  // hidden from the UI. Dominant term on purpose.
  const precision = m.reworkRatio === null ? 0 : Math.round(30 * (1 - m.reworkRatio));

  // focus: RAW net edits landed per turn, saturating at 3/turn — a single
  // giant Write (the §7.5 rework-ratio degenerate play) hits this ceiling
  // instead of running away with the score. This must divide `netEdits`, not
  // `landed`: landed is already log2-scaled (e.g. 6 net edits -> landed≈28),
  // so dividing THAT by turns saturated the term almost immediately for any
  // qualifying session instead of at the documented 3 raw edits/turn —
  // silently making focus a near-constant +20 rather than the differentiator
  // it's meant to be.
  const perTurn = netEdits / Math.max(1, m.turns) / 3;
  const focus = Math.round(20 * Math.min(1, perTurn));

  return { total: Math.min(SESSION_POINT_CAP, landed + precision + focus), landed, precision, focus };
}

// Sums sessionPoints across sessions, clamping each UTC day's subtotal to
// DAILY_POINT_CAP before adding it to the lifetime total.
export function totalPoints(sessions: SessionMetric[]): number {
  const byDay = new Map<number, number>();
  for (const s of sessions) {
    const day = utcDay(s.startedMs);
    byDay.set(day, (byDay.get(day) ?? 0) + sessionPoints(s).total);
  }
  let total = 0;
  for (const dayTotal of byDay.values()) total += Math.min(DAILY_POINT_CAP, dayTotal);
  return total;
}

// Same, restricted to sessions that started in the UTC calendar month nowMs
// falls in — feeds the /season monthly board.
export function monthPoints(sessions: SessionMetric[], nowMs: number): number {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const inMonth = sessions.filter((s) => {
    const d = new Date(s.startedMs);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
  return totalPoints(inMonth);
}

// ponytail: thresholds are a tuning knob, not a truth — re-fit once there's
// real usage data. Keep them here, one edit away.
export const LEVELS: { tier: Tier; min: number }[] = [
  { tier: 'Bronze', min: 0 },
  { tier: 'Silver', min: 500 },
  { tier: 'Gold', min: 2000 },
  { tier: 'Platinum', min: 6000 },
  { tier: 'Diamond', min: 15000 },
];

export type Rank = { tier: Tier; next: Tier | null; nextAt: number | null; pct: number };

export function rankFor(points: number): Rank {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) idx = i;
  }
  const current = LEVELS[idx];
  const upper = LEVELS[idx + 1] ?? null;
  if (!upper) return { tier: current.tier, next: null, nextAt: null, pct: 1 };
  const pct = (points - current.min) / (upper.min - current.min);
  return { tier: current.tier, next: upper.tier, nextAt: upper.min, pct: Math.max(0, Math.min(1, pct)) };
}
