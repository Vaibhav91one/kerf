// Shared surfaces from the `Material 3 — Platform` comps. Every screen is built
// from these three pieces: a page header (28px title, 14px subtitle, hairline),
// a 16px-radius panel on Surface/Base, and the 260x116 stat card.

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { formatSkillLabel } from '@kerf/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckIcon, CopyIcon } from '@/components/kerf/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Copies `text` and says so for a moment. The timer is cleared on unmount and
 * the clipboard rejection is caught — `writeText` throws outside a secure
 * origin, and an unhandled rejection there is a console error for the user.
 *
 * Icon only, so `label` stops being visible text and becomes the accessible
 * name: the tooltip on hover, the aria-label for anyone tabbing to it. Three of
 * these in one CommandBlock would otherwise all announce "Copy", which is why
 * CommandBlock passes the command itself.
 *
 * `size="icon-sm"` is 28px; plain `icon` is 32px and reflows CommandBlock's row.
 */
export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={label}
            className={className}
            onClick={() => {
              void navigator.clipboard
                .writeText(text)
                .then(() => {
                  // The icon flipping to a check + the tooltip reading "Copied"
                  // for 1500ms IS the confirmation — no toast. A toast here used
                  // to echo `text` into its description, which is fine for a
                  // short command but dumped a whole skill's markdown into a
                  // 5s-wide notification when `text` was a skill's content.
                  setCopied(true);
                  timer.current = setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => toast.error('Could not copy — the clipboard needs a secure origin'));
            }}
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </Button>
        }
      />
      <TooltipContent>{copied ? 'Copied' : label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A block of shell commands with a copy button. `lines` are [command, comment]
 * pairs — only the command is copied, never the padded comment.
 */
export function CommandBlock({ lines, className }: { lines: [string, string?][]; className?: string }) {
  return (
    <div className={cn('rounded-[16px] border border-border px-5 py-[14px]', className)}>
      {lines.map(([cmd, note]) => (
        <div key={cmd} className="flex items-center gap-3 py-[3px]">
          <p className="min-w-0 flex-1 truncate font-mono text-[15px] leading-[26px] text-muted-foreground">
            {cmd}
            {note && <span className="text-muted-foreground/70">{`  ${note}`}</span>}
          </p>
          {/* The command, not "Copy": three icon buttons in one block need
              three different accessible names. */}
          <CopyButton text={cmd} label={`Copy ${cmd}`} className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** `action` is the page's primary control, sitting on the heading row. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[32px] font-semibold leading-[40px] text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-[6px] max-w-[900px] text-[16px] leading-[23px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[12px] font-semibold leading-[16px] text-primary', className)}>{children}</p>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-[16px] border border-border bg-card px-[18px] py-5', className)}>{children}</section>;
}

/**
 * One usage row: label, count, and a bar as a fraction of the panel's peak.
 *
 * It calls `formatSkillLabel` itself, which is the whole reason it is one
 * component: the two copies this replaced formatted their labels differently —
 * one stripped `skill:` by hand before formatting, the other printed
 * `plugin_figma_figma` raw. `badge` rides beside the label (the MCP chip);
 * `onClick` turns the row into a button that opens the skill sheet; `action`
 * rides on the count side so a per-row control needs no second row.
 */
export function SkillBar({
  name,
  count,
  max,
  badge,
  onClick,
  action,
  className,
}: {
  name: string;
  count: number;
  max: number;
  badge?: ReactNode;
  onClick?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate text-[15px] text-muted-foreground">{formatSkillLabel(name)}</span>
          {badge}
        </span>
        <span className="shrink-0 font-mono text-[15px] text-muted-foreground">{count}</span>
      </div>
      {/* overflow-hidden: a count above `max` (a per-tab peak can be exceeded
          mid-refresh) would otherwise paint the fill outside its track. */}
      <div className="mt-[9px] h-[8px] overflow-hidden rounded-[4px] bg-secondary">
        <div
          className="h-[8px] rounded-[4px] bg-primary"
          style={{ width: `${Math.min(100, Math.max(4, (count / max) * 100))}%` }}
        />
      </div>
    </>
  );
  const row = onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  ) : (
    <div>{body}</div>
  );

  // `action` sits outside the button — a control nested inside a button is not
  // clickable, and the sheet would open behind it.
  return (
    <div className={cn('mt-[10px] flex items-start gap-3 first:mt-0', className)}>
      <div className="min-w-0 flex-1">{row}</div>
      {action && <div className="shrink-0 pt-[2px]">{action}</div>}
    </div>
  );
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
        <div className="h-[40px] w-[380px] rounded-[8px] bg-secondary" />
        <div className="h-[23px] w-[620px] rounded-[8px] bg-secondary/70" />
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

/**
 * A setting or destination: label, one line of copy, then a large control that
 * fills the card's width. StatCard's value slot is a 32px mono number and has
 * nowhere to put a button, which is why this is its own thing.
 */
export function ActionCard({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex min-h-[190px] flex-col rounded-[16px] border border-border bg-card px-[18px] py-[18px]">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-[10px] text-[14px] leading-[18px] text-muted-foreground">{children}</p>
      <div className="mt-auto pt-[18px] [&>*]:w-full">{action}</div>
    </div>
  );
}

/**
 * 260x116 metric tile — label, mono value, footnote, optional artwork at right.
 * Currently unused: its last caller was the empty-season screen, deleted when
 * Home stopped short-circuiting. Kept because it is a `Material 3 — Platform`
 * comp shape that PageSkeleton still mirrors, and the next stats surface wants
 * exactly this. Delete both if that never arrives.
 */
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
    <div className="relative min-h-[116px] rounded-[16px] border border-border bg-card px-[18px] pt-[18px]">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-[9px] font-mono text-[32px] font-medium leading-[40px] text-foreground">{value}</p>
      <p className="mt-[10px] text-[13px] leading-[16px] text-muted-foreground">{foot}</p>
      {art && <div className="absolute right-6 top-[30px]">{art}</div>}
    </div>
  );
}
