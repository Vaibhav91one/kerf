'use client';

import Link from 'next/link';
import { CircleIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export function ConnectionStatus() {
  const { auth, ready } = useAuth();

  if (!ready) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton render={<Link href="/me" />} size="lg">
          <CircleIcon
            className={auth ? 'size-2 fill-emerald-500 text-emerald-500' : 'size-2 fill-muted-foreground text-muted-foreground'}
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{auth ? `@${auth.handle}` : 'CLI not connected'}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">{auth ? 'connected' : 'connect your CLI'}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
