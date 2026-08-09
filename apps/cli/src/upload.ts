import type { Heartbeat, SessionMetric } from '@kerf/shared';

export async function uploadMetrics(
  apiUrl: string,
  token: string,
  metrics: SessionMetric[],
): Promise<{ accepted: number; rejected: unknown[] }> {
  const res = await fetch(`${apiUrl}/api/metrics`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(metrics),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`upload failed: ${res.status} ${body}`);
  }
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
