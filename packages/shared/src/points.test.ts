import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionPoints, totalPoints, rankFor, DAILY_POINT_CAP, SESSION_POINT_CAP } from './points.ts';
import type { SessionMetric } from './schema.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);

function session(over: Partial<SessionMetric> = {}): SessionMetric {
  return {
    source: 'claude-code',
    sessionId: 's',
    projectHash: 'p',
    startedMs: NOW,
    endedMs: NOW + 1000,
    turns: 5,
    edits: 4,
    editsRework: 1,
    reworkRatio: 0.25,
    qualifies: true,
    toolCounts: {},
    ...over,
  };
}

test('a non-qualifying session scores 0', () => {
  const s = session({ qualifies: false });
  assert.deepEqual(sessionPoints(s), { total: 0, landed: 0, precision: 0, focus: 0 });
});

test('a zero-rework session outscores a same-size high-rework one', () => {
  const clean = sessionPoints(session({ edits: 6, editsRework: 0, reworkRatio: 0 }));
  const messy = sessionPoints(session({ edits: 6, editsRework: 3, reworkRatio: 0.9 }));
  assert.ok(clean.total > messy.total);
});

test('doubling edits does not double points (sublinear)', () => {
  // High turns keeps the focus term near 0 in both cases, isolating landed's
  // log-scale growth from precision (fixed here) and focus.
  const small = sessionPoints(session({ edits: 10, editsRework: 0, reworkRatio: 0, turns: 1000 }));
  const big = sessionPoints(session({ edits: 20, editsRework: 0, reworkRatio: 0, turns: 1000 }));
  assert.ok(big.total < small.total * 2);
});

test('focus scales with raw net edits/turn, not the log2-scaled landed value', () => {
  // 6 net edits over 5 turns = 1.2 edits/turn, well under the 3/turn cap.
  // Bug: dividing `landed` (10*log2(7)≈28) by turns/3 saturated this to the
  // focus max (20) immediately; the fix divides the raw 6 net edits instead.
  const s = sessionPoints(session({ edits: 6, editsRework: 0, reworkRatio: 0, turns: 5 }));
  assert.equal(s.focus, Math.round(20 * ((6 / 5) / 3)));
  assert.ok(s.focus < 20, 'focus should not saturate at well under 3 edits/turn');
});

test('focus saturates at 3 net edits/turn', () => {
  const atCap = sessionPoints(session({ edits: 15, editsRework: 0, reworkRatio: 0, turns: 5 }));
  const overCap = sessionPoints(session({ edits: 30, editsRework: 0, reworkRatio: 0, turns: 5 }));
  assert.equal(atCap.focus, 20);
  assert.equal(overCap.focus, 20);
});

test('a single session cannot exceed SESSION_POINT_CAP', () => {
  const s = sessionPoints(session({ edits: 500, editsRework: 0, reworkRatio: 0, turns: 1 }));
  assert.ok(s.total <= SESSION_POINT_CAP);
});

test('one UTC day of max-value sessions is clamped to DAILY_POINT_CAP', () => {
  const maxSession = session({ edits: 500, editsRework: 0, reworkRatio: 0, turns: 1 });
  const sessions = Array.from({ length: 20 }, (_, i) => ({ ...maxSession, sessionId: `s${i}` }));
  assert.equal(totalPoints(sessions), DAILY_POINT_CAP);
});

test('the daily cap applies per UTC day, not globally', () => {
  const maxSession = session({ edits: 500, editsRework: 0, reworkRatio: 0, turns: 1 });
  const today = { ...maxSession, sessionId: 'a', startedMs: NOW };
  const yesterday = { ...maxSession, sessionId: 'b', startedMs: NOW - DAY };
  assert.equal(totalPoints([today, yesterday]), Math.min(SESSION_POINT_CAP, DAILY_POINT_CAP) * 2);
});

test('rankFor starts at Bronze', () => {
  assert.equal(rankFor(0).tier, 'Bronze');
});

test('rankFor tops out at Diamond with no next tier', () => {
  const r = rankFor(20000);
  assert.equal(r.tier, 'Diamond');
  assert.equal(r.next, null);
  assert.equal(r.nextAt, null);
});

test('rankFor pct stays within [0, 1] across the range', () => {
  for (const points of [0, 100, 500, 1000, 2000, 4000, 6000, 10000, 15000, 30000]) {
    const r = rankFor(points);
    assert.ok(r.pct >= 0 && r.pct <= 1, `pct out of range at ${points}: ${r.pct}`);
  }
});
