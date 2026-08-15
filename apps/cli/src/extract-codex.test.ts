import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCodexSessionFile } from './extract-codex.ts';

function session(lines: unknown[]) {
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

test('parseCodexSessionFile reads the session id and cwd hash from session_meta', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      {
        timestamp: '2026-08-01T00:00:00.000Z',
        type: 'session_meta',
        payload: { session_id: '019fccc8-e961-7fd2-80b5-42003d939a82', cwd: '/tmp/proj' },
      },
      {
        timestamp: '2026-08-01T00:00:01.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'do the thing' },
      },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events[0].sessionId, '019fccc8-e961-7fd2-80b5-42003d939a82');
  assert.equal(events[0].projectHash.length, 64); // sha256 hex
  assert.equal(events[0].source, 'codex');
});

test('parseCodexSessionFile falls back to payload.id when session_id is absent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      { timestamp: '2026-08-01T00:00:00.000Z', type: 'session_meta', payload: { id: 'old-style-id', cwd: '/tmp/proj' } },
      { timestamp: '2026-08-01T00:00:01.000Z', type: 'event_msg', payload: { type: 'user_message', message: 'hi' } },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events[0].sessionId, 'old-style-id');
});

test('parseCodexSessionFile counts user_message as a human turn and ignores developer-role preamble', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      { timestamp: '2026-08-01T00:00:00.000Z', type: 'session_meta', payload: { session_id: 's1', cwd: '/tmp/proj' } },
      // Harness-injected preamble — has role:'user' but is NOT event_msg/user_message.
      {
        timestamp: '2026-08-01T00:00:01.000Z',
        type: 'response_item',
        payload: { type: 'message', role: 'developer', content: 'system preamble' },
      },
      {
        timestamp: '2026-08-01T00:00:02.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'a real human turn' },
      },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events.filter((e) => e.kind === 'human_turn').length, 1);
});

test('parseCodexSessionFile records one edit per path in patch_apply_end', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      { timestamp: '2026-08-01T00:00:00.000Z', type: 'session_meta', payload: { session_id: 's1', cwd: '/tmp/proj' } },
      {
        timestamp: '2026-08-01T00:00:01.000Z',
        type: 'event_msg',
        payload: {
          type: 'patch_apply_end',
          success: true,
          changes: {
            '/tmp/proj/a.ts': { type: 'update', unified_diff: '...' },
            '/tmp/proj/b.ts': { type: 'add', content: '...' },
          },
        },
      },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  const edits = events.filter((e) => e.kind === 'tool_call' && e.tool === 'Edit');
  assert.equal(edits.length, 2);
  assert.deepEqual(
    edits.map((e) => e.filePath).sort(),
    ['/tmp/proj/a.ts', '/tmp/proj/b.ts'],
  );
});

test('parseCodexSessionFile ignores a patch that did not succeed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      { timestamp: '2026-08-01T00:00:00.000Z', type: 'session_meta', payload: { session_id: 's1', cwd: '/tmp/proj' } },
      {
        timestamp: '2026-08-01T00:00:01.000Z',
        type: 'event_msg',
        payload: { type: 'patch_apply_end', success: false, changes: { '/tmp/proj/a.ts': { type: 'update' } } },
      },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events.filter((e) => e.kind === 'tool_call').length, 0);
});

test('parseCodexSessionFile leaves sessionId empty when a file is truncated before session_meta', async () => {
  // extractAllCodex merges events by events[0].sessionId — a file that never
  // reaches session_meta (truncated write, killed process) must surface an
  // empty sessionId here so that caller can drop it, rather than silently
  // merging under a shared '' key with every other such file.
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([{ timestamp: '2026-08-01T00:00:00.000Z', type: 'event_msg', payload: { type: 'user_message', message: 'hi' } }]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  assert.equal(events[0].sessionId, '');
});

test('parseCodexSessionFile joins an MCP namespace onto the tool name', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-codex-test-'));
  const file = join(dir, 'rollout.jsonl');
  await writeFile(
    file,
    session([
      { timestamp: '2026-08-01T00:00:00.000Z', type: 'session_meta', payload: { session_id: 's1', cwd: '/tmp/proj' } },
      {
        timestamp: '2026-08-01T00:00:01.000Z',
        type: 'response_item',
        payload: { type: 'function_call', name: 'new_page', namespace: 'mcp__chrome_devtools' },
      },
      // No namespace — a plain builtin tool call, unqualified.
      {
        timestamp: '2026-08-01T00:00:02.000Z',
        type: 'response_item',
        payload: { type: 'function_call', name: 'exec_command' },
      },
    ]),
  );

  const events = await parseCodexSessionFile(file);
  await rm(dir, { recursive: true, force: true });

  const tools = events.filter((e) => e.kind === 'tool_call').map((e) => e.tool);
  assert.deepEqual(tools.sort(), ['exec_command', 'mcp__chrome_devtools__new_page']);
});
