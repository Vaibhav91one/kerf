#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { computeSessionMetric, type Heartbeat } from '@kerf/shared';
import { extractAll } from './extract.ts';
import { uploadMetrics, sendHeartbeat } from './upload.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const command = positionals[0];

const DEFAULT_API_URL = 'https://backend-2cf9-3000.prg1.zerops.app';
const DEFAULT_DASHBOARD_URL = 'https://frontend-2cf9-3000.prg1.zerops.app';
const CONFIG_PATH = process.env.KERF_CONFIG ?? process.env.KERF_CONFIG_PATH ?? join(homedir(), '.kerf', 'config.json');

type KerfConfig = {
  apiUrl: string;
  dashboardUrl: string;
  token: string;
  handle: string;
};

async function readMetrics() {
  const bySession = await extractAll();
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
  const started = await fetch(`${apiUrl}/api/cli-login/start`, { method: 'POST' });
  if (!started.ok) {
    console.error(`login failed to start: ${started.status} ${started.statusText}`);
    process.exit(1);
  }
  const { code, expiresAtMs } = (await started.json()) as { code: string; expiresAtMs: number };
  const connectUrl = `${dashboardUrl}/cli/connect?code=${encodeURIComponent(code)}`;
  console.log(`opening ${connectUrl}`);
  console.log('if the browser does not open, paste that URL into Chrome');
  openBrowser(connectUrl);

  for (;;) {
    if (Date.now() > expiresAtMs) {
      console.error('login expired — run `kerf login` again');
      process.exit(1);
    }
    await sleep(2000);
    const polled = await fetch(`${apiUrl}/api/cli-login/${encodeURIComponent(code)}`).catch(() => null);
    if (!polled) continue;
    if (polled.status === 404) {
      console.error('login expired — run `kerf login` again');
      process.exit(1);
    }
    if (!polled.ok) continue;
    const body = (await polled.json()) as { status: 'pending' | 'claimed'; handle?: string; token?: string };
    if (body.status !== 'claimed') continue;
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

if (command === 'sync') {
  const { apiUrl, token } = requireAuth();
  const result = await uploadMetrics(apiUrl, token, await readMetrics());
  console.log(`uploaded ${result.accepted} sessions, ${result.rejected.length} rejected`);
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
  if (sub !== 'install' || !slug) {
    console.error('usage: kerf skill install <slug>');
    process.exit(1);
  }
  const apiUrl = configuredApiUrl();

  const res = await fetch(`${apiUrl}/api/skill-library/by-slug/${encodeURIComponent(slug)}`);
  if (res.status === 404) {
    console.error(`no skill published at slug "${slug}"`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const skill = (await res.json()) as { slug: string; content: string };

  const dir = join(homedir(), '.claude', 'skills', skill.slug);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, 'SKILL.md');
  writeFileSync(dest, skill.content);

  // Best-effort — one unreachable server must not fail an install that already
  // wrote the file to disk.
  const config = readConfig();
  const token = process.env.KERF_TOKEN ?? config?.token;
  await fetch(`${apiUrl}/api/skill-library/by-slug/${encodeURIComponent(skill.slug)}/install`, {
    method: 'POST',
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  })
    .then((bump) => {
      if (!bump.ok && bump.status !== 401) console.error(`install-count bump failed: ${bump.status} ${bump.statusText}`);
    })
    .catch((err) => console.error(`install-count bump failed: ${err.message}`));

  console.log(`installed → ${dest}`);
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
} else {
  const metrics = await readMetrics();
  const qualifying = metrics.filter((m) => m.qualifies);
  console.log(`${metrics.length} sessions parsed, ${qualifying.length} qualify (§7.4 floor)`);
  const withRework = qualifying.filter((m) => m.reworkRatio !== null);
  const avg = withRework.reduce((sum, m) => sum + (m.reworkRatio ?? 0), 0) / (withRework.length || 1);
  console.log(`avg rework ratio (qualifying sessions): ${avg.toFixed(3)}`);
}
