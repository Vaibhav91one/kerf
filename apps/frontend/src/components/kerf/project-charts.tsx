'use client';

// The two project-page visuals. Recharts lives ONLY in this file so the rest of
// the app keeps its zero-dependency hand-rolled bars, and the import cost lands
// on the one route that asked for it.
//
// Colours come from the illustration palette rather than Recharts defaults, and
// axes/grid read theme tokens so both palettes work without a second config.

import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionLabel } from '@/components/kerf/ui';
import { formatDate } from '@/lib/time';
import type { RepoJson } from '@/lib/api';

/** The illustration palette, in the order the flat art uses it. */
const SLICE_COLORS = ['#72E06A', '#FBBF24', '#7C3AED', '#3B82F6', '#FF3B6B', '#3FBF73', '#8B5CF6', '#D8DED4'];

function TooltipBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] text-foreground shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="mt-[2px] font-mono text-muted-foreground">{value}</p>
    </div>
  );
}

export function ActivityChart({ weeks }: { weeks: { weekStartMs: number; sessions: number }[] }) {
  const data = weeks.map((w) => ({ ...w, label: formatDate(w.weekStartMs) }));
  const total = weeks.reduce((n, w) => n + w.sessions, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <SectionLabel>SESSIONS PER WEEK</SectionLabel>
        <span className="font-mono text-[13px] text-muted-foreground">{total} in 12 weeks</span>
      </div>
      <div className="mt-[16px] h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="kerf-activity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="weekStartMs"
              tickFormatter={(ms: number) => formatDate(ms).replace(/ \d{4}$/, '')}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              width={48}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-border)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    label={String(payload[0].payload.label)}
                    value={`${payload[0].value} session${payload[0].value === 1 ? '' : 's'}`}
                  />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#kerf-activity)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LanguagePie({ languages }: { languages: RepoJson['languages'] }) {
  const total = languages.reduce((n, l) => n + l.bytes, 0);
  if (total === 0) return null;
  const pct = (bytes: number) => Math.round((bytes / total) * 100);

  return (
    <div>
      <SectionLabel>LANGUAGES</SectionLabel>
      <div className="mt-[16px] flex items-center gap-6">
        <div className="h-[180px] w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={languages} dataKey="bytes" nameKey="name" innerRadius={44} outerRadius={80} stroke="none">
                {languages.map((l, i) => (
                  <Cell key={l.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      label={String(payload[0].name)}
                      value={`${pct(Number(payload[0].value))}% · ${Number(payload[0].value).toLocaleString('en-GB')} bytes`}
                    />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-[8px]">
          {languages.map((l, i) => (
            <li key={l.name} className="flex items-center gap-3">
              <span
                className="size-[10px] shrink-0 rounded-full"
                style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">{l.name}</span>
              <span className="shrink-0 font-mono text-[14px] text-muted-foreground">{pct(l.bytes)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
