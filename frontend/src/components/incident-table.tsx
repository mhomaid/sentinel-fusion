"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { useIncidents } from "@/hooks/useIncidents";
import type { Incident, Severity } from "@/types/incident";
import { formatDistanceToNow } from "date-fns";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEVERITY_VARIANT: Record<
  Severity,
  "destructive" | "default" | "secondary" | "outline"
> = {
  CRITICAL: "destructive",
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

interface Props {
  onSelectIncident?: (incident: Incident) => void;
  selectedId?: string | null;
}

export function IncidentTable({ onSelectIncident, selectedId }: Props) {
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);
  const { incidents, loading } = useIncidents({
    severity: severityFilter.length > 0 ? severityFilter : undefined,
  });

  const filtered =
    severityFilter.length > 0
      ? incidents.filter((i) => severityFilter.includes(i.severity as Severity))
      : incidents;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Severity filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">Filter:</span>
        {SEVERITIES.map((s) => (
          <Toggle
            key={s}
            size="sm"
            variant="outline"
            pressed={severityFilter.includes(s)}
            onPressedChange={(pressed) =>
              setSeverityFilter((prev) =>
                pressed ? [...prev, s] : prev.filter((x) => x !== s)
              )
            }
            className="text-xs"
          >
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full ${SEVERITY_COLOR[s]}`}
            />
            {s}
          </Toggle>
        ))}
        {severityFilter.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSeverityFilter([])}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
            <TableRow className="border-border/60">
              <TableHead className="w-24 text-[10px] tracking-widest text-muted-foreground uppercase">Severity</TableHead>
              <TableHead className="text-[10px] tracking-widest text-muted-foreground uppercase">Title</TableHead>
              <TableHead className="w-32 text-[10px] tracking-widest text-muted-foreground uppercase">Confidence</TableHead>
              <TableHead className="w-16 text-right text-[10px] tracking-widest text-muted-foreground uppercase">Srcs</TableHead>
              <TableHead className="w-32 text-right text-[10px] tracking-widest text-muted-foreground uppercase">Last event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No open incidents
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((incident) => (
                <TableRow
                  key={incident.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedId === incident.id ? "bg-muted" : ""
                  }`}
                  onClick={() => onSelectIncident?.(incident)}
                >
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANT[incident.severity as Severity]}>
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-1 font-medium">
                      {incident.title}
                    </span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {incident.event_types.join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ConfidenceBar value={incident.confidence} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {incident.source_count}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(incident.last_event_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-right text-xs text-muted-foreground">
        {filtered.length} incident{filtered.length !== 1 ? "s" : ""} (live)
      </p>
    </div>
  );
}
