"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://sentinel-fusion-production-1147.up.railway.app";

interface LiveStats {
  open_incidents: number;
  events_last_hour: number;
  fusion_runs: number;
}

const CAPABILITIES = [
  {
    icon: "⬡",
    label: "Multi-Sensor Fusion",
    desc: "Drone telemetry, RF anomalies, camera detections, and radar feeds fused into a single intelligence picture.",
    color: "border-green-500/30 hover:border-green-500/60",
    glow: "group-hover:text-green-400",
  },
  {
    icon: "◎",
    label: "Real-Time SSE Stream",
    desc: "Server-Sent Events push every incident update to the operator dashboard the moment the fusion engine writes it.",
    color: "border-sky-500/30 hover:border-sky-500/60",
    glow: "group-hover:text-sky-400",
  },
  {
    icon: "▦",
    label: "PostGIS Spatial Clustering",
    desc: "Geohash-based clustering with ST_DWithin merging groups events within 150m × 150m cells in sub-milliseconds.",
    color: "border-violet-500/30 hover:border-violet-500/60",
    glow: "group-hover:text-violet-400",
  },
  {
    icon: "◈",
    label: "Deterministic Scoring",
    desc: "Confidence is a transparent linear formula of event volume, source diversity, and recency — fully auditable.",
    color: "border-amber-500/30 hover:border-amber-500/60",
    glow: "group-hover:text-amber-400",
  },
  {
    icon: "⟳",
    label: "Deduplication Engine",
    desc: "Open incidents at the same geohash are updated in-place, not duplicated. Operators see live updates, not noise.",
    color: "border-red-500/30 hover:border-red-500/60",
    glow: "group-hover:text-red-400",
  },
  {
    icon: "⬟",
    label: "Mapbox GL Incident Map",
    desc: "WebGL-rendered dark tactical map with severity-colored markers sized by confidence. Updates live from the SSE feed.",
    color: "border-cyan-500/30 hover:border-cyan-500/60",
    glow: "group-hover:text-cyan-400",
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [demoState, setDemoState] = useState<"idle" | "loading" | "launched">(
    "idle"
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch(`${API_BASE}/api/stats`)
        .then((r) => r.json())
        .then((data: LiveStats) => setStats(data))
        .catch(() => {});
    };
    fetchStats();
    pollRef.current = setInterval(fetchStats, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function launchDemo() {
    setDemoState("loading");
    try {
      await fetch(`${API_BASE}/api/demo/start`, { method: "POST" });
    } catch {
      // fire-and-forget
    }
    setDemoState("launched");
  }

  const LIVE_STATS = [
    {
      value: stats ? String(stats.open_incidents) : "—",
      label: "Active incidents",
      live: true,
    },
    {
      value: stats ? String(stats.events_last_hour) : "—",
      label: "Events / hour",
      live: true,
    },
    {
      value: stats ? String(stats.fusion_runs) : "—",
      label: "Fusion cycles run",
      live: true,
    },
    { value: "<100ms", label: "Fusion-to-screen latency", live: false },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden sf-grid-bg text-zinc-100">
      {/* Scanning line overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-400/60 to-transparent sf-scan-line"
      />

      {/* Corner brackets */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-8 top-8 h-16 w-16 border-r border-t border-green-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 left-8 h-16 w-16 border-b border-l border-green-500/20"
      />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-28 pb-20 text-center">
        {/* Status pill — live dot pulses when stats are loaded */}
        <div className="sf-fade-up sf-fade-up-delay-1 mb-8 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-mono tracking-widest text-green-400 uppercase">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full bg-green-400 ${
              stats ? "animate-pulse" : "sf-status-dot"
            }`}
          />
          {stats
            ? `LIVE · ${stats.open_incidents} incident${stats.open_incidents !== 1 ? "s" : ""} active`
            : "System Operational · All sensors nominal"}
        </div>

        {/* Logo mark + Title */}
        <div className="sf-fade-up sf-fade-up-delay-2 mb-6 flex items-center gap-4">
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            fill="none"
            className="shrink-0 drop-shadow-[0_0_16px_rgba(34,197,94,0.5)]"
            aria-hidden
          >
            <path
              d="M28 4L6 14v16c0 12.4 9.3 24 22 28 12.7-4 22-15.6 22-28V14L28 4z"
              stroke="#22c55e"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
            <circle
              cx="28"
              cy="28"
              r="8"
              stroke="#22c55e"
              strokeWidth="1.5"
              fill="none"
              opacity="0.5"
            />
            <circle cx="28" cy="28" r="2" fill="#22c55e" opacity="0.9" />
            <line
              x1="28" y1="16" x2="28" y2="21"
              stroke="#22c55e" strokeWidth="1" opacity="0.6"
            />
            <line
              x1="28" y1="35" x2="28" y2="40"
              stroke="#22c55e" strokeWidth="1" opacity="0.6"
            />
            <line
              x1="16" y1="28" x2="21" y2="28"
              stroke="#22c55e" strokeWidth="1" opacity="0.6"
            />
            <line
              x1="35" y1="28" x2="40" y2="28"
              stroke="#22c55e" strokeWidth="1" opacity="0.6"
            />
          </svg>

          <div className="text-left">
            <h1 className="font-mono text-5xl font-bold tracking-[0.12em] text-white sf-glow md:text-6xl">
              SENTINEL
            </h1>
            <h1 className="font-mono text-5xl font-bold tracking-[0.24em] text-green-400 md:text-6xl">
              FUSION
            </h1>
          </div>
        </div>

        <p className="sf-fade-up sf-fade-up-delay-3 mb-3 max-w-2xl font-mono text-sm tracking-widest text-zinc-400 uppercase">
          Edge-to-Intelligence · Multi-Sensor Correlation · Real-Time Operator
          Awareness
        </p>
        <p className="sf-fade-up sf-fade-up-delay-3 mb-12 max-w-xl text-lg leading-relaxed text-zinc-400">
          Raw sensor events normalized, spatially clustered, scored, and
          delivered as actionable intelligence incidents — in under 100ms, with
          zero alert fatigue.
        </p>

        {/* CTAs */}
        <div className="sf-fade-up sf-fade-up-delay-4 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-lg bg-green-500 px-8 font-mono text-sm font-bold tracking-wider text-black transition-all hover:bg-green-400 active:scale-95"
          >
            <span className="relative z-10">ENTER COMMAND CENTER</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="relative z-10 transition-transform group-hover:translate-x-1"
            >
              <path
                fillRule="evenodd"
                d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"
              />
            </svg>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>

          {/* Demo button */}
          {demoState === "idle" && (
            <button
              onClick={launchDemo}
              className="group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-lg border border-green-500/40 bg-transparent px-8 font-mono text-sm font-bold tracking-wider text-green-400 transition-all hover:border-green-400 hover:bg-green-500/10 active:scale-95"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              LAUNCH LIVE DEMO
            </button>
          )}
          {demoState === "loading" && (
            <div className="inline-flex h-12 items-center gap-3 rounded-lg border border-green-500/20 px-8 font-mono text-sm text-green-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
              Injecting scenarios…
            </div>
          )}
          {demoState === "launched" && (
            <Link
              href="/dashboard"
              className="group inline-flex h-12 items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-8 font-mono text-sm font-bold tracking-wider text-green-400 transition-all hover:bg-green-500/20 active:scale-95"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Scenarios active — view map →
            </Link>
          )}
        </div>

        {demoState === "launched" && (
          <p className="mt-4 font-mono text-xs text-zinc-500">
            GCC zones seeded · incidents appear within ~30s (one fusion cycle)
          </p>
        )}
      </section>

      {/* ── Pipeline stats strip ──────────────────────────────────── */}
      <section className="sf-fade-up sf-fade-up-delay-5 border-y border-zinc-800/80 bg-zinc-900/40 py-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {LIVE_STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-3xl font-bold text-green-400 sf-glow">
                {s.value}
              </p>
              <p className="mt-1 text-xs tracking-wide text-zinc-500 uppercase">
                {s.label}
              </p>
              {s.live && (
                <span className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-green-600/60 uppercase">
                  <span className="h-1 w-1 rounded-full bg-green-500/60 animate-pulse" />
                  live
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities grid ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-widest text-zinc-500 uppercase">
            System Capabilities
          </p>
          <h2 className="text-3xl font-bold text-zinc-100">
            Built for the correlation layer
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.label}
              className={`group rounded-xl border bg-zinc-900/60 p-6 backdrop-blur transition-all duration-300 ${cap.color}`}
            >
              <p
                className={`mb-3 font-mono text-2xl text-zinc-600 transition-colors ${cap.glow}`}
              >
                {cap.icon}
              </p>
              <h3 className="mb-2 font-semibold text-zinc-100">{cap.label}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                {cap.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-8 text-center">
        <p className="font-mono text-xs text-zinc-600">
          SENTINEL FUSION · Built to think at the system level, not just the
          feature level.
        </p>
      </footer>
    </main>
  );
}
