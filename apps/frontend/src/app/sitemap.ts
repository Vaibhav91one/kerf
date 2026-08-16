import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-2cf9-3000.prg1.zerops.app';

const STATIC_ROUTES = ['/', '/live', '/season', '/people', '/projects', '/skills', '/privacy', '/docs'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
  }));

  // Best-effort: the sitemap is a discovery aid, not a page render — a
  // backend hiccup here should produce a shorter sitemap, never a 500.
  try {
    const { profiles } = await api.profiles();
    for (const p of profiles) {
      entries.push({ url: `${SITE_URL}/people/${encodeURIComponent(p.handle)}`, lastModified: new Date(p.createdAtMs) });
    }
  } catch {
    // omitted
  }
  try {
    const { projects } = await api.projects();
    for (const proj of projects) {
      entries.push({
        url: `${SITE_URL}/projects/${encodeURIComponent(proj.id)}`,
        lastModified: new Date(proj.createdAtMs),
      });
    }
  } catch {
    // omitted
  }

  return entries;
}
