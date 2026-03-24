"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Incident } from "@/types/incident";
import { useSSE } from "./useSSE";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function useIncidents(filter?: {
  severity?: string[];
  status?: string[];
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable ref for the filter to avoid re-fetching on every render
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchInitial = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: "OPEN", limit: "200" });
      if (filterRef.current?.severity?.length) {
        params.set("severity", filterRef.current.severity.join(","));
      }
      const res = await fetch(`${API_BASE}/api/incidents?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setIncidents(json.incidents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useSSE({
    incident_created: (data) => {
      const incident = (data as { incident: Incident }).incident;
      setIncidents((prev) => {
        // Guard against duplicates arriving on reconnect
        if (prev.some((i) => i.id === incident.id)) return prev;
        return [incident, ...prev];
      });
    },
    incident_updated: (data) => {
      const incident = (data as { incident: Incident }).incident;
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? incident : i))
      );
    },
  });

  return { incidents, loading, error, refresh: fetchInitial };
}
