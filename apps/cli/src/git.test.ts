import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countCommits } from './git.ts';

const run = promisify(execFile);

async function initRepo(dir: string, email: string): Promise<void> {
  await run('git', ['-C', dir, 'init', '-q']);
  await run('git', ['-C', dir, 'config', 'user.email', email]);
  await run('git', ['-C', dir, 'config', 'user.name', 'Test']);
}

async function commit(dir: string, message: string): Promise<void> {
  await writeFile(join(dir, 'file.txt'), `${Date.now()}-${Math.random()}`);
  await run('git', ['-C', dir, 'add', '.']);
  await run('git', ['-C', dir, 'commit', '-q', '-m', message]);
}

async function commitAt(dir: string, message: string, iso: string): Promise<void> {
  await writeFile(join(dir, 'file.txt'), `${Date.now()}-${Math.random()}`);
  await run('git', ['-C', dir, 'add', '.']);
  await run('git', ['-C', dir, 'commit', '-q', '-m', message], {
    env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
  });
}

test('countCommits counts commits you authored in the window', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-git-test-'));
  await initRepo(dir, 'me@example.com');
  await commit(dir, 'first');
  await commit(dir, 'second');

  const now = Date.now();
  const count = await countCommits([dir], now - 60_000, now + 60_000);
  await rm(dir, { recursive: true, force: true });

  assert.equal(count, 2);
});

test('countCommits returns zero for a folder that is not a repository', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-git-test-'));
  const now = Date.now();
  const count = await countCommits([dir], now - 60_000, now + 60_000);
  await rm(dir, { recursive: true, force: true });

  assert.equal(count, 0);
});

test('countCommits does not double-count a commit landing exactly on a month boundary', async () => {
  // git's --since/--until are both inclusive of the exact instant, so a
  // commit AT the boundary would appear in both an adjoining month's window
  // if untilMs were passed unmodified — season.ts's monthEndMs(month) IS
  // month+1's monthStartMs, by design.
  const dir = await mkdtemp(join(tmpdir(), 'kerf-git-test-'));
  await initRepo(dir, 'me@example.com');
  const boundary = Date.UTC(2026, 7, 1); // 2026-08-01T00:00:00.000Z
  await commitAt(dir, 'on the boundary', new Date(boundary).toISOString());

  const july = await countCommits([dir], Date.UTC(2026, 6, 1), boundary);
  const august = await countCommits([dir], boundary, Date.UTC(2026, 8, 1));
  await rm(dir, { recursive: true, force: true });

  assert.equal(july, 0, 'a boundary-instant commit belongs to the month it starts, not the one before');
  assert.equal(august, 1);
});

test('countCommits does not double-count a commit reachable from two cwds in the same repo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kerf-git-test-'));
  await initRepo(dir, 'me@example.com');
  await commit(dir, 'only one');
  const subdir = join(dir, 'apps', 'sub');
  await mkdir(subdir, { recursive: true });

  const now = Date.now();
  // Repo root AND a subdirectory inside it — both resolve to the same
  // toplevel, so this must still count the one commit once.
  const count = await countCommits([dir, subdir], now - 60_000, now + 60_000);
  await rm(dir, { recursive: true, force: true });

  assert.equal(count, 1);
});
