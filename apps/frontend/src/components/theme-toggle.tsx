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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  // The pre-paint script in the root layout has already put the right class on
  // <html>; read it back rather than re-deciding, or the two disagree for one
  // frame and the page flashes the other palette.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
    applyTheme(next);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
      {theme === 'dark' ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
      <span>{theme === 'dark' ? 'Use light mode' : 'Use dark mode'}</span>
    </Button>
  );
}
