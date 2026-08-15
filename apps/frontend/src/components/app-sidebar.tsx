'use client';

// Rail from `Material 3 — Platform` → every screen carries the same 260px
// sidebar (node 129:3 and its twin on the dark board).
//
// `collapsible="none"`: the rail does not collapse. The icon-only state was a
// worse version of the same navigation — glyphs with no labels, a tooltip that
// stuck open, and a footer that overflowed the 48px width — and this is a
// desktop dashboard whose every screen is a fixed two-column grid anyway. That
// also means no SidebarTrigger, no SidebarRail, no per-row tooltips (they only
// ever showed while collapsed) and no `group-data-[collapsible=icon]` classes.

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignInButton } from '@clerk/nextjs';
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
} from '@/components/ui/sidebar';
import {
  HomeIcon,
  KerfLogo,
  LiveIcon,
  PeopleIcon,
  ProjectsIcon,
  RivalsIcon,
  SeasonIcon,
  SkillsIcon,
} from '@/components/kerf/icons';
import { CliStatus } from '@/components/kerf/cli-status';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

type NavItem = { title: string; url: string; icon: typeof HomeIcon; match?: (p: string) => boolean };

const PLATFORM: NavItem[] = [
  { title: 'Home', url: '/', icon: HomeIcon },
  { title: 'Live', url: '/live', icon: LiveIcon },
  { title: 'Season', url: '/season', icon: SeasonIcon },
  { title: 'Rivals', url: '/rivals', icon: RivalsIcon },
];

const BUILD_IN_PUBLIC: NavItem[] = [
  // A project detail page keeps Projects lit, and a profile keeps People lit —
  // the comp marks People active on the public-profile screen.
  { title: 'Projects', url: '/projects', icon: ProjectsIcon, match: (p) => p.startsWith('/projects') },
  { title: 'Skills', url: '/skills', icon: SkillsIcon },
  { title: 'People', url: '/people', icon: PeopleIcon, match: (p) => p.startsWith('/people') || p.startsWith('/u/') },
];

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.url} />}
        isActive={active}
        className="h-[40px] gap-3 rounded-[10px] px-3 text-[16px] text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
      >
        <Icon size={18} />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup className="gap-0 px-3 py-0">
      <SidebarGroupLabel className="h-auto px-3 pb-[8px] text-[12px] font-semibold tracking-[0.04em] text-muted-foreground">
        {label}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-[2px]">
        {items.map((item) => (
          <NavRow
            key={item.url}
            item={item}
            active={item.match ? item.match(pathname) : pathname === item.url}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { auth, clerkEnabled } = useAuth();

  return (
    // sticky + h-svh because collapsible="none" renders a plain flex child:
    // without it the rail scrolls away with the page on a long screen.
    <Sidebar
      collapsible="none"
      className="sticky top-0 h-svh border-r border-sidebar-border"
      {...props}
    >
      <SidebarHeader className="px-3 pb-2 pt-5">
        <Link href="/" className="flex items-center gap-3 rounded-[10px] px-3 py-1">
          <KerfLogo size={32} className="shrink-0 text-primary" />
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-[21px] font-bold text-foreground">kerf</span>
            <span className="truncate text-[13px] text-muted-foreground">season 1 · points</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-[26px] px-0 pt-4">
        <NavGroup label="PLATFORM" items={PLATFORM} pathname={pathname} />
        <NavGroup label="BUILD IN PUBLIC" items={BUILD_IN_PUBLIC} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="gap-0 px-3 pb-6 pt-0">
        <div className="border-t border-sidebar-border pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <CliStatus />
          </div>
          {/* Signed in, the CliStatus row above already carries the handle and
              the avatar — a second @handle button under it said nothing new. */}
          <div className="mt-4 px-1">
            {auth ? null : clerkEnabled ? (
              <SignInButton mode="modal">
                <Button size="sm" className="w-full">
                  Sign in
                </Button>
              </SignInButton>
            ) : (
              <Button size="sm" nativeButton={false} className="w-full" render={<Link href="/me" />}>
                Sign in
              </Button>
            )}
            <Link
              href="/privacy"
              className="mt-3 block text-[13px] text-muted-foreground hover:text-foreground hover:underline"
            >
              What leaves your machine
            </Link>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
