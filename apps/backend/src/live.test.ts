import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { publish, subscribe, subscriberCount } from './live.ts';

// Minimal stand-in for an Express Response: enough surface for the SSE hub,
// none of the rest. ponytail: a fake beats booting a server to test a writer.
class FakeRes extends EventEmitter {
  headers: Record<string, string> | null = null;
  status = 0;
  chunks: string[] = [];

  writeHead(status: number, headers: Record<string, string>) {
    this.status = status;
    this.headers = headers;
    return this;
  }

  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }

  /** Frames excluding the `retry:` preamble and `: ping` keep-alives. */
  events(): string[] {
    return this.chunks.filter((c) => c.startsWith('event: '));
  }

  asResponse(): Response {
    return this as unknown as Response;
  }
}

test('subscribe sends SSE headers and a reconnect hint', () => {
  const res = new FakeRes();
  subscribe(res.asResponse());

  assert.equal(res.status, 200);
  assert.equal(res.headers?.['Content-Type'], 'text/event-stream');
  // Without this, a buffering proxy turns a live stream into a slow download.
  assert.equal(res.headers?.['X-Accel-Buffering'], 'no');
  assert.match(res.chunks[0], /^retry: \d+/);

  res.emit('close');
});

test('publish fans out to every subscriber in SSE frame format', () => {
  const a = new FakeRes();
  const b = new FakeRes();
  subscribe(a.asResponse());
  subscribe(b.asResponse());

  publish({ type: 'chat', data: { handle: 'ada', body: 'shipping' } });

  for (const res of [a, b]) {
    assert.equal(res.events().length, 1);
    assert.equal(res.events()[0], 'event: chat\ndata: {"handle":"ada","body":"shipping"}\n\n');
  }

  a.emit('close');
  b.emit('close');
});

test('closing a stream detaches its listener — no leak, no write-after-close', () => {
  const before = subscriberCount();
  const res = new FakeRes();
  subscribe(res.asResponse());
  assert.equal(subscriberCount(), before + 1);

  res.emit('close');
  assert.equal(subscriberCount(), before);

  publish({ type: 'session', data: { handle: 'ada' } });
  assert.equal(res.events().length, 0);
});

test('event types stay distinct so a client can filter by listener', () => {
  const res = new FakeRes();
  subscribe(res.asResponse());

  publish({ type: 'session', data: { turns: 1 } });
  publish({ type: 'session-end', data: { sessionId: 'x' } });
  publish({ type: 'project', data: { name: 'kerf' } });

  assert.deepEqual(
    res.events().map((f) => f.split('\n')[0]),
    ['event: session', 'event: session-end', 'event: project'],
  );

  res.emit('close');
});
