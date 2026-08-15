import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badges, currentStreak, nextBadge } from './game.ts';
import type { SessionMetric } from './schema.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 9, 18, 0, 0); // 2026-08-09T18:00Z

function session(daysAgo: number, over: Partial<SessionMetric> = {}): SessionMetric {
  const startedMs = NOW - daysAgo * DAY;
  return {
    source: 'claude-code',
    sessionId: `0000000${daysAgo}-0000-4000-8000-000000000000`,
    projectHash: 'a'.repeat(64),
    startedMs,
    endedMs: startedMs + 1000,
    turns: 5,
    edits: 4,
    editsRework: 2,
    reworkRatio: 0.5,
    qualifies: true,
    toolCounts: {},
    ...over,
  };
}

test('currentStreak counts consecutive UTC days ending today', () => {
  assert.equal(currentStreak([session(0), session(1), session(2)], NOW), 3);
});

test('currentStreak ignores gaps beyond the break', () => {
  assert.equal(currentStreak([session(0), session(1), session(5)], NOW), 2);
});

test("currentStreak survives a day that isn't over yet", () => {
  // Nothing logged today, but yesterday and the day before were — the streak is
  // alive until the day after the miss, not at 00:00 UTC.
  assert.equal(currentStreak([session(1), session(2)], NOW), 2);
});

test('currentStreak is 0 when the last session is two days old', () => {
  assert.equal(currentStreak([session(2), session(3)], NOW), 0);
});

test('currentStreak is 0 with no sessions', () => {
  assert.equal(currentStreak([], NOW), 0);
});

test('multiple sessions on one day count once', () => {
  assert.equal(currentStreak([session(0), session(0), session(0)], NOW), 1);
});

test('clean-run badge needs zero rework and at least 3 edits', () => {
  const earned = badges([session(0, { edits: 4, editsRework: 0, reworkRatio: 0 })], NOW);
  assert.equal(earned.find((b) => b.id === 'clean-run')?.earned, true);

  const notEarned = badges([session(0, { edits: 2, editsRework: 0, reworkRatio: 0 })], NOW);
  assert.equal(notEarned.find((b) => b.id === 'clean-run')?.earned, false);
});

test('diamond-session badge needs a high-scoring session', () => {
  const good = badges([session(0, { edits: 40, editsRework: 0, reworkRatio: 0 })], NOW);
  assert.equal(good.find((b) => b.id === 'diamond-session')?.earned, true);

  const bad = badges([session(0, { reworkRatio: 0.9 })], NOW);
  assert.equal(bad.find((b) => b.id === 'diamond-session')?.earned, false);
});

test('non-qualifying sessions do not earn badges or extend streaks', () => {
  const rows = [session(0, { qualifies: false, reworkRatio: 0.01 })];
  const earned = badges(rows, NOW);
  assert.equal(earned.find((b) => b.id === 'diamond-session')?.earned, false);
  assert.equal(earned.find((b) => b.id === 'streak-3')?.earned, false);
});

test('steady-hand badge needs the last 5 qualifying sessions all low-rework', () => {
  const rows = [0, 1, 2, 3, 4].map((d) => session(d, { reworkRatio: 0.1 }));
  const earned = badges(rows, NOW);
  assert.equal(earned.find((b) => b.id === 'steady-hand')?.earned, true);

  const mixed = [session(0, { reworkRatio: 0.9 }), ...rows.slice(1)];
  assert.equal(badges(mixed, NOW).find((b) => b.id === 'steady-hand')?.earned, false);
});

// --- Badge progress ---------------------------------------------------------

test('a fresh account has zero progress on every badge', () => {
  const fresh = badges([], NOW);
  assert.deepEqual(
    fresh.map((b) => b.progress),
    [
      { have: 0, need: 3 },
      { have: 0, need: 1 },
      { have: 0, need: 5 },
      { have: 0, need: 5 },
      { have: 0, need: 3 },
      { have: 0, need: 7 },
    ],
  );
  assert.equal(fresh.every((b) => !b.earned), true);
});

test('clean-run reports the best partial attempt, not a session count', () => {
  const partial = badges([session(0, { edits: 2, editsRework: 0, reworkRatio: 0 })], NOW);
  assert.deepEqual(partial.find((b) => b.id === 'clean-run')?.progress, { have: 2, need: 3 });

  const done = badges([session(0, { edits: 9, editsRework: 0, reworkRatio: 0 })], NOW);
  assert.equal(done.find((b) => b.id === 'clean-run')?.earned, true);
});

test('clean-run ignores a big session that re-touched anything', () => {
  const dirty = badges([session(0, { edits: 20, editsRework: 1, reworkRatio: 0.05 })], NOW);
  assert.deepEqual(dirty.find((b) => b.id === 'clean-run')?.progress, { have: 0, need: 3 });
});

test('have never exceeds need', () => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => session(d, { edits: 40, editsRework: 0, reworkRatio: 0 }));
  const earned = badges(rows, NOW);
  assert.deepEqual(earned.find((b) => b.id === 'diamond-session')?.progress, { have: 1, need: 1 });
  assert.deepEqual(earned.find((b) => b.id === 'diamond-x5')?.progress, { have: 5, need: 5 });
});

test('steady-hand counts the leading run, not the set', () => {
  // Newest first: one clean, then a bad one — the run stops at 1 even though
  // four of the five are clean.
  const rows = [
    session(0, { reworkRatio: 0.1 }),
    session(1, { reworkRatio: 0.9 }),
    session(2, { reworkRatio: 0.1 }),
    session(3, { reworkRatio: 0.1 }),
    session(4, { reworkRatio: 0.1 }),
  ];
  assert.deepEqual(badges(rows, NOW).find((b) => b.id === 'steady-hand')?.progress, { have: 1, need: 5 });
});

test('steady-hand fills as the run grows', () => {
  const three = [0, 1, 2].map((d) => session(d, { reworkRatio: 0.1 }));
  assert.deepEqual(badges(three, NOW).find((b) => b.id === 'steady-hand')?.progress, { have: 3, need: 5 });

  const five = [0, 1, 2, 3, 4].map((d) => session(d, { reworkRatio: 0.1 }));
  assert.equal(badges(five, NOW).find((b) => b.id === 'steady-hand')?.earned, true);
});

test('streak progress clamps at each threshold', () => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => session(d));
  const earned = badges(rows, NOW);
  assert.deepEqual(earned.find((b) => b.id === 'streak-3')?.progress, { have: 3, need: 3 });
  assert.deepEqual(earned.find((b) => b.id === 'streak-7')?.progress, { have: 7, need: 7 });
});

test('earned always agrees with have >= need', () => {
  const rows = [
    session(0, { edits: 40, editsRework: 0, reworkRatio: 0 }),
    session(1, { edits: 5, editsRework: 3, reworkRatio: 0.6 }),
    session(3, { edits: 9, editsRework: 1, reworkRatio: 0.11 }),
    session(4, { qualifies: false }),
  ];
  for (const b of badges(rows, NOW)) assert.equal(b.earned, b.progress.have >= b.progress.need);
});

test('badges do not depend on the order they are handed in', () => {
  const rows = [0, 1, 2].map((d) => session(d, { edits: 6, editsRework: 0, reworkRatio: 0 }));
  assert.deepEqual(badges(rows, NOW), badges([...rows].reverse(), NOW));
});

test('nextBadge picks the unearned badge closest to done', () => {
  // A 2-day streak is 2/3 of streak-3; clean-run sits at 1/3.
  const rows = [session(0, { edits: 1, editsRework: 0, reworkRatio: 0 }), session(1, { edits: 1, editsRework: 0, reworkRatio: 0 })];
  assert.equal(nextBadge(badges(rows, NOW))?.id, 'streak-3');
});

test('nextBadge breaks a tie on declaration order', () => {
  assert.equal(nextBadge(badges([], NOW))?.id, 'clean-run');
});

test('nextBadge returns null once everything is earned', () => {
  const all = badges([], NOW).map((b) => ({ ...b, earned: true }));
  assert.equal(nextBadge(all), null);
});
