// Real-time fan-out over Server-Sent Events.
//
// ponytail: SSE + an in-process EventEmitter, not WebSockets + a broker. SSE is
// one-directional (server -> browser), which is exactly the shape of every live
// surface here — chat POSTs over plain HTTP and comes back down the stream —
// and EventSource reconnects on its own, so there is no client-side retry code
// to own. Ceiling: this fans out within ONE container. A second replica would
// only see its own events; the upgrade is Redis pub/sub behind `publish()`,
// which is why every emit in the app goes through that one function.

import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';

export type LiveEvent =
  | { type: 'session'; data: unknown }
  | { type: 'session-end'; data: unknown }
  | { type: 'chat'; data: unknown }
  | { type: 'project'; data: unknown }
  | { type: 'skill'; data: unknown };

const bus = new EventEmitter();
// One listener per connected browser; the default cap of 10 would start
// printing leak warnings at the 11th viewer, which is a normal Tuesday.
bus.setMaxListeners(0);

export function publish(event: LiveEvent): void {
  bus.emit('event', event);
}

/** Number of currently attached streams — used by /health and the live tile. */
export function subscriberCount(): number {
  return bus.listenerCount('event');
}

/**
 * Global cap, plus a per-IP cap now that index.ts sets `trust proxy` and req.ip
 * is the real client address. Global alone let one client open all 200 slots
 * and take the feed down for everyone; per-IP alone doesn't bound total memory.
 * A refused stream gets 503 rather than a hung socket — EventSource does not
 * auto-reconnect on a non-2xx, so this cannot turn into a retry storm.
 */
const MAX_STREAMS = 200;
const MAX_STREAMS_PER_IP = 5;

const streamsByIp = new Map<string, number>();

/** False when the stream was refused (503 already written). */
export function subscribe(req: Request, res: Response): boolean {
  const ip = req.ip ?? 'unknown';
  const forIp = streamsByIp.get(ip) ?? 0;
  if (subscriberCount() >= MAX_STREAMS || forIp >= MAX_STREAMS_PER_IP) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'too many live streams' }));
    return false;
  }
  streamsByIp.set(ip, forIp + 1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Zerops (and most reverse proxies) will happily buffer a streaming
    // response into uselessness without this.
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: 3000\n\n`);

  const onEvent = (event: LiveEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  };
  bus.on('event', onEvent);

  // Comment frames keep proxies and load balancers from reaping an idle stream.
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 20_000);

  res.on('close', () => {
    clearInterval(keepAlive);
    bus.off('event', onEvent);
    const remaining = (streamsByIp.get(ip) ?? 1) - 1;
    if (remaining <= 0) streamsByIp.delete(ip);
    else streamsByIp.set(ip, remaining);
  });
  return true;
}
