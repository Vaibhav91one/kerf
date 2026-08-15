import { randomBytes } from 'node:crypto';
import { clerkMiddleware } from '@clerk/express';
import express from 'express';
import { Prisma } from '@prisma/client';
import type { AgentSource, SessionMetric } from '@kerf/shared';
import {
  sessionPoints, totalPoints, monthPoints, rankFor, LEVELS, improvementTips, badges, currentStreak,
  githubRepo, cleanText, cleanRepoUrl, classifyTool, LIMITS, LIVE_TTL_MS, MAX_RIVALS,
  seasonQualification, monthStartMs, SEASON_MIN_SESSIONS, SEASON_MIN_COMMITS,
} from '@kerf/shared';
import { prisma } from './db.ts';
import {
  clerkAuthorizedParties,
  clerkConfigured,
  clerkPublishableKey,
  getClerkUserId,
  requireClerkSession,
  requireMember,
  seedEnvProfile,
  tokenHash,
  type AuthedRequest,
} from './auth.ts';
import {
  validateSessionMetric,
  validateHeartbeat,
  validateProfileInput,
  validateProjectInput,
  validateSkillInput,
  validateChatInput,
  validateVisibilityInput,
  validateHiddenSkills,
  validateRivalInput,
  validateCommitCount,
} from './validate.ts';
import { publish, subscribe, subscriberCount } from './live.ts';
import { rateLimit } from './ratelimit.ts';
import { visibleTo } from './visibility.ts';
import { generateDeviceCode, generateUserCode, normalizeUserCode } from './device-code.ts';

// ponytail: a defensive backstop, not a real limit — no account is anywhere
// near it today. The correctness-preserving fix at real scale is a SQL
// aggregate (SUM/COUNT server-side) instead of loading every row into JS; this
// just keeps one pathological account from OOMing the process in the meantime.
const MAX_METRIC_ROWS = 50_000;

const app = express();
// Zerops terminates TLS and sits in front as a reverse proxy, setting
// X-Forwarded-For itself — trusting exactly one hop is what makes req.ip the
// real client address instead of the proxy's, which is what per-IP limits
// below (SSE, cli-login) need to mean anything.
app.set('trust proxy', 1);
// Bearer-token auth, not cookies, so a wildcard origin carries no CSRF risk.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  // Defence in depth: a CLI-login code rides in a path segment, and nothing
  // here should ever leak a URL to a third party through a Referer.
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/**
 * Liveness AND readiness. The DB round-trip is the whole point: Prisma connects
 * lazily and `app.listen` runs inside a `.finally()`, so without it this route
 * answers `{ok:true}` from a process whose database is entirely unreachable —
 * the healthiest-looking presentation of a completely broken service.
 */
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, streams: subscriberCount() });
  } catch {
    // 503, not 500: this is "not ready", and it is the signal the platform
    // healthcheck uses to keep traffic off this container.
    res.status(503).json({ ok: false, error: 'database unreachable' });
  }
});

// `clerkConfigured()` is the same predicate auth.ts answers 401-vs-503 from, so
// the middleware and the guards can never disagree about whether Clerk is on.
if (clerkConfigured()) {
  app.use(clerkMiddleware({ publishableKey: clerkPublishableKey(), authorizedParties: clerkAuthorizedParties() }));
}
app.use(express.json({ limit: '1mb' }));

// Route guard table. A new route belongs in exactly one of these three columns,
// and the two invariants below are what make the third column safe.
//
//   guard          | routes
//   ---------------+--------------------------------------------------------
//   public read    | GET /health, /api/season/current, /api/live/{stream,
//                  |   sessions}, /api/profiles[/:handle], /api/skills,
//                  |   /api/projects[/:id{,/activity,/github}],
//                  |   /api/skill-library[/:id | /by-slug/:slug], /api/chat,
//                  |   /api/cli-login/:deviceCode, /api/cli-login/user/:userCode/status,
//                  |   POST /api/cli-login/start
//   clerk session  | GET /api/clerk/me, POST /api/clerk/profile,
//                  |   POST /api/cli-login/user/:userCode/claim
//   member         | POST /api/{metrics,heartbeat,chat,projects,skill-library,commits},
//                  |   POST /api/skill-library/{:id/star,by-slug/:slug/install},
//                  |   POST /api/follows/:handle, PATCH /api/follows/:handle,
//                  |   PATCH /api/me/{profile,skill-visibility},
//                  |   PATCH /api/{projects,skill-library}/:id,
//                  |   GET /api/me/{sessions,tokens,follows},
//                  |   DELETE /api/{projects,skill-library}/:id, /api/me/tokens/:id
//
// Invariant 1: the authenticated handle comes from the Clerk session or the API
// token and is never read out of a body, param or query — see auth.ts.
// Invariant 2: every owner-scoped mutation puts `handle` in its WHERE clause, so
// a delete that matches nothing is a 404 rather than someone else's row.
// Invariant 3: every public read of a Project or a Skill passes
// `visibleTo(await optionalHandle(req))` into its WHERE clause. The ROW SET
// narrows, never the field set — a private row is absent, not blanked, so there
// is no 200-vs-404 existence oracle. See src/visibility.ts.
//
// The one oddity is POST /api/profiles: it is unauthenticated, because it is how
// the pre-Clerk flow minted an account, and it 410s whenever Clerk is configured.
//
// Public reads stay public, but "public" is now a property of the row rather
// than of the route (Invariant 3). The abuse surface is still handled by
// rateLimit(), not by gating reads.

/**
 * Best-effort handle from a bearer token or Clerk session.
 *
 * Two jobs now: `isStarredByMe` on public reads, and — since Invariant 3 — the
 * read-visibility input that lets an owner see their own private rows. It costs
 * ZERO DB round-trips when there is no `Authorization` header, because the early
 * return fires before any query; that is what makes it safe to call on the hot
 * anonymous routes.
 */
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

// One request's worth of history. `kerf sync` chunks at 500, so this is two
// chunks of headroom; past it the array is refused rather than turned into
// thousands of concurrent upserts.
const MAX_METRICS_PER_REQUEST = 1000;

app.post('/api/metrics', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const body: unknown = req.body;
  if (!Array.isArray(body)) {
    res.status(400).json({ error: 'expected an array of SessionMetric' });
    return;
  }
  if (body.length > MAX_METRICS_PER_REQUEST) {
    res.status(413).json({ error: `at most ${MAX_METRICS_PER_REQUEST} metrics per request` });
    return;
  }
  if (!rateLimit('metrics', handle, 10, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }

  const accepted: SessionMetric[] = [];
  const rejected: { index: number; reason: string }[] = [];
  body.forEach((item, index) => {
    const result = validateSessionMetric(item);
    if (result.ok) accepted.push(result.value);
    else rejected.push({ index, reason: result.reason });
  });

  // Serial, not Promise.all: a 1000-element array fanned out 1000 concurrent
  // upserts against a pool that holds a handful of connections, so one heavy
  // sync could stall every other request. One at a time bounds it to one.
  for (const m of accepted) {
    await prisma.sessionMetric.upsert({
      where: { handle_sessionId: { handle, sessionId: m.sessionId } },
      create: toRow(handle, m),
      update: toRow(handle, m),
    });
  }

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

// §7.4's season commit floor. Array body, mirroring /api/metrics's shape, so
// `kerf sync` can fix the current AND previous month in one call — a sync on
// the 1st must still be able to correct last month's count.
const MAX_COMMIT_COUNTS_PER_REQUEST = 24;

app.post('/api/commits', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const body: unknown = req.body;
  if (!Array.isArray(body)) {
    res.status(400).json({ error: 'expected an array of commit counts' });
    return;
  }
  if (body.length > MAX_COMMIT_COUNTS_PER_REQUEST) {
    res.status(413).json({ error: `at most ${MAX_COMMIT_COUNTS_PER_REQUEST} commit counts per request` });
    return;
  }
  if (!rateLimit('commits', handle, 10, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }

  const accepted: { monthStartMs: number; commits: number }[] = [];
  const rejected: { index: number; reason: string }[] = [];
  body.forEach((item, index) => {
    const result = validateCommitCount(item);
    if (result.ok) accepted.push(result.value);
    else rejected.push({ index, reason: result.reason });
  });

  // Replace, never increment — re-running `kerf sync` recomputes the whole
  // month locally and re-uploads it, so upserting the same value twice is a
  // no-op rather than double-counting. See CommitCount's schema comment.
  for (const c of accepted) {
    await prisma.commitCount.upsert({
      where: { handle_monthStartMs: { handle, monthStartMs: BigInt(c.monthStartMs) } },
      create: { handle, monthStartMs: BigInt(c.monthStartMs), commits: c.commits },
      update: { commits: c.commits },
    });
  }

  res.json({ accepted: accepted.length, rejected });
});

/**
 * Live heartbeat. Same privacy shape as a metric — numbers, hashes and
 * timestamps — so a live tile can say "someone is 12 edits into a session going
 * well" without saying anything about what they are building.
 */
app.post('/api/heartbeat', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateHeartbeat(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  // `kerf live` beats 4x/minute per session; 20 leaves room for several at once.
  if (!rateLimit('heartbeat', handle, 20, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const h = result.value;
  const reworkRatio = h.edits === 0 ? null : h.editsRework / h.edits;

  // A project is only surfaced if the owner published one for this hash — an
  // unpublished projectHash stays an opaque hash and shows as "private work".
  const project = await prisma.project.findFirst({
    where: { handle, projectHash: h.projectHash },
    select: { id: true, isPublic: true },
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

  // A session in a private project is not broadcast — to anyone, the owner
  // included (the decision taken with the user). The row is still written, so
  // the owner's own "Live" dot on /me and in the sidebar keeps working; it reads
  // the owner-scoped GET /api/me/sessions rather than this feed. Zero added
  // cost: the findFirst above already had to run.
  if (!project || project.isPublic) {
    publish({ type: 'session', data: { ...row, startedMs: h.startedMs, lastBeatMs: h.atMs } });
  }
  res.json({ ok: true });
});

// --- Live ------------------------------------------------------------------

app.get('/api/live/stream', (req, res) => {
  subscribe(req, res);
});

app.get('/api/live/sessions', async (_req, res) => {
  const cutoff = BigInt(Date.now() - LIVE_TTL_MS);
  const rows = await prisma.liveSession.findMany({
    where: { lastBeatMs: { gte: cutoff } },
    orderBy: { lastBeatMs: 'desc' },
    take: 100,
  });

  // The raw projectId used to go out to every anonymous viewer, and
  // GET /api/projects/:id then served that uuid's name and repo with no owner
  // check — the worst of the twelve leaks. One query over the ≤100 ids already
  // in hand; the session is dropped whole rather than having its projectId
  // nulled, because "someone is working on something secret" is itself a fact
  // the owner asked not to publish.
  //
  // ponytail: no LiveSession→Project relation. An FK on a table rewritten
  // 4x/minute forces an onDelete decision (cascade would silently delete live
  // rows on unpublish); a join is the upgrade if this list ever outgrows 100.
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((id): id is string => id !== null))];
  const hidden = projectIds.length
    ? new Set(
        (
          await prisma.project.findMany({ where: { id: { in: projectIds }, isPublic: false }, select: { id: true } })
        ).map((p) => p.id),
      )
    : new Set<string>();

  res.json({
    sessions: rows
      .filter((r) => r.projectId === null || !hidden.has(r.projectId))
      .map((r) => ({
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

app.post('/api/chat', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateChatInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  // Same 5-per-10s contract this route always had, now from ratelimit.ts.
  if (!rateLimit('chat', handle, 5, 10_000)) {
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
// Backstop against an unauthenticated caller inflating this map — /start has
// no rate limit (it can't be keyed on a handle nobody has yet), so a hard cap
// bounds the worst case regardless. pruneCliLogins() sweeps at 60s/1000
// entries, both self-tuning: 1000 keeps the case rare, 60s keeps the sweep
// itself cheap when it does run.
const MAX_PENDING_LOGINS = 1000;
const cliLogins = new Map<
  string, // deviceCode — the CLI's secret. Never appears in a URL a human sees.
  {
    userCode: string;
    expiresAtMs: number;
    handle?: string;
    token?: string;
    claimedAtMs?: number;
  }
>();
// Reverse lookup for the browser side, which knows only the userCode a human
// typed — never the deviceCode. Kept in sync with cliLogins: every insert,
// prune and claim touches both.
const deviceCodeByUserCode = new Map<string, string>();

let lastCliLoginSweepMs = 0;
function pruneCliLogins(nowMs = Date.now()) {
  if (nowMs - lastCliLoginSweepMs < 60_000 && cliLogins.size < MAX_PENDING_LOGINS) return;
  lastCliLoginSweepMs = nowMs;
  for (const [deviceCode, session] of cliLogins) {
    if (session.expiresAtMs <= nowMs || (session.claimedAtMs && nowMs - session.claimedAtMs > 60_000)) {
      cliLogins.delete(deviceCode);
      deviceCodeByUserCode.delete(session.userCode);
    }
  }
}

// Toggle routes (follow, skill-star) check-then-write rather than a real
// upsert because the two branches diverge (unfollow vs. a visibleTo-scoped
// existence check before follow). This narrows the race window's failure
// mode from "500" to "idempotent success": a racing duplicate hitting the
// unique constraint (P2002) or missing row (P2025) just means another
// request already landed the same end state.
function isPrismaErrorCode(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

function profileJson(p: {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
  hiddenSkills: string[];
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
  createdAt: Date;
}) {
  // Own-account view only (GET /api/clerk/me, POST /api/clerk/profile).
  // GET /api/profiles/:handle deliberately does NOT emit hiddenSkills:
  // publishing the list of what you hid is the opposite of hiding it.
  return {
    handle: p.handle,
    displayName: p.displayName,
    bio: p.bio,
    publicSkills: p.publicSkills,
    hiddenSkills: p.hiddenSkills,
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
  // Deliberately NOT clerkConfigured(): this gate must fail CLOSED. With a
  // secret but no publishable key, clerkConfigured() is false, and using it
  // here would reopen unauthenticated account minting on a half-configured
  // deploy. Gating on the secret alone means the worst case is "nobody can
  // create a profile", which is the right way round to be broken.
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

app.get('/api/clerk/me', requireClerkSession, async (req: AuthedRequest, res) => {
  const clerkUserId = req.clerkUserId as string;
  const profile = await prisma.profile.findUnique({ where: { clerkUserId } });
  res.json({ profile: profile ? profileJson(profile) : null });
});

app.post('/api/clerk/profile', requireClerkSession, async (req: AuthedRequest, res) => {
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

app.post('/api/cli-login/start', (req, res) => {
  pruneCliLogins();
  // Unauthenticated — there is no handle yet to rate-limit on — so this keys
  // on IP instead, now that `trust proxy` (top of file) makes req.ip the real
  // client address. Backstops an attacker inflating the map faster than the
  // TTL/prune can drain it (H5): 1000 pending logins is generous for real
  // traffic and cheap to fill for an attacker without this.
  if (!rateLimit('cli-login-start', req.ip ?? 'unknown', 10, 60_000) || cliLogins.size >= MAX_PENDING_LOGINS) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const deviceCode = generateDeviceCode();
  let userCode = generateUserCode();
  // Collision is astronomically unlikely (32^8 combinations) but cheap to
  // guard: a taken userCode would let two pending logins fight over one code.
  while (deviceCodeByUserCode.has(userCode)) userCode = generateUserCode();
  const expiresAtMs = Date.now() + CLI_LOGIN_TTL_MS;
  cliLogins.set(deviceCode, { userCode, expiresAtMs });
  deviceCodeByUserCode.set(userCode, deviceCode);
  res.status(201).json({ deviceCode, userCode, expiresAtMs });
});

/**
 * Non-consuming peek, for the browser — keyed on the userCode a human typed,
 * never the deviceCode (RFC 8628 split, see device-code.ts). Answers the
 * status and nothing else: no token, no handle, no delete.
 *
 * It exists so an expired or already-claimed code is reported as soon as it's
 * typed rather than after the whole claim round-trip.
 */
app.get('/api/cli-login/user/:userCode/status', (req, res) => {
  pruneCliLogins();
  // Unauthenticated, same as /start — key on IP. A human types a userCode
  // once per login attempt, so this budget only needs to absorb the
  // debounced re-checks the connect page fires while they type, not a poll
  // loop.
  if (!rateLimit('cli-login-status', req.ip ?? 'unknown', 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const deviceCode = deviceCodeByUserCode.get(normalizeUserCode(req.params.userCode as string));
  const session = deviceCode ? cliLogins.get(deviceCode) : undefined;
  if (!session) {
    res.status(404).json({ status: 'expired' });
    return;
  }
  res.json({ status: session.token ? 'claimed' : 'pending', expiresAtMs: session.expiresAtMs });
});

/**
 * The CLI's collection point, keyed on the deviceCode it alone holds — never
 * exposed in a URL, never typed by a human, so a phishing link has nothing to
 * carry that would let an attacker's CLI collect someone else's token (H1).
 * Deletes the entry and hands back the token once claimed.
 */
app.get('/api/cli-login/:deviceCode', (req, res) => {
  pruneCliLogins();
  // Unauthenticated — key on IP. The CLI polls this every 2s while waiting
  // (apps/cli/src/index.ts), so the budget needs headroom over the ~30
  // polls/min that produces; 60/min covers that with margin.
  if (!rateLimit('cli-login-poll', req.ip ?? 'unknown', 60, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const deviceCode = req.params.deviceCode as string;
  const session = cliLogins.get(deviceCode);
  if (!session) {
    res.status(404).json({ status: 'expired' });
    return;
  }
  if (!session.token || !session.handle) {
    res.json({ status: 'pending', expiresAtMs: session.expiresAtMs });
    return;
  }
  cliLogins.delete(deviceCode);
  deviceCodeByUserCode.delete(session.userCode);
  res.json({ status: 'claimed', handle: session.handle, token: session.token });
});

/**
 * The browser's claim action — the human read the userCode off their own
 * terminal and typed it here themselves, which is the actual consent step
 * (RFC 8628's device-authorization pattern). A link can carry a query
 * parameter; it cannot make someone type six characters they never saw.
 */
app.post('/api/cli-login/user/:userCode/claim', requireClerkSession, async (req: AuthedRequest, res) => {
  pruneCliLogins();
  // Authenticated — key on the Clerk user id, same defense-in-depth every
  // other mutating route in this flow already carries.
  if (!rateLimit('cli-login-claim', req.clerkUserId ?? 'unknown', 10, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const userCode = normalizeUserCode(req.params.userCode as string);
  const deviceCode = deviceCodeByUserCode.get(userCode);
  const session = deviceCode ? cliLogins.get(deviceCode) : undefined;
  if (!session || !deviceCode) {
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
  cliLogins.set(deviceCode, session);
  res.json({ status: 'claimed', handle: profile.handle });
});

app.patch('/api/me/profile', requireMember, async (req: AuthedRequest, res) => {
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

/**
 * The per-skill hide list, its own route on purpose.
 *
 * It is deliberately NOT a field on validateProfileInput: PATCH /api/me/profile
 * and POST /api/clerk/profile are both full-replace and share that validator,
 * and ClaimHandle posts `{handle, displayName}` only — the moment hiddenSkills
 * joined that allow-list, claiming a handle would wipe the list. One column, one
 * route, no shared blast radius.
 *
 * ponytail: last-write-wins over the whole array rather than a {key, hidden}
 * delta. It is one person editing their own preference; a delta endpoint buys
 * conflict resolution nobody is having.
 */
app.patch('/api/me/skill-visibility', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateHiddenSkills(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('visibility', handle, 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  await prisma.profile.update({ where: { handle }, data: { hiddenSkills: result.value } });
  res.json({ hiddenSkills: result.value });
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

  // Invariant 3: this route gains its first optionalHandle. Anonymous is the
  // common case and costs nothing (no Authorization header → early return).
  const viewer = await optionalHandle(req);
  const [rows, projects, followerCount, followingCount, myEdge] = await Promise.all([
    prisma.sessionMetric.findMany({ where: { handle }, orderBy: { startedMs: 'desc' }, take: MAX_METRIC_ROWS }),
    prisma.project.findMany({ where: { handle, ...visibleTo(viewer) }, orderBy: { createdAt: 'desc' } }),
    prisma.follow.count({ where: { followeeHandle: handle } }),
    prisma.follow.count({ where: { followerHandle: handle } }),
    // Same isStarredByMe shape as skills: fold the viewer's own follow state
    // into the profile read instead of a second route the client has to call.
    viewer && viewer !== handle
      ? prisma.follow.findUnique({
          where: { followerHandle_followeeHandle: { followerHandle: viewer, followeeHandle: handle } },
          select: { isRival: true },
        })
      : null,
  ]);

  const metrics: SessionMetric[] = rows.map(rowToMetric);
  const qualifying = metrics.filter((m) => m.qualifies);
  // Lifetime points — the same number the season board and /me derive, so the
  // three never disagree.
  const points = totalPoints(metrics);
  const rank = rankFor(points);

  const skills: Record<string, number> = {};
  if (profile.publicSkills) {
    // Hidden means hidden from everyone, this route included. The output key
    // stays `label` (the payload shape is unchanged); the key TESTED is
    // `${kind}:${label}`, the same one /api/skills and the switch on /me use.
    const hidden = new Set(profile.hiddenSkills);
    for (const m of metrics) {
      for (const [tool, count] of Object.entries(m.toolCounts)) {
        const { kind, label } = classifyTool(tool);
        if (kind === 'builtin') continue;
        if (hidden.has(`${kind}:${label}`)) continue;
        skills[label] = (skills[label] ?? 0) + count;
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
    // Points are lifetime and capped per UTC day (see points.ts's §7.5
    // counters). sessionCount rides along for display only.
    standing: {
      points,
      tier: rank.tier,
      next: rank.next,
      nextAt: rank.nextAt,
      pct: rank.pct,
      sessionCount: qualifying.length,
    },
    streak: currentStreak(qualifying, Date.now()),
    badges: badges(metrics, Date.now()),
    publicSkills: profile.publicSkills,
    skills: profile.publicSkills ? skills : null,
    projects: projects.map(toProjectJson),
    followerCount,
    followingCount,
    isFollowedByMe: myEdge !== null,
    isRivalOfMe: myEdge?.isRival ?? false,
  });
});

/**
 * Who this account follows, and which of them are marked as a rival. Owner-
 * scoped: this is the control surface both /live's filter and /rivals read
 * from, not a public follower list (follower/following COUNTS are public, on
 * GET /api/profiles/:handle — the list of WHO is a step further and stays
 * behind the owner's own token, same as the two published-inventory lists on
 * /me).
 */
app.get('/api/me/follows', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const rows = await prisma.follow.findMany({
    where: { followerHandle: handle },
    orderBy: { createdAt: 'desc' },
    select: { followeeHandle: true, isRival: true },
  });
  res.json({ following: rows.map((r) => ({ handle: r.followeeHandle, isRival: r.isRival })) });
});

/**
 * Follow/unfollow, toggled — exact template of POST .../skill-library/:id/star
 * below: rate-limited, idempotent, returns the new state plus the recomputed
 * count. Unfollowing drops isRival for free (the row is gone), which is what
 * makes "a rival you don't follow" an unreachable state rather than one every
 * caller has to guard against separately.
 */
app.post('/api/follows/:handle', requireMember, async (req: AuthedRequest, res) => {
  const follower = req.handle as string;
  if (!rateLimit('follow', follower, 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const followee = req.params.handle as string;
  if (followee === follower) {
    res.status(400).json({ error: 'cannot follow yourself' });
    return;
  }
  const key = { followerHandle_followeeHandle: { followerHandle: follower, followeeHandle: followee } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) {
    // A racing duplicate request may have deleted this row already — P2025
    // means the end state (unfollowed) is what we wanted anyway, so treat it
    // as success instead of a 500.
    try {
      await prisma.follow.delete({ where: key });
    } catch (err) {
      if (!isPrismaErrorCode(err, 'P2025')) throw err;
    }
  } else {
    const target = await prisma.profile.findUnique({ where: { handle: followee }, select: { handle: true } });
    if (!target) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    // Same race the other way — a concurrent duplicate request already
    // created this row. P2002 means the end state (following) is what we
    // wanted, so treat it as success instead of a 500.
    try {
      await prisma.follow.create({ data: { followerHandle: follower, followeeHandle: followee } });
    } catch (err) {
      if (!isPrismaErrorCode(err, 'P2002')) throw err;
    }
  }
  const followerCount = await prisma.follow.count({ where: { followeeHandle: followee } });
  res.json({ following: !existing, followerCount });
});

/**
 * Mark/unmark a followed account as a rival, capped at MAX_RIVALS. Owner-
 * scoped updateMany + count===0→404 (index.ts's universal mutation shape) —
 * "follow that account first" is the honest reason a rival-flip 404s, since
 * there is no row to flip until POST .../follows/:handle creates one.
 */
app.patch('/api/follows/:handle', requireMember, async (req: AuthedRequest, res) => {
  const follower = req.handle as string;
  const result = validateRivalInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('rival', follower, 20, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const followee = req.params.handle as string;
  if (result.value) {
    // ponytail: count-then-write, not a serialisable transaction. Two racing
    // requests can leave MAX_RIVALS+1 rivals; the cap is cosmetic and self-
    // healing (the next unrival brings it back under), not a hard invariant
    // worth a SELECT ... FOR UPDATE over.
    const rivals = await prisma.follow.count({
      where: { followerHandle: follower, isRival: true, followeeHandle: { not: followee } },
    });
    if (rivals >= MAX_RIVALS) {
      res.status(409).json({ error: `at most ${MAX_RIVALS} rivals` });
      return;
    }
  }
  const { count } = await prisma.follow.updateMany({
    where: { followerHandle: follower, followeeHandle: followee },
    data: { isRival: result.value },
  });
  if (count === 0) {
    res.status(404).json({ error: 'follow that account first' });
    return;
  }
  res.json({ isRival: result.value });
});

/** Cross-user skill/tool usage — only from profiles that opted in. */
// ponytail: "trending" means most-used in the last 7 days, not a week-over-week
// delta. A delta needs a second window over days 8-14, and on this much data
// every delta is noise. Add it when there is enough history to mean something.
const TRENDING_WINDOW_MS = 7 * 86_400_000;
const SKILL_OF_THE_DAY_POOL = 20;

app.get('/api/skills', async (req, res) => {
  // Any value other than 7d is all-time — a public read should not 400 on a
  // query string someone typed.
  const windowed = req.query.window === '7d';
  const opted = await prisma.profile.findMany({
    where: { publicSkills: true },
    // Riding on a query this route already runs, which is why a per-skill hide
    // list is a column rather than a table — zero extra queries on the hottest
    // read in the app.
    select: { handle: true, hiddenSkills: true },
  });
  const handles = opted.map((p) => p.handle);
  const hidden = new Map(opted.map((p) => [p.handle, new Set(p.hiddenSkills)]));
  const rows = handles.length
    ? await prisma.sessionMetric.findMany({
        where: {
          handle: { in: handles },
          // Lands on @@index([handle, startedMs]); a window shrinks the JS fold
          // below, so this is strictly cheaper than the unwindowed call.
          ...(windowed ? { startedMs: { gte: BigInt(Date.now() - TRENDING_WINDOW_MS) } } : {}),
        },
        select: { handle: true, toolCounts: true },
        take: MAX_METRIC_ROWS,
      })
    : [];

  // Per-handle counts as well as the total, so the league page can answer "who
  // uses this". Both sides are already public for these accounts: the handles
  // opted in, and a tool name is a bounded identifier, never an argument (§6).
  const TOP_USERS_PER_SKILL = 7;
  const totals: Record<string, { kind: string; label: string; count: number; byHandle: Map<string, number> }> = {};
  for (const r of rows) {
    for (const [tool, count] of Object.entries((r.toolCounts as Record<string, number>) ?? {})) {
      const { kind, label } = classifyTool(tool);
      // Skipped BEFORE the accumulate, and that ordering is the whole point: it
      // is what keeps count, users, topUsers and skillOfTheDay mutually
      // consistent. Filtering the finished array instead would leave a `users`
      // count that includes people who are not in `topUsers`.
      if (hidden.get(r.handle)?.has(`${kind}:${label}`)) continue;
      // Keyed on kind+label so every tool of one MCP server merges into one row.
      const entry = (totals[`${kind}:${label}`] ??= { kind, label, count: 0, byHandle: new Map() });
      entry.count += count;
      entry.byHandle.set(r.handle, (entry.byHandle.get(r.handle) ?? 0) + count);
    }
  }

  const skills = Object.entries(totals)
    .map(([name, v]) => ({
      name,
      kind: v.kind,
      label: v.label,
      count: v.count,
      users: v.byHandle.size,
      topUsers: [...v.byHandle.entries()]
        .map(([handle, count]) => ({ handle, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_USERS_PER_SKILL),
    }))
    // Total order on purpose: equal counts used to fall back to Postgres row
    // order, so the list — and anything derived from it — could reshuffle on a
    // restart. Skill of the day depends on this being stable.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // ponytail: the UTC day number IS the hash — already uniform, so the modulo
  // is the index. No crypto, no stored pick, no cron; it rolls at 00:00 UTC and
  // every instance answers the same thing. One skill in the pool means the same
  // skill daily, which is the only correct answer rather than a bug.
  const pool = skills.filter((s) => s.kind !== 'builtin').slice(0, SKILL_OF_THE_DAY_POOL);
  const skillOfTheDay = pool.length === 0 ? null : pool[Math.floor(Date.now() / 86_400_000) % pool.length];

  // Built-in rows are still returned; the skills page filters them out. Serving
  // them keeps "show tools too" a one-line change on the client.
  res.json({ window: windowed ? '7d' : 'all', skills, skillOfTheDay });
});

// --- Projects (build in public) ---------------------------------------------

function toProjectJson(p: {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  logoUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
}) {
  // projectHash is deliberately not serialised: it is derived from a local path
  // and is nobody else's business, even hashed.
  //
  // isPublic needs no branch: a stranger only ever receives rows visibleTo()
  // already let through, so it is always true for them. The owner's UI needs the
  // real value to draw the toggle.
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    description: p.description,
    repoUrl: p.repoUrl,
    logoUrl: p.logoUrl,
    isPublic: p.isPublic,
    createdAtMs: p.createdAt.getTime(),
  };
}

app.post('/api/projects', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateProjectInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('projects', handle, 10, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const row = await prisma.project.create({ data: { handle, ...result.value } });
  const json = toProjectJson(row);
  // A row created private must never be broadcast — which is why the create
  // form carries the switch rather than asking you to create then flip.
  if (row.isPublic) publish({ type: 'project', data: json });
  res.status(201).json(json);
});

app.get('/api/projects', async (req, res) => {
  const viewer = await optionalHandle(req);
  const rows = await prisma.project.findMany({
    where: visibleTo(viewer),
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // How many of the owner's own sessions carry this project's hash. An
  // aggregate count, the same class of number as the session count already on
  // a public profile — the hash itself is still never serialised. Not a leak
  // despite covering every account: it is looked up by (handle, hash) below and
  // never reaches the client.
  //
  // Scoped to the handles on THIS page, not the whole table: this used to
  // groupBy every session_metrics row for every account regardless of the
  // take:100 above, so the page's cost grew with total sessions across every
  // user rather than with the 100 rows it actually renders.
  const pageHandles = [...new Set(rows.map((r) => r.handle))];
  const counts = pageHandles.length
    ? await prisma.sessionMetric.groupBy({
        by: ['handle', 'projectHash'],
        where: { handle: { in: pageHandles } },
        _count: { _all: true },
      })
    : [];
  const countByKey = new Map(counts.map((c) => [`${c.handle} ${c.projectHash}`, c._count._all]));
  const countFor = (handle: string, projectHash: string | null) =>
    projectHash === null ? 0 : countByKey.get(`${handle} ${projectHash}`) ?? 0;

  res.json({
    projects: rows.map((r) => ({ ...toProjectJson(r), sessionCount: countFor(r.handle, r.projectHash) })),
  });
});

app.get('/api/projects/:id', async (req, res) => {
  const viewer = await optionalHandle(req);
  const row = await prisma.project.findFirst({ where: { id: req.params.id, ...visibleTo(viewer) } });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const [live, sessionCount] = await Promise.all([
    prisma.liveSession.findMany({
      where: { projectId: row.id, lastBeatMs: { gte: BigInt(Date.now() - LIVE_TTL_MS) } },
    }),
    // Scoped count rather than the list route's whole-table groupBy — the
    // detail page should not pay for every other project's rows.
    // ponytail: add an index on (handle, project_hash) if this ever gets slow;
    // the existing (handle, started_ms) index covers only the handle prefix.
    row.projectHash === null
      ? Promise.resolve(0)
      : prisma.sessionMetric.count({ where: { handle: row.handle, projectHash: row.projectHash } }),
  ]);
  res.json({ ...toProjectJson(row), liveSessions: live.length, sessionCount });
});

/**
 * Sessions per week for one project, last 12 weeks.
 *
 * §6: counts only — no session ids, no per-session timestamps, nothing that
 * says WHICH session happened when. That is the same class of number as the
 * `sessionCount` this page already shows publicly, just bucketed so it can be
 * drawn. A week is the coarsest bucket a chart can still use; do not make this
 * finer, and do not add fields to the rows.
 */
const ACTIVITY_WEEKS = 12;
const WEEK_MS = 7 * 86_400_000;

app.get('/api/projects/:id/activity', async (req, res) => {
  const viewer = await optionalHandle(req);
  // Narrowed like the detail route, not just guarded on the detail route: a
  // sibling that 200s for an id its parent 404s for IS the existence oracle.
  const row = await prisma.project.findFirst({
    where: { id: req.params.id as string, ...visibleTo(viewer) },
    select: { handle: true, projectHash: true },
  });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  // Weeks are anchored to now, not to the calendar, so the last bucket is
  // always "this week" and the chart never opens on a stub.
  const nowMs = Date.now();
  const firstWeekStart = nowMs - (ACTIVITY_WEEKS - 1) * WEEK_MS;
  const weeks = Array.from({ length: ACTIVITY_WEEKS }, (_, i) => ({
    weekStartMs: firstWeekStart + i * WEEK_MS,
    sessions: 0,
  }));

  if (row.projectHash !== null) {
    const rows = await prisma.sessionMetric.findMany({
      where: {
        handle: row.handle,
        projectHash: row.projectHash,
        startedMs: { gte: BigInt(firstWeekStart) },
      },
      select: { startedMs: true },
    });
    for (const r of rows) {
      const idx = Math.floor((Number(r.startedMs) - firstWeekStart) / WEEK_MS);
      if (idx >= 0 && idx < weeks.length) weeks[idx].sessions += 1;
    }
  }

  res.json({ weeks });
});

// --- GitHub proxy ------------------------------------------------------------
//
// A separate route from the project detail on purpose: this is a third-party
// call that can be slow, rate-limited or down, and folding it into the detail
// route would take the whole page with it.
//
// §6 note: nothing here is transcript-derived — it is a third-party fact about a
// URL the owner deliberately published, the same class as logoUrl. But it IS
// free text arriving from outside our trust boundary, so it goes through the
// same sanitisers Path B uses. **The output of toRepoJson must never be written
// to a Project column** — that would be a Path-B write from a non-human source,
// exactly what social.ts's banner exists to prevent.

// ponytail: one Map, one TTL, LRU-capped. The repo count is NOT "small" —
// it is attacker-controlled, since anyone can publish a project pointing at any
// public github.com repo, and expiry alone never removes a key. Same
// single-process assumption as the SSE hub; Redis when this runs on more than
// one instance.
const GITHUB_TTL_MS = 10 * 60_000;
const GITHUB_CACHE_MAX = 200;
const githubCache = new Map<string, { atMs: number; status: number; body: unknown }>();

/**
 * delete-then-set is what makes this LRU rather than FIFO: re-setting a key
 * that already exists does not move it in a Map's insertion order, so without
 * the delete the most-used repo would be the first one evicted.
 */
function githubCacheSet(key: string, value: { atMs: number; status: number; body: unknown }): void {
  githubCache.delete(key);
  githubCache.set(key, value);
  if (githubCache.size > GITHUB_CACHE_MAX) {
    const oldest = githubCache.keys().next().value;
    if (oldest !== undefined) githubCache.delete(oldest);
  }
}

/**
 * Whitelist, never passthrough: GitHub's repo object is ~100 keys and grows.
 * Strings run through cleanText because a description carrying a bidi override
 * renders beside a handle in our page exactly like a chat message does, and
 * `homepage` runs through cleanRepoUrl because it becomes an href.
 */
function toRepoJson(r: Record<string, unknown>, langs: Record<string, unknown>) {
  const topics = Array.isArray(r.topics) ? r.topics : [];
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    // Byte counts per language, biggest first, name sanitised like every other
    // string that arrives from outside the trust boundary.
    languages: Object.entries(langs)
      .map(([name, bytes]) => ({ name: cleanText(name, 32), bytes: num(bytes) }))
      .filter((l): l is { name: string; bytes: number } => Boolean(l.name) && l.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8),
    fullName: cleanText(r.full_name, 128),
    description: cleanText(r.description, LIMITS.projectDescription),
    homepage: cleanRepoUrl(r.homepage, LIMITS.repoUrl),
    stars: num(r.stargazers_count),
    forks: num(r.forks_count),
    openIssues: num(r.open_issues_count),
    language: cleanText(r.language, 32),
    topics: topics.slice(0, 12).map((t) => cleanText(t, 32)).filter(Boolean),
    pushedAtMs: typeof r.pushed_at === 'string' ? Date.parse(r.pushed_at) || null : null,
    archived: r.archived === true,
  };
}

app.get('/api/projects/:id/github', async (req, res) => {
  const viewer = await optionalHandle(req);
  const row = await prisma.project.findFirst({
    where: { id: req.params.id, ...visibleTo(viewer) },
    select: { repoUrl: true },
  });
  // githubRepo is the SSRF guard: exact host match, https only, no credentials.
  const gh = githubRepo(row?.repoUrl ?? null);
  if (!gh) {
    res.status(404).json({ error: 'no github repo' });
    return;
  }

  const key = `${gh.owner}/${gh.repo}`;
  const nowMs = Date.now();
  const hit = githubCache.get(key);
  if (hit && nowMs - hit.atMs < GITHUB_TTL_MS) {
    // Re-seat on read too, or "least recently used" would mean least recently
    // WRITTEN and a popular repo would be evicted on its TTL boundary.
    githubCacheSet(key, hit);
    res.status(hit.status).json(hit.body);
    return;
  }

  let status = 502;
  let body: unknown = { error: 'github unreachable' };
  try {
    // Rebuilt from owner/repo, never the stored string: nothing user-supplied
    // can move the host, the scheme or the path prefix, and encodeURIComponent
    // stops a `..` segment climbing out of /repos/.
    const url = `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}`;
    const r = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'kerf',
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'error', // keeps the target frozen at the URL we built
    });
    if (r.ok) {
      status = 200;
      // Second upstream call, same cache entry and same 10-minute TTL — the pie
      // needs per-language bytes, which the repo object does not carry.
      const langs = await fetch(`${url}/languages`, {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'kerf',
          ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      })
        .then((lr) => (lr.ok ? (lr.json() as Promise<Record<string, unknown>>) : {}))
        .catch(() => ({}));
      body = toRepoJson((await r.json()) as Record<string, unknown>, langs);
    } else if (r.status === 404) {
      status = 404;
      body = { error: 'repo not found or private' };
    } else if (r.status === 403 || r.status === 429) {
      status = 503;
      body = { error: 'github rate limit' };
    } else {
      status = 502;
      body = { error: 'github error' };
    }
  } catch {
    // Network error or the 5s timeout — the 502 default stands.
  }

  // Failures are cached too: without that, an uncached 404 burns another of the
  // anonymous 60/hr budget on every single page view.
  githubCacheSet(key, { atMs: nowMs, status, body });
  res.status(status).json(body);
});

// Flip one project between public and private. Same owner-scoped shape as the
// delete below: `handle` in the WHERE, count === 0 is a 404. Its own rate-limit
// bucket so flipping a switch never eats the publish budget.
app.patch('/api/projects/:id', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateVisibilityInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('visibility', handle, 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const { count } = await prisma.project.updateMany({
    where: { id: req.params.id as string, handle },
    data: { isPublic: result.value },
  });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true, isPublic: result.value });
});

// Unpublish. Scoped by handle in the WHERE clause, not by reading an owner off
// the row after the fact — a delete that matches nothing is a 404, so one
// account can never remove another's project by guessing a uuid.
app.delete('/api/projects/:id', requireMember, async (req: AuthedRequest, res) => {
  const { count } = await prisma.project.deleteMany({ where: { id: req.params.id as string, handle: req.handle as string } });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true });
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

function toSkillJson(s: {
  id: string;
  handle: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  installCount: number;
  isPublic: boolean;
  createdAt: Date;
  _count: { stars: number };
}) {
  // Same reasoning as toProjectJson: always true for anyone who is not the
  // owner, because visibleTo() already dropped the rest of the rows.
  return {
    id: s.id,
    handle: s.handle,
    slug: s.slug,
    name: s.name,
    description: s.description,
    content: s.content,
    installCount: s.installCount,
    isPublic: s.isPublic,
    starCount: s._count.stars,
    createdAtMs: s.createdAt.getTime(),
  };
}

const SKILL_INCLUDE = { _count: { select: { stars: true as const } } };

app.post('/api/skill-library', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateSkillInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('skill-publish', handle, 5, 60_000)) {
    res.status(429).json({ error: 'slow down' });
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
  // Never broadcast a row created private — see POST /api/projects.
  if (row.isPublic) publish({ type: 'skill', data: json });
  res.status(201).json(json);
});

app.get('/api/skill-library', async (req, res) => {
  // Moved above the query: it is the visibility input now, not just the
  // isStarredByMe nicety it used to be. A private row is absent from this list,
  // which is what keeps its `content` off the wire entirely.
  const handle = await optionalHandle(req);
  const rows = await prisma.skill.findMany({
    where: visibleTo(handle),
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: SKILL_INCLUDE,
  });
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
  const handle = await optionalHandle(req);
  const row = await prisma.skill.findFirst({
    where: { id: req.params.id, ...visibleTo(handle) },
    include: SKILL_INCLUDE,
  });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const isStarredByMe = handle
    ? (await prisma.skillStar.findUnique({ where: { skillId_handle: { skillId: row.id, handle } } })) !== null
    : false;
  res.json({ ...toSkillJson(row), isStarredByMe });
});

app.get('/api/skill-library/by-slug/:slug', async (req, res) => {
  const handle = await optionalHandle(req);
  const row = await prisma.skill.findFirst({
    where: { slug: req.params.slug, ...visibleTo(handle) },
    include: SKILL_INCLUDE,
  });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const isStarredByMe = handle
    ? (await prisma.skillStar.findUnique({ where: { skillId_handle: { skillId: row.id, handle } } })) !== null
    : false;
  res.json({ ...toSkillJson(row), isStarredByMe });
});

app.post('/api/skill-library/:id/star', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  if (!rateLimit('skill-star', handle, 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const skillId = req.params.id as string;
  const key = { skillId_handle: { skillId, handle } };
  const existing = await prisma.skillStar.findUnique({ where: key });
  if (existing) {
    // See the matching comment on POST /api/follows/:handle — a racing
    // duplicate request may already have deleted this row.
    try {
      await prisma.skillStar.delete({ where: key });
    } catch (err) {
      if (!isPrismaErrorCode(err, 'P2025')) throw err;
    }
  } else {
    // Scoped by visibleTo, not just by existence: starring is a write, and a
    // write that succeeds only for ids that exist is an oracle like any read.
    const skill = await prisma.skill.findFirst({ where: { id: skillId, ...visibleTo(handle) }, select: { id: true } });
    if (!skill) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    try {
      await prisma.skillStar.create({ data: { skillId, handle } });
    } catch (err) {
      if (!isPrismaErrorCode(err, 'P2002')) throw err;
    }
  }
  const starCount = await prisma.skillStar.count({ where: { skillId } });
  res.json({ starred: !existing, starCount });
});

// Flip one published skill between public and private. Owner-scoped exactly
// like PATCH /api/projects/:id, and sharing its rate-limit bucket.
app.patch('/api/skill-library/:id', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const result = validateVisibilityInput(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  if (!rateLimit('visibility', handle, 30, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const { count } = await prisma.skill.updateMany({
    where: { id: req.params.id as string, handle },
    data: { isPublic: result.value },
  });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true, isPublic: result.value });
});

// Unpublish a skill you published. Same owner-scoped delete as projects.
app.delete('/api/skill-library/:id', requireMember, async (req: AuthedRequest, res) => {
  const { count } = await prisma.skill.deleteMany({ where: { id: req.params.id as string, handle: req.handle as string } });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true });
});

// ponytail: the install counter is deduped by rate limit only, not by a
// `skill_installs` table. A table would make a legitimate re-install invisible
// and costs a migration for a vanity number nothing ranks on. Revisit if
// installs ever become a ranked signal.
app.post('/api/skill-library/by-slug/:slug/install', requireMember, async (req: AuthedRequest, res) => {
  if (!rateLimit('skill-install', req.handle as string, 10, 60_000)) {
    res.status(429).json({ error: 'slow down' });
    return;
  }
  const slug = req.params.slug as string;
  // updateMany + count, not update-in-a-try: the catch was control flow for a
  // missing row, and it cannot express "exists but is not yours to see" at all.
  const { count } = await prisma.skill.updateMany({
    where: { slug, ...visibleTo(req.handle as string) },
    data: { installCount: { increment: 1 } },
  });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true });
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
    source: r.source as AgentSource,
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
app.get('/api/me/sessions', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const nowMs = Date.now();
  const [rows, cliTokens, profile, newest, myLive, commitRow] = await Promise.all([
    prisma.sessionMetric.findMany({ where: { handle }, orderBy: { startedMs: 'desc' }, take: MAX_METRIC_ROWS }),
    prisma.apiToken.count({ where: { handle } }),
    prisma.profile.findUnique({ where: { handle }, select: { tokenHash: true } }),
    // When a metric row was last WRITTEN — i.e. when `kerf sync` last ran. Not
    // the newest session's own timestamp, which is when the work happened.
    prisma.sessionMetric.findFirst({
      where: { handle },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    // Your own live sessions, private projects included. This exists to fix the
    // consequence of hiding them from the public feed: the sidebar's "Live" dot
    // read that feed, so it would go dark exactly while you were working on your
    // own private project. CliStatus derives from here instead — a route it
    // already fetches, so it is one FEWER request per page.
    prisma.liveSession.findMany({
      where: { handle, lastBeatMs: { gte: BigInt(Date.now() - LIVE_TTL_MS) } },
      select: { lastBeatMs: true },
    }),
    // §7.4's commit half of the season floor — /me and /season must never
    // disagree, so both read the identical CommitCount row.
    prisma.commitCount.findUnique({
      where: { handle_monthStartMs: { handle, monthStartMs: BigInt(monthStartMs(nowMs)) } },
      select: { commits: true },
    }),
  ]);
  // Either a token minted by `kerf login` or the legacy dashboard token counts:
  // both mean "a CLI can post as me", which is what the connect steps ask for.
  const hasCliToken = cliTokens > 0 || Boolean(profile?.tokenHash);
  const metrics = rows.map(rowToMetric);

  const toolTotals: Record<string, number> = {};
  const sessions = metrics.map((metric) => {
    for (const [tool, count] of Object.entries(metric.toolCounts)) {
      toolTotals[tool] = (toolTotals[tool] ?? 0) + count;
    }
    return { ...metric, points: sessionPoints(metric).total, tips: metric.qualifies ? improvementTips(metric) : [] };
  });

  const points = totalPoints(metrics);
  res.json({
    sessions,
    toolTotals,
    totalPoints: points,
    monthPoints: monthPoints(metrics, nowMs),
    rank: rankFor(points),
    hasCliToken,
    liveSessions: myLive.length,
    lastBeatMs: myLive.length > 0 ? Math.max(...myLive.map((s) => Number(s.lastBeatMs))) : null,
    lastSyncedMs: newest?.createdAt.getTime() ?? null,
    streak: currentStreak(metrics.filter((m) => m.qualifies), nowMs),
    badges: badges(metrics, nowMs),
    seasonQualification: seasonQualification(metrics, commitRow?.commits ?? 0, nowMs),
  });
});

/**
 * What CLI credentials exist for this account. Never the token itself — only
 * a sha256 digest is ever stored (mintApiToken), so there is nothing to show
 * even if this route wanted to. Exists so H2's revoke route has something to
 * revoke: before this, a leaked token could never even be confirmed to exist,
 * let alone killed.
 */
app.get('/api/me/tokens', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  const rows = await prisma.apiToken.findMany({
    where: { handle },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, createdAt: true },
  });
  res.json({ tokens: rows.map((t) => ({ id: t.id, label: t.label, createdAtMs: t.createdAt.getTime() })) });
});

app.delete('/api/me/tokens/:id', requireMember, async (req: AuthedRequest, res) => {
  const handle = req.handle as string;
  // Same owner-scoped shape as DELETE /api/projects/:id: handle in the WHERE,
  // not a findUnique-then-check — a delete that matches nothing is a 404, so
  // one account can never revoke another's token by guessing an id.
  const { count } = await prisma.apiToken.deleteMany({ where: { id: req.params.id as string, handle } });
  if (count === 0) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true });
});

// --- Season ------------------------------------------------------------------

// ponytail: "current season" = current UTC calendar month, computed live
// from session_metrics — no persisted season row, no cron close-out. See
// prisma/schema.prisma header for the upgrade path.
//
// The board ranks on points earned this month; the crest beside each player is
// their LIFETIME level, which never resets. Both come from the same lifetime
// row set, so one query serves both — see points.ts for why a total is being
// ranked on at all.
app.get('/api/season/current', async (_req, res) => {
  const nowMs = Date.now();
  const [rows, commitRows] = await Promise.all([
    prisma.sessionMetric.findMany({
      where: { qualifies: true },
      orderBy: { startedMs: 'desc' },
      take: MAX_METRIC_ROWS,
    }),
    prisma.commitCount.findMany({ where: { monthStartMs: BigInt(monthStartMs(nowMs)) } }),
  ]);

  const byHandle = new Map<string, SessionMetric[]>();
  for (const r of rows) {
    const list = byHandle.get(r.handle) ?? [];
    list.push(rowToMetric(r));
    byHandle.set(r.handle, list);
  }
  const commitsByHandle = new Map(commitRows.map((c) => [c.handle, c.commits]));

  const standings = [...byHandle.entries()]
    .map(([handle, metrics]) => {
      const lifetime = totalPoints(metrics);
      const month = monthPoints(metrics, nowMs);
      const floor = seasonQualification(metrics, commitsByHandle.get(handle) ?? 0, nowMs);
      return {
        handle,
        points: lifetime,
        monthPoints: month,
        tier: rankFor(lifetime).tier,
        sessionCount: floor.sessions,
        streak: currentStreak(metrics, nowMs),
        qualified: floor.qualified,
        seasonSessions: floor.sessions,
        seasonCommits: floor.commits,
      };
    })
    // Qualified players first (the §7.4 floor), then by month points within
    // each group — an unqualified player with more points must never outrank
    // a qualified one, or the floor means nothing.
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.monthPoints - a.monthPoints || b.points - a.points);

  res.json({
    metric: 'points',
    sampleSize: standings.length,
    levels: LEVELS,
    floor: { sessions: SEASON_MIN_SESSIONS, commits: SEASON_MIN_COMMITS },
    standings,
  });
});

// Must be last, and must take four arguments — Express identifies an error
// handler by arity, so dropping `_next` silently turns this back into an
// ordinary middleware that never runs.
//
// Express 5 forwards a rejected async handler here automatically. Without this,
// that lands in finalhandler, which prints err.stack to the client whenever
// NODE_ENV is not 'production'. NODE_ENV is the fix for the leak; this is the
// fix for the silence — the stack belongs in the logs, not in the response.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('unhandled route error', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal' });
});

// A rejection with no handler kills the process on Node 22 by default, taking
// every in-flight request and every SSE subscriber with it. Log and stay up:
// one bad request is not a reason to drop the other 199 streams.
process.on('unhandledRejection', (reason) => console.error('unhandledRejection', reason));
// An uncaught exception is different: the process is now in an undefined
// state (a half-applied write, a leaked connection), and the only correct
// response is stop taking new work, drain what's in flight, exit, let the
// platform restart into a clean process — not keep serving from it.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException — shutting down', err);
  shutdown(1);
});

const port = Number(process.env.PORT ?? 3000);

let server: ReturnType<typeof app.listen> | undefined;

/**
 * Stop accepting new connections, let in-flight requests finish, then exit.
 * A hard timeout backstops a request or SSE stream that never completes —
 * without it a stuck connection could hold the process open past the
 * platform's own kill timeout, turning a graceful shutdown into a forced one.
 */
function shutdown(code: number): void {
  const timer = setTimeout(() => process.exit(code), 10_000);
  timer.unref();
  if (!server) {
    process.exit(code);
    return;
  }
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(code));
  });
}

// Zerops sends SIGTERM on every deploy. Without a handler the process dies
// instantly: in-flight requests are cut, the serial metrics-upsert loop can be
// halfway through a sync, and every SSE stream drops at once instead of
// draining (they will reconnect via `retry: 3000`, thundering onto whatever
// container comes up next).
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  shutdown(0);
});

seedEnvProfile()
  .catch((err) => console.error('profile seed failed', err))
  .finally(() => {
    server = app.listen(port, () => console.log(`kerf backend listening on ${port}`));
  });
