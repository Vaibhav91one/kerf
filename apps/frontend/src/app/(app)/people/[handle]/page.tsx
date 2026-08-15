// Server wrapper around profile-client.tsx, for one reason: generateMetadata
// cannot be exported from a 'use client' file. Every profile route used to be
// 'use client' end to end with a useEffect fetch, so the SSR'd HTML a crawler
// or a Slack/Twitter unfurl received was empty PageSkeleton divs — for an app
// whose whole premise is shareable public profiles, that defeated the
// feature. This file fetches once, server-side, for the metadata; the client
// component still does its own fetch for the interactive page (auth-aware
// data — your own private sessions on your own profile — that only makes
// sense client-side).

import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProfileClient } from './profile-client';

export async function generateMetadata({ params }: PageProps<'/people/[handle]'>): Promise<Metadata> {
  const { handle } = await params;
  try {
    const profile = await api.profile(handle);
    const title = `${profile.displayName} (@${profile.handle})`;
    const description = profile.bio ?? `${profile.displayName}'s Kerf profile — ${profile.standing.tier} tier.`;
    return {
      title,
      description,
      openGraph: { title, description, type: 'profile' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    // A missing or unreachable profile still needs a title — the page body
    // below renders its own "No profile" / "Could not load" states.
    return { title: `@${handle}` };
  }
}

export default async function ProfilePage({ params }: PageProps<'/people/[handle]'>) {
  const { handle } = await params;
  return <ProfileClient handle={handle} />;
}
