export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface IncidentEvent {
  id: string;
  event_type: string;
  source_id: string;
  source_class: "DRONE" | "CAMERA" | "RF_SENSOR" | "RADAR" | string;
  lat: number;
  lon: number;
  payload: Record<string, unknown>;
  received_at: string;
}
export type IncidentStatus = "OPEN" | "UPDATING" | "CLOSED";

export interface Incident {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  confidence: number;
  status: IncidentStatus;
  geohash: string;
  lat: number | null;
  lon: number | null;
  event_ids: string[];
  event_types: string[];
  source_count: number;
  source_diversity: number;
  first_event_at: string;
  last_event_at: string;
  created_at: string;
  updated_at: string;
}

export interface StatsPayload {
  events_last_hour: number;
  events_last_minute: number;
  open_incidents: number;
  critical_incidents: number;
  fusion_runs: number;
  last_fusion_at: string | null;
  avg_fusion_latency_ms: number;
}

export type SseEvent =
  | { type: "INCIDENT_CREATED"; incident: Incident }
  | { type: "INCIDENT_UPDATED"; incident: Incident }
  | { type: "STATS_UPDATE" } & StatsPayload & { type: "STATS_UPDATE" }
  | { type: "HEARTBEAT" };

export interface StatsUpdateEvent {
  type: "STATS_UPDATE";
  events_last_hour: number;
  events_last_minute: number;
  open_incidents: number;
  critical_incidents: number;
  fusion_runs: number;
  last_fusion_at: string | null;
  avg_fusion_latency_ms: number;
}
