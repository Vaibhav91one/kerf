// Schema-walk validator — kerf-spec.md §6 privacy invariant, enforced as
// code, not review. Any field not explicitly allowed here is rejected, not
// stored — a stray free-text field must fail closed, never pass through.

import type { AgentSource, Heartbeat, SessionMetric } from '@kerf/shared';
import { AGENT_SOURCES, LIMITS, cleanHandle, cleanMultilineText, cleanRepoUrl, cleanText } from '@kerf/shared';

function isAgentSource(v: unknown): v is AgentSource {
  return typeof v === 'string' && (AGENT_SOURCES as readonly string[]).includes(v);
}

const ALLOWED_KEYS = new Set<keyof SessionMetric>([
  'source',
  'sessionId',
  'projectHash',
  'startedMs',
  'endedMs',
  'turns',
  'edits',
  'editsRework',
  'reworkRatio',
  'qualifies',
  'toolCounts',
]);

export type ValidationResult = { ok: true; value: SessionMetric } | { ok: false; reason: string };

function isSha256Hex(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Postgres Int32 bound — the column these land in, so anything outside
// this range would 500 on the write instead of failing closed here.
const INT32_MAX = 2147483647;

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= INT32_MAX;
}

function isNonNegSafeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

// Tool/skill names (e.g. "Edit", "mcp__plugin_figma_figma__use_figma",
// "skill:caveman") — bounded identifier shape, not free text. TOOL_NAME is the
// privacy bound: it is what stops a key from being a sentence, and an unknown
// top-level field still rejects the whole item.
//
// MAX_TOOL_COUNT_KEYS is a payload-SIZE bound, not a privacy one. It was 60,
// which a real session already brushes (~52 distinct tool names before skill
// attribution was added). Since this validator fails closed on the whole
// metric, too tight a cap silently loses sessions — the opposite of what it is
// for. 240 keys x 80 chars is still a bounded ~20KB.
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_TOOL_COUNT_KEYS = 240;

function isToolCounts(v: unknown): v is Record<string, number> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > MAX_TOOL_COUNT_KEYS) return false;
  return entries.every(([key, count]) => TOOL_NAME.test(key) && isNonNegInt(count));
}

export function validateSessionMetric(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not an object' };
  }
  const obj = input as Record<string, unknown>;

  const extraKeys = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k as keyof SessionMetric));
  if (extraKeys.length > 0) return { ok: false, reason: `unexpected field(s): ${extraKeys.join(', ')}` };

  if (!isAgentSource(obj.source)) return { ok: false, reason: 'invalid source' };
  if (!isUuid(obj.sessionId)) return { ok: false, reason: 'invalid sessionId' };
  if (!isSha256Hex(obj.projectHash)) return { ok: false, reason: 'invalid projectHash' };
  if (!isNonNegSafeInt(obj.startedMs)) return { ok: false, reason: 'invalid startedMs' };
  if (!isNonNegSafeInt(obj.endedMs)) return { ok: false, reason: 'invalid endedMs' };
  if (!isNonNegInt(obj.turns)) return { ok: false, reason: 'invalid turns' };
  if (!isNonNegInt(obj.edits)) return { ok: false, reason: 'invalid edits' };
  if (!isNonNegInt(obj.editsRework)) return { ok: false, reason: 'invalid editsRework' };
  if (obj.reworkRatio !== null && !(typeof obj.reworkRatio === 'number' && Number.isFinite(obj.reworkRatio) && obj.reworkRatio >= 0)) {
    return { ok: false, reason: 'invalid reworkRatio' };
  }
  if (typeof obj.qualifies !== 'boolean') return { ok: false, reason: 'invalid qualifies' };
  if (!isToolCounts(obj.toolCounts)) return { ok: false, reason: 'invalid toolCounts' };

  return { ok: true, value: obj as unknown as SessionMetric };
}

// --- Heartbeat (Path A) ------------------------------------------------------
// Same privacy rules as SessionMetric: schema-walked, no free text, fails
// closed. The handle is attached server-side from the token, never sent.

const HEARTBEAT_KEYS = new Set<keyof Heartbeat>([
  'source',
  'sessionId',
  'projectHash',
  'startedMs',
  'atMs',
  'turns',
  'edits',
  'editsRework',
]);

export type HeartbeatResult = { ok: true; value: Heartbeat } | { ok: false; reason: string };

export function validateHeartbeat(input: unknown): HeartbeatResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not an object' };
  }
  const obj = input as Record<string, unknown>;

  const extraKeys = Object.keys(obj).filter((k) => !HEARTBEAT_KEYS.has(k as keyof Heartbeat));
  if (extraKeys.length > 0) return { ok: false, reason: `unexpected field(s): ${extraKeys.join(', ')}` };

  if (!isAgentSource(obj.source)) return { ok: false, reason: 'invalid source' };
  if (!isUuid(obj.sessionId)) return { ok: false, reason: 'invalid sessionId' };
  if (!isSha256Hex(obj.projectHash)) return { ok: false, reason: 'invalid projectHash' };
  if (!isNonNegSafeInt(obj.startedMs)) return { ok: false, reason: 'invalid startedMs' };
  if (!isNonNegSafeInt(obj.atMs)) return { ok: false, reason: 'invalid atMs' };
  if (!isNonNegInt(obj.turns)) return { ok: false, reason: 'invalid turns' };
  if (!isNonNegInt(obj.edits)) return { ok: false, reason: 'invalid edits' };
  if (!isNonNegInt(obj.editsRework)) return { ok: false, reason: 'invalid editsRework' };

  return { ok: true, value: obj as unknown as Heartbeat };
}

// --- Commit counts (Path A: a count and a month boundary, nothing else) -----
// §7.4's season floor. The CLI recomputes the whole month's count locally
// (apps/cli/src/git.ts) and uploads only the integer — see CommitCount's
// schema comment for why this is a replace, never an increment.

export type CommitCountInput = { monthStartMs: number; commits: number };
export type CommitCountResult = { ok: true; value: CommitCountInput } | { ok: false; reason: string };

const COMMIT_COUNT_KEYS = ['monthStartMs', 'commits'];

export function validateCommitCount(input: unknown): CommitCountResult {
  const walked = walk(input, COMMIT_COUNT_KEYS);
  if (!walked.ok) return walked;
  const obj = walked.obj;

  if (!isNonNegSafeInt(obj.monthStartMs)) return { ok: false, reason: 'invalid monthStartMs' };
  // Must be an EXACT UTC month start, not just any timestamp. A free value
  // here would let a client shard its commits across arbitrary buckets to
  // pick whichever one clears the floor.
  const d = new Date(obj.monthStartMs);
  if (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) !== obj.monthStartMs) {
    return { ok: false, reason: 'monthStartMs is not a UTC month start' };
  }
  if (!isNonNegInt(obj.commits)) return { ok: false, reason: 'invalid commits' };

  return { ok: true, value: { monthStartMs: obj.monthStartMs, commits: obj.commits } };
}

// --- Path B (authored content) ----------------------------------------------
// Free text is permitted here and nowhere else. Each value is normalised by
// @kerf/shared's cleanText (control chars + bidi overrides stripped, whitespace
// collapsed, length capped) and rejected if it cannot be made safe. Unknown
// keys still fail closed — a form that starts POSTing an extra field must
// break loudly rather than quietly persisting whatever it felt like sending.

function walk<T>(input: unknown, allowed: string[]): { ok: true; obj: Record<string, unknown> } | { ok: false; reason: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'not an object' };
  }
  const obj = input as Record<string, unknown>;
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (extra.length > 0) return { ok: false, reason: `unexpected field(s): ${extra.join(', ')}` };
  return { ok: true, obj };
}

export type ProfileInput = {
  handle: string;
  displayName: string;
  bio: string | null;
  publicSkills: boolean;
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
};
export type ProfileResult = { ok: true; value: ProfileInput } | { ok: false; reason: string };

function cleanOptionalUrl(
  v: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; reason: string } {
  if (v == null || v === '') return { ok: true, value: null };
  const cleaned = cleanRepoUrl(v, max);
  if (!cleaned) return { ok: false, reason: `invalid ${field}` };
  return { ok: true, value: cleaned };
}

export function validateProfileInput(input: unknown): ProfileResult {
  const walked = walk(input, [
    'handle',
    'displayName',
    'bio',
    'publicSkills',
    'avatarUrl',
    'websiteUrl',
    'githubUrl',
    'xUrl',
  ]);
  if (!walked.ok) return walked;
  const { obj } = walked;

  const handle = cleanHandle(obj.handle);
  if (!handle) return { ok: false, reason: 'invalid handle' };
  const displayName = cleanText(obj.displayName, LIMITS.displayName);
  if (!displayName) return { ok: false, reason: 'invalid displayName' };

  let bio: string | null = null;
  if (obj.bio != null && obj.bio !== '') {
    bio = cleanText(obj.bio, LIMITS.bio);
    if (!bio) return { ok: false, reason: 'invalid bio' };
  }
  if (obj.publicSkills != null && typeof obj.publicSkills !== 'boolean') {
    return { ok: false, reason: 'invalid publicSkills' };
  }

  const avatar = cleanOptionalUrl(obj.avatarUrl, 'avatarUrl', LIMITS.avatarUrl);
  if (!avatar.ok) return avatar;
  const website = cleanOptionalUrl(obj.websiteUrl, 'websiteUrl', LIMITS.socialUrl);
  if (!website.ok) return website;
  const github = cleanOptionalUrl(obj.githubUrl, 'githubUrl', LIMITS.socialUrl);
  if (!github.ok) return github;
  const x = cleanOptionalUrl(obj.xUrl, 'xUrl', LIMITS.socialUrl);
  if (!x.ok) return x;

  return {
    ok: true,
    value: {
      handle,
      displayName,
      bio,
      publicSkills: obj.publicSkills === true,
      avatarUrl: avatar.value,
      websiteUrl: website.value,
      githubUrl: github.value,
      xUrl: x.value,
    },
  };
}

export type ProjectInput = {
  name: string;
  description: string | null;
  repoUrl: string | null;
  logoUrl: string | null;
  projectHash: string | null;
  isPublic: boolean;
};
export type ProjectResult = { ok: true; value: ProjectInput } | { ok: false; reason: string };

// `isPublic` defaults OPEN — `!== false`, deliberately NOT the `=== true` idiom
// validateProfileInput uses for publicSkills a few lines up. That switch is
// opt-in because nothing existed before it; this one is opt-OUT because rows and
// CLI publishes that predate the field are already visible and must stay so.
// Flip this to `=== true` and every legacy publish silently goes dark.
function readIsPublic(obj: Record<string, unknown>): { ok: true; value: boolean } | { ok: false; reason: string } {
  if (obj.isPublic != null && typeof obj.isPublic !== 'boolean') return { ok: false, reason: 'invalid isPublic' };
  return { ok: true, value: obj.isPublic !== false };
}

export function validateProjectInput(input: unknown): ProjectResult {
  const walked = walk(input, ['name', 'description', 'repoUrl', 'logoUrl', 'projectHash', 'isPublic']);
  if (!walked.ok) return walked;
  const { obj } = walked;

  const isPublic = readIsPublic(obj);
  if (!isPublic.ok) return isPublic;

  const name = cleanText(obj.name, LIMITS.projectName);
  if (!name) return { ok: false, reason: 'invalid name' };

  let description: string | null = null;
  if (obj.description != null && obj.description !== '') {
    description = cleanText(obj.description, LIMITS.projectDescription);
    if (!description) return { ok: false, reason: 'invalid description' };
  }

  let repoUrl: string | null = null;
  if (obj.repoUrl != null && obj.repoUrl !== '') {
    repoUrl = cleanRepoUrl(obj.repoUrl);
    if (!repoUrl) return { ok: false, reason: 'invalid repoUrl' };
  }

  // A logo is fetched by the browser, so it runs through the same http(s)-only
  // allow-list a repo URL does — cleanRepoUrl is that check, not a repo-specific one.
  let logoUrl: string | null = null;
  if (obj.logoUrl != null && obj.logoUrl !== '') {
    logoUrl = cleanRepoUrl(obj.logoUrl, LIMITS.logoUrl);
    if (!logoUrl) return { ok: false, reason: 'invalid logoUrl' };
  }

  let projectHash: string | null = null;
  if (obj.projectHash != null && obj.projectHash !== '') {
    if (!isSha256Hex(obj.projectHash)) return { ok: false, reason: 'invalid projectHash' };
    projectHash = obj.projectHash;
  }

  return { ok: true, value: { name, description, repoUrl, logoUrl, projectHash, isPublic: isPublic.value } };
}

export type SkillInput = { name: string; description: string | null; content: string; isPublic: boolean };
export type SkillResult = { ok: true; value: SkillInput } | { ok: false; reason: string };

// `handle` and `slug` are deliberately not accepted here: handle comes from
// the bearer token, slug is derived server-side from name (see index.ts).
export function validateSkillInput(input: unknown): SkillResult {
  const walked = walk(input, ['name', 'description', 'content', 'isPublic']);
  if (!walked.ok) return walked;
  const { obj } = walked;

  const isPublic = readIsPublic(obj);
  if (!isPublic.ok) return isPublic;

  const name = cleanText(obj.name, LIMITS.skillName);
  if (!name) return { ok: false, reason: 'invalid name' };

  let description: string | null = null;
  if (obj.description != null && obj.description !== '') {
    description = cleanText(obj.description, LIMITS.skillDescription);
    if (!description) return { ok: false, reason: 'invalid description' };
  }

  const content = cleanMultilineText(obj.content, LIMITS.skillContent);
  if (!content) return { ok: false, reason: 'invalid content' };

  return { ok: true, value: { name, description, content, isPublic: isPublic.value } };
}

// --- Visibility ---------------------------------------------------------------

export type BoolResult = { ok: true; value: boolean } | { ok: false; reason: string };

/** Body of both PATCH visibility routes. Required here — a flip must be explicit. */
export function validateVisibilityInput(input: unknown): BoolResult {
  const walked = walk(input, ['isPublic']);
  if (!walked.ok) return walked;
  if (typeof walked.obj.isPublic !== 'boolean') return { ok: false, reason: 'invalid isPublic' };
  return { ok: true, value: walked.obj.isPublic };
}

/** Body of PATCH /api/follows/:handle. Required here too — a rival flip must be explicit. */
export function validateRivalInput(input: unknown): BoolResult {
  const walked = walk(input, ['isRival']);
  if (!walked.ok) return walked;
  if (typeof walked.obj.isRival !== 'boolean') return { ok: false, reason: 'invalid isRival' };
  return { ok: true, value: walked.obj.isRival };
}

// A hide key is `${kind}:${label}` from classifyTool over the same TOOL_NAME
// alphabet — an identifier, not free text. `builtin:` is rejected on purpose:
// builtins are already dropped from every public surface, so hiding one is a
// no-op the UI must not offer. Same 240 bound as MAX_TOOL_COUNT_KEYS, for the
// same reason — it caps payload size, not information type.
const HIDDEN_SKILL_KEY = /^(skill|mcp):[A-Za-z0-9_.:-]{1,80}$/;

export type HiddenSkillsResult = { ok: true; value: string[] } | { ok: false; reason: string };

export function validateHiddenSkills(input: unknown): HiddenSkillsResult {
  const walked = walk(input, ['hiddenSkills']);
  if (!walked.ok) return walked;
  const list = walked.obj.hiddenSkills;
  if (!Array.isArray(list)) return { ok: false, reason: 'invalid hiddenSkills' };
  if (list.length > MAX_TOOL_COUNT_KEYS) return { ok: false, reason: 'too many hiddenSkills' };
  for (const key of list) {
    if (typeof key !== 'string' || !HIDDEN_SKILL_KEY.test(key)) return { ok: false, reason: 'invalid hiddenSkills' };
  }
  return { ok: true, value: [...new Set(list as string[])] };
}

export type ChatResult = { ok: true; value: { body: string } } | { ok: false; reason: string };

export function validateChatInput(input: unknown): ChatResult {
  const walked = walk(input, ['body']);
  if (!walked.ok) return walked;
  const body = cleanText(walked.obj.body, LIMITS.chatBody);
  if (!body) return { ok: false, reason: 'invalid body' };
  return { ok: true, value: { body } };
}
