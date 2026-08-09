import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSessionMetric } from './metrics.ts';
import type { KerfEvent } from './schema.ts';

test('rework ratio: second edit to same file counts as rework', () => {
  const events: KerfEvent[] = [
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 0, ordinal: 0, kind: 'human_turn' },
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 1, ordinal: 1, kind: 'human_turn' },
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 2, ordinal: 2, kind: 'human_turn' },
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 3, ordinal: 3, kind: 'tool_call', tool: 'Edit', filePath: 'a.ts' },
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 4, ordinal: 4, kind: 'tool_call', tool: 'Edit', filePath: 'b.ts' },
    { source: 'claude-code', sessionId: 's1', projectHash: 'p', ts: 5, ordinal: 5, kind: 'tool_call', tool: 'Edit', filePath: 'a.ts' },
  ];
  const m = computeSessionMetric('s1', events);
  assert.equal(m.edits, 3);
  assert.equal(m.editsRework, 1);
  assert.equal(m.reworkRatio, 1 / 3);
  assert.equal(m.qualifies, true);
  assert.deepEqual(m.toolCounts, { Edit: 3 });
});

test('qualification floor: fewer than 3 turns does not qualify', () => {
  const events: KerfEvent[] = [
    { source: 'claude-code', sessionId: 's2', projectHash: 'p', ts: 0, ordinal: 0, kind: 'human_turn' },
    { source: 'claude-code', sessionId: 's2', projectHash: 'p', ts: 1, ordinal: 1, kind: 'tool_call', tool: 'Edit', filePath: 'a.ts' },
  ];
  const m = computeSessionMetric('s2', events);
  assert.equal(m.qualifies, false);
});

test('reworkRatio is null, not zero, when there are no edits', () => {
  const events: KerfEvent[] = [
    { source: 'claude-code', sessionId: 's3', projectHash: 'p', ts: 0, ordinal: 0, kind: 'human_turn' },
  ];
  const m = computeSessionMetric('s3', events);
  assert.equal(m.reworkRatio, null);
});

test('toolCounts tallies every tool call, including non-edit tools', () => {
  const events: KerfEvent[] = [
    { source: 'claude-code', sessionId: 's4', projectHash: 'p', ts: 0, ordinal: 0, kind: 'tool_call', tool: 'Bash' },
    { source: 'claude-code', sessionId: 's4', projectHash: 'p', ts: 1, ordinal: 1, kind: 'tool_call', tool: 'Bash' },
    { source: 'claude-code', sessionId: 's4', projectHash: 'p', ts: 2, ordinal: 2, kind: 'tool_call', tool: 'Edit', filePath: 'a.ts' },
  ];
  const m = computeSessionMetric('s4', events);
  assert.deepEqual(m.toolCounts, { Bash: 2, Edit: 1 });
  assert.equal(m.edits, 1);
});
