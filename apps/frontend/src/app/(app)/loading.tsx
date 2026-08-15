// Next's route-segment loading UI — applies to every page under (app) that
// doesn't define its own loading.tsx, so one file covers the whole app. The
// sidebar in (app)/layout.tsx is unaffected: this only replaces the {children}
// slot while a segment's content is being prepared.

import { ScreenLoader } from '@/components/kerf/screen-loader';

export default function Loading() {
  return <ScreenLoader />;
}
