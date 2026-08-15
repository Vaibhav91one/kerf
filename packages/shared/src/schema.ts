// Unified event schema — kerf-spec.md §5.3. Every string field here is a
// compiled enum, a sha256 hash, or a timestamp; never free text (§6).

// Which agent produced the transcript. An enum, so it stays §6-safe on Path A
// — widened from a single literal so apps/cli/src/extract-codex.ts can tag
// its output the same way apps/cli/src/extract.ts does.
export const AGENT_SOURCES = ['claude-code', 'codex'] as const;
export type AgentSource = (typeof AGENT_SOURCES)[number];

export type EventKind =
  | 'human_turn'
  | 'assistant'
  | 'tool_call'
  | 'tool_result'
  | 'interrupt'
  | 'denial'
  | 'compaction'
  | 'session_start'
  | 'session_end';

export type KerfEvent = {
  source: AgentSource;
  sessionId: string;
  projectHash: string; // sha256(cwd), never the path — §6
  ts: number; // epoch ms
  ordinal: number; // position within session, source-assigned
  kind: EventKind;
  tool?: string;
  filePath?: string; // in-memory only during derivation; never uploaded
  editBytes?: number;
  isError?: boolean;
};

// Output of metrics.ts — one row per session (kerf-spec.md §9 session_metric,
// trimmed to what an August-season (rework ratio) build needs).
export type SessionMetric = {
  source: AgentSource;
  sessionId: string;
  projectHash: string;
  startedMs: number;
  endedMs: number;
  turns: number;
  edits: number;
  editsRework: number;
  reworkRatio: number | null; // null when edits == 0 — undefined, not zero
  qualifies: boolean; // §7.4 floor: >=3 human turns and >=1 edit
  // Counts per tool/skill name (e.g. {"Edit": 12, "Bash": 4}) — identifiers
  // only, never arguments or prompt text. Powers the dashboard's usage
  // histogram without touching the privacy invariant (§6).
  toolCounts: Record<string, number>;
};

export const REWORK_RATIO_TIER = 'A' as const;
