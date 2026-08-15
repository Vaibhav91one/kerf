// Claude Code transcript extractor — kerf-spec.md §5.1.
//
// Subagent transcripts (`<session-uuid>/subagents/agent-*.jsonl`) ARE
// recursed: their records carry the PARENT's sessionId, so extractAll's
// bySession keying below merges them with no id remapping needed. A session
// that delegated all its edits to a subagent used to score near zero — the
// main-session-only rule this comment used to describe was exactly that bug.

import { createReadStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EDIT_TOOLS, type KerfEvent, type EventKind } from '@kerf/shared';

// ponytail: default profile only — user has other .claude-* profile dirs
// (personal/work/qwen) on this machine, deliberately excluded tonight.
const ROOTS = [join(homedir(), '.claude', 'projects')];

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function listSessionFiles(roots: string[] = ROOTS): Promise<string[]> {
  const files: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const projectDirs = await readdir(root, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projectPath = join(root, dir.name);
      const entries = await readdir(projectPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(join(projectPath, entry.name));
          continue;
        }
        if (!entry.isDirectory()) continue;
        // <session-uuid>/subagents/agent-<hex>.jsonl — the delegated half of
        // a session. Its records carry the PARENT's sessionId.
        const subDir = join(projectPath, entry.name, 'subagents');
        if (!existsSync(subDir)) continue;
        for (const sub of await readdir(subDir)) {
          if (sub.endsWith('.jsonl')) files.push(join(subDir, sub));
        }
      }
    }
  }
  return files;
}

// Which skill drove a turn. Claude Code stamps this on the assistant record
// itself (`attributionSkill`), so it also catches skills entered by slash
// command, which never produce a `Skill` tool_use block at all.
//
// §6: the slug is an enum-ish identifier and is the ONLY thing read. A `Skill`
// block's `input.args` and a transcript's `<command-args>` are free text and
// are never touched. This regex mirrors the backend's TOOL_NAME (minus the
// "skill:" prefix we add) so a malformed slug is dropped here rather than
// failing the whole session's upload closed at the validator.
const SKILL_SLUG = /^[A-Za-z0-9_.:-]{1,72}$/;

// `origin.kind` is now common on real transcripts (values seen: "human",
// "task-notification", "coordinator") — verified directly against a real
// corpus, and it is authoritative when present, so it is the primary signal.
// The content heuristic below is the fallback for older transcripts that
// predate the field: a `type=="user"` record whose content contains no
// `tool_result` block — that's the agentic-loop feedback, not a person typing.
function isHumanTurn(record: any): boolean {
  if (record.type !== 'user') return false;
  if (typeof record.origin?.kind === 'string') return record.origin.kind === 'human';
  const content = record.message?.content;
  if (typeof content === 'string') return true;
  if (!Array.isArray(content)) return true;
  return !content.some((c: any) => c?.type === 'tool_result');
}

// Parses one session transcript into KerfEvent[]. Filters on `type` before
// doing anything else with a line — attachment/mode/ai-title/etc records
// (the majority of lines, §5.1) are skipped without further work.
export async function parseSessionFile(path: string): Promise<KerfEvent[]> {
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

    const type = record.type;
    if (type !== 'user' && type !== 'assistant') continue;

    sessionId = record.sessionId ?? sessionId;
    if (record.cwd && !projectHash) projectHash = sha256(record.cwd);
    const ts = Date.parse(record.timestamp ?? '') || 0;

    // isSidechain marks every subagent record. A subagent's `type:'user'`
    // records are the harness feeding its agent, not a person typing — without
    // this guard, turns inflates by one per delegated step and the focus term
    // (packages/shared/src/points.ts) collapses toward zero. Assistant/
    // tool_use records below are deliberately NOT guarded: counting a
    // subagent's edits is the entire point of recursing into it.
    if (type === 'user' && record.isSidechain !== true && isHumanTurn(record)) {
      events.push({
        source: 'claude-code',
        sessionId,
        projectHash,
        ts,
        ordinal: ordinal++,
        kind: 'human_turn' as EventKind,
      });
      continue;
    }

    if (type === 'assistant') {
      const content = record.message?.content;
      if (!Array.isArray(content)) continue;
      let toolCalls = 0;
      for (const block of content) {
        if (block?.type !== 'tool_use') continue;
        toolCalls += 1;
        const isEdit = EDIT_TOOLS.has(block.name);
        events.push({
          source: 'claude-code',
          sessionId,
          projectHash,
          ts,
          ordinal: ordinal++,
          kind: 'tool_call' as EventKind,
          tool: block.name,
          filePath: isEdit ? block.input?.file_path : undefined,
        });
      }

      // One event per record, not per block: a "use" of a skill is a turn it
      // drove, so a record with three tool calls is still one use. Records with
      // no tool call are skipped — a skill that did nothing measurable should
      // not outweigh the tools it would have used.
      const skill = record.attributionSkill;
      if (toolCalls > 0 && typeof skill === 'string' && SKILL_SLUG.test(skill)) {
        events.push({
          source: 'claude-code',
          sessionId,
          projectHash,
          ts,
          ordinal: ordinal++,
          kind: 'tool_call' as EventKind,
          tool: `skill:${skill}`,
        });
      }
    }
  }

  return events;
}

export async function extractAll(): Promise<Map<string, KerfEvent[]>> {
  const files = await listSessionFiles();
  const bySession = new Map<string, KerfEvent[]>();
  for (const file of files) {
    const events = await parseSessionFile(file);
    if (events.length === 0) continue;
    const sessionId = events[0].sessionId;
    const existing = bySession.get(sessionId);
    if (existing) existing.push(...events);
    else bySession.set(sessionId, events);
  }
  return bySession;
}
