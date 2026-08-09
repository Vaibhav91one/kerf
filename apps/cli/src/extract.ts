// Claude Code transcript extractor — kerf-spec.md §5.1.
//
// ponytail: subagent transcripts (`<session>/subagents/*.jsonl`) are not
// recursed tonight. Rework ratio is computed from main-session Edit/Write
// calls only. Add subagent recursion when tokens-per-session ships (needs
// the same recursion per §5.1's "read the parent's totalTokens, never both"
// rule anyway).

import { createReadStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { KerfEvent, EventKind } from '@kerf/shared';

// ponytail: default profile only — user has other .claude-* profile dirs
// (personal/work/qwen) on this machine, deliberately excluded tonight.
const ROOTS = [join(homedir(), '.claude', 'projects')];

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function listSessionFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const root of ROOTS) {
    if (!existsSync(root)) continue;
    const projectDirs = await readdir(root, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projectPath = join(root, dir.name);
      const entries = await readdir(projectPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(join(projectPath, entry.name));
        }
      }
    }
  }
  return files;
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// Real schema has no `origin.kind` field (checked against live transcripts,
// 2026-08). A human turn is a `type=="user"` record whose content contains
// no `tool_result` block — that's the agentic-loop feedback, not a person typing.
function isHumanTurn(record: any): boolean {
  if (record.type !== 'user') return false;
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

    if (type === 'user' && isHumanTurn(record)) {
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
      for (const block of content) {
        if (block?.type !== 'tool_use') continue;
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
