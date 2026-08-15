import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, rateLimitSize } from './ratelimit.ts';

// Every case passes an explicit `nowMs`, so nothing here depends on the clock
// or on the order the file's tests run in — each uses its own bucket name.

test('allows up to max in a window, then refuses', () => {
  const at = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(rateLimit('t1', 'ada', 5, 10_000, at + i), true, `hit ${i}`);
  assert.equal(rateLimit('t1', 'ada', 5, 10_000, at + 5), false);
});

test('the window slides — the budget is back once the oldest hit ages out', () => {
  const at = 2_000_000;
  for (let i = 0; i < 3; i++) rateLimit('t2', 'ada', 3, 10_000, at);
  assert.equal(rateLimit('t2', 'ada', 3, 10_000, at + 9_999), false);
  assert.equal(rateLimit('t2', 'ada', 3, 10_000, at + 10_000), true);
});

test('two buckets do not share a budget — the bug a naive key ships', () => {
  const at = 3_000_000;
  for (let i = 0; i < 5; i++) rateLimit('chat', 'ada', 5, 10_000, at + i);
  assert.equal(rateLimit('chat', 'ada', 5, 10_000, at + 5), false);
  // Same handle, different route: a busy heartbeat must not silence someone.
  assert.equal(rateLimit('heartbeat', 'ada', 20, 60_000, at + 5), true);
});

test('two handles do not share a budget', () => {
  const at = 4_000_000;
  for (let i = 0; i < 5; i++) rateLimit('t4', 'ada', 5, 10_000, at + i);
  assert.equal(rateLimit('t4', 'ada', 5, 10_000, at + 5), false);
  assert.equal(rateLimit('t4', 'grace', 5, 10_000, at + 5), true);
});

test('expired keys are evicted — the map does not grow one entry per handle forever', () => {
  const at = 5_000_000;
  for (let i = 0; i < 50; i++) rateLimit('t5', `person-${i}`, 5, 10_000, at);
  const withKeys = rateLimitSize();
  assert.ok(withKeys >= 50, `expected at least 50 keys, got ${withKeys}`);

  // One call long after every window closed triggers the sweep.
  rateLimit('t5', 'ada', 5, 10_000, at + 3_600_000);
  assert.equal(rateLimitSize(), 1);
});
