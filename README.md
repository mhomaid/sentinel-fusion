# Sentinel Fusion

**Edge-to-intelligence pipeline for multi-sensor autonomous defense systems.**

Raw sensor events — detections, drone telemetry, RF anomalies — are ingested, normalized, spatially and temporally correlated, scored, and served to operators as actionable intelligence incidents in under 100ms.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        EDGE LAYER                           │
│  Drone / Camera / RF Sensor / Radar (simulated)             │
│  → publishes raw JSON events via HTTP POST                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER                          │
│  Rust · Axum HTTP server                                    │
│  · Validates and stamps incoming events                     │
│  · Normalizes to canonical schema                           │
│  · Writes to raw_events (PostgreSQL)                        │
│  · Publishes to internal event channel                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    FUSION ENGINE                            │
│  Rust · Tokio async runtime                                 │
│  · Runs on sliding time window (configurable, default 5min) │
│  · Clusters events by geohash + type proximity              │
│  · Scores clusters: confidence + severity                   │
│  · Creates or updates incidents                             │
│  · Deduplicates open incidents                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE STORE                         │
│  PostgreSQL + PostGIS                                       │
│  · raw_events table                                         │
│  · incidents table                                          │
│  · Geospatial indexes on both                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE API                           │
│  Rust · Axum REST                                           │
│  · GET /api/incidents (filterable, paginated)               │
│  · GET /api/incidents/:id (full detail + source events)     │
│  · GET /api/stats (pipeline health + throughput)            │
│  · GET /api/health                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  OPERATOR DASHBOARD                         │
│  Next.js · Minimal · Functional                             │
│  · Incident feed (live polling, 5s interval)                │
│  · Incident detail with source event breakdown              │
│  · Map view with incident clusters (Leaflet + PostGIS)      │
│  · Pipeline stats panel                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|---|---|
| API + Ingestion | Rust · Axum · Tokio |
| Database client | SQLx (compile-time query checking) |
| Intelligence store | PostgreSQL + PostGIS |
| Operator dashboard | Next.js (App Router) |
| Map rendering | Leaflet.js |
| Infrastructure | Docker Compose |

---

## Quick Start

**Prerequisites:** Docker, Docker Compose, Rust toolchain (`rustup`), Node 20+

```bash
# 1. Clone and configure
git clone https://github.com/mhomaid/sentinel-fusion
cd sentinel-fusion
cp .env.example .env

# 2. Start infrastructure
docker compose up -d

# 3. Run the backend (migrations applied automatically)
cd backend
cargo run --bin api

# 4. Seed demo data (in a separate terminal)
cd seed
chmod +x seed.sh
./seed.sh scenario_a       # → CRITICAL incident
./seed.sh scenario_b       # → HIGH incident
./seed.sh scenario_c_part1 # → LOW incident
./seed.sh scenario_c_part2 # → escalates to MEDIUM

# 5. Start the operator dashboard
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## API Reference

### Ingest Event
```
POST /api/events
Content-Type: application/json

Response 202: { "id": "uuid", "received_at": "...", "normalized": true }
```

### List Incidents
```
GET /api/incidents?severity=HIGH,CRITICAL&status=OPEN&since=...&limit=50&offset=0

Response 200: { "incidents": [...], "total": 12, "limit": 50, "offset": 0 }
```

### Incident Detail
```
GET /api/incidents/:id

Response 200: full incident with linked source_events array
```

### Pipeline Stats
```
GET /api/stats

Response 200:
{
  "events_last_hour": 847,
  "events_last_minute": 14,
  "open_incidents": 3,
  "critical_incidents": 1,
  "fusion_runs": 24,
  "last_fusion_at": "...",
  "avg_fusion_latency_ms": 42
}
```

### Health
```
GET /api/health

Response 200: { "status": "ok", "db": "connected", "uptime_seconds": 3847 }
```

---

## Fusion Engine

The fusion engine runs every 30 seconds on a Tokio interval timer and processes the following pipeline:

1. **Window query** — fetch events from the last 5 minutes not assigned to a closed incident
2. **Spatial clustering** — group by `ST_GeoHash(location, 7)` (≈150m × 150m cells), merge adjacent cells within 300m via `ST_DWithin`
3. **Temporal filtering** — within each cluster, group events in 3-minute sliding windows
4. **Scoring**

```
confidence =
  min(event_count / 5, 1.0)          × 0.30   // volume
  + (distinct_source_classes / 4)    × 0.40   // diversity
  + (1.0 - avg_age_seconds / 300)    × 0.30   // recency

severity:
  confidence ≥ 0.85 AND source_diversity == 4  → CRITICAL
  confidence ≥ 0.70 OR  source_diversity ≥ 3   → HIGH
  confidence ≥ 0.50 OR  source_diversity ≥ 2   → MEDIUM
  default                                       → LOW

SIGNAL anomaly present + any other type → escalate one level
```

5. **Title + summary generation** — deterministic templates derived from actual field values (frequency, speed, geohash)
6. **Deduplication** — open incident at same geohash in last 10 minutes → update, not insert
7. **Stale closure** — open incidents with no new events for 15 minutes → CLOSED

---

## Repo Structure

```
sentinel-fusion/
│
├── backend/                         # Rust workspace
│   ├── Cargo.toml
│   ├── crates/
│   │   ├── api/                     # Axum HTTP server
│   │   ├── fusion/                  # Fusion engine
│   │   ├── ingest/                  # Event normalizer
│   │   └── db/                      # Database layer
│   └── migrations/
│       ├── 001_schema.sql
│       └── 002_indexes.sql
│
├── frontend/                        # Next.js operator dashboard
│   └── src/
│       ├── app/
│       └── components/
│
├── seed/
│   ├── events.json                  # 3 named demo scenarios
│   └── seed.sh                      # curl loop poster
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Design Decisions

### Why deterministic scoring over ML

The hard problem in autonomous defense intelligence is not ingestion — it's the correlation layer. Most implementations either count events (causes alert fatigue) or use black-box ML (operators don't trust opaque output in the field). This prototype takes a deliberate middle path: **deterministic, explainable, tunable scoring** that is transparent enough to audit and fast enough to run at the edge.

Every incident's confidence score can be traced back to the exact event count, source diversity, and recency values that produced it.

### Why Rust

Atam is building autonomous defense systems. Rust is the right signal: memory safety without a GC, zero-cost abstractions, and a compiler that eliminates entire classes of production failures. The fusion hot path and the API server share a single async runtime (Tokio) with no thread-per-request overhead.

### Why PostGIS over a custom spatial index

`ST_DWithin`, `ST_GeoHash`, and `ST_Collect` are exactly what the fusion engine needs. Building spatial indexing from scratch would trade weeks of engineering for something PostGIS has already solved and battle-tested.

### Deduplication design

A naïve implementation would create one incident per fusion cycle, drowning operators in duplicates. The deduplication step checks for an open incident at the same geohash within the last 10 minutes before inserting. Matching incidents are updated in place — event list appended, score recalculated, status set to `UPDATING`. The operator sees a live update, not a new noisy alert.

---

## What Changes at Production Scale

1. **Move fusion to the edge node.** At real sensor density, correlation needs to happen on-device before data is sent up — both for latency and offline resilience. The cloud becomes aggregation and persistence, not the decision layer.
2. **Compiled Rust binary on Jetson hardware.** The correlation loop is where latency and memory efficiency matter most. Rust on CUDA-enabled hardware with zero-copy processing is the right architecture.
3. **Streaming backbone.** The 30-second timer is a prototype approximation. Production needs Kafka or a lightweight equivalent for a fully event-driven, horizontally scalable pipeline.
4. **Operator feedback loop.** Confirmed or dismissed incidents feed back into confidence model calibration. Without this, the system never improves beyond its initial tuning.

---

*Sentinel Fusion — built to think at the system level, not just the feature level.*
