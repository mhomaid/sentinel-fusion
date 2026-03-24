"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Incident, Severity } from "@/types/incident";
import { formatDistanceToNow, format } from "date-fns";

const SEVERITY_VARIANT: Record<
  Severity,
  "destructive" | "default" | "secondary" | "outline"
> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm tabular-nums">{pct}%</span>
    </div>
  );
}

interface Props {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncidentDetailPanel({ incidentId, open, onOpenChange }: Props) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId || !open) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/incidents/${incidentId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Incident>;
      })
      .then((data) => {
        setIncident(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [incidentId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {loading && (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {error && (
          <p className="mt-6 text-sm text-destructive">Error: {error}</p>
        )}

        {!loading && !error && incident && (
          <div className="mt-2 space-y-6">
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="text-base leading-snug">
                  {incident.title}
                </SheetTitle>
                <Badge
                  variant={SEVERITY_VARIANT[incident.severity as Severity]}
                  className="shrink-0"
                >
                  {incident.severity}
                </Badge>
              </div>
            </SheetHeader>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {incident.summary}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{incident.status}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sources</p>
                <p className="font-medium">
                  {incident.source_count} ({incident.source_diversity} classes)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First event</p>
                <p className="font-medium">
                  {format(new Date(incident.first_event_at), "PPp")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last event</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(incident.last_event_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {incident.lat != null && incident.lon != null && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium font-mono text-xs">
                    {incident.lat.toFixed(5)}, {incident.lon.toFixed(5)} —{" "}
                    {incident.geohash}
                  </p>
                </div>
              )}
            </div>

            {/* Confidence */}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Confidence</p>
              <ConfidenceBar value={incident.confidence} />
            </div>

            {/* Event types */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Contributing sensor types
              </p>
              <div className="flex flex-wrap gap-1">
                {incident.event_types.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Source events table */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Source events ({incident.event_ids.length})
              </p>
              <div className="max-h-48 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Event ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incident.event_ids.map((id) => (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs">
                          {id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
