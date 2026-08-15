// RFC 8628-style split for `kerf login`: a high-entropy DEVICE code the CLI
// polls with, and a short human-typeable USER code the terminal prints and the
// browser requires the person to type — typing it is the consent step a
// clickable link cannot supply. One secret doing both jobs (the old design) is
// phishable: an attacker's own `kerf login` link, sent to a victim, lets the
// victim's sign-in mint a token the attacker's CLI can then collect.
//
// Own file, not inline in index.ts, for the same reason as ratelimit.ts and
// visibility.ts: importing index.ts runs `app.listen()`, so pure logic that
// needs a unit test lives apart from its caller.

import { randomBytes, randomInt } from 'node:crypto';

// Crockford's base32 alphabet (already excludes the easily-confused I/L/O/U).
// randomInt, not randomBytes+modulo, so there is no modulo bias toward the low
// end of the alphabet.
const USER_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const USER_CODE_GROUP_LEN = 4;
const USER_CODE_GROUPS = 2;

export function generateDeviceCode(): string {
  return randomBytes(18).toString('base64url');
}

export function generateUserCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < USER_CODE_GROUPS; g++) {
    let group = '';
    for (let i = 0; i < USER_CODE_GROUP_LEN; i++) {
      group += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

/**
 * Normalises what a human typed for lookup: uppercase, strip everything but
 * alphanumerics, then re-insert the dash at the right spot. A stray space or a
 * missing/extra dash then can't fail a code someone otherwise typed correctly.
 */
export function normalizeUserCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (cleaned.length !== USER_CODE_GROUP_LEN * USER_CODE_GROUPS) return cleaned;
  return `${cleaned.slice(0, USER_CODE_GROUP_LEN)}-${cleaned.slice(USER_CODE_GROUP_LEN)}`;
}
