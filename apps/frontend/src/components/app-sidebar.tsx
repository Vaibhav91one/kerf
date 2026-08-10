'use client';

// Rail from `Material 3 — Platform` → every screen carries the same 260px
// sidebar (node 129:3 and its twin on the dark board). Geometry is taken from
// the comp: 34px rows on a 34px pitch, 8px pill, 16px glyph at x=24, label at
// x=52, footer divider 104px off the bottom.

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  HomeIcon,
  InsightsIcon,
  KerfLogo,
  LiveIcon,
  PeopleIcon,
  ProjectsIcon,
  SeasonIcon,
  SkillsIcon,
} from '@/components/kerf/icons';
import { CliStatus } from '@/components/kerf/cli-status';
import { ThemeToggle } from '@/components/theme-toggle';

type NavItem = { title: string; url: string; icon: typeof HomeIcon; match?: (p: string) => boolean };

const PLATFORM: NavItem[] = [
  { title: 'Home', url: '/', icon: HomeIcon },
  { title: 'Live', url: '/live', icon: LiveIcon },
  { title: 'Season', url: '/season', icon: SeasonIcon },
  { title: 'Insights', url: '/insights', icon: InsightsIcon },
];

const BUILD_IN_PUBLIC: NavItem[] = [
  { title: 'Projects', url: '/projects', icon: ProjectsIcon },
  { title: 'Skills', url: '/skills', icon: SkillsIcon },
  // The comp marks People active on the public-profile screen, so a profile
  // route lights this row too.
  { title: 'People', url: '/people', icon: PeopleIcon, match: (p) => p.startsWith('/people') || p.startsWith('/u/') },
];

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.url} />}
        isActive={active}
        tooltip={item.title}
        className="h-[34px] gap-3 rounded-[8px] px-3 text-[14px] text-muted-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
      >
        <Icon size={16} />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.match ? item.match(pathname) : pathname === item.url);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      <SidebarHeader className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="h-auto gap-2.5 rounded-[8px] px-5 py-[22px] hover:bg-transparent"
            >
              <KerfLogo size={32} className="text-primary" />
              <div className="grid flex-1 leading-tight">
                <span className="truncate text-[18px] font-bold text-foreground">kerf</span>
                <span className="truncate text-[11px] text-muted-foreground">season 1 · rework ratio</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-0">
        <SidebarGroup className="gap-0 px-3 py-0">
          <SidebarGroupLabel className="h-auto px-2 pb-[7px] text-[10px] font-semibold tracking-normal text-foreground">
            PLATFORM
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0">
            {PLATFORM.map((item) => (
              <NavRow key={item.url} item={item} active={isActive(item)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="gap-0 px-3 pb-0 pt-[25px]">
          <SidebarGroupLabel className="h-auto px-2 pb-[7px] text-[10px] font-semibold tracking-normal text-foreground">
            BUILD IN PUBLIC
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0">
            {BUILD_IN_PUBLIC.map((item) => (
              <NavRow key={item.url} item={item} active={isActive(item)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 px-0 pb-6 pt-0">
        <div className="mx-3 border-t border-sidebar-border pt-5">
          <div className="flex items-center gap-2.5 px-2">
            <CliStatus />
          </div>
          <div className="px-1 pt-2 group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
          <p className="px-2 pt-[11px] text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
            Cmd+B collapses to the icon rail
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
