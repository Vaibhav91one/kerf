import { test } from 'node:test';
import assert from 'node:assert/strict';
import { improvementTips } from './insights.ts';
import type { SessionMetric } from './schema.ts';

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

test('flags rework ratio above the fixed threshold', () => {
  const tips = improvementTips({ ...base, reworkRatio: 0.6 });
  assert.ok(tips.some((t) => t.id === 'high-rework'));
});

test('flags few turns relative to edits', () => {
  const tips = improvementTips({ ...base, turns: 2, edits: 6 });
  assert.ok(tips.some((t) => t.id === 'low-planning'));
});

test('praises a clean run with no rework', () => {
  const tips = improvementTips({ ...base, editsRework: 0 });
  assert.ok(tips.some((t) => t.id === 'clean-run'));
});

test('a tip states the numeric rule that fired it', () => {
  const [tip] = improvementTips({ ...base, reworkRatio: 0.6 });
  assert.match(tip.trigger, /0\.40/);
  assert.match(tip.title, /0\.60/);
});

test('no tips for a session with nothing notable', () => {
  const tips = improvementTips({ ...base, turns: 5, edits: 4, editsRework: 1, reworkRatio: 0.25 });
  assert.deepEqual(tips, []);
});
