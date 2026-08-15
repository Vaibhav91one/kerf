'use client';

// Nothing in this app pushes a score. `POST /api/metrics` publishes only
// `session-end`, and only for sessions that already had a live tile, so before
// this hook every number on every screen — points, rank, session count, season
// standing, badges — was fetched once on mount and never again. A tab left open
// while you worked showed the state of the world when you opened it.
//
// Two things come from one timer on purpose. A screen that refetches needs a
// clock that also moves, or "last beat 4s ago" freezes beside a number that
// just changed, and the page looks more broken than before it refreshed.

import { useEffect, useState } from 'react';

/**
 * 30s, not 15s. `CliStatus` and `/live` poll at 15s because they track a
 * heartbeat; these screens show league standings, which move on the order of a
 * session. Halving the request rate costs nothing anyone can perceive.
 *
 * ponytail: polling, not push. The upgrade is publishing a `metrics` SSE event
 * and applying it client-side — worth it when a screen needs sub-second
 * freshness, which none of these do.
 */
export const REFRESH_MS = 30_000;

/**
 * A counter that increments every `intervalMs`. Add it to a fetching effect's
 * dependency array and the effect re-runs on each tick — no restructuring of
 * the fetch itself, which is why this is a counter rather than a callback
 * registry.
 *
 * `nowMs` starts null and is set in an effect rather than read during render:
 * `Date.now()` in a render body is impure and makes hydrated markup disagree
 * with the server's. Every consumer already guards on the null.
 */
export function useRefresh(intervalMs: number = REFRESH_MS): { tick: number; nowMs: number | null } {
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
      setTick((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { tick, nowMs };
}
