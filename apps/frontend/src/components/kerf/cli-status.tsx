'use client';

// Sidebar footer identity block: avatar, handle, and how recently the CLI beat.
// The comp reads "@vaibhav / CLI connected · beat 3s ago" — the beat age comes
// from this account's own row in the public live feed, which is the only signal
// the API exposes about an in-flight session.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/kerf/artwork';

// `kerf live` beats every 15s, so re-checking on the same cadence keeps the
// label honest without inventing a second polling rate.
const BEAT_POLL_MS = 15_000;

function ago(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

export function CliStatus() {
  const { auth, ready } = useAuth();
  const [lastBeatMs, setLastBeatMs] = useState<number | null>(null);

  useEffect(() => {
    if (!auth) {
      setLastBeatMs(null);
      return;
    }
    let cancelled = false;
    const read = () =>
      api
        .liveSessions()
        .then((r) => {
          if (cancelled) return;
          const mine = r.sessions.filter((s) => s.handle === auth.handle);
          setLastBeatMs(mine.length > 0 ? Math.max(...mine.map((s) => s.lastBeatMs)) : null);
        })
        .catch(() => {});
    void read();
    const timer = setInterval(read, BEAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [auth]);

  const handle = auth?.handle ?? null;
  const status = !ready
    ? ''
    : !auth
      ? 'Not connected · run kerf login'
      : lastBeatMs
        ? `CLI connected · beat ${ago(Date.now() - lastBeatMs)}`
        : 'CLI connected';

  return (
    <Link href="/me" className="flex min-w-0 flex-1 items-center gap-2.5">
      <Avatar handle={handle} size={32} className="shrink-0 rounded-full" />
      <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-[13px] font-medium text-foreground">{handle ? `@${handle}` : 'Sign in'}</span>
        <span className="truncate text-[11px] text-muted-foreground">{status}</span>
      </div>
    </Link>
  );
}
