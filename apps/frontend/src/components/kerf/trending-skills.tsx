'use client';

// Home's two skill panels. Both are presentational — Home fetches
// api.skills('7d') once and hands the same payload to each, so there is one
// request and the two can never disagree about the week.

import Link from 'next/link';
import { formatSkillLabel } from '@kerf/shared';
import { Avatar, Illustration } from '@/components/kerf/artwork';
import { EmptyState } from '@/components/kerf/empty-state';
import { Panel, SectionLabel } from '@/components/kerf/ui';
import type { SkillTotal } from '@/lib/api';

const TRENDING_ROWS = 5;
/** A facepile past three heads stops being faces and starts being noise. */
const FACES = 3;

/** Overlapping heads with a ring in the panel colour, then a +N chip. */
export function Facepile({ users }: { users: { handle: string; count: number }[] }) {
  const shown = users.slice(0, FACES);
  const rest = users.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((u) => (
        <Link
          key={u.handle}
          href={`/people/${u.handle}`}
          title={`@${u.handle}`}
          className="-ml-3 rounded-full ring-2 ring-card first:ml-0 hover:z-10"
        >
          <Avatar handle={u.handle} size={36} className="rounded-full" />
        </Link>
      ))}
      {rest > 0 && (
        <span className="-ml-3 flex size-[36px] items-center justify-center rounded-full bg-secondary font-mono text-[13px] text-muted-foreground ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}

export function SkillOfTheDay({ skill }: { skill: SkillTotal | null }) {
  return (
    <Panel className="flex min-h-[280px] flex-col">
      <SectionLabel>SKILL OF THE DAY</SectionLabel>
      {skill === null ? (
        <EmptyState illustration="insights" title="Nothing to feature yet">
          Skills appear once someone with public skills on has used one this week.
        </EmptyState>
      ) : (
        // Text left, art right, both stretched to the card's full height — the
        // right half used to be empty, which is what made this read unfinished.
        <div className="mt-[10px] flex flex-1 items-stretch gap-4">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="max-w-full truncate text-[28px] font-semibold leading-[34px] text-foreground">
              {formatSkillLabel(skill.label)}
            </p>
            <p className="mt-[8px] text-[15px] leading-[20px] text-muted-foreground">
              {skill.kind === 'mcp' ? 'MCP server' : 'skill'} · {skill.count.toLocaleString('en-GB')} uses ·{' '}
              {skill.users} {skill.users === 1 ? 'person' : 'people'} this week
            </p>
            <div className="mt-auto pt-[20px]">
              <Facepile users={skill.topUsers} />
            </div>
          </div>
          <Illustration name="skill-spotlight" width={220} className="-my-2 -mr-2 h-auto w-[46%] shrink-0 self-center" />
        </div>
      )}
    </Panel>
  );
}

export function TrendingSkills({ skills }: { skills: SkillTotal[] }) {
  const rows = skills.filter((s) => s.kind !== 'builtin').slice(0, TRENDING_ROWS);
  const peak = rows.length > 0 ? rows[0].count : 1;

  return (
    // No illustration here: five bars already fill the right half, and a second
    // piece of art would crowd them.
    <Panel className="min-h-[280px]">
      <div className="flex items-start justify-between gap-4">
        <SectionLabel>TRENDING THIS WEEK</SectionLabel>
        <Link href="/skills" className="text-[14px] font-medium leading-[16px] text-foreground hover:underline">
          Explore all skills
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState illustration="insights" title="Nothing trending yet">
          This fills up as people with public skills on use them.
        </EmptyState>
      ) : (
        <div className="mt-[16px] space-y-[14px]">
          {rows.map((s) => (
            <div key={s.name}>
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
                  {formatSkillLabel(s.label)}
                </span>
                <span className="shrink-0 font-mono text-[14px] text-muted-foreground">
                  {s.count.toLocaleString('en-GB')}
                </span>
              </div>
              <div className="mt-[8px] h-[8px] overflow-hidden rounded-[4px] bg-secondary">
                <div
                  className="h-[8px] rounded-[4px] bg-primary"
                  style={{ width: `${Math.min(100, Math.max(4, (s.count / peak) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
