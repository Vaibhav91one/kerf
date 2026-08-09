import { test } from 'node:test';
import assert from 'node:assert/strict';
import { improvementTips } from './insights.ts';
import type { SessionMetric } from './schema.ts';
import type { TierCuts } from './season.ts';

const cuts: TierCuts = { p20: 0.1, p50: 0.3, p80: 0.5, p95: 0.8 };

const base: SessionMetric = {
  source: 'claude-code',
  sessionId: 's1',
  projectHash: 'p',
  startedMs: 0,
  endedMs: 1,
  turns: 5,
  edits: 4,
  editsRework: 1,
  reworkRatio: 0.25,
  qualifies: true,
  toolCounts: { Edit: 4 },
};

test('flags rework ratio above season p80', () => {
  const tips = improvementTips({ ...base, reworkRatio: 0.6 }, cuts);
  assert.ok(tips.some((t) => t.id === 'high-rework'));
});

test('flags few turns relative to edits', () => {
  const tips = improvementTips({ ...base, turns: 2, edits: 6 }, cuts);
  assert.ok(tips.some((t) => t.id === 'low-planning'));
});

test('praises a clean run with no rework', () => {
  const tips = improvementTips({ ...base, editsRework: 0 }, cuts);
  assert.ok(tips.some((t) => t.id === 'clean-run'));
});

test('no tips for a session with nothing notable', () => {
  const tips = improvementTips({ ...base, turns: 5, edits: 4, editsRework: 1, reworkRatio: 0.25 }, cuts);
  assert.deepEqual(tips, []);
});
