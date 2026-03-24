"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStats } from "@/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  title,
  value,
  subtitle,
  badge,
  badgeVariant,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string | number;
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
  accent?: "green" | "red" | "amber" | "default";
}) {
  const accentClass = {
    green:   "text-green-400",
    red:     "text-red-400",
    amber:   "text-amber-400",
    default: "text-foreground",
  }[accent ?? "default"];

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold tabular-nums ${accentClass}`}>
            {value}
          </span>
          {badge !== undefined && (
            <Badge variant={badgeVariant ?? "secondary"} className="mb-0.5 text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PipelineStats() {
  const { stats, loading } = useStats();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60">
            <CardHeader className="pb-1 pt-4">
              <Skeleton className="h-3 w-28" />
            </CardHeader>
            <CardContent className="pb-4">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="mt-2 h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        title="Events / minute"
        value={stats.events_last_minute.toLocaleString()}
        subtitle={`${stats.events_last_hour.toLocaleString()} last hour`}
        accent="green"
      />
      <StatCard
        title="Open incidents"
        value={stats.open_incidents.toLocaleString()}
        badge={stats.open_incidents > 10 ? "High load" : stats.open_incidents > 0 ? "Active" : undefined}
        badgeVariant={stats.open_incidents > 10 ? "destructive" : "secondary"}
        subtitle="Non-closed fused events"
        accent={stats.open_incidents > 0 ? "amber" : "default"}
      />
      <StatCard
        title="Critical incidents"
        value={stats.critical_incidents.toLocaleString()}
        badge={stats.critical_incidents > 0 ? "CRITICAL" : undefined}
        badgeVariant="destructive"
        subtitle="Severity: CRITICAL"
        accent={stats.critical_incidents > 0 ? "red" : "default"}
      />
      <StatCard
        title="Avg fusion latency"
        value={`${stats.avg_fusion_latency_ms} ms`}
        subtitle={
          stats.last_fusion_at
            ? `Last run ${new Date(stats.last_fusion_at).toLocaleTimeString()}`
            : `${stats.fusion_runs} cycles run`
        }
        accent="default"
      />
    </div>
  );
}
