'use client';

// Earned badges as a scroll rail. Native CSS scroll-snap, not a carousel
// library: this project is on @base-ui, so `shadcn add carousel` would drag in
// embla plus a second primitive stack to slide six chips.
//
// Accessibility notes, because they are the reason there is no keydown handler:
// the <ul> is one tab stop and the browser already scrolls it with
// arrows/Home/End. Overflowed chips stay in the DOM, so a screen reader reaches
// every badge — the arrow buttons are a convenience, not the only path. No
// aria-roledescription="carousel": this is a scrollable list, and mislabelling
// it promises controls that do not exist.

import { useRef } from 'react';
import { BadgeArt } from '@/components/kerf/artwork';
import type { Badge } from '@/lib/api';

/** Above this many chips the rail can overflow, so the arrows appear. */
const ARROWS_FROM = 4;
const NUDGE_PX = 160;

function Arrow({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Previous badges' : 'Next badges'}
      className="flex size-[28px] shrink-0 items-center justify-center rounded-full border border-border text-[16px] text-muted-foreground hover:text-foreground"
    >
      <span aria-hidden>{dir < 0 ? '‹' : '›'}</span>
    </button>
  );
}

export function BadgeCarousel({ badges, className }: { badges: Badge[]; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const earned = badges.filter((b) => b.earned);

  if (earned.length === 0) {
    return <span className="text-[13px] text-muted-foreground">No badges yet.</span>;
  }

  const nudge = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * NUDGE_PX, behavior: 'smooth' });
  const showArrows = earned.length >= ARROWS_FROM;

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {showArrows && <Arrow dir={-1} onClick={() => nudge(-1)} />}
      <ul
        ref={track}
        tabIndex={0}
        aria-label={`${earned.length} badge${earned.length === 1 ? '' : 's'} earned`}
        className="flex max-w-[420px] snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth rounded-[12px] outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {earned.map((b) => (
          <li
            key={b.id}
            title={b.label}
            className="flex shrink-0 snap-start items-center gap-[6px] rounded-[12px] border border-border px-[10px] py-[4px]"
          >
            <BadgeArt id={b.id} size={22} />
            <span className="whitespace-nowrap text-[13px] text-muted-foreground">{b.label}</span>
          </li>
        ))}
      </ul>
      {showArrows && <Arrow dir={1} onClick={() => nudge(1)} />}
    </div>
  );
}

/** The next badge to chase: art, the requirement, and how far along you are. */
export function BadgeProgress({ badge }: { badge: Badge }) {
  const pct = Math.round((badge.progress.have / badge.progress.need) * 100);
  return (
    <div className="flex items-center gap-5">
      <BadgeArt id={badge.id} size={64} className="shrink-0 opacity-60" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium leading-[20px] text-foreground">{badge.requirement}</p>
        <div className="mt-[12px] h-[8px] overflow-hidden rounded-[4px] bg-secondary">
          <div className="h-[8px] rounded-[4px] bg-primary" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <p className="mt-[8px] font-mono text-[13px] text-muted-foreground">
          {badge.progress.have} of {badge.progress.need}
        </p>
      </div>
    </div>
  );
}
