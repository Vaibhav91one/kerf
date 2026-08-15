'use client';

// Screen `Light / 04 Skills` (130:346) and its dark twin (133:1516).
//
// Shows skills and MCP servers, not tools: "Bash 1085" is a fact about Claude
// Code, not about anyone's craft. Built-in rows are still served by
// GET /api/skills and filtered here, so putting them back is a one-line change.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { formatSkillLabel, searchNeedle } from '@kerf/shared';
import { api, type SkillJson, type SkillTotal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/kerf/artwork';
import { EmptyState } from '@/components/kerf/empty-state';
import { SearchBox } from '@/components/kerf/search-box';
import { SkillSheet, type SkillSheetSubject } from '@/components/kerf/skill-sheet';
import { PageHeader, PageSkeleton, Panel, SectionLabel } from '@/components/kerf/ui';
import { Button } from '@/components/ui/button';
import { SharedLibrary } from './shared-library';

export default function SkillsPage() {
  const { auth, signedIn, clerkEnabled } = useAuth();
  const [publishOpen, setPublishOpen] = useState(false);
  const [skills, setSkills] = useState<SkillTotal[] | null>(null);
  const [library, setLibrary] = useState<SkillJson[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<SkillSheetSubject | null>(null);

  useEffect(() => {
    api
      .skills()
      .then((r) => {
        const shown = r.skills.filter((s) => s.kind !== 'builtin');
        setSkills(shown);
        setSelected(shown[0]?.name ?? null);
      })
      .catch(() => setSkills([]));
    api.skillLibrary('recent').then((r) => setLibrary(r.skills)).catch(() => {});
  }, []);

  if (!skills) return <PageSkeleton />;

  // Both the formatted label and the raw one: `fig` should find `figma`, and
  // so should someone pasting `plugin_figma_figma` out of a config file.
  const needle = searchNeedle(query);
  const shown = needle
    ? skills.filter((s) => [formatSkillLabel(s.label), s.label].some((f) => f.toLowerCase().includes(needle)))
    : skills;

  // Both derived from `shown`, not `skills`: filtering the selected row out used
  // to leave the rail reading "WHO USES —" with an empty list, and the bars
  // scaled against a peak that was no longer on screen.
  const peak = shown.length > 0 ? shown[0].count : 1;
  const focus = shown.find((s) => s.name === selected) ?? shown[0] ?? null;

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="Skills"
        action={
          // Never disabled — signed out it opens sign-in, which is what someone
          // clicking "Publish a skill" actually wants.
          auth ? (
            <Button onClick={() => setPublishOpen(true)}>Publish a skill</Button>
          ) : signedIn || !clerkEnabled ? (
            <Button nativeButton={false} render={<Link href="/me" />}>Publish a skill</Button>
          ) : (
            <SignInButton mode="modal">
              <Button>Publish a skill</Button>
            </SignInButton>
          )
        }
      />

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search skills and MCP servers"
        label="Search skills"
        count={shown.length}
      />

      <div className="grid grid-cols-[740fr_340fr] items-start gap-5">
        <Panel>
          <SectionLabel>SKILLS &amp; MCP SERVERS</SectionLabel>
          <div className="mt-[12px] flex gap-3 border-b border-border pb-[9px] text-[12px] font-semibold leading-[16px] text-primary">
            <span className="min-w-0 flex-1">NAME</span>
            <span className="w-[120px] shrink-0">USES</span>
            <span className="w-[84px] shrink-0">PEOPLE</span>
          </div>
          {/* Fixed height + scroll: the list is unbounded, the page should not be. */}
          <div className="mt-[22px] max-h-[560px] space-y-[32px] overflow-y-auto pr-2">
            {shown.map((s) => (
              <button
                key={s.name}
                type="button"
                // Both: the rail follows the row you clicked, and the sheet
                // opens on top of it. A row used to be a dead end past the rail.
                onClick={() => {
                  setSelected(s.name);
                  setSubject({ label: s.label, kind: s.kind, usage: { count: s.count, scope: 'league-wide' }, users: s.users, topUsers: s.topUsers });
                }}
                className="block w-full text-left"
                aria-pressed={s.name === selected}
              >
                <div className="flex items-baseline gap-3">
                  {/* min-w-0 + truncate: a flex item defaults to min-width:auto,
                      so a long MCP server name would otherwise refuse to shrink
                      and shove the count columns out of the panel. */}
                  <span
                    className={`min-w-0 flex-1 truncate text-[16px] ${s.name === selected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                  >
                    {formatSkillLabel(s.label)}
                  </span>
                  <span className="shrink-0 rounded-[10px] border border-border px-[8px] py-[1px] text-[12px] text-muted-foreground">
                    {s.kind === 'mcp' ? 'MCP' : 'skill'}
                  </span>
                  <span className="w-[120px] shrink-0 font-mono text-[15px] text-muted-foreground">
                    {s.count.toLocaleString('en-GB')}
                  </span>
                  <span className="w-[84px] shrink-0 font-mono text-[15px] text-muted-foreground">{s.users}</span>
                </div>
                <div className="mt-[10px] h-[8px] overflow-hidden rounded-[4px] bg-secondary">
                  <div
                    className="h-[8px] rounded-[4px] bg-primary"
                    style={{ width: `${Math.min(100, Math.max(4, (s.count / peak) * 100))}%` }}
                  />
                </div>
              </button>
            ))}
            {shown.length === 0 &&
              (needle ? (
                <p className="text-[15px] text-muted-foreground">Nothing matches “{query.trim()}”.</p>
              ) : (
                <EmptyState illustration="insights" title="No public skills yet">
                  Skills appear here once someone turns on public skills in their account.
                </EmptyState>
              ))}
          </div>
        </Panel>

        <Panel className="sticky top-6">
          <SectionLabel>WHO USES {focus ? formatSkillLabel(focus.label) : '—'}</SectionLabel>
          <div className="mt-[16px] max-h-[560px] space-y-4 overflow-y-auto pr-1">
            {(focus?.topUsers ?? []).map((u) => (
              <Link key={u.handle} href={`/people/${u.handle}`} className="flex items-center gap-[10px]">
                <Avatar handle={u.handle} size={28} className="shrink-0 rounded-full" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground hover:underline">
                  @{u.handle}
                </span>
                <span className="shrink-0 font-mono text-[15px] text-muted-foreground">{u.count}</span>
              </Link>
            ))}
            {focus && focus.topUsers.length === 0 && (
              <p className="text-[15px] text-muted-foreground">No opted-in account uses this yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <SharedLibrary
        initialSkills={library}
        publishOpen={publishOpen}
        onPublishOpenChange={setPublishOpen}
        query={query}
      />

      {subject && <SkillSheet subject={subject} onClose={() => setSubject(null)} />}
    </div>
  );
}
