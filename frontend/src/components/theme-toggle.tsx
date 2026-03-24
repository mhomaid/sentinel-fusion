"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light",  label: "Light",  Icon: SunIcon     },
  { value: "dark",   label: "Dark",   Icon: MoonIcon    },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render icon after mount
  useEffect(() => setMounted(true), []);

  const Icon = !mounted
    ? MoonIcon
    : resolvedTheme === "light"
    ? SunIcon
    : resolvedTheme === "dark"
    ? MoonIcon
    : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors outline-none"
        aria-label="Toggle theme"
      >
        <Icon className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[120px]">
        {THEMES.map(({ value, label, Icon: ItemIcon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-2 text-xs cursor-pointer ${
              theme === value ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <ItemIcon className="h-3.5 w-3.5" />
            {label}
            {theme === value && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
