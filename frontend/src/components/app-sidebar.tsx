"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  AlertTriangleIcon,
  RadioIcon,
  BarChart3Icon,
  Settings2Icon,
  CircleHelpIcon,
  BookOpenIcon,
  ShieldIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";

const NAV_MAIN = [
  { title: "Dashboard",  url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Incidents",  url: "/dashboard", icon: AlertTriangleIcon,  badge: true },
  { title: "Event Log",  url: "/dashboard", icon: RadioIcon },
  { title: "Analytics",  url: "/dashboard", icon: BarChart3Icon },
];

const NAV_SYSTEM = [
  { title: "Settings", url: "#", icon: Settings2Icon },
  { title: "API Docs",  url: "#", icon: BookOpenIcon },
  { title: "Help",      url: "#", icon: CircleHelpIcon },
];

const OPERATOR = {
  name: "Operator",
  email: "ops@sentinel-fusion.local",
  avatar: "",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-3 outline-none">
          {/* Shield icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-green-500/25 bg-green-500/10">
            <ShieldIcon className="h-4 w-4 text-green-400" />
          </div>
          {/* Name */}
          <div className="flex flex-col gap-0">
            <span className="text-[11px] font-bold tracking-[0.18em] text-green-400 uppercase">
              Sentinel
            </span>
            <span className="text-[10px] tracking-[0.28em] text-zinc-500 uppercase">
              Fusion
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* ── Main Nav ─────────────────────────────────────────────── */}
      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-1.5 text-[10px] tracking-[0.15em] text-zinc-600 uppercase">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_MAIN.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={active}
                      render={<Link href={item.url} />}
                      className="group relative h-8 gap-2.5 rounded-md px-2.5 text-[12px] tracking-wide"
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <span className="inline-flex h-4 items-center rounded-sm border border-green-500/30 bg-green-500/10 px-1.5 text-[9px] tracking-widest text-green-400 uppercase">
                          Live
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <div className="mx-2 my-3 h-px bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-1.5 text-[10px] tracking-[0.15em] text-zinc-600 uppercase">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_SYSTEM.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    render={<a href={item.url} />}
                    className="h-8 gap-2.5 rounded-md px-2.5 text-[12px] tracking-wide"
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Operator footer ───────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
        <NavUser user={OPERATOR} />
      </SidebarFooter>
    </Sidebar>
  );
}
