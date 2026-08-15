'use client';

// shadcn's Sonner wrapper, minus next-themes: this app stores its theme in
// localStorage and applies it as a `dark` class on <html> (theme-script.ts), so
// the toaster reads that instead of a provider that does not exist here.

import { useEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { THEME_STORAGE_KEY } from '@/components/kerf/theme-script';

export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Read the class the pre-paint script already set, and follow it if the user
  // flips the toggle while a toast is on screen.
  useEffect(() => {
    const read = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const onStorage = (e: StorageEvent) => e.key === THEME_STORAGE_KEY && read();
    window.addEventListener('storage', onStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      expand
      duration={5000}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': '12px',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
