'use client';

// One sheet for a skill or an MCP server, opened from four places: the /skills
// usage rows, the /skills library cards, a public profile's skills panel, and
// your own toolkit rail. A skill row used to be a dead end everywhere except
// /skills, which is where the richest screen in the app lived.
//
// It degrades in both directions with no branches beyond `?.`: used but never
// published shows usage and who else uses it, published but unused shows the
// description and the SKILL.md. Nothing is required except `label`.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatSkillLabel } from '@kerf/shared';
import { api, type SkillJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/kerf/artwork';
import { Facepile } from '@/components/kerf/trending-skills';
import { LoadingRow } from '@/components/kerf/spinner';
import { CommandBlock, CopyButton } from '@/components/kerf/ui';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export type SkillSheetSubject = {
  /** The only field every call site has. Raw — the sheet formats it. */
  label: string;
  kind?: 'skill' | 'mcp' | 'builtin';
  /** How much it is used, and whose sessions that count covers. */
  usage?: { count: number; scope: string };
  users?: number;
  topUsers?: { handle: string; count: number }[];
  /** Already-loaded library row. Undefined means "fetch it on open". */
  entry?: SkillJson;
};

export function SkillSheet({ subject, onClose }: { subject: SkillSheetSubject; onClose: () => void }) {
  const slug = formatSkillLabel(subject.label);
  const { getToken } = useAuth();
  const [entry, setEntry] = useState<SkillJson | null>(subject.entry ?? null);
  const [loading, setLoading] = useState(!subject.entry);

  // Only SharedLibrary passes `entry` — it is already rendering the array. A
  // profile must not pull 200 rows x 8000 chars on the chance one is opened, so
  // everywhere else fetches the one row when the sheet opens.
  //
  // The join is the formatted label against the published slug: it agrees for
  // CLI-published skills and can miss a hand-typed name. A miss renders "not
  // published yet", which is a legitimate answer, so there is no by-label route.
  //
  // The token is not optional any more. by-slug narrows to visible rows, so
  // without it the owner opening their own PRIVATE skill is told "not published"
  // and republishes it into a suffixed duplicate slug.
  //
  // getToken(), not the auth.token snapshot: Clerk mints short-lived session
  // JWTs, and a snapshot older than about a minute resolves to no viewer — which
  // is exactly the 404 this fetch exists to avoid.
  useEffect(() => {
    if (subject.entry) return;
    let live = true;
    void getToken()
      .catch(() => null)
      .then((t) => api.skillBySlug(slug, t ?? undefined))
      .then((s) => live && setEntry(s))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [slug, subject.entry, getToken]);

  const topUsers = subject.topUsers ?? [];
  const peak = topUsers.length > 0 ? topUsers[0].count : 1;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {slug}
            {subject.kind === 'mcp' && <Badge variant="secondary">MCP</Badge>}
          </SheetTitle>
          <SheetDescription>
            {[
              subject.usage && `${subject.usage.count.toLocaleString('en-GB')} uses ${subject.usage.scope}`,
              subject.users !== undefined && `${subject.users} ${subject.users === 1 ? 'person' : 'people'}`,
              entry && `@${entry.handle} · ${entry.starCount} stars · ${entry.installCount} installs`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Nothing recorded for this one yet.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {topUsers.length > 0 && (
            <div className="space-y-3">
              <Facepile users={topUsers} />
              {topUsers.map((u) => (
                <Link key={u.handle} href={`/people/${u.handle}`} className="block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <Avatar handle={u.handle} size={20} className="shrink-0 self-center rounded-full" />
                      <span className="min-w-0 truncate text-sm text-foreground hover:underline">@{u.handle}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-muted-foreground">{u.count}</span>
                  </div>
                  <div className="mt-1.5 h-[8px] overflow-hidden rounded-[4px] bg-secondary">
                    <div
                      className="h-[8px] rounded-[4px] bg-primary"
                      style={{ width: `${Math.min(100, Math.max(4, (u.count / peak) * 100))}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {loading ? (
            <LoadingRow label="Looking in the shared library…" />
          ) : entry ? (
            <>
              {entry.description && <p className="text-sm text-muted-foreground">{entry.description}</p>}
              <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">{entry.content}</pre>
            </>
          ) : subject.kind === 'skill' ? (
            <>
              <p className="text-sm text-muted-foreground">Not published to the shared library yet.</p>
              <CommandBlock lines={[[`kerf skills publish ${slug}`], [`kerf skills publish ${slug} --private`]]} />
            </>
          ) : subject.kind === 'mcp' ? (
            // No command at all: an MCP server is configured in Claude Code's
            // own settings, and a copyable command that does not exist is worse
            // than no next step.
            <p className="text-sm text-muted-foreground">
              An MCP server is configured in your Claude Code settings, not published here. The count above is how often
              its tools were called.
            </p>
          ) : subject.kind === 'builtin' ? (
            <p className="text-sm text-muted-foreground">
              A built-in tool — it ships with the CLI, so there is nothing to publish or install.
            </p>
          ) : (
            // No `kind`: someone else's profile discards it (§6), so this keeps
            // the one plain line it always had.
            <p className="text-sm text-muted-foreground">Not published to the shared library yet.</p>
          )}
        </div>

        {entry && (
          <SheetFooter className="flex-row gap-2">
            <CopyButton text={entry.content} label="Copy content" />
            <CopyButton text={`kerf skill install ${entry.slug}`} label="Copy install command" />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
