// One empty state for the whole app: centred illustration, then the line.
//
// Deliberately NOT a Panel — every caller already sits inside one, and wrapping
// here would double the border. Deliberately not adopted everywhere either: an
// EmptyState forced into a <td colSpan> or an overflow-y-auto rail is how a
// shared component turns into a liability. See the comments at the sites that
// kept their plain <p>.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Illustration, type IllustrationName } from '@/components/kerf/artwork';

export function EmptyState({
  illustration,
  title,
  children,
  action,
  className,
}: {
  illustration: IllustrationName;
  title: string;
  /** One sentence. ReactNode because two callers need a <Link> or an interpolated term. */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <Illustration name={illustration} width={160} />
      <p className="mt-[14px] text-[16px] font-medium leading-[20px] text-foreground">{title}</p>
      {children && (
        <p className="mt-[6px] max-w-[360px] text-[14px] leading-[18px] text-muted-foreground">{children}</p>
      )}
      {action && <div className="mt-[14px]">{action}</div>}
    </div>
  );
}
