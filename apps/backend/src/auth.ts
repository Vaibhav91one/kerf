import { createHash } from 'node:crypto';
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
export type AuthedRequest = Request & { handle?: string };

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
  const profile = await prisma.profile.findUnique({
    where: { tokenHash: tokenHash(provided) },
    select: { handle: true },
  });
  if (!profile) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  req.handle = profile.handle;
  next();
}

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
