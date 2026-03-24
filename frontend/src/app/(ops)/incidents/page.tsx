"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  FilterIcon,
  PanelRightOpenIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
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
import { IncidentDetailPanel } from "@/components/incident-detail-panel";
import { useIncidents } from "@/hooks/useIncidents";
import { useStats } from "@/hooks/useStats";
import type { Incident, Severity, IncidentStatus } from "@/types/incident";

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: "text-red-400 border-red-500/40 bg-red-500/10",
  HIGH:     "text-orange-400 border-orange-500/40 bg-orange-500/10",
  MEDIUM:   "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  LOW:      "text-zinc-400 border-zinc-600/40 bg-zinc-800/40",
};

const SEV_ROW_ACCENT: Record<Severity, string> = {
  CRITICAL: "border-l-2 border-l-red-500/60",
  HIGH:     "border-l-2 border-l-orange-500/60",
  MEDIUM:   "border-l-2 border-l-yellow-500/60",
  LOW:      "border-l-2 border-l-zinc-700",
};

const STATUS_ICON: Record<IncidentStatus, React.ReactNode> = {
  OPEN:     <CircleDotIcon className="h-3 w-3 text-green-400" />,
  UPDATING: <RefreshCwIcon className="h-3 w-3 animate-spin text-yellow-400" />,
  CLOSED:   <CheckCircle2Icon className="h-3 w-3 text-zinc-500" />,
};

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: IncidentStatus[] = ["OPEN", "UPDATING", "CLOSED"];

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function StatCard({
  label, value, icon, accent,
}: {
  label: string; value: number | string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className={`rounded-lg border ${accent} bg-card p-4`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{label}</p>
        <div className="opacity-60">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function IncidentsPage() {
  const router = useRouter();
  const { incidents, loading, refresh } = useIncidents();
  const { stats } = useStats();

  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<IncidentStatus>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (sevFilter.size > 0 && !sevFilter.has(inc.severity as Severity)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(inc.status as IncidentStatus)) return false;
      return true;
    });
  }, [incidents, sevFilter, statusFilter]);

  function toggleSev(s: Severity) {
    setSevFilter((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }
  function toggleStatus(s: IncidentStatus) {
    setStatusFilter((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  function openQuickView(e: React.MouseEvent, inc: Incident) {
    e.stopPropagation();
    e.preventDefault();
    setPanelId(inc.id);
    setPanelOpen(true);
  }

  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const openCount = incidents.filter((i) => i.status === "OPEN").length;

  return (
    <>
      <div className="flex flex-col gap-6 p-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total"        value={incidents.length}                 icon={<ShieldAlertIcon    className="h-4 w-4" />}                  accent="border-zinc-800"      />
          <StatCard label="Open"         value={openCount}                        icon={<CircleDotIcon      className="h-4 w-4 text-green-400" />}   accent="border-green-500/20"  />
          <StatCard label="Critical"     value={criticalCount}                    icon={<AlertTriangleIcon  className="h-4 w-4 text-red-400" />}     accent="border-red-500/20"    />
          <StatCard label="Events / min" value={stats?.events_last_minute ?? "—"} icon={<RefreshCwIcon      className="h-4 w-4 text-zinc-400" />}    accent="border-zinc-800"      />
        </div>

        {/* Hint banner */}
        <div className="flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-400">
          <span className="font-bold">↵</span>
          <span>Click any row to open the full incident detail page &nbsp;·&nbsp; click
            <PanelRightOpenIcon className="inline h-3 w-3 mx-1" />
            for a quick-view panel
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] tracking-widest text-muted-foreground uppercase">
            <FilterIcon className="h-3 w-3" /> Severity
          </div>
          <div className="flex flex-wrap gap-1">
            {SEVERITIES.map((s) => (
              <Toggle key={s} size="sm" pressed={sevFilter.has(s)} onPressedChange={() => toggleSev(s)}
                className={`h-6 rounded-sm border px-2 text-[10px] tracking-wider uppercase transition-colors ${sevFilter.has(s) ? SEV_COLOR[s] : "border-zinc-800 text-zinc-500"}`}>
                {s}
              </Toggle>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] tracking-widest text-muted-foreground uppercase ml-2">Status</div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <Toggle key={s} size="sm" pressed={statusFilter.has(s)} onPressedChange={() => toggleStatus(s)}
                className={`h-6 rounded-sm border px-2 text-[10px] tracking-wider uppercase transition-colors ${statusFilter.has(s) ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-zinc-800 text-zinc-500"}`}>
                {s}
              </Toggle>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">{filtered.length} of {incidents.length}</span>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 border-zinc-800 px-2 text-[11px]" onClick={refresh}>
              <RefreshCwIcon className="h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-zinc-800 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 w-8">#</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Title</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Sev</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Status</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500">Confidence</TableHead>
                <TableHead className="text-[11px] tracking-widest uppercase text-zinc-500 hidden sm:table-cell">Last event</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    Loading incidents…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    No incidents match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((inc, idx) => (
                <TableRow
                  key={inc.id}
                  className={`cursor-pointer border-zinc-800/60 transition-colors hover:bg-zinc-800/50 group ${SEV_ROW_ACCENT[inc.severity as Severity]}`}
                  onClick={() => router.push(`/incidents/${inc.id}`)}
                >
                  <TableCell className="text-xs text-zinc-600 tabular-nums">{idx + 1}</TableCell>

                  {/* Title + summary */}
                  <TableCell className="max-w-[280px]">
                    <p className="truncate text-xs font-medium group-hover:text-cyan-400 transition-colors">
                      {inc.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{inc.summary}</p>
                  </TableCell>

                  {/* Severity */}
                  <TableCell>
                    <Badge className={`text-[10px] uppercase tracking-wider border ${SEV_COLOR[inc.severity as Severity]}`} variant="outline">
                      {inc.severity}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[inc.status as IncidentStatus]}
                      <span className="text-xs">{inc.status}</span>
                    </div>
                  </TableCell>

                  {/* Confidence */}
                  <TableCell><ConfidenceBar value={inc.confidence} /></TableCell>

                  {/* Last event */}
                  <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {formatDistanceToNow(new Date(inc.last_event_at), { addSuffix: true })}
                  </TableCell>

                  {/* Quick-view panel icon — stops propagation so row click still goes to detail */}
                  <TableCell onClick={(e) => openQuickView(e, inc)}>
                    <PanelRightOpenIcon className="h-3.5 w-3.5 text-zinc-700 hover:text-cyan-400 transition-colors" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <IncidentDetailPanel
        incidentId={panelId}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </>
  );
}
