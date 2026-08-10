import { redirect } from 'next/navigation';

export default async function LegacyUserProfilePage({ params }: PageProps<'/u/[handle]'>) {
  const { handle } = await params;
  redirect(`/people/${encodeURIComponent(handle)}`);
}
