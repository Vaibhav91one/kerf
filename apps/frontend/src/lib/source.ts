// The page-tree/search loader for /docs, built from content/docs/*.mdx.
// Nothing here reads from a transcript or the database — it's a static
// content source compiled at build time, same as the rest of the docs site.
import { defineDocs } from 'fumadocs-mdx/macro';
import { loader } from 'fumadocs-core/source';

const docs = defineDocs({
  dir: 'content/docs',
});

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
