'use client';

// Screen `Light / 04 Skills` (130:346) and its dark twin (133:1516).
//
// The comp draws the league-usage view only. The Shared Library shipped after
// those boards were drawn, so it is kept below rather than deleted to match a
// picture — removing working publish/star/install would be the worse trade.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type SkillJson, type SkillTotal } from '@/lib/api';
import { Avatar } from '@/components/kerf/artwork';
import { PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { SharedLibrary } from './shared-library';

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillTotal[] | null>(null);
  const [library, setLibrary] = useState<SkillJson[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api
      .skills()
      .then((r) => {
        setSkills(r.skills);
        setSelected(r.skills[0]?.name ?? null);
      })
      .catch(() => setSkills([]));
    api.skillLibrary('recent').then((r) => setLibrary(r.skills)).catch(() => {});
  }, []);

  if (!skills) return <PageSkeleton />;

  const peak = skills.length > 0 ? skills[0].count : 1;
  const focus = skills.find((s) => s.name === selected) ?? null;
  const people = new Set(skills.flatMap((s) => s.topUsers.map((u) => u.handle))).size;

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Skills"
        subtitle={`Aggregated from the ${people} profile${people === 1 ? '' : 's'} that turned public skills on. Names of tools and skills only — never their arguments.`}
      />

      <div className="grid grid-cols-[740fr_340fr] gap-5">
        <Panel className="min-h-[690px]">
          <SectionLabel>MOST USED ACROSS THE LEAGUE</SectionLabel>
          <div className="mt-[12px] flex border-b border-border pb-[9px] text-[10px] font-semibold leading-[13px] text-primary">
            <span className="flex-1">SKILL / TOOL</span>
            <span className="w-[140px]">USES</span>
            <span className="w-[84px]">PEOPLE</span>
          </div>
          <div className="mt-[22px] space-y-[40px]">
            {skills.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setSelected(s.name)}
                className="block w-full text-left"
                aria-pressed={s.name === selected}
              >
                <div className="flex items-baseline">
                  <span
                    className={`flex-1 text-[14px] ${s.name === selected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                  >
                    {s.name}
                  </span>
                  <span className="w-[140px] font-mono text-[13px] text-muted-foreground">
                    {s.count.toLocaleString('en-US').replace(/,/g, ' ')}
                  </span>
                  <span className="w-[84px] font-mono text-[13px] text-muted-foreground">{s.users}</span>
                </div>
                <div className="mt-[10px] h-[8px] rounded-[4px] bg-secondary">
                  <div
                    className="h-[8px] rounded-[4px] bg-primary"
                    style={{ width: `${Math.max(4, (s.count / peak) * 100)}%` }}
                  />
                </div>
              </button>
            ))}
            {skills.length === 0 && (
              <p className="text-[13px] text-muted-foreground">Nobody has turned public skills on yet.</p>
            )}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="min-h-[400px]">
            <p className="text-[10px] font-semibold leading-[13px] text-foreground">
              WHO USES {focus?.name ?? '—'}
            </p>
            <p className="mt-[5px] text-[11px] leading-[14px] text-muted-foreground">
              Click a handle to open their profile.
            </p>
            <div className="mt-[16px] space-y-4">
              {(focus?.topUsers ?? []).map((u) => (
                <Link key={u.handle} href={`/u/${u.handle}`} className="flex items-center gap-[10px]">
                  <Avatar handle={u.handle} size={28} className="shrink-0 rounded-full" />
                  <span className="flex-1 text-[13px] font-medium text-foreground hover:underline">@{u.handle}</span>
                  <span className="font-mono text-[13px] text-muted-foreground">{u.count}</span>
                </Link>
              ))}
              {focus && focus.topUsers.length === 0 && (
                <p className="text-[13px] text-muted-foreground">No opted-in account uses this yet.</p>
              )}
            </div>
          </Panel>

          <Panel className="min-h-[270px]">
            <SectionLabel>HOW THIS LIST IS BUILT</SectionLabel>
            <p className="mt-[10px] max-w-[300px] text-[13px] leading-[17px] text-muted-foreground">
              The extractor counts tool_use blocks by name and ships the histogram. A skill name is an enum-ish
              string the agent already emitted — the arguments beside it are never read.
            </p>
          </Panel>
        </div>
      </div>

      <Panel className="min-h-[100px]">
        <p className="max-w-[1000px] text-[13px] leading-[17px] text-muted-foreground">
          Your skills are private until you flip the switch on <Link href="/me" className="underline">/me</Link>.
          Turning it off hides you from this page immediately.
        </p>
      </Panel>

      <Panel>
        <SectionLabel>SHARED LIBRARY</SectionLabel>
        <p className="mt-[6px] text-[11px] leading-[14px] text-muted-foreground">
          Skills people published by hand, not derived from anyone&apos;s transcripts.
        </p>
        <div className="mt-4">
          <SharedLibrary initialSkills={library} />
        </div>
      </Panel>
    </div>
  );
}
