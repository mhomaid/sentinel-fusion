"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeftIcon,
  BrainCircuitIcon,
  CircleDotIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  RadioIcon,
  CameraIcon,
  RadarIcon,
  SatelliteIcon,
  ActivityIcon,
  MapPinIcon,
  ClockIcon,
  ShieldAlertIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IncidentDetailMap } from "@/components/incident-detail-map";
import { useSSE } from "@/hooks/useSSE";
import type { Incident, IncidentEvent } from "@/types/incident";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-500/40 bg-red-500/10",
  HIGH:     "text-orange-400 border-orange-500/40 bg-orange-500/10",
  MEDIUM:   "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  LOW:      "text-zinc-400 border-zinc-600/40 bg-zinc-800/40",
};

const SEV_GLOW: Record<string, string> = {
  CRITICAL: "shadow-[0_0_24px_#ef444430] border-red-500/20",
  HIGH:     "shadow-[0_0_16px_#f9731620] border-orange-500/20",
  MEDIUM:   "shadow-[0_0_12px_#eab30820] border-yellow-500/20",
  LOW:      "border-zinc-800",
};

function SourceIcon({ cls }: { cls: string }) {
  switch (cls) {
    case "DRONE":     return <SatelliteIcon className="h-3.5 w-3.5 text-cyan-400" />;
    case "CAMERA":    return <CameraIcon    className="h-3.5 w-3.5 text-amber-400" />;
    case "RF_SENSOR": return <RadioIcon     className="h-3.5 w-3.5 text-violet-400" />;
    case "RADAR":     return <RadarIcon     className="h-3.5 w-3.5 text-sky-400" />;
    default:          return <ActivityIcon  className="h-3.5 w-3.5 text-zinc-400" />;
  }
}

function sourceBadgeColor(cls: string): string {
  switch (cls) {
    case "DRONE":     return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
    case "CAMERA":    return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "RF_SENSOR": return "text-violet-400 border-violet-500/30 bg-violet-500/10";
    case "RADAR":     return "text-sky-400 border-sky-500/30 bg-sky-500/10";
    default:          return "text-zinc-400 border-zinc-600/30 bg-zinc-800/40";
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function TelemetryCell({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <span className="text-[9px] tracking-widest text-zinc-500 uppercase">{label}</span>
      <span className="text-sm font-bold tabular-nums text-zinc-100">
        {value ?? "—"}
        {unit && value !== null && <span className="ml-1 text-[10px] font-normal text-zinc-500">{unit}</span>}
      </span>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updatedAt = useRef<string>("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [incRes, evRes] = await Promise.all([
        fetch(`${API_BASE}/api/incidents/${id}`),
        fetch(`${API_BASE}/api/incidents/${id}/events`),
      ]);
      if (!incRes.ok) throw new Error(`HTTP ${incRes.status}`);
      const inc: Incident = await incRes.json();
      setIncident(inc);
      if (evRes.ok) {
        const evs: IncidentEvent[] = await evRes.json();
        setEvents(evs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live SSE updates for this incident
  useSSE({
    incident_updated: (data) => {
      const updated = (data as { incident: Incident }).incident;
      if (updated.id === id) {
        setIncident(updated);
        updatedAt.current = new Date().toISOString();
      }
    },
  });

  // ── Derived telemetry ─────────────────────────────────────────────────────
  const droneEvent = [...events].reverse().find((e) => e.source_class === "DRONE");
  const radarEvent = [...events].reverse().find((e) => e.source_class === "RADAR");
  const rfEvent    = [...events].reverse().find((e) => e.source_class === "RF_SENSOR");
  const camEvent   = [...events].reverse().find((e) => e.source_class === "CAMERA");

  const dp = droneEvent?.payload ?? {};
  const rp = radarEvent?.payload ?? {};
  const rfp = rfEvent?.payload ?? {};

  const speedMs      = num(dp.speed_ms);
  const speedKmh     = speedMs !== null ? (speedMs * 3.6).toFixed(1) : null;
  const altitudeM    = num(dp.altitude_m);
  const headingDeg   = num(dp.heading_deg);
  const batteryPct   = num(dp.battery_pct);
  const droneId      = str(dp.drone_id);
  const zone         = str(dp.zone);
  const isLiveAdsb   = str(dp.source) === "opensky";
  const icao24       = str(dp.icao24);
  const originCountry = str(dp.origin_country);

  const radarSpeed   = num(rp.speed_knots);
  const radarAlt     = num(rp.altitude_ft);
  const radarHeading = num(rp.heading_deg);
  const trackId      = str(rp.track_id);

  const rfFreq      = num(rfp.frequency_mhz);
  const rfStrength  = num(rfp.strength_dbm);
  const rfAnomaly   = str(rfp.anomaly_type);

  const camObjects  = (camEvent?.payload?.objects ?? []) as Array<{ class?: string; confidence?: number; speed_kmh?: number }>;
  const camObj      = camObjects[0];

  function compassDir(deg: number): string {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        <RefreshCwIcon className="mr-2 h-3 w-3 animate-spin" /> Loading incident…
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-zinc-500">
        <ShieldAlertIcon className="h-8 w-8 text-zinc-700" />
        <p>{error ?? "Incident not found"}</p>
        <Link href="/incidents" className="text-cyan-400 hover:underline">← Back to incidents</Link>
      </div>
    );
  }

  const statusIcon =
    incident.status === "OPEN"     ? <CircleDotIcon  className="h-3 w-3 text-green-400" /> :
    incident.status === "UPDATING" ? <RefreshCwIcon  className="h-3 w-3 animate-spin text-yellow-400" /> :
                                     <CheckCircle2Icon className="h-3 w-3 text-zinc-500" />;

  const confidencePct = Math.round(incident.confidence * 100);
  const confColor = confidencePct >= 80 ? "bg-green-500" : confidencePct >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col overflow-hidden">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm px-5 py-3 ${SEV_GLOW[incident.severity]}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/incidents"
            className="flex items-center gap-1 text-[10px] tracking-widest text-zinc-500 uppercase hover:text-zinc-300 transition-colors"
          >
            <ArrowLeftIcon className="h-3 w-3" /> Incidents
          </Link>

          <span className="text-zinc-700">/</span>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge
              variant="outline"
              className={`shrink-0 text-[9px] uppercase tracking-wider border ${SEV_COLOR[incident.severity]}`}
            >
              {incident.severity}
            </Badge>
            <h1 className="truncate text-sm font-semibold text-zinc-100">{incident.title}</h1>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-zinc-500 ml-auto shrink-0">
            <div className="flex items-center gap-1">
              {statusIcon}
              <span>{incident.status}</span>
            </div>
            {(zone || originCountry) && (
              <div className="flex items-center gap-1">
                <MapPinIcon className="h-3 w-3" />
                <span className="uppercase">
                  {originCountry ?? zone?.replace(/_/g, " ")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <ZapIcon className="h-3 w-3 text-cyan-400" />
              <span className="tabular-nums text-cyan-400">{confidencePct}%</span>
            </div>
            <div className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(incident.last_event_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Map */}
        <div className="relative flex-[55] overflow-hidden p-3">
          <IncidentDetailMap incident={incident} events={events} />
          {/* Map overlay: drone ID badge */}
          {droneId && (
            <div className="absolute left-6 top-6 rounded-md bg-zinc-950/90 border border-cyan-500/30 px-2.5 py-1.5 backdrop-blur-sm space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] tracking-widest text-zinc-500 uppercase">
                  {isLiveAdsb ? "Callsign" : "Asset"}
                </p>
                {isLiveAdsb && (
                  <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1 text-[8px] tracking-wider text-cyan-400 uppercase">
                    ADS-B
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-cyan-400">{droneId}</p>
              {icao24 && (
                <p className="text-[9px] font-mono text-zinc-500">ICAO: {icao24.toUpperCase()}</p>
              )}
              {originCountry && (
                <p className="text-[9px] text-zinc-500">{originCountry}</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Intelligence panel */}
        <div className="flex flex-[45] flex-col overflow-y-auto border-l border-zinc-800/60 bg-zinc-950">

          {/* ── Incident summary ──────────────────────────────────────── */}
          <section className="shrink-0 border-b border-zinc-800/40 px-4 py-4 space-y-3">
            <p className="text-[10px] tracking-widest text-zinc-500 uppercase flex items-center gap-1.5">
              <BrainCircuitIcon className="h-3 w-3" /> Incident Intelligence
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">{incident.summary}</p>

            {/* Confidence bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-widest text-zinc-500 uppercase">Confidence</span>
                <span className="text-[10px] font-bold tabular-nums text-zinc-200">{confidencePct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className={`h-1.5 rounded-full transition-all ${confColor}`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
                <p className="text-zinc-500 uppercase tracking-wider">Sources</p>
                <p className="font-bold text-zinc-200 mt-0.5">{incident.source_count}</p>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
                <p className="text-zinc-500 uppercase tracking-wider">Diversity</p>
                <p className="font-bold text-zinc-200 mt-0.5">{incident.source_diversity}</p>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
                <p className="text-zinc-500 uppercase tracking-wider">Events</p>
                <p className="font-bold text-zinc-200 mt-0.5">{incident.event_ids.length}</p>
              </div>
            </div>
          </section>

          {/* ── Drone telemetry ───────────────────────────────────────── */}
          {droneEvent && (
            <section className="shrink-0 border-b border-zinc-800/40 px-4 py-4 space-y-2.5">
              <p className="text-[10px] tracking-widest text-cyan-500 uppercase flex items-center gap-1.5">
                <SatelliteIcon className="h-3 w-3" />
                {isLiveAdsb ? "Live ADS-B Telemetry" : "Live Drone Telemetry"}
                {isLiveAdsb && (
                  <span className="ml-auto rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] tracking-wider text-cyan-400">
                    REAL DATA
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TelemetryCell label="Speed" value={speedKmh} unit="km/h" />
                <TelemetryCell label="Altitude" value={altitudeM} unit="m" />
                <TelemetryCell
                  label="Heading"
                  value={headingDeg !== null ? `${headingDeg}° ${compassDir(headingDeg)}` : null}
                />
                {isLiveAdsb
                  ? <TelemetryCell label="ICAO24" value={icao24 ? icao24.toUpperCase() : null} />
                  : <TelemetryCell label="Battery" value={batteryPct} unit="%" />
                }
              </div>
              {isLiveAdsb && originCountry && (
                <div className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                  <span className="text-[9px] tracking-widest text-cyan-600 uppercase">Origin</span>
                  <p className="text-xs font-mono text-cyan-300 mt-0.5">{originCountry}</p>
                </div>
              )}
            </section>
          )}

          {/* ── Radar track ──────────────────────────────────────────── */}
          {radarEvent && (
            <section className="shrink-0 border-b border-zinc-800/40 px-4 py-4 space-y-2.5">
              <p className="text-[10px] tracking-widest text-sky-500 uppercase flex items-center gap-1.5">
                <RadarIcon className="h-3 w-3" /> Radar Track
              </p>
              {trackId && (
                <p className="text-xs font-mono text-zinc-400">
                  Track ID: <span className="text-sky-400">{trackId}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <TelemetryCell label="Speed" value={radarSpeed} unit="kts" />
                <TelemetryCell label="Altitude" value={radarAlt} unit="ft" />
                <TelemetryCell
                  label="Heading"
                  value={radarHeading !== null ? `${radarHeading}° ${compassDir(radarHeading)}` : null}
                />
                <TelemetryCell label="RCS" value={num(rp.radar_cross_section)} unit="m²" />
              </div>
            </section>
          )}

          {/* ── RF sensor ────────────────────────────────────────────── */}
          {rfEvent && (
            <section className="shrink-0 border-b border-zinc-800/40 px-4 py-4 space-y-2.5">
              <p className="text-[10px] tracking-widest text-violet-500 uppercase flex items-center gap-1.5">
                <RadioIcon className="h-3 w-3" /> RF Signal
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TelemetryCell label="Frequency" value={rfFreq} unit="MHz" />
                <TelemetryCell label="Strength" value={rfStrength} unit="dBm" />
              </div>
              {rfAnomaly && (
                <div className="rounded border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                  <span className="text-[9px] tracking-widest text-violet-500 uppercase">Anomaly</span>
                  <p className="text-xs font-mono text-violet-300 mt-0.5">{rfAnomaly}</p>
                </div>
              )}
            </section>
          )}

          {/* ── Camera detections ─────────────────────────────────────── */}
          {camEvent && camObj && (
            <section className="shrink-0 border-b border-zinc-800/40 px-4 py-4 space-y-2.5">
              <p className="text-[10px] tracking-widest text-amber-500 uppercase flex items-center gap-1.5">
                <CameraIcon className="h-3 w-3" /> Camera Detection
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TelemetryCell label="Class" value={camObj.class ?? null} />
                <TelemetryCell
                  label="Confidence"
                  value={camObj.confidence !== undefined ? `${Math.round(camObj.confidence * 100)}%` : null}
                />
                {camObj.speed_kmh !== undefined && (
                  <TelemetryCell label="Visual Speed" value={camObj.speed_kmh} unit="km/h" />
                )}
              </div>
            </section>
          )}

          {/* ── Event timeline ────────────────────────────────────────── */}
          <section className="flex-1 px-4 py-4 space-y-2.5">
            <p className="text-[10px] tracking-widest text-zinc-500 uppercase flex items-center gap-1.5">
              <ClockIcon className="h-3 w-3" /> Event Timeline
              <span className="ml-auto tabular-nums text-zinc-600">{events.length} events</span>
            </p>

            {events.length === 0 && (
              <p className="text-xs text-zinc-600">No events loaded yet.</p>
            )}

            <div className="space-y-1">
              {events.map((ev, i) => {
                const evPayload = ev.payload as Record<string, unknown>;
                const evSpeed = num(evPayload.speed_ms) ?? num(evPayload.speed_knots);
                const evAlt = num(evPayload.altitude_m) ?? num(evPayload.altitude_ft);
                return (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2.5 rounded border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 mt-0.5">
                      <SourceIcon cls={ev.source_class} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[8px] tracking-wider uppercase border px-1 py-0 h-4 ${sourceBadgeColor(ev.source_class)}`}
                        >
                          {ev.source_class.replace("_", " ")}
                        </Badge>
                        {(ev.payload as Record<string, unknown>).source === "opensky" && (
                          <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1 text-[8px] tracking-wider text-cyan-400 uppercase">
                            ADS-B
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 truncate">{ev.source_id}</span>
                        <span className="ml-auto text-[9px] tabular-nums text-zinc-600 shrink-0">
                          {format(new Date(ev.received_at), "HH:mm:ss.SSS")}
                        </span>
                      </div>
                      <div className="mt-0.5 flex gap-3 text-[9px] text-zinc-500">
                        <span className="font-mono">{ev.lat.toFixed(5)}, {ev.lon.toFixed(5)}</span>
                        {evSpeed !== null && <span>{evSpeed.toFixed(1)} {evPayload.speed_ms !== undefined ? "m/s" : "kts"}</span>}
                        {evAlt !== null && <span>{evAlt} {evPayload.altitude_m !== undefined ? "m" : "ft"}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] tabular-nums text-zinc-700">#{i + 1}</span>
                  </div>
                );
              })}
            </div>

            {/* Incident meta footer */}
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5 text-[9px] text-zinc-500 font-mono">
              <div className="flex justify-between">
                <span>INCIDENT ID</span>
                <span className="text-zinc-400 truncate ml-4">{incident.id}</span>
              </div>
              <div className="flex justify-between">
                <span>GEOHASH</span>
                <span className="text-cyan-600">{incident.geohash}</span>
              </div>
              <div className="flex justify-between">
                <span>FIRST SEEN</span>
                <span>{format(new Date(incident.first_event_at), "MMM d HH:mm:ss")}</span>
              </div>
              <div className="flex justify-between">
                <span>LAST EVENT</span>
                <span>{format(new Date(incident.last_event_at), "MMM d HH:mm:ss")}</span>
              </div>
              <div className="flex justify-between">
                <span>CREATED</span>
                <span>{format(new Date(incident.created_at), "MMM d HH:mm:ss")}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
