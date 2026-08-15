import type { AgentSource } from './schema.ts';

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
  logoUrl: 300,
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

// A global ladder motivates the top 1% and nobody else — rivals are the
// retention mechanic instead (kerf-spec.md §8), capped so it stays a
// deliberate short list, not a second following feed. Shared between the
// backend's enforcement and the frontend's disabled-state copy so the two
// numbers can't drift.
export const MAX_RIVALS = 3;

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

/**
 * How a skill or MCP-server identifier is shown to a person.
 *
 * The output is STILL A SLUG on purpose: it is what you type into
 * `kerf skills publish <slug>`, so prettifying it into Title Case would make
 * the screen and the CLI disagree. This only strips noise the identifier picked
 * up from its packaging:
 *
 *   plugin_figma_figma           -> figma
 *   figma:figma-use              -> figma-use
 *   codex:setup                  -> setup
 *   claude-in-chrome             -> claude-in-chrome   (already clean)
 */
export function formatSkillLabel(label: string): string {
  let out = label.trim();
  if (out.length === 0) return label;

  // An MCP server published as a plugin arrives as `plugin_<name>_<name>`; the
  // duplicate is the packaging, not the name.
  const plugin = /^plugin[_-](.+)$/.exec(out);
  if (plugin) {
    const parts = plugin[1].split(/[_-]/).filter(Boolean);
    // Collapse a run of identical segments: figma_figma -> figma.
    const deduped = parts.filter((part, i) => part !== parts[i - 1]);
    out = deduped.join('-');
  }

  // A leading `namespace:` is the plugin that owns the skill, and the skill's
  // own name almost always repeats it (figma:figma-use). Drop the namespace.
  const namespaced = /^([^:]+):(.+)$/.exec(out);
  if (namespaced) out = namespaced[2];

  return out.length > 0 ? out : label;
}

/**
 * Splits a stored repo URL into an owner/repo pair — but ONLY for github.com,
 * because the caller feeds the result to a server-side fetch.
 *
 * This is the SSRF guard, and it lives here rather than at the call site so
 * there is exactly one place that turns user-authored text into a fetch target.
 * `cleanRepoUrl` is deliberately NOT enough and must not be tightened: it guards
 * what we render as a LINK, where GitLab and Codeberg are perfectly legitimate.
 * What the SERVER may fetch is a different question — an owner could otherwise
 * point repoUrl at http://169.254.169.254/ or a service on the backend's own
 * private network and read the response back through our proxy.
 *
 * Host is compared exactly, never with endsWith: `evilgithub.com` and
 * `github.com.attacker.tld` both pass a suffix test.
 */
export function githubRepo(repoUrl: string | null | undefined): { owner: string; repo: string } | null {
  if (typeof repoUrl !== 'string') return null;
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'github.com') return null;
  if (url.username !== '' || url.password !== '') return null;
  const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

// Heartbeat stays on **Path A**: it is transcript-derived, so it carries no free
// text at all. The server attaches the handle from the caller's token.
export type Heartbeat = {
  source: AgentSource;
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

// --- display helpers, not sanitisers -----------------------------------------
//
// Everything below is presentation. Nothing here makes a value safe to store or
// to show a stranger, and a Path-A classifier must not be mistaken for a Path-B
// guard: `classifyTool` reads a `toolCounts` key that validate.ts already
// bounded, and `searchNeedle` normalises what someone typed into a filter box
// that never leaves their browser.

/**
 * Display taxonomy for the league page. A `toolCounts` key is one of three
 * things: a skill the CLI attributed (`skill:<slug>`), an MCP tool
 * (`mcp__<server>__<tool>`, folded to its server), or a built-in Claude Code
 * tool. The non-greedy group splits on the FIRST `__`, which is the real
 * delimiter — server names may themselves contain `_` (plugin_figma_figma).
 *
 * It lives here rather than in the CLI because a display taxonomy baked into
 * uploads would need every user to re-sync to change it. What must stay
 * server-side is the CALL inside `GET /api/skills`: that route slices `topUsers`
 * to 7, so folding an MCP server's tools together after the slice would report a
 * wrong `users` count. The function itself is pure — either side may call it.
 */
export function classifyTool(name: string): { kind: 'skill' | 'mcp' | 'builtin'; label: string } {
  if (name.startsWith('skill:')) return { kind: 'skill', label: name.slice('skill:'.length) };
  const mcp = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(name);
  if (mcp) return { kind: 'mcp', label: mcp[1] };
  return { kind: 'builtin', label: name };
}

/**
 * What a search box's raw value means: trim, drop ONE leading `@` (people type a
 * handle the way they read it), lowercase. Matching stays with each caller —
 * three screens search three different field sets, so a shared `matchesNeedle`
 * would only be a place to get one of them wrong.
 */
export function searchNeedle(q: string): string {
  return q.trim().replace(/^@/, '').toLowerCase();
}
