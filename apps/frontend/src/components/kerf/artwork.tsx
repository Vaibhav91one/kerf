// Kerf display artwork — league crests, achievement badges and community
// avatars. These are the exact SVGs exported from the Figma masters
// (`Kerf/Asset/League/*`, `Kerf/Asset/Badge/*`, `Kerf/Asset/Avatar/*`), served
// from /public rather than inlined: they are multi-colour illustrations that
// must NOT take currentColor, and the Figma note on each is "Reusable display
// artwork; preserve aspect ratio."

import type { Tier } from '@kerf/shared';

// INVARIANT for anyone adding artwork here: every badge and league master's
// viewBox is SQUARED ON ITS OWN INK (bounding box + 7% each side), not left at
// the exporter's 512x512 canvas. Without that, `size` sizes the canvas rather
// than the drawing, and the same prop renders wildly different marks — the set
// used to range from 28% to 87% ink coverage, so `clean-run` at size 22 drew
// 6.6px of ink beside `steady-hand`'s 19.2px. Illustrations stay 320x240 and
// bleed to the frame; Illustration() reserves its box from that 4:3 ratio.

const LEAGUE_FILE: Record<Tier, string> = {
  Bronze: 'bronze',
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
  Diamond: 'diamond',
};

export function LeagueArt({ tier, size, className }: { tier: Tier; size: number; className?: string }) {
  return (
    <img
      src={`/kerf/league/${LEAGUE_FILE[tier]}.svg`}
      alt={`${tier} league`}
      width={size}
      height={size}
      className={className}
    />
  );
}

// Badge ids come from @kerf/shared's badges(). streak-3 and streak-7 share one
// piece of artwork, exactly as the Home comp shows them.
const BADGE_FILE: Record<string, string> = {
  'clean-run': 'clean-run',
  'diamond-session': 'diamond-session',
  'diamond-x5': 'diamond-x5',
  'steady-hand': 'steady-hand',
  'streak-3': 'streak',
  'streak-7': 'streak',
};

export function BadgeArt({ id, size, className }: { id: string; size: number; className?: string }) {
  const file = BADGE_FILE[id];
  if (!file) return null;
  return <img src={`/kerf/badge/${file}.svg`} alt="" width={size} height={size} className={className} />;
}

// Product illustrations. Figma note: "Preserve aspect ratio and do not add text
// inside the master" — every master is 320x240, so callers pass a width and the
// height follows from the 4:3 box.
export type IllustrationName =
  | 'empty-season'
  | 'cli-sync'
  | 'live-activity'
  | 'insights'
  | 'publish-project'
  // Live-card activity art, keyed off what a session is mostly doing.
  | 'activity-building'
  | 'activity-debugging'
  | 'activity-reading'
  | 'activity-exploring'
  // Stands in for a project's logo when it has none.
  | 'project-fallback'
  // The right half of Home's Skill of the Day card.
  | 'skill-spotlight';

export function Illustration({
  name,
  width,
  className,
}: {
  name: IllustrationName;
  width: number;
  className?: string;
}) {
  return (
    <img
      src={`/kerf/illustration/${name}.svg`}
      alt=""
      width={width}
      height={Math.round((width * 240) / 320)}
      className={className}
    />
  );
}

// The 12 illustrated identities plus the silhouette fallback. A handle with no
// dedicated portrait gets a stable one by hash, so the same person keeps the
// same face across every screen.
const AVATARS = [
  'vaibhav',
  'ada',
  'june',
  'theo',
  'mira',
  'sol',
  'rune',
  'ari',
  'noor',
  'ishan',
  'lea',
  'kai',
] as const;

export function avatarFor(handle: string | null | undefined): string {
  if (!handle) return 'fallback';
  const named = AVATARS.find((a) => a === handle.toLowerCase());
  if (named) return named;
  let hash = 0;
  for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

export function Avatar({
  handle,
  size,
  className,
}: {
  handle: string | null | undefined;
  size: number;
  className?: string;
}) {
  return (
    <img
      src={`/kerf/avatar/${avatarFor(handle)}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
