'use client';

// One live-session card, shared by Home and /live — the two screens had
// near-identical tiles that drifted apart. Left is who/what/how much, right is
// an illustration of what the session is doing. The "rework so far" readout is
// gone: a mid-session ratio is noise, and no visitor could read it anyway.

import Link from 'next/link';
import { Illustration, type IllustrationName } from '@/components/kerf/artwork';
import { elapsed } from '@/lib/time';
import type { LiveSessionJson } from '@/lib/api';

/** What the session looks like it is doing, from its counters alone. */
export function activityFor(s: Pick<LiveSessionJson, 'turns' | 'edits' | 'editsRework'>): {
  name: IllustrationName;
  label: string;
} {
  if (s.edits >= 3) return { name: 'activity-building', label: 'building' };
  if (s.edits >= 1 && s.editsRework > 0) return { name: 'activity-debugging', label: 'debugging' };
  if (s.turns >= 3 && s.edits === 0) return { name: 'activity-reading', label: 'reading' };
  return { name: 'activity-exploring', label: 'exploring' };
}

export function LiveCard({
  session,
  projectName,
  nowMs,
}: {
  session: LiveSessionJson;
  projectName: string | null;
  /** Held by the caller, never read during render — see cli-status.tsx. */
  nowMs: number | null;
}) {
  const activity = activityFor(session);

  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-live" />
          <Link href={`/people/${session.handle}`} className="truncate text-[16px] font-semibold text-foreground hover:underline">
            @{session.handle}
          </Link>
        </div>
        {/* Not "private": that word now means an explicit visibility switch, and
            this is simply a project nobody published. A session in a genuinely
            private project never reaches this feed at all. */}
        <p className="mt-[10px] truncate text-[14px] leading-[18px] text-muted-foreground">
          {projectName ?? 'unpublished project'}
        </p>
        <p className="mt-[13px] font-mono text-[15px] leading-[19px] text-foreground">
          {session.turns} turns · {session.edits} edits
        </p>
        <p className="mt-[9px] text-[13px] leading-[17px] text-muted-foreground">
          {activity.label}
          {nowMs === null ? '' : ` · ${elapsed(nowMs - session.startedMs)}`}
        </p>
      </div>
      {/* A "live" indicator, not a per-activity scene: the four activity-*
          illustrations used to sit here (still used for `activity.label`'s
          caption text below), but four different scenes across a page of
          cards read as noise, not signal — "someone is live" is the one thing
          every card actually needs to say visually. */}
      <Illustration name="live-activity" width={96} className="shrink-0" />
    </div>
  );
}
