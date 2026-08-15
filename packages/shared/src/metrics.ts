// Pure metric derivation — kerf-spec.md §5.4, §7.4. No I/O. Amendment F.

import type { KerfEvent, SessionMetric } from './schema.ts';

// Exported: apps/cli/src/extract.ts used to keep its own copy, so a new edit
// tool had to be added in two places or the extractor would stop tagging a
// file path the scorer needs. One set now, imported by both.
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// The per-SESSION floor (§7.4). The per-SEASON floor (10 sessions + 5
// commits/month) is a different, cross-session shape — see season.ts.
// Exported so the UI's prose can't drift from the predicate the way it
// already had (season/page.tsx used to hand-type "3 human turns, 1 edit").
export const SESSION_MIN_TURNS = 3;
export const SESSION_MIN_EDITS = 1;

// events must be a single session's events, any order — including events from
// a subagent transcript merged in under the same sessionId (extract.ts walks
// <session>/subagents/*.jsonl alongside the main file).
export function computeSessionMetric(sessionId: string, events: KerfEvent[]): SessionMetric {
  // Sorted by TIMESTAMP, not ordinal alone: a session can now span more than
  // one file (main + subagents), and parseSessionFile restarts `ordinal` at 0
  // per file — sorting on ordinal put a subagent's first event before the
  // main session's start and gave the whole metric the wrong boundaries.
  // Ordinal stays as the tie-break: several tool_use blocks in one assistant
  // record share a timestamp, and their order within that record is real.
  const sorted = [...events].sort((a, b) => a.ts - b.ts || a.ordinal - b.ordinal);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const source = first?.source ?? 'claude-code';
  // First event that actually HAS a projectHash, not literally the first
  // event: subagent records carry no `cwd`, so if one lands first by
  // timestamp the naive `first?.projectHash` would give the whole session an
  // empty hash — which validate.ts's isSha256Hex rejects, silently dropping
  // the session at upload.
  const projectHash = sorted.find((e) => e.projectHash)?.projectHash ?? '';

  const turns = sorted.filter((e) => e.kind === 'human_turn').length;

  const editedFiles = new Set<string>();
  let edits = 0;
  let editsRework = 0;
  const toolCounts: Record<string, number> = {};
  for (const e of sorted) {
    if (e.kind !== 'tool_call' || !e.tool) continue;
    toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1;
    if (!EDIT_TOOLS.has(e.tool) || !e.filePath) continue;
    edits += 1;
    if (editedFiles.has(e.filePath)) editsRework += 1;
    editedFiles.add(e.filePath);
  }

  return {
    source,
    sessionId,
    projectHash,
    startedMs: first?.ts ?? 0,
    endedMs: last?.ts ?? 0,
    turns,
    edits,
    editsRework,
    reworkRatio: edits > 0 ? editsRework / edits : null,
    qualifies: turns >= SESSION_MIN_TURNS && edits >= SESSION_MIN_EDITS,
    toolCounts,
  };
}

export function groupBySession(events: KerfEvent[]): Map<string, KerfEvent[]> {
  const bySession = new Map<string, KerfEvent[]>();
  for (const e of events) {
    const list = bySession.get(e.sessionId);
    if (list) list.push(e);
    else bySession.set(e.sessionId, [e]);
  }
  return bySession;
}
