'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('kerf.theme');
    const next = stored === 'light' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('kerf.theme', next);
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
