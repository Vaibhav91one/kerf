// Schema-walk validator — kerf-spec.md §6 privacy invariant, enforced as
// code, not review. Any field not explicitly allowed here is rejected, not
// stored — a stray free-text field must fail closed, never pass through.

import type { Heartbeat, SessionMetric } from '@kerf/shared';
import { LIMITS, cleanHandle, cleanRepoUrl, cleanText } from '@kerf/shared';

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

// Tool/skill names (e.g. "Edit", "mcp__plugin_figma_figma__use_figma") — bounded
// identifier shape, not free text. Key count capped so a payload can't smuggle
// an unbounded bag of arbitrary strings through as "keys".
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_TOOL_COUNT_KEYS = 60;

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

  if (obj.source !== 'claude-code') return { ok: false, reason: 'invalid source' };
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

  if (obj.source !== 'claude-code') return { ok: false, reason: 'invalid source' };
  if (!isUuid(obj.sessionId)) return { ok: false, reason: 'invalid sessionId' };
  if (!isSha256Hex(obj.projectHash)) return { ok: false, reason: 'invalid projectHash' };
  if (!isNonNegSafeInt(obj.startedMs)) return { ok: false, reason: 'invalid startedMs' };
  if (!isNonNegSafeInt(obj.atMs)) return { ok: false, reason: 'invalid atMs' };
  if (!isNonNegInt(obj.turns)) return { ok: false, reason: 'invalid turns' };
  if (!isNonNegInt(obj.edits)) return { ok: false, reason: 'invalid edits' };
  if (!isNonNegInt(obj.editsRework)) return { ok: false, reason: 'invalid editsRework' };

  return { ok: true, value: obj as unknown as Heartbeat };
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

export type ProfileInput = { handle: string; displayName: string; bio: string | null; publicSkills: boolean };
export type ProfileResult = { ok: true; value: ProfileInput } | { ok: false; reason: string };

export function validateProfileInput(input: unknown): ProfileResult {
  const walked = walk(input, ['handle', 'displayName', 'bio', 'publicSkills']);
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

  return { ok: true, value: { handle, displayName, bio, publicSkills: obj.publicSkills === true } };
}

export type ProjectInput = { name: string; description: string | null; repoUrl: string | null; projectHash: string | null };
export type ProjectResult = { ok: true; value: ProjectInput } | { ok: false; reason: string };

export function validateProjectInput(input: unknown): ProjectResult {
  const walked = walk(input, ['name', 'description', 'repoUrl', 'projectHash']);
  if (!walked.ok) return walked;
  const { obj } = walked;

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

  let projectHash: string | null = null;
  if (obj.projectHash != null && obj.projectHash !== '') {
    if (!isSha256Hex(obj.projectHash)) return { ok: false, reason: 'invalid projectHash' };
    projectHash = obj.projectHash;
  }

  return { ok: true, value: { name, description, repoUrl, projectHash } };
}

export type ChatResult = { ok: true; value: { body: string } } | { ok: false; reason: string };

export function validateChatInput(input: unknown): ChatResult {
  const walked = walk(input, ['body']);
  if (!walked.ok) return walked;
  const body = cleanText(walked.obj.body, LIMITS.chatBody);
  if (!body) return { ok: false, reason: 'invalid body' };
  return { ok: true, value: { body } };
}
