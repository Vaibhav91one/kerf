// One sliding-window limiter for every mutating route.
//
// It lives in its own file rather than beside its first caller because
// importing index.ts runs `app.listen`, so the chat limiter it grew out of
// could not be unit-tested at all. `nowMs` is a parameter for the same reason:
// the test needs no clock mocking.
//
// ponytail: one Map, one process, counts per replica — N containers allow N ×
// max. Swap this body for a Redis counter at the same call sites when the app
// runs on more than one instance; every caller already goes through here.

const buckets = new Map<string, { hits: number[]; windowMs: number }>();

/** Full pass at most this often — eviction is amortised, not per-request. */
const SWEEP_EVERY_MS = 60_000;
let lastSweepMs = 0;

/**
 * Drops keys whose window has run out. Without it the map grows one entry per
 * handle per bucket and never shrinks, every one of them a budget that expired
 * minutes ago — the leak the chat limiter this replaces actually had.
 */
function sweep(nowMs: number): void {
  if (nowMs - lastSweepMs < SWEEP_EVERY_MS) return;
  lastSweepMs = nowMs;
  for (const [key, entry] of buckets) {
    const newest = entry.hits[entry.hits.length - 1];
    if (newest === undefined || nowMs - newest >= entry.windowMs) buckets.delete(key);
  }
}

/**
 * True if this call is within budget (and records it), false if it is over.
 *
 * `bucket` keeps each route's budget separate: chat and heartbeat share a
 * handle but must not share a counter, or a busy `kerf live` would silence
 * someone in the room.
 */
export function rateLimit(
  bucket: string,
  handle: string,
  max: number,
  windowMs: number,
  nowMs: number = Date.now(),
): boolean {
  const key = `${bucket}:${handle}`;
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => nowMs - t < windowMs);
  const allowed = hits.length < max;
  if (allowed) hits.push(nowMs);
  buckets.set(key, { hits, windowMs });
  sweep(nowMs);
  return allowed;
}

/** Live key count — only so a test can prove the sweep actually evicts. */
export function rateLimitSize(): number {
  return buckets.size;
}
