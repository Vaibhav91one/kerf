'use client';

// Screen `Light / 03 Profile` (130:181) and its dark twin (133:1370) — the
// People destination in the rail. Lives at /people/[handle]; /u/[handle]
// redirects here so links minted before the move keep working.
//
// The screen itself is components/kerf/profile-view.tsx, shared with /me.
//
// The handle arrives as a plain prop, not `use(params)`: the server
// component in page.tsx already resolved it once for generateMetadata, and
// resolving the same params Promise twice is redundant, not incorrect — but
// a plain string keeps this file working exactly as it did before the split.

import { useEffect, useState } from 'react';
import { api, ApiError, type LiveSessionJson, type MeSessions, type PublicProfile, type SeasonCurrent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProfileView } from '@/components/kerf/profile-view';
import { PageSkeleton } from '@/components/kerf/ui';

export function ProfileClient({ handle }: { handle: string }) {
  const { auth, ready, getToken } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [season, setSeason] = useState<SeasonCurrent | null>(null);
  const [live, setLive] = useState<LiveSessionJson[]>([]);
  const [mine, setMine] = useState<MeSessions | null>(null);
  const [missing, setMissing] = useState(false);
  // Distinct from `missing`: a 404 means no such profile, anything else means
  // we could not find out. Without this the page holds a skeleton forever on a
  // 500/DNS/CORS failure — projects/[id]/page.tsx has the same guard.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Wait for auth to hydrate: fetching with no token first and a token a
    // moment later is how isFollowedByMe/isRivalOfMe would flash from wrong
    // to right on every load for a signed-in viewer — same reason
    // projects/[id] waits for `ready` before its first fetch.
    if (!ready) return;
    setMissing(false);
    setFailed(false);
    void getToken()
      .catch(() => null)
      .then((t) =>
        api
          .profile(handle, t ?? undefined)
          .then(setProfile)
          .catch((e) => {
            if (e instanceof ApiError && e.status === 404) setMissing(true);
            else setFailed(true);
          }),
      );
    api.seasonCurrent().then(setSeason).catch(() => {});
    api.liveSessions().then((r) => setLive(r.sessions)).catch(() => {});
  }, [handle, ready, getToken]);

  const isOwn = auth?.handle === handle;
  useEffect(() => {
    if (!auth || !isOwn) {
      setMine(null);
      return;
    }
    void getToken().then((t) => (t ? api.mySessions(t).then(setMine) : null)).catch(() => {});
  }, [auth, isOwn, getToken]);

  if (missing) return <p className="text-[16px] text-muted-foreground">No profile at @{handle}.</p>;
  if (failed) return <p className="text-[16px] text-muted-foreground">Could not load this profile. Try again.</p>;
  if (!profile) return <PageSkeleton />;

  return (
    <ProfileView
      profile={profile}
      live={live}
      sessions={mine?.sessions ?? null}
      toolTotals={mine?.toolTotals}
      isOwn={isOwn}
      boardPosition={season ? season.standings.findIndex((s) => s.handle === handle) : undefined}
      boardSize={season?.standings.length}
    />
  );
}
