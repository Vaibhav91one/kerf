'use client';

// Screen `Light / 08 Insights` (131:287) and its dark twin (133:2007).

import { useEffect, useState } from 'react';
import { tierForValue } from '@kerf/shared';
import { api, type MeSessions, type SeasonCurrent, type Tip } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';

export default function InsightsPage() {
  const { auth, ready, getToken } = useAuth();
  const [data, setData] = useState<MeSessions | null>(null);
  const [season, setSeason] = useState<SeasonCurrent | null>(null);

  useEffect(() => {
    if (!auth) {
      setData(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setData) : null)).catch(() => {});
  }, [auth, getToken]);

  useEffect(() => {
    api.seasonCurrent().then(setSeason).catch(() => {});
  }, []);

  if (!ready) return <PageSkeleton />;

  if (!auth) {
    return (
      <div className="space-y-[28px]">
        <PageHeader
          title="Insights"
          subtitle="Your sessions only. Every tip below is triggered by a number crossing a threshold — no model reads your transcripts."
        />
        <Panel>
          <p className="text-[13px] text-muted-foreground">
            Connect your CLI to see your own sessions. Nobody else&apos;s appear here.
          </p>
        </Panel>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const qualifying = data.sessions.filter((s) => s.qualifies).length;
  const tools = Object.entries(data.toolTotals).sort((a, b) => b[1] - a[1]);
  const peak = tools.length > 0 ? tools[0][1] : 1;

  // One card per distinct rule, newest session first — the same tip firing on
  // six sessions is one thing to change, not six.
  const tips = new Map<string, Tip>();
  for (const s of data.sessions) for (const t of s.tips) if (!tips.has(t.id)) tips.set(t.id, t);

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Insights"
        subtitle="Your sessions only. Every tip below is triggered by a number crossing a threshold — no model reads your transcripts."
      />

      <div className="grid grid-cols-[740fr_340fr] gap-5">
        <Panel className="min-h-[520px]">
          <SectionLabel>SESSIONS</SectionLabel>
          <table className="mt-[12px] w-full table-fixed">
            <thead>
              <tr className="border-b border-border text-left align-top [&>th]:pb-[9px] [&>th]:text-[10px] [&>th]:font-semibold [&>th]:leading-[13px] [&>th]:text-primary">
                <th>STARTED</th>
                <th className="w-[120px]">TURNS</th>
                <th className="w-[120px]">EDITS</th>
                <th className="w-[120px]">REWORK</th>
                <th className="w-[110px]">TIER</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.slice(0, 9).map((s) => (
                // A non-qualifying session is greyed, not hidden: the floor
                // should be visible rather than silently filtering data away.
                <tr key={s.sessionId} className={s.qualifies ? undefined : 'opacity-60'}>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">
                    {new Date(s.startedMs).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{s.turns}</td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">{s.edits}</td>
                  <td className="py-[13px] font-mono text-[13px] text-muted-foreground">
                    {s.reworkRatio === null ? '—' : s.reworkRatio.toFixed(2)}
                  </td>
                  <td className="py-[13px] text-[13px] text-muted-foreground">
                    {season && s.reworkRatio !== null && s.qualifies
                      ? tierForValue(s.reworkRatio, season.cuts, false)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-[16px] text-[11px] leading-[14px] text-muted-foreground">
            {data.sessions.length} parsed · {qualifying} qualifying · floor is 3 human turns and 1 edit.
          </p>
        </Panel>

        <Panel className="min-h-[520px]">
          <SectionLabel>YOUR TOOL USE</SectionLabel>
          <div className="mt-[18px] space-y-[18px]">
            {tools.map(([name, count]) => (
              <div key={name}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-muted-foreground">{name}</span>
                  <span className="font-mono text-[13px] text-muted-foreground">{count}</span>
                </div>
                <div className="mt-[9px] h-[8px] rounded-[4px] bg-secondary">
                  <div
                    className="h-[8px] rounded-[4px] bg-primary"
                    style={{ width: `${Math.max(4, (count / peak) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {tools.length === 0 && <p className="text-[13px] text-muted-foreground">No tool usage yet.</p>}
          </div>
          <p className="mt-[22px] max-w-[300px] text-[11px] leading-[14px] text-muted-foreground">
            Names only. Arguments never leave your machine.
          </p>
        </Panel>
      </div>

      <Panel>
        <SectionLabel>WHAT TO TRY NEXT</SectionLabel>
        <div className="mt-[12px] space-y-4">
          {[...tips.values()].map((t) => (
            <div key={t.id} className="flex min-h-[92px] items-start gap-6 rounded-[16px] border border-border p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-[18px] text-foreground">{t.title}</p>
                <p className="mt-[6px] max-w-[800px] text-[13px] leading-[17px] text-muted-foreground">{t.message}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] leading-[17px] text-muted-foreground">{t.trigger}</span>
            </div>
          ))}
          {tips.size === 0 && (
            <p className="text-[13px] text-muted-foreground">
              Nothing crossed a threshold. No tip is better than an invented one.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
