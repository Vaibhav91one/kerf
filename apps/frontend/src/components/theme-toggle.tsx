'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { THEME_STORAGE_KEY } from '@/components/kerf/theme-script';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

/** `iconOnly` is the top-bar shape: a square button with an accessible name. */
export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // Dark is the default (see theme-script.ts). The pre-paint script has already
  // put the right class on <html>; read it back rather than re-deciding, or the
  // two disagree for one frame and the page flashes the other palette.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
    applyTheme(next);
  }

  const label = theme === 'dark' ? 'Use light mode' : 'Use dark mode';
  const Icon = theme === 'dark' ? SunIcon : MoonIcon;

  if (iconOnly) {
    return (
      <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label} title={label}>
        <Icon />
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
      <Icon data-icon="inline-start" />
      <span>{label}</span>
    </Button>
  );
}
