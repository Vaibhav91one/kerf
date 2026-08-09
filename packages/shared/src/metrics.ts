// Pure metric derivation — kerf-spec.md §5.4, §7.4. No I/O. Amendment F.

import type { KerfEvent, SessionMetric } from './schema.ts';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// events must be a single session's events, any order.
export function computeSessionMetric(sessionId: string, events: KerfEvent[]): SessionMetric {
  const sorted = [...events].sort((a, b) => a.ordinal - b.ordinal);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const source = first?.source ?? 'claude-code';
  const projectHash = first?.projectHash ?? '';

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
    // ponytail: §7.4's 5-commits-per-season floor needs the git connector
    // (milestone 7, not built tonight). Session-level floor only.
    qualifies: turns >= 3 && edits >= 1,
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
