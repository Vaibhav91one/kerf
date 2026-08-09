import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSessionFile } from './extract.ts';

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
