// Root-level, not inside (app): Next renders this for any path that matches no
// layout segment at all, so it can never nest inside (app)/layout.tsx and get
// the sidebar for free — see (app)/error.tsx for the boundary that CAN.
// Self-contained but theme-correct: it still inherits the CSS variables the
// root layout puts on <html>, just not the nav.

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="font-mono text-[15px] text-primary">404</p>
      <h1 className="text-[28px] font-semibold leading-[34px] text-foreground">Page not found</h1>
      <p className="max-w-[420px] text-[15px] leading-[20px] text-muted-foreground">
        Nothing lives at this address. It may have moved, or never existed.
      </p>
      <Button nativeButton={false} render={<Link href="/" />} className="mt-2">
        Back to Kerf
      </Button>
    </div>
  );
}
