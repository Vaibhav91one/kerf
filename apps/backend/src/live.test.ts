import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { publish, subscribe, subscriberCount } from './live.ts';

// Each caller gets its own IP by default so tests that open many streams don't
// trip the per-IP cap by accident — only the dedicated per-IP test reuses one.
let nextIp = 0;
function fakeReq(ip: string = `10.0.0.${++nextIp}`): Request {
  return { ip } as unknown as Request;
}

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

  end(chunk?: string) {
    if (chunk) this.chunks.push(chunk);
    return this;
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
  subscribe(fakeReq(), res.asResponse());

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
  subscribe(fakeReq(), a.asResponse());
  subscribe(fakeReq(), b.asResponse());

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
  subscribe(fakeReq(), res.asResponse());
  assert.equal(subscriberCount(), before + 1);

  res.emit('close');
  assert.equal(subscriberCount(), before);

  publish({ type: 'session', data: { handle: 'ada' } });
  assert.equal(res.events().length, 0);
});

test('the 201st stream is refused with a 503 rather than attached', () => {
  const open = Array.from({ length: 200 - subscriberCount() }, () => {
    const res = new FakeRes();
    assert.equal(subscribe(fakeReq(), res.asResponse()), true);
    return res;
  });

  const refused = new FakeRes();
  assert.equal(subscribe(fakeReq(), refused.asResponse()), false);
  assert.equal(refused.status, 503);
  // Refused means detached: it must not receive the fan-out either.
  publish({ type: 'chat', data: { handle: 'ada' } });
  assert.equal(refused.events().length, 0);

  for (const res of open) res.emit('close');
});

test('the 6th stream from one IP is refused even with global capacity free', () => {
  const ip = '203.0.113.7';
  const open = Array.from({ length: 5 }, () => {
    const res = new FakeRes();
    assert.equal(subscribe(fakeReq(ip), res.asResponse()), true);
    return res;
  });

  const refused = new FakeRes();
  assert.equal(subscribe(fakeReq(ip), refused.asResponse()), false);
  assert.equal(refused.status, 503);

  // A different IP is unaffected — the cap is per-IP, not a second global one.
  const other = new FakeRes();
  assert.equal(subscribe(fakeReq(), other.asResponse()), true);

  for (const res of [...open, other]) res.emit('close');
});

test('event types stay distinct so a client can filter by listener', () => {
  const res = new FakeRes();
  subscribe(fakeReq(), res.asResponse());

  publish({ type: 'session', data: { turns: 1 } });
  publish({ type: 'session-end', data: { sessionId: 'x' } });
  publish({ type: 'project', data: { name: 'kerf' } });

  assert.deepEqual(
    res.events().map((f) => f.split('\n')[0]),
    ['event: session', 'event: session-end', 'event: project'],
  );

  res.emit('close');
});
