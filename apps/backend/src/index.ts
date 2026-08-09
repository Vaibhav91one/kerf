import { randomBytes } from 'node:crypto';
import express from 'express';
import type { SessionMetric } from '@kerf/shared';
import { tierCuts, tierForValue, improvementTips, badges, currentStreak, tierProgress, LIVE_TTL_MS } from '@kerf/shared';
import { prisma } from './db.ts';
import { bearerAuth, seedEnvProfile, tokenHash, type AuthedRequest } from './auth.ts';
import {
  validateSessionMetric,
  validateHeartbeat,
  validateProfileInput,
  validateProjectInput,
  validateChatInput,
} from './validate.ts';
import { publish, subscribe, subscriberCount } from './live.ts';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Bearer-token auth, not cookies, so a wildcard origin carries no CSRF risk.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, streams: subscriberCount() });
});

// --- Path A: telemetry -------------------------------------------------------

function toRow(handle: string, m: SessionMetric) {
  return {
    handle,
    sessionId: m.sessionId,
    source: m.source,
    projectHash: m.projectHash,
    startedMs: BigInt(m.startedMs),
    endedMs: BigInt(m.endedMs),
    turns: m.turns,
    edits: m.edits,
    editsRework: m.editsRework,
    reworkRatio: m.reworkRatio,
    qualifies: m.qualifies,
    toolCounts: m.toolCounts,
  };
}

app.post('/api/metrics', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const body: unknown = req.body;
  if (!Array.isArray(body)) {
    res.status(400).json({ error: 'expected an array of SessionMetric' });
    return;
  }

  const accepted: SessionMetric[] = [];
  const rejected: { index: number; reason: string }[] = [];
  body.forEach((item, index) => {
    const result = validateSessionMetric(item);
    if (result.ok) accepted.push(result.value);
    else rejected.push({ index, reason: result.reason });
  });

  await Promise.all(
    accepted.map((m) =>
      prisma.sessionMetric.upsert({
        where: { handle_sessionId: { handle, sessionId: m.sessionId } },
        create: toRow(handle, m),
        update: toRow(handle, m),
      }),
    ),
  );

  // A finished session is no longer live. Only announce the ones that actually
  // had a live tile — a plain `kerf sync` uploads history, and every one of
  // those would otherwise fire a session-end for a tile nobody ever saw.
  const uploaded = accepted.map((m) => m.sessionId);
  if (uploaded.length > 0) {
    const wasLive = await prisma.liveSession.findMany({
      where: { handle, sessionId: { in: uploaded } },
      select: { sessionId: true },
    });
    if (wasLive.length > 0) {
      await prisma.liveSession.deleteMany({ where: { handle, sessionId: { in: wasLive.map((s) => s.sessionId) } } });
      for (const { sessionId } of wasLive) publish({ type: 'session-end', data: { handle, sessionId } });
    }
  }

  res.json({ accepted: accepted.length, rejected });
});

/**
 * Live heartbeat. Same privacy shape as a metric — numbers, hashes and
 * timestamps — so a live tile can say "someone is 12 edits into a session going
 * well" without saying anything about what they are building.
 */
app.post('/api/heartbeat', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateHeartbeat(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const h = result.value;
  const reworkRatio = h.edits === 0 ? null : h.editsRework / h.edits;

  // A project is only surfaced if the owner published one for this hash — an
  // unpublished projectHash stays an opaque hash and shows as "private work".
  const project = await prisma.project.findFirst({
    where: { handle, projectHash: h.projectHash },
    select: { id: true },
  });

  const row = {
    handle,
    sessionId: h.sessionId,
    projectId: project?.id ?? null,
    startedMs: BigInt(h.startedMs),
    lastBeatMs: BigInt(h.atMs),
    turns: h.turns,
    edits: h.edits,
    editsRework: h.editsRework,
    reworkRatio,
  };
  await prisma.liveSession.upsert({
    where: { handle_sessionId: { handle, sessionId: h.sessionId } },
    create: row,
    update: row,
  });

  publish({ type: 'session', data: { ...row, startedMs: h.startedMs, lastBeatMs: h.atMs } });
  res.json({ ok: true });
});

// --- Live ------------------------------------------------------------------

app.get('/api/live/stream', (_req, res) => {
  subscribe(res);
});

app.get('/api/live/sessions', async (_req, res) => {
  const cutoff = BigInt(Date.now() - LIVE_TTL_MS);
  const rows = await prisma.liveSession.findMany({
    where: { lastBeatMs: { gte: cutoff } },
    orderBy: { lastBeatMs: 'desc' },
    take: 100,
  });
  res.json({
    sessions: rows.map((r) => ({
      handle: r.handle,
      sessionId: r.sessionId,
      projectId: r.projectId,
      startedMs: Number(r.startedMs),
      lastBeatMs: Number(r.lastBeatMs),
      turns: r.turns,
      edits: r.edits,
      editsRework: r.editsRework,
      reworkRatio: r.reworkRatio,
    })),
  });
});

// --- Chat --------------------------------------------------------------------

// ponytail: in-memory sliding window, one process, resets on restart. Enough to
// stop a stuck loop from flooding the room; swap for a Redis counter when the
// SSE hub itself outgrows one container.
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_PER_WINDOW = 5;
const chatHits = new Map<string, number[]>();

function chatAllowed(handle: string, nowMs: number): boolean {
  const hits = (chatHits.get(handle) ?? []).filter((t) => nowMs - t < CHAT_WINDOW_MS);
  if (hits.length >= CHAT_MAX_PER_WINDOW) {
    chatHits.set(handle, hits);
    return false;
  }
  hits.push(nowMs);
  chatHits.set(handle, hits);
  return true;
}

app.post('/api/chat', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateChatInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!chatAllowed(handle, Date.now())) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const row = await prisma.chatMessage.create({ data: { handle, body: result.value.body } });
  const message = { id: row.id, handle, body: row.body, createdAtMs: row.createdAt.getTime() };
  publish({ type: 'chat', data: message });
  res.status(201).json(message);
});

app.get('/api/chat', async (_req, res) => {
  const rows = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({
    messages: rows
      .reverse()
      .map((r) => ({ id: r.id, handle: r.handle, body: r.body, createdAtMs: r.createdAt.getTime() })),
  });
});

// --- Accounts & profiles -----------------------------------------------------

/**
 * Claim a handle and get a CLI token. The token is returned exactly once and
 * stored only as a sha256 digest — there is no endpoint that can show it again.
 */
app.post('/api/profiles', async (req, res) => {
  const result = validateProfileInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const { handle, displayName, bio, publicSkills } = result.value;
  const existing = await prisma.profile.findUnique({ where: { handle }, select: { handle: true } });
  if (existing) {
    res.status(409).json({ error: 'handle taken' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  await prisma.profile.create({
    data: { handle, displayName, bio, publicSkills, tokenHash: tokenHash(token) },
  });
  res.status(201).json({ handle, token });
});

app.patch('/api/me/profile', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateProfileInput({ handle, ...req.body });
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const { displayName, bio, publicSkills } = result.value;
  const row = await prisma.profile.update({
    where: { handle },
    data: { displayName, bio, publicSkills },
    select: { handle: true, displayName: true, bio: true, publicSkills: true },
  });
  res.json(row);
});

app.get('/api/profiles', async (_req, res) => {
  const rows = await prisma.profile.findMany({
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { handle: true, displayName: true, bio: true, publicSkills: true, createdAt: true },
  });
  res.json({
    profiles: rows.map((r) => ({
      handle: r.handle,
      displayName: r.displayName,
      bio: r.bio,
      publicSkills: r.publicSkills,
      createdAtMs: r.createdAt.getTime(),
    })),
  });
});

/**
 * A public profile: standing, badges, published projects, and — only when the
 * owner opted in — which tools and skills they lean on. Never session-level
 * detail for someone else's account.
 */
app.get('/api/profiles/:handle', async (req, res) => {
  const handle = req.params.handle;
  const profile = await prisma.profile.findUnique({ where: { handle } });
  if (!profile) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  const [rows, projects, cuts] = await Promise.all([
    prisma.sessionMetric.findMany({ where: { handle }, orderBy: { startedMs: 'desc' } }),
    prisma.project.findMany({ where: { handle }, orderBy: { createdAt: 'desc' } }),
    seasonCuts(),
  ]);

  const metrics: SessionMetric[] = rows.map(rowToMetric);
  const qualifying = metrics.filter((m) => m.qualifies && m.reworkRatio !== null);
  const ratios = qualifying.map((m) => m.reworkRatio as number);
  const avg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  const skills: Record<string, number> = {};
  if (profile.publicSkills) {
    for (const m of metrics) {
      for (const [tool, count] of Object.entries(m.toolCounts)) {
        skills[tool] = (skills[tool] ?? 0) + count;
      }
    }
  }

  res.json({
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    createdAtMs: profile.createdAt.getTime(),
    // Standing is a ratio, never a count (§7.2). sessionCount rides along for
    // display only, and must not be used to order anything.
    standing: {
      avgReworkRatio: avg,
      tier: avg === null ? null : tierForValue(avg, cuts, false),
      progress: avg === null ? null : tierProgress(avg, cuts),
      sessionCount: qualifying.length,
    },
    streak: currentStreak(qualifying, Date.now()),
    badges: badges(metrics, cuts, Date.now()),
    publicSkills: profile.publicSkills,
    skills: profile.publicSkills ? skills : null,
    projects: projects.map(toProjectJson),
  });
});

/** Cross-user skill/tool usage — only from profiles that opted in. */
app.get('/api/skills', async (_req, res) => {
  const opted = await prisma.profile.findMany({ where: { publicSkills: true }, select: { handle: true } });
  const handles = opted.map((p) => p.handle);
  const rows = handles.length
    ? await prisma.sessionMetric.findMany({ where: { handle: { in: handles } }, select: { handle: true, toolCounts: true } })
    : [];

  const totals: Record<string, { count: number; users: Set<string> }> = {};
  for (const r of rows) {
    for (const [tool, count] of Object.entries((r.toolCounts as Record<string, number>) ?? {})) {
      const entry = (totals[tool] ??= { count: 0, users: new Set() });
      entry.count += count;
      entry.users.add(r.handle);
    }
  }

  res.json({
    skills: Object.entries(totals)
      .map(([name, v]) => ({ name, count: v.count, users: v.users.size }))
      .sort((a, b) => b.count - a.count),
  });
});

// --- Projects (build in public) ---------------------------------------------

function toProjectJson(p: {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  createdAt: Date;
}) {
  // projectHash is deliberately not serialised: it is derived from a local path
  // and is nobody else's business, even hashed.
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    description: p.description,
    repoUrl: p.repoUrl,
    createdAtMs: p.createdAt.getTime(),
  };
}

app.post('/api/projects', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateProjectInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const row = await prisma.project.create({ data: { handle, ...result.value } });
  const json = toProjectJson(row);
  publish({ type: 'project', data: json });
  res.status(201).json(json);
});

app.get('/api/projects', async (_req, res) => {
  const rows = await prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ projects: rows.map(toProjectJson) });
});

app.get('/api/projects/:id', async (req, res) => {
  const row = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const live = await prisma.liveSession.findMany({
    where: { projectId: row.id, lastBeatMs: { gte: BigInt(Date.now() - LIVE_TTL_MS) } },
  });
  res.json({ ...toProjectJson(row), liveSessions: live.length });
});

// --- Own dashboard -----------------------------------------------------------

function rowToMetric(r: {
  source: string;
  sessionId: string;
  projectHash: string;
  startedMs: bigint;
  endedMs: bigint;
  turns: number;
  edits: number;
  editsRework: number;
  reworkRatio: number | null;
  qualifies: boolean;
  toolCounts: unknown;
}): SessionMetric {
  return {
    source: r.source as 'claude-code',
    sessionId: r.sessionId,
    projectHash: r.projectHash,
    startedMs: Number(r.startedMs),
    endedMs: Number(r.endedMs),
    turns: r.turns,
    edits: r.edits,
    editsRework: r.editsRework,
    reworkRatio: r.reworkRatio,
    qualifies: r.qualifies,
    toolCounts: (r.toolCounts as Record<string, number>) ?? {},
  };
}

// User dashboard (numbers-only, spec §6): own session history, a tool-usage
// histogram, and threshold-triggered tips — all derived from numbers already
// in SessionMetric, nothing read from prompt/tool-argument content.
app.get('/api/me/sessions', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const rows = await prisma.sessionMetric.findMany({ where: { handle }, orderBy: { startedMs: 'desc' } });
  const metrics = rows.map(rowToMetric);

  const qualifyingRatios = metrics.filter((m) => m.qualifies && m.reworkRatio !== null).map((m) => m.reworkRatio as number);
  const cuts = tierCuts(qualifyingRatios);

  const toolTotals: Record<string, number> = {};
  const sessions = metrics.map((metric) => {
    for (const [tool, count] of Object.entries(metric.toolCounts)) {
      toolTotals[tool] = (toolTotals[tool] ?? 0) + count;
    }
    return { ...metric, tips: metric.qualifies ? improvementTips(metric, cuts) : [] };
  });

  res.json({
    sessions,
    toolTotals,
    streak: currentStreak(metrics.filter((m) => m.qualifies), Date.now()),
    badges: badges(metrics, cuts, Date.now()),
  });
});

// --- Season ------------------------------------------------------------------

async function seasonCuts() {
  const now = new Date();
  const monthStart = BigInt(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = BigInt(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const rows = await prisma.sessionMetric.findMany({
    where: { qualifies: true, startedMs: { gte: monthStart, lt: monthEnd }, reworkRatio: { not: null } },
    select: { reworkRatio: true },
  });
  return tierCuts(rows.map((r) => r.reworkRatio as number));
}

// ponytail: "current season" = current UTC calendar month, computed live
// from session_metrics — no persisted season row, no cron close-out. See
// prisma/schema.prisma header for the upgrade path.
app.get('/api/season/current', async (_req, res) => {
  const now = new Date();
  const monthStart = BigInt(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = BigInt(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const rows = await prisma.sessionMetric.findMany({
    where: { qualifies: true, startedMs: { gte: monthStart, lt: monthEnd }, reworkRatio: { not: null } },
    select: { handle: true, reworkRatio: true },
  });

  const values = rows.map((r) => r.reworkRatio as number);
  const cuts = tierCuts(values);

  // Standings rank on a per-account average ratio — an outcome over an attempt,
  // never a total (§7.2). More sessions does not move you up the board.
  const byHandle = new Map<string, number[]>();
  for (const r of rows) {
    const list = byHandle.get(r.handle) ?? [];
    list.push(r.reworkRatio as number);
    byHandle.set(r.handle, list);
  }
  const standings = [...byHandle.entries()]
    .map(([handle, list]) => {
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      return { handle, avgReworkRatio: avg, tier: tierForValue(avg, cuts, false), sessionCount: list.length };
    })
    .sort((a, b) => a.avgReworkRatio - b.avgReworkRatio);

  res.json({
    metric: 'rework_ratio',
    higherIsBetter: false,
    sampleSize: values.length,
    cuts,
    standings,
    ghosts: [], // ponytail: no closed historical seasons exist yet on night one
  });
});

const port = Number(process.env.PORT ?? 3000);

seedEnvProfile()
  .catch((err) => console.error('profile seed failed', err))
  .finally(() => {
    app.listen(port, () => console.log(`kerf backend listening on ${port}`));
  });
