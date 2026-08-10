'use client';

// The People rail entry. There is no comp for a directory — the Figma board
// draws the profile screen as the People destination — so this stays a plain
// index in the same language and hands off to `/people/[handle]` immediately.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type LiveSessionJson, type PublicProfileSummary } from '@/lib/api';
import { Avatar } from '@/components/kerf/artwork';
import { PageHeader, Panel } from '@/components/kerf/ui';

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<PublicProfileSummary[] | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);

  useEffect(() => {
    api
      .profiles()
      .then((r) => setProfiles(r.profiles))
      .catch(() => setProfiles([]));
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
  }, []);

  const liveHandles = new Set(live.map((s) => s.handle));

  return (
    <div className="space-y-[28px]">
      <PageHeader
        title="People"
        subtitle="Everyone who has claimed a handle. Open a profile for their standing, badges and published projects."
      />

      {profiles === null ? (
        <div className="grid grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-[16px] border border-border bg-card" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Panel>
          <p className="text-[13px] text-muted-foreground">Nobody has claimed a handle yet.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {profiles.map((p) => (
            <Link
              key={p.handle}
              href={`/people/${p.handle}`}
              className="rounded-[16px] border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <Avatar handle={p.handle} size={56} className="shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold leading-[20px] text-foreground">{p.displayName}</p>
                  <p className="mt-[4px] text-[12px] leading-[15px] text-muted-foreground">
                    @{p.handle}
                    {liveHandles.has(p.handle) && <span className="ml-2 text-live">live now</span>}
                  </p>
                </div>
              </div>
              {p.bio && (
                <p className="mt-[14px] line-clamp-2 text-[13px] leading-[17px] text-muted-foreground">{p.bio}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
