// Static full-text search over content/docs/*.mdx, indexed at build time.
// Self-contained in the frontend — no call to apps/backend, no new data
// leaves anyone's machine, this only searches already-public doc pages.
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source, {
  language: 'english',
});
