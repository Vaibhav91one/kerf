// Insights are a property of a person, not of the platform, so they live on the
// profile now (components/kerf/profile-view.tsx) and the rail no longer carries
// an entry. The route stays as a redirect: links to it were already minted.

import { redirect } from 'next/navigation';

export default function InsightsPage() {
  redirect('/me');
}
