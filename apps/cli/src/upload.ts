import type { Heartbeat, SessionMetric } from '@kerf/shared';

/**
 * The server refuses an array over 1000 with a 413, so a whole corpus cannot go
 * up in one request. Chunked at 500 — half the cap, so the limit can be lowered
 * without a CLI release — and the results are summed back into the one shape
 * the caller prints.
 */
const CHUNK = 500;

export async function uploadMetrics(
  apiUrl: string,
  token: string,
  metrics: SessionMetric[],
): Promise<{ accepted: number; rejected: unknown[] }> {
  let accepted = 0;
  const rejected: unknown[] = [];

  for (let i = 0; i < metrics.length; i += CHUNK) {
    const res = await fetch(`${apiUrl}/api/metrics`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(metrics.slice(i, i + CHUNK)),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`upload failed: ${res.status} ${body}`);
    }
    const page = (await res.json()) as { accepted: number; rejected: unknown[] };
    accepted += page.accepted;
    rejected.push(...page.rejected);
  }

  return { accepted, rejected };
}

/**
 * §7.4's commit half of the season floor — one integer per UTC month,
 * replacing whatever the server already had for that month (see git.ts's
 * header for why replace-not-increment is what makes re-running this safe).
 * Same shape as uploadMetrics's `{accepted, rejected}` even though a sync
 * only ever sends 1-2 months at a time — no separate response type to learn.
 */
export async function uploadCommits(
  apiUrl: string,
  token: string,
  counts: { monthStartMs: number; commits: number }[],
): Promise<{ accepted: number; rejected: unknown[] }> {
  const res = await fetch(`${apiUrl}/api/commits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(counts),
  });
  if (!res.ok) throw new Error(`commit upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { accepted: number; rejected: unknown[] };
}

/**
 * One live beat for one in-flight session. Carries the same numbers-only shape
 * as a SessionMetric — a viewer learns that work is happening and how it is
 * going, never what it is about.
 */
export async function sendHeartbeat(apiUrl: string, token: string, beat: Heartbeat): Promise<void> {
  const res = await fetch(`${apiUrl}/api/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(beat),
  });
  if (!res.ok) throw new Error(`heartbeat failed: ${res.status} ${await res.text()}`);
}
