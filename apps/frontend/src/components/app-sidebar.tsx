'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  RadioIcon,
  TrophyIcon,
  LightbulbIcon,
  FolderGitIcon,
  WrenchIcon,
  UserIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { ConnectionStatus } from '@/components/connection-status';

const platform = [
  { title: 'Home', url: '/', icon: HomeIcon },
  { title: 'Live', url: '/live', icon: RadioIcon },
  { title: 'Season', url: '/season', icon: TrophyIcon },
  { title: 'Insights', url: '/insights', icon: LightbulbIcon },
];

const buildInPublic = [
  { title: 'Projects', url: '/projects', icon: FolderGitIcon },
  { title: 'Skills', url: '/skills', icon: WrenchIcon },
  { title: 'Me', url: '/me', icon: UserIcon },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-mono font-bold">
                K
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Kerf</span>
                <span className="truncate text-xs text-sidebar-foreground/60">rework ratio league</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {platform.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton render={<Link href={item.url} />} isActive={pathname === item.url} tooltip={item.title}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Build in Public</SidebarGroupLabel>
          <SidebarMenu>
            {buildInPublic.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton render={<Link href={item.url} />} isActive={pathname === item.url} tooltip={item.title}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ConnectionStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
