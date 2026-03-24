import Link from "next/link";

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

const STATS = [
  { value: "<100ms", label: "Fusion-to-dashboard latency" },
  { value: "4",      label: "Sensor source classes" },
  { value: "30s",    label: "Default fusion cycle" },
  { value: "100%",   label: "Rust — zero GC pauses" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden sf-grid-bg text-zinc-100">

      {/* Scanning line overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-400/60 to-transparent sf-scan-line"
      />

      {/* Top-right corner brackets */}
      <div aria-hidden className="pointer-events-none absolute right-8 top-8 h-16 w-16 border-r border-t border-green-500/20" />
      <div aria-hidden className="pointer-events-none absolute bottom-8 left-8 h-16 w-16 border-b border-l border-green-500/20" />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-28 pb-20 text-center">

        {/* Status pill */}
        <div className="sf-fade-up sf-fade-up-delay-1 mb-8 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-mono tracking-widest text-green-400 uppercase">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 sf-status-dot" />
          System Operational · All sensors nominal
        </div>

        {/* Logo mark + Title */}
        <div className="sf-fade-up sf-fade-up-delay-2 mb-6 flex items-center gap-4">
          {/* Shield / target icon */}
          <svg
            width="56" height="56" viewBox="0 0 56 56" fill="none"
            className="shrink-0 drop-shadow-[0_0_16px_rgba(34,197,94,0.5)]"
            aria-hidden
          >
            <path
              d="M28 4L6 14v16c0 12.4 9.3 24 22 28 12.7-4 22-15.6 22-28V14L28 4z"
              stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.7"
            />
            <circle cx="28" cy="28" r="8" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.5" />
            <circle cx="28" cy="28" r="2" fill="#22c55e" opacity="0.9" />
            <line x1="28" y1="16" x2="28" y2="21" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
            <line x1="28" y1="35" x2="28" y2="40" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
            <line x1="16" y1="28" x2="21" y2="28" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
            <line x1="35" y1="28" x2="40" y2="28" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
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
          Edge-to-Intelligence · Multi-Sensor Correlation · Real-Time Operator Awareness
        </p>
        <p className="sf-fade-up sf-fade-up-delay-3 mb-12 max-w-xl text-lg leading-relaxed text-zinc-400">
          Raw sensor events normalized, spatially clustered, scored, and delivered as
          actionable intelligence incidents — in under 100ms, with zero alert fatigue.
        </p>

        {/* CTA */}
        <div className="sf-fade-up sf-fade-up-delay-4 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-lg bg-green-500 px-8 font-mono text-sm font-bold tracking-wider text-black transition-all hover:bg-green-400 active:scale-95"
          >
            <span className="relative z-10">ENTER COMMAND CENTER</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="relative z-10 transition-transform group-hover:translate-x-1">
              <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
            </svg>
            {/* Shimmer */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
          <a
            href="https://github.com/mhomaid/sentinel-fusion"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-zinc-700 bg-transparent px-6 font-mono text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            View Source
          </a>
        </div>
      </section>

      {/* ── Pipeline stats strip ─────────────────────────────────── */}
      <section className="sf-fade-up sf-fade-up-delay-5 border-y border-zinc-800/80 bg-zinc-900/40 py-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-3xl font-bold text-green-400 sf-glow">{s.value}</p>
              <p className="mt-1 text-xs tracking-wide text-zinc-500 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities grid ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-widest text-zinc-500 uppercase">System Capabilities</p>
          <h2 className="text-3xl font-bold text-zinc-100">Built for the correlation layer</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.label}
              className={`group rounded-xl border bg-zinc-900/60 p-6 backdrop-blur transition-all duration-300 ${cap.color}`}
            >
              <p className={`mb-3 font-mono text-2xl text-zinc-600 transition-colors ${cap.glow}`}>
                {cap.icon}
              </p>
              <h3 className="mb-2 font-semibold text-zinc-100">{cap.label}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture pill strip ──────────────────────────────── */}
      <section className="border-t border-zinc-800/80 bg-zinc-900/20 py-12">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-6 text-center font-mono text-xs tracking-widest text-zinc-600 uppercase">Technology Stack</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["Rust · Axum", "Tokio async", "PostgreSQL", "PostGIS", "SQLx", "Next.js 16", "Mapbox GL", "Shadcn UI", "Server-Sent Events", "Docker"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-zinc-700/60 bg-zinc-800/40 px-4 py-1.5 font-mono text-xs text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-8 text-center">
        <p className="font-mono text-xs text-zinc-600">
          SENTINEL FUSION · Built to think at the system level, not just the feature level.
        </p>
      </footer>
    </main>
  );
}
