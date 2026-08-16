// Shared Fumadocs layout options for /docs — kept in its own file per the
// framework's convention (would also feed a docs-only top nav if one is
// added later), branded with Kerf's own mark instead of the Fumadocs default.
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { KerfLogo } from '@/components/kerf/icons';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <KerfLogo size={20} />
          <span>kerf docs</span>
        </>
      ),
      url: '/',
    },
  };
}
