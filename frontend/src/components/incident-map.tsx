"use client";

import { useCallback, useRef, useState } from "react";
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
        },
      })),
  };
}

interface Props {
  onSelectIncident?: (incident: Incident) => void;
}

export function IncidentMap({ onSelectIncident }: Props) {
  const mapRef = useRef<MapRef>(null);
  const { incidents } = useIncidents();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const geojson = incidentsToGeoJson(incidents);

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
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "pointer";
    }
    const id = e.features?.[0]?.properties?.id as string | undefined;
    if (id) setHoveredId(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = "";
    }
    setHoveredId(null);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border/60">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{
          longitude: 0,
          latitude: 20,
          zoom: 2,
        }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["incident-circles"]}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Source id="incidents" type="geojson" data={geojson}>
          {/* Outer glow ring */}
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

          {/* Main marker */}
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
      </Map>

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
