import { createHash } from 'node:crypto';
import { getAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './db.ts';

// Tokens are stored as sha256 digests, never in the clear: a DB dump must not
// be a ring of keys. Lookup is by digest, so there is no secret-dependent
// comparison left to time — the constant-time compare this file used to do
// became unnecessary the moment the plaintext token stopped being stored.
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// The authenticated handle rides on the request. Declared here rather than in a
// global .d.ts so the coupling stays visible at the point of use.
export type AuthedRequest = Request & { handle?: string; clerkUserId?: string };
export type KerfRole = 'public' | 'member' | 'clerk-session';

function readBearer(req: Request): string | null {
  const parts = (req.header('authorization') ?? '').split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return null;
  return parts[1];
}

/** Requires a valid token; attaches `req.handle`. */
export async function bearerAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const provided = readBearer(req);
  if (!provided) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }

  const hash = tokenHash(provided);
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { handle: true },
  });
  if (apiToken) {
    req.handle = apiToken.handle;
    next();
    return;
  }

  // Backwards compatibility for tokens issued before `api_tokens` existed.
  const profile = await prisma.profile.findUnique({
    where: { tokenHash: hash },
    select: { handle: true },
  });
  if (profile) {
    req.handle = profile.handle;
    next();
    return;
  }

  // Browser requests use Clerk session JWTs. `clerkMiddleware()` is installed
  // in index.ts when CLERK_SECRET_KEY exists; in local/offline test runs this
  // branch simply falls through to the normal 401.
  const clerk = getClerkUserId(req);
  if (clerk) {
    const clerkProfile = await prisma.profile.findUnique({
      where: { clerkUserId: clerk },
      select: { handle: true },
    });
    if (clerkProfile) {
      req.handle = clerkProfile.handle;
      req.clerkUserId = clerk;
      next();
      return;
    }
    res.status(401).json({ error: 'profile required' });
    return;
  }

  res.status(401).json({ error: 'invalid token' });
}

/** The publishable key, under either name. Exported so index.ts installs the
 *  middleware from exactly the value this module tests for. */
export function clerkPublishableKey(): string | undefined {
  return process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

/**
 * Clerk is usable only when BOTH keys are present, because that is the exact
 * condition under which index.ts installs `clerkMiddleware`.
 *
 * Gating on the secret alone is the trap this replaces: with a secret and no
 * publishable key the middleware is never installed, so `getAuth()` throws, the
 * catch below swallows it, and a signed-in user is told "not signed in" — a
 * config typo presenting as a user error, identically on every request, forever.
 * One key missing now answers 503 "clerk not configured", which is true.
 */
export function clerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && clerkPublishableKey());
}

/**
 * Origins Clerk will accept a session token as issued for. Without this, any
 * site holding a valid Clerk session JWT for this instance — not just our own
 * frontend — can present it here and clerkMiddleware will accept it; a wildcard
 * CORS origin (index.ts) makes that a real reachable path, not a theoretical
 * one. Comma-separated, e.g. "https://kerf.example.com,https://staging.kerf.example.com".
 */
export function clerkAuthorizedParties(): string[] | undefined {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES;
  if (!raw) return undefined;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function getClerkUserId(req: Request): string | null {
  if (!clerkConfigured()) return null;
  try {
    const auth = getAuth(req);
    return auth.isAuthenticated ? auth.userId : null;
  } catch {
    return null;
  }
}

/** Requires a Clerk browser session; attaches `req.clerkUserId`. */
export function clerkAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const clerkUserId = getClerkUserId(req);
  if (!clerkUserId) {
    const configured = clerkConfigured();
    res.status(configured ? 401 : 503).json({
      error: configured ? 'not signed in' : 'clerk not configured',
    });
    return;
  }
  req.clerkUserId = clerkUserId;
  next();
}

// RBAC names used by route declarations. `requireMember` accepts either a
// browser Clerk session already linked to a profile or a Kerf CLI/API token.
// `requireClerkSession` is only for browser account lifecycle endpoints.
export const requireMember = bearerAuth;
export const requireClerkSession = clerkAuth;

/**
 * Seeds the account named by KERF_TOKEN/KERF_HANDLE so the existing single-user
 * CLI setup keeps working after the move to per-account tokens.
 * ponytail: idempotent upsert at boot beats a migration script for one row.
 */
export async function seedEnvProfile(): Promise<string | null> {
  const token = process.env.KERF_TOKEN;
  if (!token) return null;
  const handle = process.env.KERF_HANDLE ?? 'me';
  const hash = tokenHash(token);
  await prisma.profile.upsert({
    where: { handle },
    create: { handle, displayName: handle, tokenHash: hash },
    update: { tokenHash: hash },
  });
  return handle;
}
