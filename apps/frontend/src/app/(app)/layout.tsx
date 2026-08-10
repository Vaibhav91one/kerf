'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/live': 'Live',
  '/season': 'Season',
  '/insights': 'Insights',
  '/people': 'People',
  '/projects': 'Projects',
  '/skills': 'Skills',
  '/me': 'Me',
};

function titleFor(pathname: string): string {
  if (pathname.startsWith('/people/')) return `@${pathname.slice('/people/'.length)}`;
  if (pathname.startsWith('/u/')) return `@${pathname.slice(3)}`;
  return TITLES[pathname] ?? 'Kerf';
}

export default function AppLayout({ children }: LayoutProps<'/'>) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <h1 className="text-sm font-semibold tracking-tight">{titleFor(pathname)}</h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 xl:p-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
