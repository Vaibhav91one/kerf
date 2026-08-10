'use client';

// Both comps ship a light and a dark board but neither draws a switcher, so the
// control lives in the sidebar footer where it disturbs the designed layout
// least. Default is the OS preference; an explicit choice is remembered.
// ponytail: 30 lines and a class on <html> — next-themes solves a problem
// (SSR-safe multi-theme, system listeners) this app does not have.

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/components/kerf/theme-script';

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={dark ?? false}
      className="grid size-7 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {/* Inline so the glyph follows currentColor like every other icon here. */}
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4.2" fill="currentColor" />
            <path
              d="M12 2.5v2.6M12 18.9v2.6M4.3 4.3l1.9 1.9M17.8 17.8l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.3 19.7l1.9-1.9M17.8 6.2l1.9-1.9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z"
            fill="currentColor"
          />
        )}
      </svg>
    </button>
  );
}
