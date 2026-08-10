#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { computeSessionMetric, type Heartbeat } from '@kerf/shared';
import { extractAll } from './extract.ts';
import { uploadMetrics, sendHeartbeat } from './upload.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const command = positionals[0];

async function readMetrics() {
  const bySession = await extractAll();
  return [...bySession.entries()].map(([sessionId, events]) => computeSessionMetric(sessionId, events));
}

function requireEnv(): { apiUrl: string; token: string } {
  const apiUrl = process.env.KERF_API_URL;
  const token = process.env.KERF_TOKEN;
  if (!apiUrl || !token) {
    console.error('KERF_API_URL and KERF_TOKEN must be set');
    process.exit(1);
  }
  return { apiUrl, token };
}

if (command === 'sync') {
  const { apiUrl, token } = requireEnv();
  const result = await uploadMetrics(apiUrl, token, await readMetrics());
  console.log(`uploaded ${result.accepted} sessions, ${result.rejected.length} rejected`);
} else if (command === 'live') {
  const { apiUrl, token } = requireEnv();
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
  const apiUrl = process.env.KERF_API_URL;
  if (!apiUrl) {
    console.error('KERF_API_URL must be set');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/api/skill-library/by-slug/${slug}`);
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
  await fetch(`${apiUrl}/api/skill-library/by-slug/${skill.slug}/install`, { method: 'POST' }).catch((err) =>
    console.error(`install-count bump failed: ${err.message}`),
  );

  console.log(`installed → ${dest}`);
} else {
  const metrics = await readMetrics();
  const qualifying = metrics.filter((m) => m.qualifies);
  console.log(`${metrics.length} sessions parsed, ${qualifying.length} qualify (§7.4 floor)`);
  const withRework = qualifying.filter((m) => m.reworkRatio !== null);
  const avg = withRework.reduce((sum, m) => sum + (m.reworkRatio ?? 0), 0) / (withRework.length || 1);
  console.log(`avg rework ratio (qualifying sessions): ${avg.toFixed(3)}`);
}
