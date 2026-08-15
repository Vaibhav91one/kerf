// One place for every date/duration string on the dashboard. Five screens had
// hand-rolled versions of these, two of them printing a raw ISO stamp
// ("2026-08-10T14:32") — which is a timestamp, not a readable date.
//
// Rendered with an explicit UTC time zone and a fixed locale on purpose: these
// components are server-rendered and then hydrated, and a browser-local format
// makes the two disagree.
const FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', FORMAT).format(new Date(ms));
}

export function formatDateTime(ms: number): string {
  const date = new Intl.DateTimeFormat('en-GB', FORMAT).format(new Date(ms));
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(ms));
  return `${date}, ${time}`;
}

/** A running duration: 42s · 12m 30s · 3h 05m. */
export function elapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${String(secs % 60).padStart(2, '0')}s`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/** How long ago something happened, given the gap in ms. */
export function ago(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

// ponytail: seasons are UTC calendar months and the first one is 2026-08, so
// the ordinal is derivable without a persisted season row. Swap for the
// season's own id when close-out lands (see prisma/schema.prisma header).
const FIRST_SEASON = { year: 2026, month: 7 };

export function seasonNumber(now = new Date()): number {
  return (now.getUTCFullYear() - FIRST_SEASON.year) * 12 + (now.getUTCMonth() - FIRST_SEASON.month) + 1;
}
