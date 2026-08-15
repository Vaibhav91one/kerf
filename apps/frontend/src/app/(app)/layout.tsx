'use client';

// Shell geometry from the comps: a 260px rail, then content inset 40px with the
// page starting 42px down. No top bar — the rail is the only chrome, and each
// screen opens with its own PageHeader carrying that page's primary action.

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '260px' } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        {/* Left-aligned, not centred: the comps put the content 40px after the
            rail and cap it at 1100, which only holds if the gutter is fixed. */}
        <div className="w-full max-w-[1180px] px-10 pb-16 pt-[42px]">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
