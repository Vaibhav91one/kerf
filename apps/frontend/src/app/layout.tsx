import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { SUSE, SUSE_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { TooltipProvider } from '@/components/ui/tooltip';

const suse = SUSE({
  variable: '--font-suse',
  subsets: ['latin'],
  display: 'swap',
});

const suseMono = SUSE_Mono({
  variable: '--font-suse-mono',
  subsets: ['latin'],
  display: 'swap',
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
    </AuthProvider>
  );

  return (
    <html lang="en" className={`${suse.variable} ${suseMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {clerkKey ? <ClerkProvider publishableKey={clerkKey}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
