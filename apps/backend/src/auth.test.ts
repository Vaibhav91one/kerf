import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clerkConfigured, clerkPublishableKey, clerkAuth, tokenHash } from './auth.ts';

// Save and restore rather than delete-and-forget: these tests mutate real
// process env, and a leaked value would change how every later test behaves.
const KEYS = ['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, run: () => void) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(values)) process.env[k] = v;
  try {
    run();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
}

/** Minimal Response stand-in: clerkAuth only ever calls status().json(). */
function fakeRes() {
  const out: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  return { res, out };
}

test('clerkConfigured needs BOTH keys, not just the secret', () => {
  withEnv({ CLERK_SECRET_KEY: 'sk_test_x', CLERK_PUBLISHABLE_KEY: 'pk_test_x' }, () =>
    assert.equal(clerkConfigured(), true),
  );
  withEnv({ CLERK_SECRET_KEY: 'sk_test_x' }, () => assert.equal(clerkConfigured(), false));
  withEnv({ CLERK_PUBLISHABLE_KEY: 'pk_test_x' }, () => assert.equal(clerkConfigured(), false));
  withEnv({}, () => assert.equal(clerkConfigured(), false));
});

test('clerkPublishableKey accepts either name, preferring the unprefixed one', () => {
  withEnv({ CLERK_PUBLISHABLE_KEY: 'pk_a', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_b' }, () =>
    assert.equal(clerkPublishableKey(), 'pk_a'),
  );
  withEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_b' }, () => assert.equal(clerkPublishableKey(), 'pk_b'));
  withEnv({}, () => assert.equal(clerkPublishableKey(), undefined));
});

// The regression this file exists for. A secret with no publishable key means
// clerkMiddleware was never installed, so getAuth() throws and no request can
// ever authenticate. Answering 401 "not signed in" there blames the user for a
// deploy typo, identically on every request, with nothing in the logs.
test('a half-configured Clerk answers 503, never 401', () => {
  withEnv({ CLERK_SECRET_KEY: 'sk_test_x' }, () => {
    const { res, out } = fakeRes();
    let nexted = false;
    clerkAuth({} as never, res as never, (() => {
      nexted = true;
    }) as never);
    assert.equal(nexted, false);
    assert.equal(out.status, 503);
    assert.deepEqual(out.body, { error: 'clerk not configured' });
  });
});

test('fully configured but signed out is 401, not 503', () => {
  withEnv({ CLERK_SECRET_KEY: 'sk_test_x', CLERK_PUBLISHABLE_KEY: 'pk_test_x' }, () => {
    const { res, out } = fakeRes();
    // No clerkMiddleware ran on this bare object, so getAuth() throws and
    // getClerkUserId returns null — the signed-out shape.
    clerkAuth({} as never, res as never, (() => {}) as never);
    assert.equal(out.status, 401);
    assert.deepEqual(out.body, { error: 'not signed in' });
  });
});

test('tokenHash is a stable sha256 hex digest', () => {
  assert.equal(tokenHash('abc'), tokenHash('abc'));
  assert.notEqual(tokenHash('abc'), tokenHash('abd'));
  assert.match(tokenHash('abc'), /^[0-9a-f]{64}$/);
});
