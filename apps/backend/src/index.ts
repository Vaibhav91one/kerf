import { randomBytes } from 'node:crypto';
import { clerkMiddleware } from '@clerk/express';
import express from 'express';
import type { SessionMetric } from '@kerf/shared';
import { tierCuts, tierForValue, improvementTips, badges, currentStreak, tierProgress, LIVE_TTL_MS } from '@kerf/shared';
import { prisma } from './db.ts';
import { bearerAuth, clerkAuth, getClerkUserId, seedEnvProfile, tokenHash, type AuthedRequest } from './auth.ts';
import {
  validateSessionMetric,
  validateHeartbeat,
  validateProfileInput,
  validateProjectInput,
  validateSkillInput,
  validateChatInput,
} from './validate.ts';
import { publish, subscribe, subscriberCount } from './live.ts';

const app = express();
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

const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (process.env.CLERK_SECRET_KEY && clerkPublishableKey) app.use(clerkMiddleware({ publishableKey: clerkPublishableKey }));
app.use(express.json({ limit: '1mb' }));

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

const CLI_LOGIN_TTL_MS = 10 * 60_000;
const cliLogins = new Map<
  string,
  {
    expiresAtMs: number;
    handle?: string;
    token?: string;
    claimedAtMs?: number;
  }
>();

function pruneCliLogins(nowMs = Date.now()) {
  for (const [code, session] of cliLogins) {
    if (session.expiresAtMs <= nowMs || (session.claimedAtMs && nowMs - session.claimedAtMs > 60_000)) {
      cliLogins.delete(code);
    }
  }
}

function profileJson(p: {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
  createdAt: Date;
}) {
  return {
    handle: p.handle,
    displayName: p.displayName,
    bio: p.bio,
    publicSkills: p.publicSkills,
    avatarUrl: p.avatarUrl,
    websiteUrl: p.websiteUrl,
    githubUrl: p.githubUrl,
    xUrl: p.xUrl,
    createdAtMs: p.createdAt.getTime(),
  };
}

async function mintApiToken(handle: string, label: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.apiToken.create({
    data: {
      handle,
      tokenHash: tokenHash(token),
      label,
    },
  });
  return token;
}

/**
 * Claim a handle and get a CLI token. The token is returned exactly once and
 * stored only as a sha256 digest — there is no endpoint that can show it again.
 */
app.post('/api/profiles', async (req, res) => {
  if (process.env.CLERK_SECRET_KEY) {
    res.status(410).json({ error: 'use Clerk sign-in to create a profile' });
    return;
  }
  const result = validateProfileInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const { handle, displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl } = result.value;
  const existing = await prisma.profile.findUnique({ where: { handle }, select: { handle: true } });
  if (existing) {
    res.status(409).json({ error: 'handle taken' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  await prisma.profile.create({
    data: { handle, displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl, tokenHash: tokenHash(token) },
  });
  res.status(201).json({ handle, token });
});

app.get('/api/clerk/me', clerkAuth, async (req: AuthedRequest, res) => {
  const clerkUserId = req.clerkUserId as string;
  const profile = await prisma.profile.findUnique({ where: { clerkUserId } });
  res.json({ profile: profile ? profileJson(profile) : null });
});

app.post('/api/clerk/profile', clerkAuth, async (req: AuthedRequest, res) => {
  const clerkUserId = req.clerkUserId as string;
  const existing = await prisma.profile.findUnique({ where: { clerkUserId } });
  const result = validateProfileInput(existing ? { ...req.body, handle: existing.handle } : req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }

  const { handle, displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl } = result.value;
  if (!existing) {
    const taken = await prisma.profile.findUnique({ where: { handle }, select: { handle: true, clerkUserId: true } });
    if (taken) {
      res.status(409).json({ error: 'handle taken' });
      return;
    }
  }

  const profile = existing
    ? await prisma.profile.update({
        where: { handle: existing.handle },
        data: { displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl },
      })
    : await prisma.profile.create({
        data: { handle, clerkUserId, displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl },
      });
  res.status(existing ? 200 : 201).json({ profile: profileJson(profile) });
});

app.post('/api/clerk/api-token', clerkAuth, async (req: AuthedRequest, res) => {
  const profile = await prisma.profile.findUnique({
    where: { clerkUserId: req.clerkUserId as string },
    select: { handle: true },
  });
  if (!profile) {
    res.status(409).json({ error: 'profile required' });
    return;
  }
  const token = await mintApiToken(profile.handle, 'dashboard session');
  res.json({ handle: profile.handle, token });
});

app.post('/api/cli-login/start', (_req, res) => {
  pruneCliLogins();
  const code = randomBytes(18).toString('base64url');
  const expiresAtMs = Date.now() + CLI_LOGIN_TTL_MS;
  cliLogins.set(code, { expiresAtMs });
  res.status(201).json({ code, expiresAtMs });
});

app.get('/api/cli-login/:code', (req, res) => {
  pruneCliLogins();
  const code = req.params.code as string;
  const session = cliLogins.get(code);
  if (!session) {
    res.status(404).json({ status: 'expired' });
    return;
  }
  if (!session.token || !session.handle) {
    res.json({ status: 'pending', expiresAtMs: session.expiresAtMs });
    return;
  }
  cliLogins.delete(code);
  res.json({ status: 'claimed', handle: session.handle, token: session.token });
});

app.post('/api/cli-login/:code/claim', clerkAuth, async (req: AuthedRequest, res) => {
  pruneCliLogins();
  const code = req.params.code as string;
  const session = cliLogins.get(code);
  if (!session) {
    res.status(404).json({ error: 'login code expired' });
    return;
  }
  if (session.token) {
    res.status(409).json({ error: 'login code already claimed' });
    return;
  }
  const profile = await prisma.profile.findUnique({
    where: { clerkUserId: req.clerkUserId as string },
    select: { handle: true },
  });
  if (!profile) {
    res.status(409).json({ error: 'profile required' });
    return;
  }

  const token = await mintApiToken(profile.handle, 'kerf login');
  session.handle = profile.handle;
  session.token = token;
  session.claimedAtMs = Date.now();
  cliLogins.set(code, session);
  res.json({ status: 'claimed', handle: profile.handle });
});

app.patch('/api/me/profile', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateProfileInput({ ...req.body, handle });
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  const { displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl } = result.value;
  const row = await prisma.profile.update({
    where: { handle },
    data: { displayName, bio, publicSkills, avatarUrl, websiteUrl, githubUrl, xUrl },
    select: {
      handle: true,
      displayName: true,
      bio: true,
      publicSkills: true,
      avatarUrl: true,
      websiteUrl: true,
      githubUrl: true,
      xUrl: true,
    },
  });
  res.json(row);
});

app.get('/api/profiles', async (_req, res) => {
  const rows = await prisma.profile.findMany({
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { handle: true, displayName: true, bio: true, publicSkills: true, avatarUrl: true, createdAt: true },
  });
  res.json({
    profiles: rows.map((r) => ({
      handle: r.handle,
      displayName: r.displayName,
      bio: r.bio,
      publicSkills: r.publicSkills,
      avatarUrl: r.avatarUrl,
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
    avatarUrl: profile.avatarUrl,
    websiteUrl: profile.websiteUrl,
    githubUrl: profile.githubUrl,
    xUrl: profile.xUrl,
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

// --- Shared Skills Library (Path B) ------------------------------------------
//
// Distinct from GET /api/skills above (which is a Path A tool-usage leaderboard
// derived from transcript toolCounts). This is a human publishing an actual
// Claude Code Skill they use day to day — the same Path B rule as projects and
// chat: a person typed `content` into a form and clicked Publish. `handle` and
// `slug` are never accepted from the client (see validateSkillInput).

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '') || 'skill';
}

/** Best-effort handle from a bearer token — used only to compute isStarredByMe on public reads. */
async function optionalHandle(req: express.Request): Promise<string | null> {
  const parts = (req.header('authorization') ?? '').split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return null;
  const hash = tokenHash(parts[1]);
  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash: hash }, select: { handle: true } });
  if (apiToken) return apiToken.handle;
  const profile = await prisma.profile.findUnique({ where: { tokenHash: hash }, select: { handle: true } });
  if (profile) return profile.handle;
  const clerkUserId = getClerkUserId(req);
  if (!clerkUserId) return null;
  const clerkProfile = await prisma.profile.findUnique({ where: { clerkUserId }, select: { handle: true } });
  return clerkProfile?.handle ?? null;
}

function toSkillJson(s: {
  id: string;
  handle: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  installCount: number;
  createdAt: Date;
  _count: { stars: number };
}) {
  return {
    id: s.id,
    handle: s.handle,
    slug: s.slug,
    name: s.name,
    description: s.description,
    content: s.content,
    installCount: s.installCount,
    starCount: s._count.stars,
    createdAtMs: s.createdAt.getTime(),
  };
}

const SKILL_INCLUDE = { _count: { select: { stars: true as const } } };

app.post('/api/skill-library', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateSkillInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }

  const base = slugify(result.value.name);
  let slug = base;
  let row;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      row = await prisma.skill.create({
        data: { handle, slug, ...result.value },
        include: SKILL_INCLUDE,
      });
      break;
    } catch {
      // Unique constraint on slug — retry with a short random suffix.
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }
  }
  if (!row) {
    res.status(500).json({ error: 'could not allocate a unique slug' });
    return;
  }

  const json = toSkillJson(row);
  publish({ type: 'skill', data: json });
  res.status(201).json(json);
});

app.get('/api/skill-library', async (req, res) => {
  const rows = await prisma.skill.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: SKILL_INCLUDE });
  const handle = await optionalHandle(req);
  const starred = handle
    ? new Set(
        (
          await prisma.skillStar.findMany({
            where: { handle, skillId: { in: rows.map((r) => r.id) } },
            select: { skillId: true },
          })
        ).map((s) => s.skillId),
      )
    : new Set<string>();
  const skills = rows.map((row) => ({ ...toSkillJson(row), isStarredByMe: starred.has(row.id) }));
  if (req.query.sort === 'stars') skills.sort((a, b) => b.starCount - a.starCount);
  res.json({ skills });
});

app.get('/api/skill-library/:id', async (req, res) => {
  const row = await prisma.skill.findUnique({ where: { id: req.params.id }, include: SKILL_INCLUDE });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const handle = await optionalHandle(req);
  const isStarredByMe = handle
    ? (await prisma.skillStar.findUnique({ where: { skillId_handle: { skillId: row.id, handle } } })) !== null
    : false;
  res.json({ ...toSkillJson(row), isStarredByMe });
});

app.get('/api/skill-library/by-slug/:slug', async (req, res) => {
  const row = await prisma.skill.findUnique({ where: { slug: req.params.slug }, include: SKILL_INCLUDE });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const handle = await optionalHandle(req);
  const isStarredByMe = handle
    ? (await prisma.skillStar.findUnique({ where: { skillId_handle: { skillId: row.id, handle } } })) !== null
    : false;
  res.json({ ...toSkillJson(row), isStarredByMe });
});

app.post('/api/skill-library/:id/star', bearerAuth, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const skillId = req.params.id as string;
  const existing = await prisma.skillStar.findUnique({ where: { skillId_handle: { skillId, handle } } });
  if (existing) {
    await prisma.skillStar.delete({ where: { skillId_handle: { skillId, handle } } });
  } else {
    const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { id: true } });
    if (!skill) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await prisma.skillStar.create({ data: { skillId, handle } });
  }
  const starCount = await prisma.skillStar.count({ where: { skillId } });
  res.json({ starred: !existing, starCount });
});

app.post('/api/skill-library/by-slug/:slug/install', async (req, res) => {
  try {
    await prisma.skill.update({ where: { slug: req.params.slug }, data: { installCount: { increment: 1 } } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'not found' });
  }
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
