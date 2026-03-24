"use client";

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  RadioIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  ActivityIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSSE } from "@/hooks/useSSE";
import type { Incident } from "@/types/incident";

/* ── Types ─────────────────────────────────────────────────────────────── */

type LiveEntry =
  | { kind: "incident_created"; incident: Incident; ts: Date }
  | { kind: "incident_updated"; incident: Incident; ts: Date }
  | { kind: "heartbeat"; ts: Date };

const MAX_ENTRIES = 500;

const EVENT_TYPE_COLORS: Record<string, string> = {
  DETECTION: "border-red-500/40 bg-red-500/10 text-red-400",
  SIGNAL:    "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  TELEMETRY: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  STATUS:    "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-400",
  HIGH:     "border-orange-500/40 bg-orange-500/10 text-orange-400",
  MEDIUM:   "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  LOW:      "border-zinc-600/40 bg-zinc-800/40 text-zinc-400",
};

/* ── Component ─────────────────────────────────────────────────────────── */

export default function EventLogPage() {
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | "created" | "updated">("all");
  const pausedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  pausedRef.current = paused;

  /* Subscribe to SSE events */
  useSSE({
    incident_created: (data) => {
      if (pausedRef.current) return;
      const incident = (data as { incident: Incident }).incident;
      const entry: LiveEntry = { kind: "incident_created", incident, ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    },
    incident_updated: (data) => {
      if (pausedRef.current) return;
      const incident = (data as { incident: Incident }).incident;
      const entry: LiveEntry = { kind: "incident_updated", incident, ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    },
    heartbeat: () => {
      if (pausedRef.current) return;
      const entry: LiveEntry = { kind: "heartbeat", ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    },
  });

  /* Auto-scroll to top (newest first) */
  useEffect(() => {
    if (autoScroll && !paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll, paused]);

  const visible = entries.filter((e) => {
    if (filter === "created") return e.kind === "incident_created";
    if (filter === "updated") return e.kind === "incident_updated";
    return true;
  });

  const incidentEntries = entries.filter(
    (e) => e.kind === "incident_created" || e.kind === "incident_updated"
  );

  return (
    <div className="flex flex-col gap-6 p-5">

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${paused ? "bg-zinc-600" : "bg-green-500 sf-status-dot"}`} />
          <span className="text-sm font-semibold">
            {paused ? "PAUSED" : "LIVE STREAM"}
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {incidentEntries.length} events captured
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Filter toggles */}
          <div className="flex gap-1">
            {(["all", "created", "updated"] as const).map((f) => (
              <Toggle
                key={f}
                size="sm"
                pressed={filter === f}
                onPressedChange={() => setFilter(f)}
                className={`h-6 rounded-sm border px-2 text-[10px] uppercase tracking-wider ${
                  filter === f
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-zinc-800 text-zinc-500"
                }`}
              >
                {f}
              </Toggle>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 border-zinc-800 px-2 text-[11px]"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <PlayIcon className="h-3 w-3" /> : <PauseIcon className="h-3 w-3" />}
            {paused ? "Resume" : "Pause"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 border-zinc-800 px-2 text-[11px]"
            onClick={() => setEntries([])}
          >
            <TrashIcon className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>

      {/* Stream table */}
      <div className="rounded-lg border border-zinc-800 bg-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <ActivityIcon className="h-8 w-8 opacity-30" />
            <p className="text-sm">Waiting for events…</p>
            <p className="text-xs">
              {paused
                ? "Stream is paused. Click Resume to continue."
                : "Start the backend simulator to generate events."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 w-36">Time</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 w-28">Event</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Title</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Severity</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Sensor types</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Sources</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 w-32">Location</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 w-20">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((entry, idx) => {
                if (entry.kind === "heartbeat") {
                  return (
                    <TableRow key={idx} className="border-zinc-800/40 opacity-30 hover:bg-transparent">
                      <TableCell className="font-mono text-[10px] text-zinc-600">
                        {format(entry.ts, "HH:mm:ss")}
                      </TableCell>
                      <TableCell colSpan={7}>
                        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                          <RadioIcon className="h-3 w-3" /> heartbeat
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                }

                const inc = entry.incident;
                const isNew = entry.kind === "incident_created";

                return (
                  <TableRow
                    key={idx}
                    className={`border-zinc-800/60 transition-colors hover:bg-zinc-800/30 ${
                      isNew ? "bg-green-500/5" : ""
                    }`}
                  >
                    <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(entry.ts, "HH:mm:ss.SSS")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider border ${
                          isNew
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {isNew ? "NEW" : "UPDATE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-xs font-medium">{inc.title}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider border ${SEV_COLOR[inc.severity] ?? ""}`}
                      >
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(inc.event_types)].map((t) => (
                          <span
                            key={t}
                            className={`inline-flex items-center rounded border px-1 text-[9px] uppercase tracking-wider ${EVENT_TYPE_COLORS[t] ?? "border-zinc-700 text-zinc-400"}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{inc.source_count}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{inc.geohash}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {Math.round(inc.confidence * 100)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
