// Shared surfaces from the `Material 3 — Platform` comps. Every screen is built
// from these three pieces: a page header (28px title, 14px subtitle, hairline),
// a 16px-radius panel on Surface/Base, and the 260x116 stat card.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header>
      <h1 className="text-[28px] font-semibold leading-[34px] text-foreground">{title}</h1>
      {subtitle && <p className="mt-[6px] max-w-[900px] text-[14px] leading-[20px] text-muted-foreground">{subtitle}</p>}
      <hr className="mt-5 border-t border-border" />
    </header>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[10px] font-semibold leading-[13px] text-primary', className)}>{children}</p>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-[16px] border border-border bg-card px-[18px] py-5', className)}>{children}</section>;
}

/**
 * Placeholder while a screen's first fetch is in flight. The comps draw no
 * loading state, so this is deliberately the quietest thing that still holds
 * the layout: the same surfaces at the same sizes, no invented numbers.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-[28px]" aria-hidden>
      <div className="space-y-[6px]">
        <div className="h-[34px] w-[380px] rounded-[8px] bg-secondary" />
        <div className="h-[20px] w-[620px] rounded-[8px] bg-secondary/70" />
        <div className="pt-5">
          <hr className="border-t border-border" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[116px] rounded-[16px] border border-border bg-card" />
        ))}
      </div>
      <div className="h-[220px] rounded-[16px] border border-border bg-card" />
      <div className="h-[270px] rounded-[16px] border border-border bg-card" />
    </div>
  );
}

/** 260x116 metric tile — label, mono value, footnote, optional artwork at the right. */
export function StatCard({
  label,
  value,
  foot,
  art,
}: {
  label: string;
  value: ReactNode;
  foot: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="relative h-[116px] rounded-[16px] border border-border bg-card px-[18px] pt-[18px]">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-[9px] font-mono text-[28px] font-medium leading-[34px] text-foreground">{value}</p>
      <p className="mt-[10px] text-[11px] leading-[13px] text-muted-foreground">{foot}</p>
      {art && <div className="absolute right-6 top-[30px]">{art}</div>}
    </div>
  );
}
