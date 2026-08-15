import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSessionFiles, parseSessionFile } from './extract.ts';

test('parseSessionFile: skips attachment/mode noise, keeps human turns and edits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-test-'));
  const file = join(dir, 'session.jsonl');
  const lines = [
    { type: 'attachment', foo: 'noise' },
    { type: 'mode', sessionId: 's1' },
    {
      type: 'user',
      sessionId: 's1',
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:00.000Z',
      message: { role: 'user', content: 'do the thing' },
    },
    {
      type: 'user',
      sessionId: 's1',
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:01.000Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] },
    },
    {
      type: 'assistant',
      sessionId: 's1',
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:02.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/tmp/proj/a.ts' } }],
      },
    },
  ];
  await writeFile(file, lines.map((l) => JSON.stringify(l)).join('\n'));

  const events = await parseSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events.filter((e) => e.kind === 'human_turn').length, 1);
  assert.equal(events.filter((e) => e.kind === 'tool_call').length, 1);
  assert.equal(events[0].projectHash.length, 64); // sha256 hex
});

test('parseSessionFile does not count a sidechain user record as a human turn', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-test-'));
  const file = join(dir, 'session.jsonl');
  const lines = [
    {
      type: 'user',
      sessionId: 's1',
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:00.000Z',
      message: { role: 'user', content: 'a real human turn' },
    },
    // The harness feeding a subagent its next step — plain string content, no
    // tool_result, so the content heuristic alone would count this as human.
    {
      type: 'user',
      sessionId: 's1',
      isSidechain: true,
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:01.000Z',
      message: { role: 'user', content: 'continue with the next step' },
    },
  ];
  await writeFile(file, lines.map((l) => JSON.stringify(l)).join('\n'));

  const events = await parseSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events.filter((e) => e.kind === 'human_turn').length, 1);
});

test('parseSessionFile treats origin.kind as authoritative over the content heuristic', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-test-'));
  const file = join(dir, 'session.jsonl');
  const lines = [
    // No tool_result block — the content heuristic alone would count this as
    // human, but origin.kind says otherwise and wins.
    {
      type: 'user',
      sessionId: 's1',
      origin: { kind: 'task-notification' },
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:00.000Z',
      message: { role: 'user', content: 'a background notification' },
    },
    {
      type: 'user',
      sessionId: 's1',
      origin: { kind: 'human' },
      cwd: '/tmp/proj',
      timestamp: '2026-08-01T00:00:01.000Z',
      message: { role: 'user', content: 'a real human turn' },
    },
  ];
  await writeFile(file, lines.map((l) => JSON.stringify(l)).join('\n'));

  const events = await parseSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events.filter((e) => e.kind === 'human_turn').length, 1);
});

test('listSessionFiles includes subagent transcripts alongside the main session file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kerf-test-'));
  const sessionDir = join(root, 'my-project', 'a1b2c3d4-session-uuid');
  const subagentsDir = join(sessionDir, 'subagents');
  await mkdir(subagentsDir, { recursive: true });
  await writeFile(join(root, 'my-project', 'a1b2c3d4-session-uuid.jsonl'), '');
  await writeFile(join(subagentsDir, 'agent-abc123.jsonl'), '');
  await writeFile(join(subagentsDir, 'agent-abc123.meta.json'), '{}'); // not .jsonl — must be skipped

  const files = await listSessionFiles([root]);
  await rm(root, { recursive: true, force: true });

  assert.equal(files.length, 2);
  assert.ok(files.some((f) => f.endsWith('a1b2c3d4-session-uuid.jsonl') && !f.includes('subagents')));
  assert.ok(files.some((f) => f.endsWith(join('subagents', 'agent-abc123.jsonl'))));
});
