"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SatelliteIcon } from "lucide-react";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/incidents": "Incidents",
  "/events": "Event Log",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

/** Minimal SSE connection probe — just tracks whether EventSource is OPEN */
function useSSEStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    const src = new EventSource(`${API_BASE}/api/stream`);

    const onOpen  = () => setConnected(true);
    const onError = () => setConnected(false);

    src.addEventListener("open",  onOpen);
    src.addEventListener("error", onError);
    src.addEventListener("heartbeat", onOpen); // treat any heartbeat as alive

    return () => {
      src.removeEventListener("open",  onOpen);
      src.removeEventListener("error", onError);
      src.removeEventListener("heartbeat", onOpen);
      src.close();
    };
  }, []);

  return connected;
}

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {time}
    </span>
  );
}

export function SiteHeader() {
  const pathname   = usePathname();
  const connected  = useSSEStatus();
  const title      = ROUTE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="flex h-[--header-height] shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[--header-height]">
      <div className="flex w-full items-center gap-2 px-4 lg:gap-3 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />

        {/* Page title */}
        <h1 className="font-mono text-sm font-semibold tracking-wide text-foreground">
          {title}
        </h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Live clock */}
        <LiveClock />

        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />

        {/* ADS-B live feed badge */}
        <div className="flex items-center gap-1.5">
          <SatelliteIcon className="h-3 w-3 text-cyan-400" />
          <Badge
            variant="outline"
            className="h-5 px-2 font-mono text-[10px] tracking-wider border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
          >
            ADS-B LIVE
          </Badge>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />

        {/* SSE connection status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full transition-colors ${
              connected
                ? "bg-green-500 sf-status-dot"
                : "bg-zinc-600"
            }`}
          />
          <Badge
            variant="outline"
            className={`h-5 px-2 font-mono text-[10px] tracking-wider transition-colors ${
              connected
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-zinc-700 bg-transparent text-zinc-600"
            }`}
          >
            {connected ? "STREAM LIVE" : "CONNECTING"}
          </Badge>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
