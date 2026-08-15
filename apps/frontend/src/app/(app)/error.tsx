'use client';

// Scoped to (app), not the root: nesting inside (app)/layout.tsx means a
// render-time throw on any dashboard page still keeps the sidebar and theme —
// the failure is contained to the content area, not the whole shell.
// Error boundaries must be client components (Next requirement).

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-[28px] font-semibold leading-[34px] text-foreground">Something went wrong</h1>
      <p className="max-w-[420px] text-[15px] leading-[20px] text-muted-foreground">
        This page hit an unexpected error. It has been logged; trying again usually fixes it.
      </p>
      <Button onClick={() => reset()} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
