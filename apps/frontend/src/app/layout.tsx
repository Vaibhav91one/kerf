import type { Metadata } from 'next';
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
  return (
    <html lang="en" className={`${suse.variable} ${suseMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
