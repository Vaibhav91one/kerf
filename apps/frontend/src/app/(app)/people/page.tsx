'use client';

// The People rail entry. There is no comp for a directory — the Figma board
// draws the profile screen as the People destination — so this stays a plain
// index in the same language and hands off to `/people/[handle]` immediately.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { searchNeedle } from '@kerf/shared';
import { api, type LiveSessionJson, type PublicProfileSummary } from '@/lib/api';
import { Avatar } from '@/components/kerf/artwork';
import { SearchBox } from '@/components/kerf/search-box';
import { PageHeader, Panel } from '@/components/kerf/ui';

export default function PeoplePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<PublicProfileSummary[] | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .profiles()
      .then((r) => setProfiles(r.profiles))
      .catch(() => setProfiles([]));
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
  }, []);

  const liveHandles = new Set(live.map((s) => s.handle));

  // The handle IS the unique tag, so one box covers both: type a name to
  // filter, type an exact @handle and press Enter to go straight there.
  //
  // ponytail: filters the first 200 profiles GET /api/profiles returns. Add a
  // `?q=` param when the directory outgrows that cap — until then a debounced
  // round-trip per keystroke buys nothing a client filter doesn't.
  const needle = searchNeedle(query);
  const shown = needle
    ? (profiles ?? []).filter(
        (p) => p.handle.toLowerCase().includes(needle) || p.displayName.toLowerCase().includes(needle),
      )
    : profiles ?? [];

  function onSubmit() {
    if ((profiles ?? []).some((p) => p.handle.toLowerCase() === needle)) router.push(`/people/${needle}`);
  }

  return (
    <div className="space-y-[28px]">
      <PageHeader title="People" />

      <SearchBox
        value={query}
        onChange={setQuery}
        onSubmit={onSubmit}
        placeholder="Search a name or @handle"
        label="Search people"
        count={profiles === null ? undefined : shown.length}
      />

      {profiles === null ? (
        <div className="grid grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-[16px] border border-border bg-card" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Panel>
          <p className="text-[15px] text-muted-foreground">
            {needle ? `No one matches “${query.trim()}”.` : 'Nobody has claimed a handle yet.'}
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {shown.map((p) => (
            <Link
              key={p.handle}
              href={`/people/${p.handle}`}
              className="rounded-[16px] border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <Avatar handle={p.handle} size={56} className="shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-semibold leading-[23px] text-foreground">{p.displayName}</p>
                  <p className="mt-[4px] text-[14px] leading-[18px] text-muted-foreground">
                    @{p.handle}
                    {liveHandles.has(p.handle) && <span className="ml-2 text-live">live now</span>}
                  </p>
                </div>
              </div>
              {p.bio && (
                <p className="mt-[14px] line-clamp-2 text-[15px] leading-[20px] text-muted-foreground">{p.bio}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
