// Your own session history — one table, used by Insights and your profile.
// REWORK and TIER columns are gone: the ratio is the scoring engine now, not a
// readout, and a per-session tier stopped existing when levels became lifetime.

import { formatDateTime } from '@/lib/time';
import type { AgentSource } from '@kerf/shared';
import type { MySession } from '@/lib/api';

// Two-letter chip rather than a real brand mark for either agent: there is no
// licensed logo for either in artwork.tsx, and inventing one is a design
// decision, not an implementation one — this is the smallest thing that lets
// a mixed Claude Code/Codex history be told apart at a glance.
const AGENT_LABEL: Record<AgentSource, { short: string; full: string }> = {
  'claude-code': { short: 'CC', full: 'Claude Code' },
  codex: { short: 'CX', full: 'Codex' },
};

function AgentGlyph({ source }: { source: AgentSource }) {
  const { short, full } = AGENT_LABEL[source];
  return (
    <span
      title={full}
      className="inline-flex h-[20px] w-[26px] items-center justify-center rounded-[6px] border border-border font-mono text-[10px] text-muted-foreground"
    >
      {short}
    </span>
  );
}

export function SessionTable({ sessions, limit }: { sessions: MySession[]; limit?: number }) {
  const rows = limit === undefined ? sessions : sessions.slice(0, limit);

  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[12px] [&>th]:font-semibold [&>th]:leading-[16px] [&>th]:text-primary">
          <th className="w-[40px]">
            <span className="sr-only">AGENT</span>
          </th>
          <th>STARTED</th>
          <th className="w-[110px]">TURNS</th>
          <th className="w-[110px]">EDITS</th>
          <th className="w-[110px]">POINTS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          // A non-qualifying session is greyed, not hidden: the floor should be
          // visible rather than silently filtering data away.
          <tr key={s.sessionId} className={s.qualifies ? undefined : 'opacity-60'}>
            <td className="py-[13px]">
              <AgentGlyph source={s.source} />
            </td>
            <td className="py-[13px] text-[15px] text-muted-foreground">{formatDateTime(s.startedMs)}</td>
            <td className="py-[13px] font-mono text-[15px] text-muted-foreground">{s.turns}</td>
            <td className="py-[13px] font-mono text-[15px] text-muted-foreground">{s.edits}</td>
            <td className="py-[13px] font-mono text-[15px] text-foreground">{s.qualifies ? s.points : '—'}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="py-[13px] text-[15px] text-muted-foreground">
              No sessions yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
