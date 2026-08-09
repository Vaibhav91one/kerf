import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badges, currentStreak, tierProgress } from './game.ts';
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

const cuts = { p20: 0.2, p50: 0.5, p80: 0.8, p95: 0.95 };

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
  const earned = badges([session(0, { edits: 4, editsRework: 0, reworkRatio: 0 })], cuts, NOW);
  assert.equal(earned.find((b) => b.id === 'clean-run')?.earned, true);

  const notEarned = badges([session(0, { edits: 2, editsRework: 0, reworkRatio: 0 })], cuts, NOW);
  assert.equal(notEarned.find((b) => b.id === 'clean-run')?.earned, false);
});

test('diamond badges use the lower-is-better direction', () => {
  const good = badges([session(0, { reworkRatio: 0.1 })], cuts, NOW);
  assert.equal(good.find((b) => b.id === 'diamond-session')?.earned, true);

  const bad = badges([session(0, { reworkRatio: 0.9 })], cuts, NOW);
  assert.equal(bad.find((b) => b.id === 'diamond-session')?.earned, false);
});

test('non-qualifying sessions do not earn badges or extend streaks', () => {
  const rows = [session(0, { qualifies: false, reworkRatio: 0.01 })];
  const earned = badges(rows, cuts, NOW);
  assert.equal(earned.find((b) => b.id === 'diamond-session')?.earned, false);
  assert.equal(earned.find((b) => b.id === 'streak-3')?.earned, false);
});

test('tierProgress fills as the ratio drops toward the next cut', () => {
  // Between p50 and p80 -> climbing toward Platinum.
  const mid = tierProgress(0.65, cuts);
  assert.equal(mid?.next, 'Platinum');
  assert.ok(mid !== null && mid.pct > 0.4 && mid.pct < 0.6);

  // Right at the target cut counts as arrived at the next band.
  assert.equal(tierProgress(0.5, cuts)?.next, 'Diamond');
});

test('tierProgress returns null once already Diamond', () => {
  assert.equal(tierProgress(0.15, cuts), null);
});

test('tierProgress reports 0% in the unbounded worst band', () => {
  const worst = tierProgress(4.0, cuts);
  assert.equal(worst?.next, 'Silver');
  assert.equal(worst?.pct, 0);
});
