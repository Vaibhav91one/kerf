// One spinner for the whole app. `currentColor`, so it inherits whatever it is
// placed in — inside a primary button it is the button's foreground, inside
// muted text it is muted, with no per-site colour prop to get wrong.

import { cn } from '@/lib/utils';

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn('animate-spin motion-reduce:animate-none', className)}
    >
      {/* The track is the same stroke at low opacity, so the arc reads as a
          gap in a ring rather than a floating comma. */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Spinner plus a line of text, for a panel that has nothing to show yet. */
export function LoadingRow({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 text-[15px] text-muted-foreground', className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
