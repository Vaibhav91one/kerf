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

export function getClerkUserId(req: Request): string | null {
  if (!process.env.CLERK_SECRET_KEY) return null;
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
    res.status(process.env.CLERK_SECRET_KEY ? 401 : 503).json({
      error: process.env.CLERK_SECRET_KEY ? 'not signed in' : 'clerk not configured',
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
