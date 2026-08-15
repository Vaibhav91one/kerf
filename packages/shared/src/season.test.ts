import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthEndMs, monthStartMs, seasonQualification, SEASON_MIN_COMMITS, SEASON_MIN_SESSIONS } from './season.ts';
import type { SessionMetric } from './schema.ts';

const NOW = Date.UTC(2026, 7, 15); // 2026-08-15, well inside August

function qualifyingSession(startedMs: number): SessionMetric {
  return {
    source: 'claude-code',
    sessionId: crypto.randomUUID(),
    projectHash: 'p',
    startedMs,
    endedMs: startedMs + 1000,
    turns: 3,
    edits: 1,
    editsRework: 0,
    reworkRatio: 0,
    qualifies: true,
    toolCounts: {},
  };
}

test('season floor needs ten qualifying sessions', () => {
  const sessions = Array.from({ length: SEASON_MIN_SESSIONS - 1 }, () => qualifyingSession(NOW));
  const result = seasonQualification(sessions, SEASON_MIN_COMMITS, NOW);
  assert.equal(result.qualified, false);
  assert.equal(result.sessions, SEASON_MIN_SESSIONS - 1);
});

test('season floor needs five commits', () => {
  const sessions = Array.from({ length: SEASON_MIN_SESSIONS }, () => qualifyingSession(NOW));
  const result = seasonQualification(sessions, SEASON_MIN_COMMITS - 1, NOW);
  assert.equal(result.qualified, false);
  assert.equal(result.commits, SEASON_MIN_COMMITS - 1);
});

test('sessions from a previous month do not count toward this season', () => {
  const lastMonth = Date.UTC(2026, 6, 20); // 2026-07-20
  const sessions = [
    ...Array.from({ length: SEASON_MIN_SESSIONS }, () => qualifyingSession(lastMonth)),
    ...Array.from({ length: 2 }, () => qualifyingSession(NOW)),
  ];
  const result = seasonQualification(sessions, SEASON_MIN_COMMITS, NOW);
  assert.equal(result.sessions, 2);
  assert.equal(result.qualified, false);
});

test('both floors cleared qualifies', () => {
  const sessions = Array.from({ length: SEASON_MIN_SESSIONS }, () => qualifyingSession(NOW));
  const result = seasonQualification(sessions, SEASON_MIN_COMMITS, NOW);
  assert.equal(result.qualified, true);
});

test('a non-qualifying session does not count toward the season floor either', () => {
  const nonQualifying = { ...qualifyingSession(NOW), qualifies: false };
  const sessions = [nonQualifying, ...Array.from({ length: SEASON_MIN_SESSIONS - 1 }, () => qualifyingSession(NOW))];
  const result = seasonQualification(sessions, SEASON_MIN_COMMITS, NOW);
  assert.equal(result.sessions, SEASON_MIN_SESSIONS - 1);
});

test('monthStartMs/monthEndMs bracket exactly the UTC calendar month', () => {
  assert.equal(monthStartMs(NOW), Date.UTC(2026, 7, 1));
  assert.equal(monthEndMs(NOW), Date.UTC(2026, 8, 1));
});
