"use client";

import { useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Incident, IncidentEvent } from "@/types/incident";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Props {
  incident: Incident;
  events: IncidentEvent[];
}

function compassDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function bearingBetween(a: [number, number], b: [number, number]): number {
  const dLon = (b[0] - a[0]) * (Math.PI / 180);
  const lat1 = a[1] * (Math.PI / 180);
  const lat2 = b[1] * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function IncidentDetailMap({ incident, events }: Props) {
  const mapRef = useRef<MapRef>(null);
  const animFrameRef = useRef<number>(0);

  // Extract drone waypoints sorted by time
  const droneWaypoints: Array<{ lon: number; lat: number; ts: number }> =
    events
      .filter((e) => e.source_class === "DRONE")
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())
      .map((e) => ({ lon: e.lon, lat: e.lat, ts: new Date(e.received_at).getTime() }));

  // Non-drone sensor markers
  const sensorMarkers = events.filter((e) => e.source_class !== "DRONE");

  // Animated drone position state
  const [droneLon, setDroneLon] = useState<number | null>(null);
  const [droneLat, setDroneLat] = useState<number | null>(null);
  const [droneHeading, setDroneHeading] = useState(0);
  const playheadRef = useRef(0); // seconds into animation

  // Build a looping 60-second animation across all waypoints
  useEffect(() => {
    if (droneWaypoints.length === 0) return;

    const LOOP_DURATION = 60; // seconds for a full lap
    const startTime = performance.now();

    function tick() {
      const elapsed = (performance.now() - startTime) / 1000;
      playheadRef.current = elapsed % LOOP_DURATION;
      const t = playheadRef.current / LOOP_DURATION; // 0–1

      if (droneWaypoints.length === 1) {
        setDroneLon(droneWaypoints[0].lon);
        setDroneLat(droneWaypoints[0].lat);
      } else {
        const segCount = droneWaypoints.length - 1;
        const segT = t * segCount;
        const segIdx = Math.min(Math.floor(segT), segCount - 1);
        const segFrac = segT - segIdx;
        const from = droneWaypoints[segIdx];
        const to = droneWaypoints[segIdx + 1];
        const lon = from.lon + (to.lon - from.lon) * segFrac;
        const lat = from.lat + (to.lat - from.lat) * segFrac;
        setDroneLon(lon);
        setDroneLat(lat);
        setDroneHeading(bearingBetween([from.lon, from.lat], [to.lon, to.lat]));
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [droneWaypoints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // GeoJSON for the drone trajectory line
  const trajectoryGeoJson = {
    type: "FeatureCollection" as const,
    features: droneWaypoints.length >= 2
      ? [{
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: droneWaypoints.map((w) => [w.lon, w.lat]),
          },
          properties: {},
        }]
      : [],
  };

  const centerLon = incident.lon ?? (droneWaypoints[0]?.lon ?? 45.0);
  const centerLat = incident.lat ?? (droneWaypoints[0]?.lat ?? 24.0);

  function sensorColor(cls: string): string {
    switch (cls) {
      case "CAMERA":    return "#f59e0b";
      case "RF_SENSOR": return "#8b5cf6";
      case "RADAR":     return "#06b6d4";
      default:          return "#6b7280";
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-800">
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: centerLon, latitude: centerLat, zoom: 14 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        {/* Drone trajectory line */}
        <Source id="trajectory" type="geojson" data={trajectoryGeoJson}>
          <Layer
            id="trajectory-glow"
            type="line"
            paint={{
              "line-color": "#22d3ee",
              "line-width": 6,
              "line-opacity": 0.15,
              "line-blur": 3,
            }}
          />
          <Layer
            id="trajectory-line"
            type="line"
            paint={{
              "line-color": "#22d3ee",
              "line-width": 1.5,
              "line-opacity": 0.7,
              "line-dasharray": [4, 3],
            }}
          />
        </Source>

        {/* Sensor markers (Camera, RF, Radar) */}
        {sensorMarkers.map((ev) => (
          <Marker key={ev.id} longitude={ev.lon} latitude={ev.lat} anchor="center">
            <div
              className="relative flex items-center justify-center"
              title={`${ev.source_class} · ${ev.source_id}`}
            >
              <div
                className="h-3 w-3 rounded-full border border-black/40"
                style={{ backgroundColor: sensorColor(ev.source_class) }}
              />
              <span className="absolute -top-4 left-3 whitespace-nowrap rounded bg-zinc-900/90 px-1 py-0.5 text-[8px] text-zinc-300 opacity-0 hover:opacity-100 transition-opacity">
                {ev.source_class}
              </span>
            </div>
          </Marker>
        ))}

        {/* Animated drone marker */}
        {droneLon !== null && droneLat !== null && (
          <Marker longitude={droneLon} latitude={droneLat} anchor="center">
            <div
              className="relative flex items-center justify-center"
              style={{ transform: `rotate(${droneHeading}deg)` }}
            >
              {/* Outer pulse ring */}
              <div
                className="absolute rounded-full border border-cyan-400/40"
                style={{
                  width: 36,
                  height: 36,
                  animation: "ping 1.6s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              {/* Inner ring */}
              <div className="absolute h-7 w-7 rounded-full border border-cyan-400/30" />
              {/* Drone body */}
              <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400 bg-zinc-950 shadow-[0_0_8px_#22d3ee80]">
                <svg viewBox="0 0 16 16" className="h-3 w-3 fill-cyan-300" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                  <path d="M3 3h2v2H3zM11 3h2v2h-2zM3 11h2v2H3zM11 11h2v2h-2z" opacity=".5"/>
                  <path d="M4.5 4.5L7 7M11.5 4.5L9 7M4.5 11.5L7 9M11.5 11.5L9 9" stroke="#67e8f9" strokeWidth=".8" fill="none"/>
                </svg>
              </div>
            </div>
          </Marker>
        )}

        {/* Geohash cell center pulse */}
        <Marker longitude={centerLon} latitude={centerLat} anchor="center">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400/40 shadow-[0_0_6px_#22d3ee]" />
        </Marker>
      </Map>

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-zinc-950/80 px-2.5 py-2 backdrop-blur-sm border border-zinc-800/60 text-[9px] font-mono text-zinc-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full border border-cyan-400 bg-zinc-950" />
          <span>Drone (live)</span>
        </div>
        {sensorMarkers.some((e) => e.source_class === "CAMERA") && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Camera</span>
          </div>
        )}
        {sensorMarkers.some((e) => e.source_class === "RF_SENSOR") && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-violet-400" />
            <span>RF Sensor</span>
          </div>
        )}
        {sensorMarkers.some((e) => e.source_class === "RADAR") && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Radar</span>
          </div>
        )}
      </div>

      {/* Compass indicator */}
      {droneLon !== null && (
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/80 backdrop-blur-sm">
          <span className="text-[9px] font-mono text-cyan-400 font-bold">
            {compassDir(droneHeading)}
          </span>
        </div>
      )}
    </div>
  );
}
