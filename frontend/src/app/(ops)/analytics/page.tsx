"use client";

import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import {
  TrendingUpIcon,
  ActivityIcon,
  LayersIcon,
  ZapIcon,
} from "lucide-react";

import { useStats } from "@/hooks/useStats";
import { useIncidents } from "@/hooks/useIncidents";
import { useSSE } from "@/hooks/useSSE";
import type { Incident } from "@/types/incident";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface TimePoint { time: string; value: number }

/* ── Constants ──────────────────────────────────────────────────────────── */

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#71717a",
};

const SOURCE_COLORS: Record<string, string> = {
  DRONE:     "#22c55e",
  CAMERA:    "#3b82f6",
  RF_SENSOR: "#a855f7",
  RADAR:     "#f97316",
};

const CHART_GRID_COLOR  = "rgba(255,255,255,0.05)";
const CHART_AXIS_COLOR  = "rgba(255,255,255,0.25)";
const CHART_TICK_STYLE  = { fill: "#71717a", fontSize: 10, fontFamily: "inherit" };
const TOOLTIP_STYLE     = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "inherit",
};

/* ── Small helpers ──────────────────────────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-card p-5">
      <div className="mb-4 flex items-start gap-2">
        <div className="mt-0.5 text-zinc-500">{icon}</div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-600">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}

/* ── Tooltip formatters ─────────────────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      {label && <p className="mb-1 text-zinc-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-[11px]">
          {p.name}: <span className="font-bold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const { stats } = useStats();
  const { incidents } = useIncidents();

  /* Rolling events-per-minute sparkline (last 30 ticks) */
  const [eventsTimeline, setEventsTimeline] = useState<TimePoint[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const now = format(new Date(), "HH:mm:ss");
      setEventsTimeline((prev) => {
        const next = [...prev, { time: now, value: 0 }].slice(-30);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useSSE({
    incident_created: () => {
      setEventsTimeline((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          value: copy[copy.length - 1].value + 1,
        };
        return copy;
      });
    },
    incident_updated: () => {
      setEventsTimeline((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          value: copy[copy.length - 1].value + 1,
        };
        return copy;
      });
    },
  });

  /* Severity distribution */
  const sevDist = Object.entries(
    incidents.reduce<Record<string, number>>((acc, inc) => {
      acc[inc.severity] = (acc[inc.severity] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  /* Source diversity breakdown */
  const sourceDist: { name: string; value: number }[] = [];
  const sourceMap: Record<string, number> = {};
  incidents.forEach((inc: Incident) => {
    inc.event_types.forEach((t) => {
      sourceMap[t] = (sourceMap[t] ?? 0) + 1;
    });
  });
  for (const [name, value] of Object.entries(sourceMap)) {
    sourceDist.push({ name, value });
  }

  /* Status breakdown for pie */
  const statusDist = Object.entries(
    incidents.reduce<Record<string, number>>((acc, inc) => {
      acc[inc.status] = (acc[inc.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const STATUS_COLORS: Record<string, string> = {
    OPEN:     "#22c55e",
    UPDATING: "#eab308",
    CLOSED:   "#71717a",
  };

  /* Confidence distribution histogram (0-10% buckets) */
  const confBuckets: { range: string; count: number }[] = Array.from(
    { length: 10 },
    (_, i) => ({ range: `${i * 10}–${i * 10 + 10}%`, count: 0 })
  );
  incidents.forEach((inc) => {
    const bucket = Math.min(Math.floor(inc.confidence * 10), 9);
    confBuckets[bucket].count++;
  });

  return (
    <div className="flex flex-col gap-6 p-5">

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatPill label="Total incidents"     value={incidents.length} />
        <StatPill label="Open"                value={stats.open_incidents}    accent="text-green-400" />
        <StatPill label="Critical"            value={stats.critical_incidents} accent="text-red-400" />
        <StatPill label="Events / hour"       value={stats.events_last_hour} />
        <StatPill label="Events / min"        value={stats.events_last_minute} accent="text-green-400" />
        <StatPill
          label="Avg fusion latency"
          value={`${stats.avg_fusion_latency_ms.toFixed(0)} ms`}
          accent="text-blue-400"
        />
      </div>

      {/* Row 1 — Activity timeline */}
      <ChartCard
        title="Pipeline activity"
        subtitle="Incident events captured per 5-second window (live)"
        icon={<TrendingUpIcon className="h-4 w-4" />}
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={eventsTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} interval="preserveStartEnd" />
            <YAxis tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              name="events"
              stroke="#22c55e"
              strokeWidth={1.5}
              fill="url(#areaGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 2 — Severity + Status side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Severity distribution"
          subtitle="Incident count by severity level"
          icon={<ActivityIcon className="h-4 w-4" />}
        >
          {sevDist.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sevDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} />
                <YAxis tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="incidents" radius={[3, 3, 0, 0]}>
                  {sevDist.map((entry) => (
                    <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? "#71717a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Incident status"
          subtitle="Open / updating / closed breakdown"
          icon={<LayersIcon className="h-4 w-4" />}
        >
          {statusDist.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusDist.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#71717a"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(v) => (
                    <span style={{ fontSize: 11, color: "#9f9fa9", fontFamily: "inherit" }}>{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3 — Sensor types + Confidence histogram */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sensor type coverage"
          subtitle="Event types contributing to incidents"
          icon={<ZapIcon className="h-4 w-4" />}
        >
          {sourceDist.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={sourceDist}
                layout="vertical"
                margin={{ top: 4, right: 4, left: 20, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="occurrences" radius={[0, 3, 3, 0]}>
                  {sourceDist.map((entry) => (
                    <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] ?? "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Confidence distribution"
          subtitle="Incidents grouped by fusion confidence score"
          icon={<ActivityIcon className="h-4 w-4" />}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={confBuckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" tick={{ ...CHART_TICK_STYLE, fontSize: 9 }} stroke={CHART_AXIS_COLOR} />
              <YAxis tick={CHART_TICK_STYLE} stroke={CHART_AXIS_COLOR} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="incidents" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

    </div>
  );
}
