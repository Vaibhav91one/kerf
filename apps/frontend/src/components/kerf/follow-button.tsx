'use client';

// The only piece of ProfileHeader that needs a token, so it is its own client
// component rather than a prop threaded through the (deliberately pure)
// ProfileHeader — same reason OpenSignIn lives apart from MePage.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function FollowButton({
  handle,
  isFollowedByMe,
  followerCount,
}: {
  handle: string;
  isFollowedByMe: boolean;
  followerCount: number;
}) {
  const { auth, getToken } = useAuth();
  const [state, setState] = useState({ following: isFollowedByMe, count: followerCount });

  // The profile refetches on navigation to a different handle; without this
  // the button keeps the FIRST profile's answer when you click through to a
  // second person's page (the component instance persists across the route
  // change since it's the same tree position).
  useEffect(() => {
    setState({ following: isFollowedByMe, count: followerCount });
  }, [isFollowedByMe, followerCount, handle]);

  // Signed out, or looking at your own profile: nothing to show. isOwn's own
  // slot (badge carousel) already covers "your own account", but this also
  // guards the signed-out case, which ProfileHeader's isOwn cannot express.
  if (!auth || auth.handle === handle) return null;

  // me/page.tsx's setProjectPublic pattern: move first, reconcile from the
  // response, revert and toast.error on failure — a button that waits for a
  // round-trip before moving reads as broken.
  async function toggle() {
    const token = await getToken();
    if (!token) return;
    const next = !state.following;
    setState((s) => ({ following: next, count: s.count + (next ? 1 : -1) }));
    try {
      const res = await api.toggleFollow(token, handle);
      setState({ following: res.following, count: res.followerCount });
      toast.success(res.following ? `Following @${handle}` : 'Unfollowed');
    } catch {
      setState((s) => ({ following: !next, count: s.count + (next ? -1 : 1) }));
      toast.error('Could not update following');
    }
  }

  return (
    <div className="text-right">
      <Button
        variant={state.following ? 'outline' : 'default'}
        onClick={() => void toggle()}
        className="h-[40px] w-[128px] rounded-[12px]"
      >
        {state.following ? 'Following' : 'Follow'}
      </Button>
      <p className="mt-[8px] text-[13px] text-muted-foreground">
        {state.count} {state.count === 1 ? 'follower' : 'followers'}
      </p>
    </div>
  );
}
