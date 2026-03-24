"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { IncidentMap } from "@/components/incident-map";
import { useSSE } from "@/hooks/useSSE";
import { useIncidents } from "@/hooks/useIncidents";
import { useStats } from "@/hooks/useStats";
import { Badge } from "@/components/ui/badge";
import { IncidentDetailPanel } from "@/components/incident-detail-panel";
import type { Incident } from "@/types/incident";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://sentinel-fusion-production-1147.up.railway.app";

const FUSION_CYCLE_SECS = 30;

type StreamEntry =
  | { kind: "incident_created"; incident: Incident; ts: Date }
  | { kind: "incident_updated"; incident: Incident; ts: Date }
  | { kind: "heartbeat"; ts: Date };

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/50 bg-red-500/10 text-red-400",
  HIGH:     "border-orange-500/50 bg-orange-500/10 text-orange-400",
  MEDIUM:   "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  LOW:      "border-zinc-600/50 bg-zinc-800/60 text-zinc-400",
};

const GCC_ZONES = [
  "Riyadh, SA",
  "Jeddah, SA",
  "Tabuk — N. Border, SA",
  "Jizan — S. Border, SA",
  "Najran — S. Border, SA",
  "Dubai, UAE",
  "Abu Dhabi, UAE",
  "Kuwait City, KW",
];

export default function DemoPage() {
  const [demoState, setDemoState] = useState<
    "launching" | "active" | "error"
  >("launching");
  const [countdown, setCountdown] = useState(FUSION_CYCLE_SECS);
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const { incidents } = useIncidents();
  const { stats } = useStats();

  // ── Auto-trigger demo on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/demo/start`, { method: "POST" })
      .then(() => setDemoState("active"))
      .catch(() => setDemoState("error"));
  }, []);

  // ── Countdown to next fusion cycle ─────────────────────────────────────
  useEffect(() => {
    if (demoState !== "active") return;
    setCountdown(FUSION_CYCLE_SECS);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return FUSION_CYCLE_SECS;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [demoState]);

  // ── SSE stream ──────────────────────────────────────────────────────────
  useSSE({
    incident_created: (data) => {
      const incident = (data as { incident: Incident }).incident;
      const entry: StreamEntry = { kind: "incident_created", incident, ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, 200));
    },
    incident_updated: (data) => {
      const incident = (data as { incident: Incident }).incident;
      const entry: StreamEntry = { kind: "incident_updated", incident, ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, 200));
    },
    heartbeat: () => {
      const entry: StreamEntry = { kind: "heartbeat", ts: new Date() };
      setEntries((prev) => [entry, ...prev].slice(0, 200));
    },
  });

  const handleSelectIncident = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
    setPanelOpen(true);
  }, []);

  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const highCount = incidents.filter((i) => i.severity === "HIGH").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 font-mono text-zinc-100">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none" aria-hidden>
              <path d="M28 4L6 14v16c0 12.4 9.3 24 22 28 12.7-4 22-15.6 22-28V14L28 4z"
                stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.8" />
              <circle cx="28" cy="28" r="6" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle cx="28" cy="28" r="2" fill="#22c55e" />
            </svg>
            <span className="text-sm font-bold tracking-[0.15em] text-white">SENTINEL FUSION</span>
          </div>

          <span className="text-zinc-700">·</span>

          {/* Demo status */}
          {demoState === "launching" && (
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-ping" />
              Injecting GCC scenarios…
            </span>
          )}
          {demoState === "active" && (
            <span className="flex items-center gap-2 text-xs text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              SCENARIO ACTIVE · 8 GCC zones · fusion cycle {FUSION_CYCLE_SECS}s
            </span>
          )}
          {demoState === "error" && (
            <span className="text-xs text-red-400">Failed to connect to API</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {demoState === "active" && (
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-600">next fusion in</span>
              <span className="tabular-nums text-green-400 w-6 text-right">{countdown}s</span>
            </span>
          )}
          <span className="text-zinc-700">·</span>
          <span>{incidents.length} incident{incidents.length !== 1 ? "s" : ""} active</span>
          {criticalCount > 0 && (
            <span className="text-red-400 animate-pulse">{criticalCount} CRITICAL</span>
          )}
          <span className="text-zinc-700">·</span>
          <Link href="/dashboard" className="text-green-500 hover:text-green-400 transition-colors">
            Open full dashboard →
          </Link>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Map (60%) */}
        <div className="relative flex-[6] overflow-hidden border-r border-zinc-800/60">
          <IncidentMap onSelectIncident={handleSelectIncident} />

          {/* Stats overlay */}
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/90 p-3 backdrop-blur text-xs">
              <p className="text-zinc-500 uppercase tracking-wider mb-2 text-[10px]">Live Intelligence</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-zinc-400">Open incidents</span>
                  <span className="text-green-400 font-bold tabular-nums">{stats?.open_incidents ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-zinc-400">Critical</span>
                  <span className={`font-bold tabular-nums ${criticalCount > 0 ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>
                    {criticalCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-zinc-400">High</span>
                  <span className="text-orange-400 font-bold tabular-nums">{highCount}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-zinc-400">Events / hr</span>
                  <span className="text-zinc-300 tabular-nums">{stats?.events_last_hour ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Zone list */}
            <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/90 p-3 backdrop-blur text-xs">
              <p className="text-zinc-500 uppercase tracking-wider mb-2 text-[10px]">Active zones</p>
              <div className="flex flex-col gap-1">
                {GCC_ZONES.map((z) => (
                  <div key={z} className="flex items-center gap-2 text-zinc-400">
                    <span className="h-1 w-1 rounded-full bg-green-500/70" />
                    {z}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live event stream (40%) */}
        <div className="flex flex-[4] flex-col overflow-hidden bg-zinc-950">
          {/* Stream header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Event Stream
            </span>
            <span className="text-[10px] text-zinc-600">SSE · auto-scroll</span>
          </div>

          {/* Stream entries */}
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
          >
            {entries.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-xs text-center gap-2">
                <span className="h-2 w-2 rounded-full bg-yellow-500/40 animate-ping" />
                Waiting for first events…
                <span className="text-zinc-700">Incidents appear ~30s after scenarios are injected</span>
              </div>
            )}
            {entries.map((entry, idx) => (
              <StreamEntryRow key={idx} entry={entry} />
            ))}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-zinc-800/60 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-600">
            <span>Rust · PostGIS · Next.js</span>
            <a
              href="https://github.com/mhomaid/sentinel-fusion"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              github.com/mhomaid/sentinel-fusion
            </a>
          </div>
        </div>
      </div>

      <IncidentDetailPanel
        incidentId={selectedIncident?.id ?? null}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </div>
  );
}

/* ── Stream entry row ────────────────────────────────────────────────────── */

function StreamEntryRow({ entry }: { entry: StreamEntry }) {
  const ts = entry.ts.toISOString().substring(11, 23);

  if (entry.kind === "heartbeat") {
    return (
      <div className="flex items-center gap-2 py-0.5 text-[10px] text-zinc-700">
        <span className="tabular-nums w-24 shrink-0">{ts}</span>
        <span>heartbeat</span>
      </div>
    );
  }

  const { incident } = entry;
  const isNew = entry.kind === "incident_created";

  return (
    <div
      className={`rounded border px-2 py-1.5 text-[11px] ${
        isNew
          ? "border-green-500/20 bg-green-500/5"
          : "border-zinc-700/40 bg-zinc-900/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="tabular-nums text-zinc-600 text-[10px] w-24 shrink-0">{ts}</span>
        <span
          className={`text-[10px] font-bold tracking-wider ${
            isNew ? "text-green-400" : "text-zinc-400"
          }`}
        >
          {isNew ? "CREATED" : "UPDATED"}
        </span>
        <Badge
          className={`text-[9px] px-1 py-0 h-4 border ${
            SEV_COLOR[incident.severity] ?? SEV_COLOR.LOW
          }`}
          variant="outline"
        >
          {incident.severity}
        </Badge>
        <span className="text-zinc-500 text-[10px] tabular-nums ml-auto shrink-0">
          {(incident.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-zinc-300 leading-snug truncate">{incident.title}</p>
      <p className="text-zinc-600 text-[10px] mt-0.5">
        {incident.source_diversity} source type{incident.source_diversity !== 1 ? "s" : ""} ·{" "}
        {incident.source_count} event{incident.source_count !== 1 ? "s" : ""} ·{" "}
        {incident.event_types.slice(0, 3).join(", ")}
      </p>
    </div>
  );
}
