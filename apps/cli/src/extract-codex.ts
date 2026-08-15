// Codex transcript extractor — kerf-spec.md §5.1, the twin of extract.ts.
//
// Schema verified directly against a real corpus at ~/.codex/sessions/ (no
// public documentation exists for this format). Envelope: every line is
// {timestamp, type, payload}. type ∈ response_item | event_msg | session_meta
// | world_state | turn_context — only the first three carry anything this
// extractor reads.

import { createReadStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { KerfEvent, EventKind } from '@kerf/shared';

const CODEX_ROOT = join(homedir(), '.codex', 'sessions');
// Same alphabet as the backend's TOOL_NAME, so a malformed tool name is
// dropped here rather than failing the whole session's upload closed at the
// validator.
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;
// The tree is sessions/YYYY/MM/DD/*.jsonl today. A depth cap rather than a
// hardcoded triple-readdir: shorter, and keeps working if Codex ever changes
// how it partitions by date.
const MAX_WALK_DEPTH = 6;

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function walkJsonl(dir: string, depth: number, out: string[]): Promise<void> {
  if (depth > MAX_WALK_DEPTH) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // races with the CLI's own cleanup, permissions, etc. — not fatal
  }
  for (const e of entries) {
    if (e.isDirectory()) await walkJsonl(join(dir, e.name), depth + 1, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(join(dir, e.name));
  }
}

export async function listCodexSessionFiles(root: string = CODEX_ROOT): Promise<string[]> {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  await walkJsonl(root, 0, files);
  return files;
}

export async function parseCodexSessionFile(path: string): Promise<KerfEvent[]> {
  const events: KerfEvent[] = [];
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });

  let sessionId = '';
  let projectHash = '';
  let ordinal = 0;

  for await (const line of rl) {
    if (!line) continue;
    let record: any;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = record?.payload;
    if (!payload || typeof payload !== 'object') continue;
    const ts = Date.parse(record.timestamp ?? '') || 0;
    const base = () => ({ source: 'codex' as const, sessionId, projectHash, ts, ordinal: ordinal++ });

    if (record.type === 'session_meta') {
      // `session_id` on newer Codex CLI builds, `id` on older ones — the same
      // UUIDv7 either way, and it passes the backend's isUuid check unchanged.
      sessionId = payload.session_id ?? payload.id ?? sessionId;
      if (typeof payload.cwd === 'string') projectHash = sha256(payload.cwd);
      // payload.git = {commit_hash, branch, repository_url} also lives here.
      // Never read: a repo URL is free text and an identifier, and §6 forbids
      // both on Path A. It is also NOT a shortcut for the season commit floor
      // (packages/shared/src/season.ts) — one commit at session start, not a
      // count; see apps/cli/src/git.ts for how that's actually computed.
      continue;
    }

    // A POSITIVE human-turn signal, unlike Claude Code's negative heuristic —
    // verified clean against the real corpus. Deliberately NOT "any record
    // with role 'user'": the harness also injects response_item/message
    // records with role developer|user (permission/plugin preamble) that no
    // person typed.
    if (record.type === 'event_msg' && payload.type === 'user_message') {
      events.push({ ...base(), kind: 'human_turn' as EventKind });
      continue;
    }

    if (record.type === 'response_item' && payload.type === 'function_call') {
      // `namespace` carries the mcp__<server> prefix that Claude Code bakes
      // into the tool name itself (e.g. {"name":"new_page","namespace":
      // "mcp__chrome_devtools"}). Joining them lands MCP calls in the same
      // classifyTool bucket instead of every one of them reading as a
      // builtin.
      const tool =
        typeof payload.namespace === 'string' ? `${payload.namespace}__${payload.name}` : payload.name;
      if (typeof tool === 'string' && TOOL_NAME.test(tool)) {
        events.push({ ...base(), kind: 'tool_call' as EventKind, tool });
      }
      continue;
    }

    // The Edit/Write analogue. `changes` is a dict keyed by absolute file
    // path — one event per path, tagged `Edit` so EDIT_TOOLS, the rework-
    // ratio logic and the toolkit histogram all work with no Codex-specific
    // branch anywhere else in the pipeline.
    if (record.type === 'event_msg' && payload.type === 'patch_apply_end') {
      if (payload.success !== true) continue; // a failed patch changed no file
      const changes = payload.changes;
      if (!changes || typeof changes !== 'object') continue;
      for (const filePath of Object.keys(changes)) {
        events.push({ ...base(), kind: 'tool_call' as EventKind, tool: 'Edit', filePath });
      }
    }
  }

  return events;
}

export async function extractAllCodex(): Promise<Map<string, KerfEvent[]>> {
  const files = await listCodexSessionFiles();
  const bySession = new Map<string, KerfEvent[]>();
  for (const file of files) {
    const events = await parseCodexSessionFile(file);
    if (events.length === 0) continue;
    const sessionId = events[0].sessionId;
    // A file truncated before its session_meta record never sets sessionId
    // (parseCodexSessionFile's default is ''), so without this guard every
    // such file's events merge together under the shared '' key instead of
    // being dropped as the unidentifiable session they are.
    if (!sessionId) continue;
    const existing = bySession.get(sessionId);
    if (existing) existing.push(...events);
    else bySession.set(sessionId, events);
  }
  return bySession;
}
