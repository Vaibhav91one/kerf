#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
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
} else {
  const metrics = await readMetrics();
  const qualifying = metrics.filter((m) => m.qualifies);
  console.log(`${metrics.length} sessions parsed, ${qualifying.length} qualify (§7.4 floor)`);
  const withRework = qualifying.filter((m) => m.reworkRatio !== null);
  const avg = withRework.reduce((sum, m) => sum + (m.reworkRatio ?? 0), 0) / (withRework.length || 1);
  console.log(`avg rework ratio (qualifying sessions): ${avg.toFixed(3)}`);
}
