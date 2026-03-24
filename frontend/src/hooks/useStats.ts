"use client";

import { useEffect, useState } from "react";
import type { StatsPayload } from "@/types/incident";
import { useSSE } from "./useSSE";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const DEFAULT_STATS: StatsPayload = {
  events_last_hour: 0,
  events_last_minute: 0,
  open_incidents: 0,
  critical_incidents: 0,
  fusion_runs: 0,
  last_fusion_at: null,
  avg_fusion_latency_ms: 0,
};

export function useStats() {
  const [stats, setStats] = useState<StatsPayload>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  // Seed with the REST snapshot before SSE events arrive
  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((data: StatsPayload) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useSSE({
    stats_update: (data) => {
      setStats(data as StatsPayload);
      setLoading(false);
    },
  });

  return { stats, loading };
}
