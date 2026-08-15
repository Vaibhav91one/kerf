#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { computeSessionMetric, HANDLE_RE, monthEndMs, monthStartMs, type Heartbeat } from '@kerf/shared';
import { extractAll } from './extract.ts';
import { extractAllCodex } from './extract-codex.ts';
import { countCommits } from './git.ts';
import { listLocalProjects, listLocalSkills } from './local.ts';
import { uploadMetrics, uploadCommits, sendHeartbeat } from './upload.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    repo: { type: 'string' },
    private: { type: 'boolean' },
    force: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});
const command = positionals[0];

const VERSION = '0.1.0';

// One table, printed by `kerf help` and by every usage error, so the two can
// never drift. `args` is what follows the command in the usage line.
const COMMANDS: { name: string; args?: string; blurb: string; network: boolean }[] = [
  { name: 'login', blurb: 'Authorise this machine in the browser and store the token', network: true },
  { name: 'logout', blurb: 'Forget the stored token', network: false },
  { name: 'whoami', blurb: 'Print the handle and API this machine is pointed at', network: false },
  { name: 'sync', blurb: 'Upload finished sessions', network: true },
  { name: 'live', blurb: 'Heartbeat in-flight sessions every 15s until you stop it', network: true },
  { name: 'skills', blurb: 'List the skills in ~/.claude/skills', network: false },
  {
    name: 'skills publish',
    args: '<slug> [--private]',
    blurb: 'Publish one of them to the shared library',
    network: true,
  },
  { name: 'projects', blurb: 'List the projects you have worked in', network: false },
  {
    name: 'projects publish',
    args: '[--name <name>] [--repo <url>] [--private]',
    blurb: 'Publish the project in the current directory',
    network: true,
  },
  {
    name: 'skill install',
    args: '<slug> [--force]',
    blurb: 'Install a published skill into ~/.claude/skills, namespaced by publisher',
    network: true,
  },
];

function help(): void {
  console.log(`kerf ${VERSION} — a league for coding-agent CLI users\n`);
  console.log('USAGE\n  kerf <command> [options]\n');
  // Column width is computed, not hardcoded — the longest usage line used to
  // run straight into its own description.
  const usageOf = (c: (typeof COMMANDS)[number]) => `${c.name}${c.args ? ` ${c.args}` : ''}`;
  const pad = Math.max(...COMMANDS.map((c) => usageOf(c).length), '(no command)'.length, 'KERF_API_URL'.length) + 2;
  const row = (left: string, right: string) => console.log(`  ${left.padEnd(pad)}${right}`);

  console.log('COMMANDS');
  for (const c of COMMANDS) row(usageOf(c), `${c.blurb}${c.network ? '' : '  (local)'}`);
  row('(no command)', 'Dry run: parse local transcripts and print the totals  (local)');

  console.log('\nOPTIONS');
  row('-h, --help', 'Show this help');
  row('-v, --version', 'Show the version');

  console.log('\nENVIRONMENT');
  row('KERF_API_URL', `Override the API (default ${DEFAULT_API_URL})`);
  row('KERF_TOKEN', 'Use this token instead of the stored one');
  row('KERF_CONFIG', 'Config path (default ~/.kerf/config.json)');
  console.log(`


PRIVACY
  Commands marked (local) make no network call at all. Everything uploaded is
  counts, hashes and timestamps — never prompts, file contents or paths.`);
}

/** Usage error: say what was wrong, show the one relevant line, exit non-zero. */
function usage(message: string, commandName?: string): never {
  console.error(message);
  const c = COMMANDS.find((x) => x.name === commandName);
  if (c) console.error(`\nusage: kerf ${c.name}${c.args ? ` ${c.args}` : ''}`);
  else console.error('\nrun `kerf help` to see every command');
  process.exit(1);
}

const DEFAULT_API_URL = 'https://backend-2cf9-3000.prg1.zerops.app';
const DEFAULT_DASHBOARD_URL = 'https://kerf.vaibhav.quest';
const CONFIG_PATH = process.env.KERF_CONFIG ?? process.env.KERF_CONFIG_PATH ?? join(homedir(), '.kerf', 'config.json');

type KerfConfig = {
  apiUrl: string;
  dashboardUrl: string;
  token: string;
  handle: string;
};

async function readMetrics() {
  const bySession = await extractAll();
  // Both agents' sessions land in one map — no --source flag, no id
  // collision (Claude Code session UUIDs and Codex's are from different
  // tools), and a machine with no ~/.codex just contributes nothing here.
  for (const [sessionId, events] of await extractAllCodex()) bySession.set(sessionId, events);
  return [...bySession.entries()].map(([sessionId, events]) => computeSessionMetric(sessionId, events));
}

function readConfig(): KerfConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as KerfConfig;
  } catch {
    return null;
  }
}

function writeConfig(config: KerfConfig) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function configuredApiUrl(): string {
  return process.env.KERF_API_URL ?? readConfig()?.apiUrl ?? DEFAULT_API_URL;
}

function configuredDashboardUrl(): string {
  return process.env.KERF_DASHBOARD_URL ?? readConfig()?.dashboardUrl ?? DEFAULT_DASHBOARD_URL;
}

function requireAuth(): { apiUrl: string; token: string } {
  const config = readConfig();
  const apiUrl = process.env.KERF_API_URL ?? config?.apiUrl ?? DEFAULT_API_URL;
  const token = process.env.KERF_TOKEN ?? config?.token;
  if (!token) {
    console.error('not logged in — run `kerf login` or set KERF_TOKEN');
    process.exit(1);
  }
  return { apiUrl, token };
}

function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // The printed URL is the fallback.
  }
}

async function login() {
  const apiUrl = configuredApiUrl();
  const dashboardUrl = configuredDashboardUrl();

  // KERF_TOKEN wins over the config file everywhere else, so logging in while
  // it is set writes a token that nothing will ever read — and prints success.
  // Refuse rather than warn: "logged in as @you" followed by every command
  // acting as someone else is worse than not logging in at all.
  if (process.env.KERF_TOKEN) {
    console.error('KERF_TOKEN is set, and it takes precedence over the stored login.');
    console.error('Unset it before running `kerf login`, or you will keep using the env token.');
    process.exit(1);
  }
  // An unreachable API used to surface here as a raw undici stack trace, which
  // says "Error.captureStackTrace" to someone whose actual problem is a typo in
  // KERF_API_URL or a backend that is down.
  const started = await fetch(`${apiUrl}/api/cli-login/start`, { method: 'POST' }).catch(() => null);
  if (!started) {
    console.error(`cannot reach ${apiUrl}`);
    console.error('check the server is up, or set KERF_API_URL if it lives somewhere else');
    process.exit(1);
  }
  if (!started.ok) {
    console.error(`login failed to start: ${started.status} ${started.statusText}`);
    process.exit(1);
  }
  const body = (await started.json().catch(() => null)) as
    | { deviceCode?: string; userCode?: string; expiresAtMs?: number }
    | null;
  if (!body?.deviceCode || !body.userCode || !body.expiresAtMs) {
    console.error(`unexpected response from ${apiUrl} — is that the Kerf API?`);
    process.exit(1);
  }
  const { deviceCode, userCode, expiresAtMs } = body as { deviceCode: string; userCode: string; expiresAtMs: number };
  // No code in this URL — the page is opened bare and the person types the
  // userCode themselves. A link cannot type for them, which is the point:
  // the old single ?code= param both identified AND authorised the login, so
  // forwarding a `kerf login` link to someone else let their sign-in mint a
  // token this CLI process would then collect. See device-code.ts.
  const connectUrl = `${dashboardUrl}/cli/connect`;
  console.log(`opening ${connectUrl}`);
  console.log('if the browser does not open, paste that URL into Chrome');
  openBrowser(connectUrl);
  console.log('');
  console.log(`  enter this code: ${userCode}`);
  console.log('');

  // Waiting for a human and being unable to reach the server used to look
  // identical: both printed nothing for ten minutes. Count consecutive
  // transport failures so the second kind can say so.
  let unreachable = 0;
  let waited = 0;
  console.log('waiting for you to authorise in the browser…');

  for (;;) {
    if (Date.now() > expiresAtMs) {
      console.error('login expired — run `kerf login` again');
      process.exit(1);
    }
    await sleep(2000);
    waited += 2;

    const polled = await fetch(`${apiUrl}/api/cli-login/${encodeURIComponent(deviceCode)}`).catch(() => null);
    if (!polled || !polled.ok) {
      unreachable += 1;
      // ~30s of solid failure is a server problem, not a slow user. Say it once
      // and keep trying — the code is still valid if it comes back.
      if (unreachable === 15) console.error(`cannot reach ${apiUrl} — still retrying`);
      if (polled?.status === 404) {
        console.error('login expired — run `kerf login` again');
        process.exit(1);
      }
      continue;
    }
    if (unreachable >= 15) console.log('reconnected');
    unreachable = 0;

    const body = (await polled.json().catch(() => null)) as
      | { status: 'pending' | 'claimed'; handle?: string; token?: string }
      | null;
    if (!body) {
      console.error(`unexpected response from ${apiUrl} — is that the Kerf API?`);
      process.exit(1);
    }
    if (body.status !== 'claimed') {
      // A quiet tick every 30s, so the terminal never looks hung.
      if (waited % 30 === 0) console.log(`still waiting… ${Math.round((expiresAtMs - Date.now()) / 60_000)} min left`);
      continue;
    }
    if (!body.handle || !body.token) {
      console.error('login response was malformed');
      process.exit(1);
    }
    writeConfig({ apiUrl, dashboardUrl, handle: body.handle, token: body.token });
    console.log(`logged in as @${body.handle}`);
    console.log(`config written → ${CONFIG_PATH}`);
    return;
  }
}

if (values.help || command === 'help') {
  help();
} else if (values.version) {
  console.log(VERSION);
} else if (command === 'sync') {
  const { apiUrl, token } = requireAuth();
  // uploadMetrics throws mid-chunk on a non-ok response (network blip, the
  // server briefly down) — unlike the commit-sync block below, this one
  // exits rather than swallowing the error: session metrics are the sync
  // command's actual job, not a best-effort extra.
  let result;
  try {
    result = await uploadMetrics(apiUrl, token, await readMetrics());
  } catch (err) {
    console.error(`sync failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  console.log(`uploaded ${result.accepted} sessions, ${result.rejected.length} rejected`);
  // Print WHY, not just how many — a rejected session is data silently lost
  // otherwise. These are validator strings ("unexpected field(s): x"), never
  // transcript content.
  for (const r of result.rejected) console.error(`  rejected: ${JSON.stringify(r)}`);

  // §7.4's season commit floor — best-effort, same shape as the install-count
  // bump: an unreachable or un-migrated (pre-B5) backend must not fail a sync
  // that already uploaded real session history. Current AND previous month,
  // so a sync on the 1st can still correct last month's count.
  try {
    const cwds = (await listLocalProjects()).map((p) => p.cwd);
    const now = Date.now();
    const lastMonth = monthStartMs(now) - 1; // any ts in the previous UTC month
    const counts = await Promise.all(
      [now, lastMonth].map(async (ts) => ({
        monthStartMs: monthStartMs(ts),
        commits: await countCommits(cwds, monthStartMs(ts), monthEndMs(ts)),
      })),
    );
    const commitResult = await uploadCommits(apiUrl, token, counts);
    console.log(`commits: ${commitResult.accepted} month(s) recorded`);
  } catch (err) {
    console.error(`commit count sync skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
} else if (command === 'live') {
  const { apiUrl, token } = requireAuth();
  const BEAT_MS = 15_000;
  // A session counts as in-flight if its last event is newer than this. Two
  // beats' worth of slack, so a slow turn doesn't blink the tile off and on.
  const ACTIVE_MS = 2 * BEAT_MS;

  console.log('beating every 15s — ctrl-c to stop');
  // ponytail: re-read the transcripts each tick rather than tailing the files.
  // The extractor already walks them fast enough at this corpus size; swap in a
  // watcher if the parse ever costs more than the interval.
  for (;;) {
    const now = Date.now();
    const active = (await readMetrics()).filter((m) => now - m.endedMs < ACTIVE_MS);
    for (const m of active) {
      const beat: Heartbeat = {
        source: m.source,
        sessionId: m.sessionId,
        projectHash: m.projectHash,
        startedMs: m.startedMs,
        atMs: now,
        turns: m.turns,
        edits: m.edits,
        editsRework: m.editsRework,
      };
      // One unreachable server must not kill a session that is still going.
      await sendHeartbeat(apiUrl, token, beat).catch((err) => console.error(`beat failed: ${err.message}`));
    }
    console.log(`${new Date(now).toISOString()} — ${active.length} live session(s)`);
    await sleep(BEAT_MS);
  }
} else if (command === 'skill') {
  const sub = positionals[1];
  const slug = positionals[2];
  if (sub !== 'install' || !slug) usage('kerf skill takes a subcommand.', 'skill install');
  const apiUrl = configuredApiUrl();

  // Authenticated GET: by-slug now narrows to rows you can see, so without the
  // token your OWN private skill 404s here — a "kerf lied to me" bug rather
  // than a privacy one. Read the token before the fetch, not after.
  const installConfig = readConfig();
  const installToken = process.env.KERF_TOKEN ?? installConfig?.token;
  const res = await fetch(`${apiUrl}/api/skill-library/by-slug/${encodeURIComponent(slug)}`, {
    ...(installToken ? { headers: { authorization: `Bearer ${installToken}` } } : {}),
  });
  if (res.status === 404) {
    console.error(`no skill published at slug "${slug}"`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const skill = (await res.json()) as { handle: string; slug: string; content: string };

  // The install path is built from values the server returned, so both are
  // validated before they reach join(): `..` or a separator in either would
  // otherwise write outside ~/.claude/skills. Same shape the backend
  // generates in slugify() (slug) and cleanHandle() (handle).
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(skill.slug)) {
    console.error(`server returned an unsafe slug: ${JSON.stringify(skill.slug)}`);
    process.exit(1);
  }
  if (!HANDLE_RE.test(skill.handle)) {
    console.error(`server returned an unsafe handle: ${JSON.stringify(skill.handle)}`);
    process.exit(1);
  }

  // Namespaced under the publisher's handle, not the bare slug: a slug is
  // globally unique on the server, but a LOCALLY-authored skill of yours
  // (never published, so the server knows nothing about it) could share a
  // name with someone else's published skill, and installing that stranger's
  // content over yours is prompt injection into your own agent — Claude Code
  // loads and follows SKILL.md as instructions. `<handle>-<slug>` means a
  // stranger's skill can never occupy a name you already own.
  const dir = join(homedir(), '.claude', 'skills', `${skill.handle}-${skill.slug}`);
  const dest = join(dir, 'SKILL.md');
  if (existsSync(dest) && !values.force) {
    const previous = readFileSync(dest, 'utf8');
    if (previous !== skill.content) {
      console.error(
        `${dest} already exists with different content.\n` +
          `Re-run with --force to overwrite your local copy, or remove it first.`,
      );
      process.exit(1);
    }
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(dest, skill.content);

  // Best-effort — one unreachable server must not fail an install that already
  // wrote the file to disk. Same token the GET above used.
  await fetch(`${apiUrl}/api/skill-library/by-slug/${encodeURIComponent(skill.slug)}/install`, {
    method: 'POST',
    ...(installToken ? { headers: { authorization: `Bearer ${installToken}` } } : {}),
  })
    .then((bump) => {
      if (!bump.ok && bump.status !== 401) console.error(`install-count bump failed: ${bump.status} ${bump.statusText}`);
    })
    .catch((err) => console.error(`install-count bump failed: ${err.message}`));

  console.log(`installed → ${dest}`);
} else if (command === 'skills') {
  // Local only — this prints to your own terminal and makes no network call.
  const sub = positionals[1];
  const skills = await listLocalSkills();
  if (!sub) {
    if (skills.length === 0) console.log('no skills in ~/.claude/skills');
    for (const skill of skills) {
      console.log(`${skill.slug.padEnd(28)}${skill.description.slice(0, 60)}`);
    }
    console.log(`\n${skills.length} local skill(s) — publish one with \`kerf skills publish <slug>\``);
  } else if (sub === 'publish') {
    const slug = positionals[2];
    const skill = skills.find((s) => s.slug === slug);
    if (!slug) usage('kerf skills publish needs a slug — run `kerf skills` to see them.', 'skills publish');
    if (!skill) {
      console.error(`no skill at ~/.claude/skills/${slug}/SKILL.md`);
      console.error('run `kerf skills` to see what is on this machine');
      process.exit(1);
    }
    const { apiUrl, token } = requireAuth();
    const res = await fetch(`${apiUrl}/api/skill-library`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      // Spread, not `isPublic: undefined` — the key must be ABSENT so the
      // server's `!== false` default applies and an old CLI keeps publishing
      // public.
      body: JSON.stringify({
        name: skill.name,
        description: skill.description || undefined,
        content: skill.content,
        ...(values.private ? { isPublic: false } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`publish failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const published = (await res.json()) as { slug: string };
    console.log(`published → ${published.slug}${values.private ? ' (private — only you can see it)' : ''}`);
  } else {
    usage(`unknown subcommand \`kerf skills ${sub}\`.`, 'skills publish');
  }
} else if (command === 'projects') {
  const sub = positionals[1];
  const projects = await listLocalProjects();
  if (!sub) {
    // Local only. Paths print here and nowhere else — publishing sends the
    // name you choose and the hash, never the path itself.
    if (projects.length === 0) console.log('no transcripts in ~/.claude/projects');
    for (const project of projects) {
      console.log(`${String(project.sessions).padStart(4)}  ${project.cwd}`);
    }
    console.log(`\n${projects.length} local project(s) — publish one with \`kerf projects publish --name <name>\``);
  } else if (sub === 'publish') {
    const cwd = process.cwd();
    const match = projects.find((p) => p.cwd === cwd);
    if (!match) {
      console.error(`no transcripts recorded for ${cwd} — cd into a project you have worked in`);
      process.exit(1);
    }
    const name = values.name ?? cwd.split('/').filter(Boolean).pop() ?? cwd;
    const { apiUrl, token } = requireAuth();
    const res = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      // projectHash is what links your uploaded sessions to this project. The
      // web form has no way to supply it, which is why publishing from the CLI
      // is the better path.
      body: JSON.stringify({
        name,
        repoUrl: values.repo,
        projectHash: match.projectHash,
        ...(values.private ? { isPublic: false } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`publish failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(
      `published "${name}"${values.private ? ' (private — only you can see it)' : ''} — ${match.sessions} local session(s) will link by hash`,
    );
  } else {
    usage(`unknown subcommand \`kerf projects ${sub}\`.`, 'projects publish');
  }
} else if (command === 'login') {
  await login();
} else if (command === 'logout') {
  rmSync(CONFIG_PATH, { force: true });
  console.log(`logged out — removed ${CONFIG_PATH}`);
} else if (command === 'whoami') {
  const config = readConfig();
  if (!config) {
    console.log('not logged in');
    process.exit(1);
  }
  console.log(`@${config.handle}`);
  console.log(config.apiUrl);
} else if (command !== undefined) {
  usage(`unknown command \`kerf ${command}\`.`);
} else {
  const metrics = await readMetrics();
  const qualifying = metrics.filter((m) => m.qualifies);
  console.log(`${metrics.length} sessions parsed, ${qualifying.length} qualify (§7.4 floor)`);
  const withRework = qualifying.filter((m) => m.reworkRatio !== null);
  const avg = withRework.reduce((sum, m) => sum + (m.reworkRatio ?? 0), 0) / (withRework.length || 1);
  console.log(`avg rework ratio (qualifying sessions): ${avg.toFixed(3)}`);
}
