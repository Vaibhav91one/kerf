// Path B — user-authored, deliberately published content (profile, projects, chat).
//
// This is NOT a relaxation of the §6 privacy invariant. §6 governs transcript-
// DERIVED data, which the user never approves item-by-item: that path stays
// hashes, enums, timestamps and numbers forever (see validate.ts's schema-walk).
// The values here are typed by a human into a form and explicitly published, so
// free text is the entire point of them.
//
// The invariant that must never break: **nothing on Path B may be populated FROM
// a transcript.** A project's `name` is authored; its `projectHash` is derived;
// the two become linked only by a deliberate publish action by the person who
// owns both. No code path may read a prompt, a file path, or a tool argument and
// turn it into a Path B string.
//
// "A human typed it" is also not a licence to store four megabytes of anything,
// so every field here is length-capped and stripped of control characters before
// it is ever persisted or fanned out to another viewer.

export const LIMITS = {
  handle: 32,
  displayName: 48,
  bio: 280,
  projectName: 64,
  projectDescription: 500,
  repoUrl: 200,
  chatBody: 500,
  skillName: 64,
  skillDescription: 300,
  skillContent: 8000,
  avatarUrl: 300,
  socialUrl: 200,
} as const;

// 3–32 chars, lowercase, no leading/trailing dash. Handles appear in URLs and
// next to other people's names, so they are the one field with a hard shape.
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

// C0/C1 controls, plus the Unicode bidi overrides. Bidi characters are not
// theoretical paranoia here: chat and profile text render inside other users'
// pages, and an unstripped U+202E reverses everything after it, which is enough
// to fake a different handle in a message. Strip at the boundary, once.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Same as UNSAFE_CHARS but leaves \u000A (LF) alone — used where newlines are
// structural (skill markdown), not just stray whitespace.
const UNSAFE_CHARS_MULTILINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/**
 * Normalise a user-authored string, or return null if it cannot be made safe.
 * Collapsing whitespace also flattens newlines, which is what we want for chat:
 * a single message must not be able to scroll everyone else's feed away.
 */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0 || cleaned.length > max) return null;
  return cleaned;
}

// Same rules as cleanText, but for content where line breaks are structural
// (a published skill's markdown — headings, code blocks, lists). Collapsing
// runs of horizontal whitespace still guards against padding abuse; newlines
// are left alone on purpose.
export function cleanMultilineText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v
    .replace(UNSAFE_CHARS_MULTILINE, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned.length === 0 || cleaned.length > max) return null;
  return cleaned;
}

export function cleanHandle(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const lowered = v.trim().toLowerCase();
  return HANDLE_RE.test(lowered) ? lowered : null;
}

// Only http(s), and no embedded credentials — a repo URL is rendered as a link
// other people click, so `javascript:` and `user:pass@` are both disqualifying.
export function cleanRepoUrl(v: unknown, max: number = LIMITS.repoUrl): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url.toString();
}

export type Profile = {
  handle: string;
  displayName: string;
  bio: string | null;
  // Opt-in. Skill names are already §6-safe (bounded identifiers in toolCounts),
  // but "safe to store" and "safe to show strangers" are different questions.
  publicSkills: boolean;
  avatarUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  xUrl: string | null;
  createdAtMs: number;
};

// A published Claude Code Skill — Path B, always. A human pastes their own
// skill's instructions into the publish form and clicks publish; nothing here
// is ever derived from a transcript. See the file banner for the invariant.
export type Skill = {
  id: string;
  handle: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  installCount: number;
  starCount: number;
  createdAtMs: number;
};

export type Project = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  // Optional link to the telemetry side. Derived value, authored association.
  projectHash: string | null;
  createdAtMs: number;
};

export type ChatMessage = {
  id: string;
  handle: string;
  body: string;
  createdAtMs: number;
};

// Live session state, fanned out over SSE. Every field is a number or an
// already-public identifier — a live tile shows that someone is working and how
// it is going, never what they are working on.
export type LiveSession = {
  sessionId: string;
  handle: string;
  projectId: string | null;
  startedMs: number;
  lastBeatMs: number;
  turns: number;
  edits: number;
  editsRework: number;
  reworkRatio: number | null;
};

// Heartbeat stays on **Path A**: it is transcript-derived, so it carries no free
// text at all. The server attaches the handle from the caller's token.
export type Heartbeat = {
  source: 'claude-code';
  sessionId: string;
  projectHash: string;
  startedMs: number;
  atMs: number;
  turns: number;
  edits: number;
  editsRework: number;
};

// A session is considered live if it beat recently. The CLI beats every 15s.
export const LIVE_TTL_MS = 60_000;

export function isLive(s: { lastBeatMs: number }, nowMs: number): boolean {
  return nowMs - s.lastBeatMs <= LIVE_TTL_MS;
}
