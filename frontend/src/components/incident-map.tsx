"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  MapMouseEvent,
  MapRef,
  Source,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSON } from "geojson";
import { useIncidents } from "@/hooks/useIncidents";
import type { Incident, Severity } from "@/types/incident";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface LiveAircraft {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  lat: number;
  lon: number;
  altitude_m: number;
  speed_ms: number;
  heading_deg: number;
  on_ground: boolean;
}

function aircraftToGeoJson(aircraft: LiveAircraft[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: aircraft
      .filter((a) => !a.on_ground)
      .map((a) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
        properties: {
          icao24:         a.icao24,
          callsign:       a.callsign ?? a.icao24,
          origin_country: a.origin_country,
          altitude_m:     Math.round(a.altitude_m),
          speed_kmh:      Math.round(a.speed_ms * 3.6),
          heading_deg:    a.heading_deg,
        },
      })),
  };
}

function useAircraft(enabled: boolean) {
  const [aircraft, setAircraft] = useState<LiveAircraft[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/aircraft/live`);
        if (res.ok && !cancelled) {
          const data: LiveAircraft[] = await res.json();
          setAircraft(data.filter((a) => !a.on_ground));
        }
      } catch { /* silently ignore */ }
    }
    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled]);
  return aircraft;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#22c55e",
};

function incidentsToGeoJson(incidents: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((i) => i.lat != null && i.lon != null)
      .map((i) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [i.lon as number, i.lat as number],
        },
        properties: {
          id: i.id,
          title: i.title,
          severity: i.severity,
          confidence: i.confidence,
          color: SEVERITY_COLOR[i.severity as Severity] ?? "#94a3b8",
          radius: Math.max(6, i.confidence * 22),
          isCritical: i.severity === "CRITICAL" ? 1 : 0,
        },
      })),
  };
}

// Splits the full incident list into CRITICAL-only and non-CRITICAL GeoJSON.
function splitByGeoJson(incidents: Incident[]): {
  critical: GeoJSON.FeatureCollection;
  rest: GeoJSON.FeatureCollection;
} {
  const all = incidentsToGeoJson(incidents);
  return {
    critical: {
      type: "FeatureCollection",
      features: all.features.filter(
        (f) => f.properties?.severity === "CRITICAL"
      ),
    },
    rest: {
      type: "FeatureCollection",
      features: all.features.filter(
        (f) => f.properties?.severity !== "CRITICAL"
      ),
    },
  };
}

interface Props {
  onSelectIncident?: (incident: Incident) => void;
}

export function IncidentMap({ onSelectIncident }: Props) {
  const mapRef = useRef<MapRef>(null);
  const { incidents } = useIncidents();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAircraft, setShowAircraft] = useState(true);
  const aircraft = useAircraft(showAircraft);
  const aircraftGeoJson = aircraftToGeoJson(aircraft);

  // Pulse animation state — oscillates between 0 and 1 on a 1.2s cycle.
  const [pulsePhase, setPulsePhase] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    function tick() {
      const elapsed = (performance.now() - start) / 1200; // 1.2s period
      setPulsePhase((elapsed % 1));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Smooth eased pulse: starts fast, slows at peak.
  const eased = Math.sin(pulsePhase * Math.PI);
  const pulseOuterScale = 1.0 + eased * 1.4;   // 1.0 → 2.4 → 1.0
  const pulseOuterOpacity = 0.55 - eased * 0.45; // 0.55 → 0.10 → 0.55

  const { critical, rest } = splitByGeoJson(incidents);

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.features;
      if (!features?.length) return;
      const id = features[0].properties?.id as string | undefined;
      if (!id) return;
      const incident = incidents.find((i) => i.id === id);
      if (incident) onSelectIncident?.(incident);
    },
    [incidents, onSelectIncident]
  );

  const handleMouseEnter = useCallback((e: MapMouseEvent) => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "pointer";
    const id = e.features?.[0]?.properties?.id as string | undefined;
    if (id) setHoveredId(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    setHoveredId(null);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border/60">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{
          longitude: 45.0,
          latitude: 24.0,
          zoom: 4.5,
        }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["incident-circles", "critical-circles"]}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Non-CRITICAL incidents (static) ───────────────────── */}
        <Source id="incidents-rest" type="geojson" data={rest}>
          <Layer
            id="incident-halos"
            type="circle"
            paint={{
              "circle-radius": ["get", "radius"],
              "circle-color": ["get", "color"],
              "circle-opacity": 0.15,
              "circle-blur": 0.8,
            }}
          />
          <Layer
            id="incident-circles"
            type="circle"
            paint={{
              "circle-radius": [
                "case",
                ["==", ["get", "id"], hoveredId ?? ""],
                ["+", ["get", "radius"], 4],
                ["get", "radius"],
              ],
              "circle-color": ["get", "color"],
              "circle-opacity": 0.85,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-opacity": 0.6,
            }}
          />
        </Source>

        {/* ── CRITICAL incidents — animated pulse rings ─────────── */}
        <Source id="incidents-critical" type="geojson" data={critical}>
          {/* Outer expanding ring */}
          <Layer
            id="critical-pulse-outer"
            type="circle"
            paint={{
              "circle-radius": [
                "*",
                ["get", "radius"],
                pulseOuterScale,
              ],
              "circle-color": "#ef4444",
              "circle-opacity": pulseOuterOpacity,
              "circle-blur": 0.5,
            }}
          />
          {/* Mid glow ring */}
          <Layer
            id="critical-pulse-mid"
            type="circle"
            paint={{
              "circle-radius": [
                "*",
                ["get", "radius"],
                1.0 + eased * 0.6,
              ],
              "circle-color": "#ef4444",
              "circle-opacity": 0.3 - eased * 0.2,
              "circle-blur": 0.3,
            }}
          />
          {/* Solid inner dot */}
          <Layer
            id="critical-circles"
            type="circle"
            paint={{
              "circle-radius": [
                "case",
                ["==", ["get", "id"], hoveredId ?? ""],
                ["+", ["get", "radius"], 4],
                ["get", "radius"],
              ],
              "circle-color": "#ef4444",
              "circle-opacity": 0.92,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fca5a5",
              "circle-stroke-opacity": 0.8,
            }}
          />
        </Source>

        {/* ── Live aircraft (OpenSky ADS-B) ───────────────────────── */}
        {showAircraft && (
          <Source id="aircraft-live" type="geojson" data={aircraftGeoJson}>
            {/* Glow halo */}
            <Layer
              id="aircraft-halo"
              type="circle"
              paint={{
                "circle-radius": 10,
                "circle-color": "#22d3ee",
                "circle-opacity": 0.12,
                "circle-blur": 1,
              }}
            />
            {/* Plane symbol rotated by heading */}
            <Layer
              id="aircraft-symbol"
              type="symbol"
              layout={{
                "text-field": "✈",
                "text-size": 13,
                "text-rotate": ["get", "heading_deg"],
                "text-rotation-alignment": "map",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{
                "text-color": "#22d3ee",
                "text-halo-color": "#000000",
                "text-halo-width": 1,
              }}
            />
            {/* Callsign label */}
            <Layer
              id="aircraft-label"
              type="symbol"
              layout={{
                "text-field": ["get", "callsign"],
                "text-size": 8,
                "text-offset": [0, 1.4],
                "text-anchor": "top",
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": "#67e8f9",
                "text-halo-color": "#000000",
                "text-halo-width": 1,
              }}
            />
          </Source>
        )}
      </Map>

      {/* Aircraft toggle + count */}
      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        <button
          onClick={() => setShowAircraft((v) => !v)}
          className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] tracking-wider uppercase backdrop-blur transition-colors ${
            showAircraft
              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
              : "border-zinc-700 bg-zinc-900/80 text-zinc-500"
          }`}
        >
          <span>✈</span>
          {showAircraft
            ? `${aircraft.length} aircraft live`
            : "ADS-B off"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-md bg-background/80 p-2 text-xs backdrop-blur">
        {(Object.entries(SEVERITY_COLOR) as [Severity, string][]).map(
          ([severity, color]) => (
            <div key={severity} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {severity}
              {severity === "CRITICAL" && (
                <span className="text-red-400 animate-pulse">●</span>
              )}
            </div>
          )
        )}
      </div>

      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/80 text-sm text-muted-foreground">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
        </div>
      )}
    </div>
  );
}
