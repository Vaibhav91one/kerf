'use client';

// Catches a throw in the ROOT layout itself (fonts, providers) — the one place
// (app)/error.tsx can't reach, since that boundary is nested INSIDE the root
// layout. Next requires this file to render its own <html>/<body>; it replaces
// the whole tree, so it deliberately does not import globals.css or the theme
// script — if the root layout is what broke, that machinery is suspect too.

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Kerf hit an unexpected error</h1>
          <p style={{ marginTop: 8, color: '#666' }}>Reloading usually fixes it.</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
