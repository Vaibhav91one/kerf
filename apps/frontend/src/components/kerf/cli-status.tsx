'use client';

// Sidebar footer: avatar, handle, and whether the CLI has anything in sync.
// A green dot plus "In sync" rather than "CLI connected" — connected describes
// a socket that does not exist; what actually matters is that your sessions are
// up here. Hovering says what is in sync and when it last happened.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type MeSessions } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/kerf/artwork';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ago, formatDateTime } from '@/lib/time';

// `kerf live` beats every 15s, so re-checking on the same cadence keeps the
// label honest without inventing a second polling rate.
const BEAT_POLL_MS = 15_000;

export function CliStatus() {
  const { auth, ready, getToken } = useAuth();
  const [me, setMe] = useState<MeSessions | null>(null);
  // Held in state rather than read during render: Date.now() in a render body
  // is impure and makes the hydrated markup disagree with the server's.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!auth) {
      setMe(null);
      return;
    }
    let cancelled = false;
    // The last beat used to come from the public /api/live/sessions feed, which
    // now hides a session in a private project from everyone — so this dot went
    // dark exactly while you worked on your own private project. /api/me/sessions
    // is owner-scoped and carries it, and this component already fetched it:
    // one fewer request, and it stays honest.
    const read = () =>
      getToken()
        .then((t) => (t ? api.mySessions(t) : null))
        .then((r) => !cancelled && r && setMe(r))
        .catch(() => {});
    void read();
    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
      void read();
    }, BEAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [auth, getToken]);

  const handle = auth?.handle ?? null;
  const lastBeatMs = me?.lastBeatMs ?? null;
  const live = (me?.liveSessions ?? 0) > 0;
  const synced = (me?.sessions.length ?? 0) > 0;

  const row = (
    <Link href="/me" className="flex min-w-0 flex-1 items-center gap-2.5">
      <Avatar handle={handle} size={32} className="shrink-0 rounded-full" />
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-[15px] font-medium text-foreground">{handle ? `@${handle}` : 'Sign in'}</span>
        <span className="flex items-center gap-[6px] truncate text-[13px] text-muted-foreground">
          {!ready ? null : !auth ? (
            'Not connected · run kerf login'
          ) : (
            <>
              <span
                aria-hidden
                className={`size-[7px] shrink-0 rounded-full ${synced ? 'bg-primary' : 'bg-muted-foreground'}`}
              />
              {live ? 'Live' : synced ? 'In sync' : 'Nothing synced yet'}
            </>
          )}
        </span>
      </div>
    </Link>
  );

  // Signed out there is nothing to explain, so no tooltip at all.
  if (!auth) return row;

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="top" className="block w-[260px] space-y-[3px] text-left">
        <p className="font-medium">
          {me?.sessions.length ?? 0} session{me?.sessions.length === 1 ? '' : 's'} in sync
        </p>
        <p className="mt-[2px] opacity-80">
          {me?.lastSyncedMs && nowMs
            ? `Last synced ${ago(nowMs - me.lastSyncedMs)} · ${formatDateTime(me.lastSyncedMs)}`
            : 'Run kerf sync to upload your sessions.'}
        </p>
        {live && lastBeatMs && nowMs && (
          <p className="mt-[2px] opacity-80">A session is live — last beat {ago(nowMs - lastBeatMs)}.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
