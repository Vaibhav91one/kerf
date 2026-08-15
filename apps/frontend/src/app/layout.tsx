import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import Script from 'next/script';
import { SUSE, SUSE_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { themeScript } from '@/components/kerf/theme-script';

const suse = SUSE({
  variable: '--font-suse',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

// next/font has no metric overrides for SUSE Mono, so it cannot synthesise a
// size-adjusted fallback and warns on every compile. Declaring the stack and
// turning the synthesis off is the actual fix — the fallback below is what
// renders during the swap.
const suseMono = SUSE_Mono({
  variable: '--font-suse-mono',
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Kerf',
  description: 'Competitive league for coding-agent CLI users.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const app = (
    <AuthProvider disabled={!clerkKey}>
      <TooltipProvider>{children}</TooltipProvider>
      {/* Bottom-right confirmations for actions that otherwise change nothing
          visible — starring, copying, publishing. */}
      <Toaster />
    </AuthProvider>
  );

  return (
    <html lang="en" className={`${suse.variable} ${suseMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so the stored theme is on <html> for the first
            frame. `id` + beforeInteractive is what stops React warning about a
            component-rendered <script> that would never execute on the client. */}
        <Script id="kerf-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        {clerkKey ? <ClerkProvider publishableKey={clerkKey}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
