// Server wrapper around project-client.tsx — same split and same reason as
// people/[handle]/page.tsx: generateMetadata can't come from a 'use client'
// file, and every project page was 'use client' end to end, so a shared link
// unfurled to empty PageSkeleton divs.

import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProjectClient } from './project-client';

export async function generateMetadata({ params }: PageProps<'/projects/[id]'>): Promise<Metadata> {
  const { id } = await params;
  try {
    const project = await api.project(id);
    const title = `${project.name} · @${project.handle}`;
    const description = project.description ?? `${project.name}, built in public on Kerf.`;
    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    // A private or missing project still needs a title — the client
    // component renders its own "No project here" / "Could not load" states,
    // and visibleTo() means a private one 404s identically to a nonexistent
    // id here (no existence oracle in the metadata either).
    return { title: 'Project' };
  }
}

export default async function ProjectPage({ params }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  return <ProjectClient id={id} />;
}
