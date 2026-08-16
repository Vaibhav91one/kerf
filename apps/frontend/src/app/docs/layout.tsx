// /docs lives outside the (app) route group entirely, with its own chrome —
// see CLAUDE.md's "Chrome" section: the dashboard's 260px rail is the only
// chrome THERE, and Fumadocs' DocsLayout brings a full sidebar/nav of its
// own that would collide with it rather than nest inside it. Real platforms
// run /docs as a distinctly-chromed subsection (Stripe, Vercel) rather than
// squeezing a second nav into the product shell, so this does the same.
//
// RootProvider wraps only {children} here, NOT <html>/<body> — the app's
// root layout (src/app/layout.tsx) already owns those (fonts, theme script,
// ClerkProvider) and must keep doing so. RootProvider is a context provider,
// not a DOM requirement, so nesting it one level down is enough.
import './docs.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <RootProvider>
      <DocsLayout tree={source.pageTree} {...baseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
