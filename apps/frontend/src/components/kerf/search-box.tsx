'use client';

// The search input /people already had, now the one every list screen uses.
//
// `type="search"` is the platform rung: the browser draws the clear button and
// wires Escape to it, so there is no clear control to build or keep in sync.
// `role="search"` and the live region are the two a11y gaps the audit found —
// a filter that silently rewrites the list below tells a screen reader nothing.
//
// Matching stays with the caller: /people, /projects and /skills search three
// different field sets, and a shared matcher would only be a place to get one
// of them wrong.

import type { FormEvent, ReactNode } from 'react';

export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  count,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Only /people has an Enter action (jump to an exact handle). */
  onSubmit?: () => void;
  placeholder: string;
  label: string;
  /** Rows currently shown. Announced only once something has been typed. */
  count?: number;
}): ReactNode {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit?.();
  }

  return (
    <form role="search" onSubmit={submit}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-[40px] w-full max-w-[420px] rounded-[12px] border border-border bg-card px-[14px] text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
      {count !== undefined && value.trim() !== '' && (
        <p role="status" aria-live="polite" className="sr-only">
          {count} {count === 1 ? 'result' : 'results'}
        </p>
      )}
    </form>
  );
}
