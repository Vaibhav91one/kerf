// Commit counts for §7.4's season floor. The ONLY thing that leaves this
// module is an integer — no hashes, no paths, no emails, no messages (§6).
//
// Design: recompute the whole UTC month from local git and REPLACE the
// server's number, never increment it. That one choice resolves every edge
// case cleanly:
//   - dedup across syncs is free — re-running `kerf sync` recomputes the same
//     answer and re-uploads it, so running it ten times can't inflate the
//     count. An incrementing endpoint would need the server to remember which
//     commit hashes it had already seen, which means uploading hashes — §6
//     forbids that.
//   - multi-repo is a Set<hash> union, so a commit reachable from two clones
//     or worktrees of the same repo counts once.
//   - attribution reads `git config user.email` PER REPO, not globally —
//     people genuinely use different emails for work and personal repos, and
//     a single default would silently undercount whichever one it isn't.
//
// Degenerate play is accepted on purpose, matching points.ts's house style:
// `git commit --allow-empty` x5 clears the floor for free, but the floor
// only gates RANKING ELIGIBILITY — it earns zero points on its own, and the
// ten qualifying sessions the season floor also requires still have to be
// real (metrics.ts's own per-session floor, uploaded honestly by the
// extractor).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Runs `git <args>` in `cwd`. Returns null for anything that means "nothing
 * to count here" — not a repo, no git on PATH, a timeout — rather than
 * throwing, so one bad path can't fail a whole sync.
 *
 * `execFile` with an argv array, never a shell string: a repo path or commit
 * message containing a quote or a semicolon must not be able to run anything.
 */
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['-C', cwd, ...args], { timeout: 10_000, maxBuffer: 8 << 20 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Commits authored in [sinceMs, untilMs) across every repo reachable from
 * `cwds` — the project list `kerf` already knows about from your transcripts
 * (apps/cli/src/local.ts's listLocalProjects).
 */
export async function countCommits(cwds: string[], sinceMs: number, untilMs: number): Promise<number> {
  // Two cwds inside the same repo (a monorepo's apps/*, worktrees) must not
  // double-count — resolve each to its repo root first, then dedup the roots.
  const roots = new Set<string>();
  for (const cwd of cwds) {
    const top = await git(cwd, ['rev-parse', '--show-toplevel']);
    if (top) roots.add(top);
  }

  const hashes = new Set<string>();
  for (const root of roots) {
    const email = await git(root, ['config', 'user.email']);
    if (!email) continue; // no local git identity configured — nothing attributable here
    // --all so branch work counts (dedup by hash makes the overlap free);
    // --no-merges because a merge commit is not a unit of work.
    const log = await git(root, [
      'log',
      '--all',
      '--no-merges',
      `--author=${email}`,
      `--since=${new Date(sinceMs).toISOString()}`,
      // untilMs - 1: git's --since/--until are both inclusive of the exact
      // instant, so passing untilMs unmodified would double-count a commit
      // landing exactly on a UTC month boundary — present in this month's
      // [since, until] AND next month's [since, until) since untilMs IS next
      // month's sinceMs (season.ts's monthEndMs). This is what actually makes
      // the window half-open, matching this function's docstring.
      `--until=${new Date(untilMs - 1).toISOString()}`,
      '--pretty=format:%H',
    ]);
    if (!log) continue;
    for (const hash of log.split('\n')) if (hash) hashes.add(hash);
  }

  return hashes.size;
}
