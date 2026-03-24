# Sentinel Fusion — Architecture & Build Document
**Atam Alignment Prototype | Edge-to-Intelligence Pipeline**

---

## 1. Purpose of This Document

This is not a portfolio toy. This is a working technical brief for a prototype that demonstrates how fragmented raw sensor data — detections, telemetry, RF signals — becomes actionable operational intelligence through a purpose-built software layer.

The prototype is scoped for 2 days of focused execution. Every decision below is made with that constraint in mind without sacrificing architectural credibility.

---

## 2. Problem Statement

Autonomous defense systems generate high volumes of raw, heterogeneous sensor data. The data itself is not the value. The value is the **intelligence extracted from it** — correlated, scored, and served to operators fast enough to matter.

The software layer between raw sensor output and operator action is where most systems fail:

- Events arrive from different sources with no shared schema
- Correlation across sensors requires spatial and temporal reasoning
- Alert fatigue comes from poor scoring and no deduplication
- Operators need sub-second access to current operational picture
- The system must stay reliable under real operational load

This prototype addresses all five.

---

## 3. What This Prototype Demonstrates

| Capability | Signal to Founders |
|---|---|
| Edge-to-cloud pipeline design | You've thought about the full deployment reality |
| Multi-source event normalization | You understand heterogeneous sensor environments |
| Spatial + temporal correlation engine | You can build the hard part, not just the API wrapper |
| Confidence + severity scoring | You understand intelligence grading, not just alerting |
| Sub-100ms operator API | You think about latency in mission-critical systems |
| Observable pipeline | You know production systems need visibility |
| One-command deployment | You respect other engineers' time |

---

## 4. System Overview

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

## 5. Stack Decision

**Backend: Rust (Axum + Tokio + SQLx)**

Quarkus is the faster build. Rust is the right signal for this company. Atam is building autonomous defense systems — they will eventually have Rust in their stack whether they know it yet or not. Showing up with idiomatic, production-quality Rust code is a differentiated signal.

The risk of slower development is real but manageable. The fusion engine and API are not complex enough to lose the 2-day window.

**Database: PostgreSQL + PostGIS**

PostGIS gives spatial indexing and geohash functions without building them from scratch. `ST_DWithin`, `ST_GeoHash`, and `ST_Collect` are exactly what the fusion engine needs.

**Frontend: Next.js (minimal, Day 2 only)**

Not the focus. Functional over beautiful. The goal is to show incidents on a map and in a list — enough for a live demo walkthrough.

---

## 6. Database Schema

```sql
-- Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Raw events from any sensor source
CREATE TABLE raw_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    TEXT NOT NULL CHECK (event_type IN ('DETECTION', 'TELEMETRY', 'SIGNAL', 'STATUS')),
    source_id     TEXT NOT NULL,
    source_class  TEXT NOT NULL,  -- 'DRONE', 'CAMERA', 'RF_SENSOR', 'RADAR'
    location      GEOMETRY(Point, 4326),
    payload       JSONB NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    normalized_at TIMESTAMPTZ
);

CREATE INDEX idx_raw_events_location    ON raw_events USING GIST(location);
CREATE INDEX idx_raw_events_received_at ON raw_events(received_at DESC);
CREATE INDEX idx_raw_events_type        ON raw_events(event_type);
CREATE INDEX idx_raw_events_source_id   ON raw_events(source_id);

-- Fused intelligence incidents
CREATE TABLE incidents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT NOT NULL,
    summary          TEXT NOT NULL,
    severity         TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confidence       FLOAT NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UPDATING', 'CLOSED')),
    location         GEOMETRY(Point, 4326),
    geohash          TEXT NOT NULL,
    event_ids        UUID[] NOT NULL,
    event_types      TEXT[] NOT NULL,
    source_count     INT NOT NULL,
    source_diversity INT NOT NULL,
    first_event_at   TIMESTAMPTZ NOT NULL,
    last_event_at    TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_location     ON incidents USING GIST(location);
CREATE INDEX idx_incidents_severity     ON incidents(severity);
CREATE INDEX idx_incidents_status       ON incidents(status);
CREATE INDEX idx_incidents_geohash      ON incidents(geohash);
CREATE INDEX idx_incidents_last_event   ON incidents(last_event_at DESC);
```

---

## 7. Canonical Event Schema

All incoming events are normalized to this internal representation before storage and processing.

```json
{
  "id": "uuid",
  "event_type": "DETECTION | TELEMETRY | SIGNAL | STATUS",
  "source_id": "cam-alpha-07",
  "source_class": "CAMERA | DRONE | RF_SENSOR | RADAR",
  "lat": 24.7136,
  "lon": 46.6753,
  "payload": { "..." : "..." },
  "received_at": "2026-03-23T14:22:01Z"
}
```

**Incoming raw formats per source type:**

```json
// Camera / Computer Vision detection
{
  "source": "cam-alpha-07",
  "type": "detection",
  "objects": [{ "class": "vehicle", "confidence": 0.91, "speed_kmh": 87 }],
  "lat": 24.7136, "lon": 46.6753,
  "ts": 1711200121
}

// Drone telemetry
{
  "drone_id": "sentinel-02",
  "altitude_m": 120,
  "heading_deg": 247,
  "speed_ms": 12.4,
  "battery_pct": 61,
  "lat": 24.7138, "lon": 46.6751,
  "timestamp": "2026-03-23T14:22:03Z"
}

// RF sensor anomaly
{
  "sensor_id": "rf-sensor-03",
  "frequency_mhz": 433.9,
  "strength_dbm": -62,
  "anomaly": true,
  "anomaly_type": "UNKNOWN_TRANSMISSION",
  "position": { "lat": 24.7141, "lon": 46.6748 }
}
```

---

## 8. API Contracts

### Ingest Event
```
POST /api/events
Content-Type: application/json

Response 202:
{
  "id": "uuid",
  "received_at": "2026-03-23T14:22:01Z",
  "normalized": true
}
```

### List Incidents
```
GET /api/incidents
  ?severity=HIGH,CRITICAL
  &status=OPEN
  &since=2026-03-23T00:00:00Z
  &limit=50
  &offset=0

Response 200:
{
  "incidents": [ ...IncidentSummary ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

### Incident Detail
```
GET /api/incidents/:id

Response 200:
{
  "id": "uuid",
  "title": "Multi-sensor convergence — Grid 24.71N/46.67E",
  "summary": "Vehicle detection, RF anomaly, and aerial observation correlated within 180s.",
  "severity": "CRITICAL",
  "confidence": 0.94,
  "status": "OPEN",
  "location": { "lat": 24.7138, "lon": 46.6751 },
  "event_types": ["DETECTION", "SIGNAL", "TELEMETRY"],
  "source_count": 3,
  "source_diversity": 3,
  "first_event_at": "...",
  "last_event_at": "...",
  "source_events": [ ...NormalizedEvent ]
}
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

Response 200:
{
  "status": "ok",
  "db": "connected",
  "uptime_seconds": 3847
}
```

---

## 9. Fusion Engine — Core Logic

This is the heart of the system. The fusion engine runs every 30 seconds on a Tokio interval timer.

```
FUSION CYCLE:

1. WINDOW QUERY
   SELECT events from the last 5 minutes
   that are not assigned to a CLOSED incident

2. SPATIAL CLUSTERING
   Group events by ST_GeoHash(location, 7)
   Geohash precision 7 ≈ 150m x 150m cell
   Events in adjacent cells merged via ST_DWithin(300m)

3. TEMPORAL FILTERING
   Within each cluster, group events within a 3-minute
   sliding window. Multiple windows can produce multiple
   incidents from the same spatial cell.

4. CLUSTER SCORING

   confidence =
     min(event_count / 5, 1.0) * 0.30          // volume
     + (distinct_source_classes / 4) * 0.40    // diversity
     + (1.0 - avg_age_seconds / 300) * 0.30    // recency

   severity:
     confidence >= 0.85 AND source_diversity == 4  → CRITICAL
     confidence >= 0.70 OR  source_diversity >= 3  → HIGH
     confidence >= 0.50 OR  source_diversity >= 2  → MEDIUM
     default                                        → LOW

   SIGNAL anomaly present + any other type → escalate one level

5. TITLE + SUMMARY GENERATION (deterministic templates)

   DETECTION + SIGNAL + TELEMETRY:
     "Multi-sensor convergence — Grid {geohash}"
     "Vehicle detection, RF anomaly, and aerial observation
      correlated within {duration}s at {geohash}."

   DETECTION + SIGNAL:
     "RF-corroborated detection — {geohash}"
     "Object detection at {geohash} corroborated by RF anomaly
      on {frequency_mhz} MHz from {source_id}."

   TELEMETRY only:
     "Unresolved aerial activity — {geohash}"
     "Drone telemetry cluster at {geohash} without visual or
      signal corroboration. Monitoring."

6. DEDUPLICATION
   Check for OPEN incident at same geohash in last 10 minutes.
   Found  → UPDATE: append event_ids, recalculate score,
             set status = UPDATING, update last_event_at
   Not found → INSERT new incident

7. STALE CLOSURE
   OPEN incidents with no new events for 15 minutes → CLOSED
```

---

## 10. Repo Structure

```
sentinel-fusion/
│
├── backend/                         # Rust workspace
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── crates/
│   │   ├── api/                     # Axum HTTP server
│   │   │   └── src/
│   │   │       ├── main.rs
│   │   │       ├── state.rs         # AppState (db pool, config)
│   │   │       ├── routes/
│   │   │       │   ├── events.rs    # POST /api/events
│   │   │       │   ├── incidents.rs
│   │   │       │   ├── stats.rs
│   │   │       │   └── health.rs
│   │   │       └── middleware/
│   │   │           └── metrics.rs
│   │   │
│   │   ├── fusion/                  # Fusion engine
│   │   │   └── src/
│   │   │       ├── engine.rs        # Main loop (Tokio interval)
│   │   │       ├── clustering.rs    # Geohash + proximity
│   │   │       ├── scoring.rs       # Confidence + severity
│   │   │       ├── dedup.rs         # Open incident matching
│   │   │       └── templates.rs     # Title/summary generation
│   │   │
│   │   ├── ingest/                  # Normalizer
│   │   │   └── src/
│   │   │       ├── normalizer.rs
│   │   │       └── sources/
│   │   │           ├── camera.rs
│   │   │           ├── drone.rs
│   │   │           ├── rf_sensor.rs
│   │   │           └── radar.rs
│   │   │
│   │   └── db/                      # Database layer
│   │       └── src/
│   │           ├── models.rs
│   │           └── queries/
│   │               ├── events.rs
│   │               └── incidents.rs
│   │
│   └── migrations/
│       ├── 001_schema.sql
│       └── 002_indexes.sql
│
├── frontend/                        # Next.js (Day 2)
│   └── src/
│       ├── app/
│       │   ├── page.tsx             # Incident feed
│       │   └── incidents/[id]/
│       │       └── page.tsx         # Detail view
│       └── components/
│           ├── IncidentCard.tsx
│           ├── IncidentMap.tsx      # Leaflet
│           └── StatsPanel.tsx
│
├── seed/
│   ├── events.json                  # 100 realistic events
│   └── seed.sh                      # curl loop poster
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 11. 2-Day Execution Plan

### Day 1 — Backend (8 hours)

| Hours | Task | Done When |
|---|---|---|
| 0:00–0:30 | Docker Compose: Postgres + PostGIS. Migrations run on startup. | `docker compose up` starts cleanly |
| 0:30–1:30 | Rust workspace scaffold. Axum server running. SQLx pool connected. | App compiles, `/api/health` returns 200 |
| 1:30–2:30 | Ingest: `POST /api/events` + normalization for 3 source types | Events appear in `raw_events` |
| 2:30–4:30 | Fusion engine: clustering, scoring, incident write | Incidents appear in `incidents` after timer fires |
| 4:30–5:30 | Deduplication + stale closure logic | Rerunning on same events doesn't create duplicates |
| 5:30–6:30 | Intelligence API: `GET /incidents`, `GET /incidents/:id` | Returns correct, well-structured JSON |
| 6:30–7:30 | Stats + health endpoints | `/api/stats` reflects live pipeline activity |
| 7:30–8:00 | Seed script. Full end-to-end walkthrough. | 3 event types in → CRITICAL incident out |

**Day 1 exit criteria:** POST 3 events of different types near the same coordinates → fusion engine fires → CRITICAL incident visible at `GET /api/incidents`.

---

### Day 2 — Frontend + Polish (8 hours)

| Hours | Task | Done When |
|---|---|---|
| 0:00–2:00 | Next.js scaffold. Incident list with live polling (5s). Severity badges. | Feed updates automatically |
| 2:00–3:00 | Incident detail page: summary, source events, confidence bar | Full incident readable in UI |
| 3:00–4:00 | Map view: Leaflet with incident markers colored by severity | CRITICAL = red, HIGH = orange on map |
| 4:00–4:30 | Stats panel: events/min, open incidents, avg confidence, fusion lag | Header shows live pipeline health |
| 4:30–5:30 | Seed polish: 3 named scenarios (see Section 12) | Demo is repeatable and compelling |
| 5:30–6:30 | README: architecture diagram, setup instructions, design decisions section | One-command startup documented |
| 6:30–7:30 | Demo narrative written out (see Section 13) | You can walk through it without notes |
| 7:30–8:00 | Buffer. Stretch: add radar-type event source as 4th normalizer | — |

---

## 12. Seed Scenarios (Make the Demo Feel Real)

Three named scenarios in `seed/events.json`. Each tells a story.

### Scenario A: Converging Threat (produces CRITICAL)
Three events, same geohash, within 90 seconds:

```json
[
  {
    "source": "cam-alpha-07", "type": "detection",
    "objects": [{ "class": "vehicle", "confidence": 0.91, "speed_kmh": 87 }],
    "lat": 24.7136, "lon": 46.6753, "ts": 1711200000
  },
  {
    "sensor_id": "rf-sensor-03", "frequency_mhz": 433.9,
    "strength_dbm": -62, "anomaly": true,
    "anomaly_type": "UNKNOWN_TRANSMISSION",
    "position": { "lat": 24.7141, "lon": 46.6748 },
    "ts": 1711200045
  },
  {
    "drone_id": "sentinel-02", "altitude_m": 120,
    "heading_deg": 247, "speed_ms": 12.4, "battery_pct": 61,
    "lat": 24.7138, "lon": 46.6751,
    "timestamp": "2026-03-23T14:22:03Z"
  }
]
```

Expected output:
```
INCIDENT: Multi-sensor convergence — Grid 7jvhf2g
Severity:   CRITICAL
Confidence: 0.91
Summary:    Vehicle detection, RF anomaly, and aerial observation
            correlated within 90s. 3 sources, 3 sensor classes.
```

---

### Scenario B: RF Anomaly Cluster (produces HIGH)
Four RF sensors detecting the same unknown transmission from slightly different positions — a realistic drone swarm precursor signature:

```json
[
  { "sensor_id": "rf-01", "frequency_mhz": 915.0, "anomaly": true,
    "position": { "lat": 24.720, "lon": 46.680 } },
  { "sensor_id": "rf-02", "frequency_mhz": 914.8, "anomaly": true,
    "position": { "lat": 24.721, "lon": 46.681 } },
  { "sensor_id": "rf-03", "frequency_mhz": 915.1, "anomaly": true,
    "position": { "lat": 24.719, "lon": 46.679 } },
  { "sensor_id": "rf-04", "frequency_mhz": 915.0, "anomaly": true,
    "position": { "lat": 24.722, "lon": 46.682 } }
]
```

Expected output:
```
INCIDENT: Multi-source RF anomaly cluster — Grid 7jvhf3k
Severity:   HIGH
Confidence: 0.76
Summary:    Four RF sensors reporting anomalous transmission on
            ~915 MHz within 300m radius. Possible drone control
            frequency. No visual corroboration yet.
```

---

### Scenario C: Lone Telemetry (produces LOW → escalates to MEDIUM)
Single drone patrol with no corroboration — starts LOW, escalates when a DETECTION event arrives nearby 4 minutes later:

```
t=0:    TELEMETRY from drone-sentinel-04 → LOW incident created
t=+4m:  DETECTION from cam-beta-02 nearby → fusion re-runs
        → incident UPDATED, severity escalated to MEDIUM
```

This scenario demonstrates **live incident updating** — one of the strongest demo moments.

---

## 13. Demo Narrative (Founder Walkthrough)

Walk through this in order. Total time: ~8 minutes.

**Opening (30 seconds)**
> "This is Sentinel Fusion — a prototype of the software layer between raw sensor data and operator action. I built it in two days to show how I think about this problem. Let me walk you through it."

**Step 1 — Show the empty dashboard (30 seconds)**
> "This is the operator view. Nothing is happening yet. The stats panel shows the pipeline is live — zero events, zero incidents."

**Step 2 — Run Scenario A (2 minutes)**
> "I'm going to simulate three sensors detecting the same activity. A camera picks up a vehicle. An RF sensor detects an unknown transmission 50 meters away. A drone overhead captures telemetry placing it in the same grid. All within 90 seconds."

Run: `./seed/seed.sh scenario_a`

> "The fusion engine runs. It clusters these three events spatially and temporally. It scores them — three sensor types, three distinct sources, recent — and generates a CRITICAL incident. Let me show you the detail."

Click into the incident.

> "Notice the summary is derived from the actual field values — the frequency, the speed, the geohash. It's not hardcoded. And every contributing event is linked — full audit trail back to the raw sensor output."

**Step 3 — Show the map (1 minute)**
> "On the map, CRITICAL incidents are red. If I had 20 sensors covering a border zone, this map is the operator's real-time picture."

**Step 4 — Run Scenario C (2 minutes)**
> "Now I'll show incident updating. A drone patrol generates a LOW incident — single source, no corroboration. Four minutes later, a camera picks up an object nearby."

Run: `./seed/seed.sh scenario_c_part1`  
*(pause)*  
Run: `./seed/seed.sh scenario_c_part2`

> "The fusion engine re-runs. It finds the open incident at that geohash, appends the new event, recalculates the score, and escalates severity. No duplicate. The operator sees a live update, not a new noisy alert."

**Step 5 — Show the stats panel (1 minute)**
> "The pipeline metrics: events per minute, fusion cycle latency, open incident count. This is how you know the system is healthy under operational load."

**Closing (1 minute)**
> "What I want you to take away from this is not the features. It's the architectural thinking underneath: edge-first, explainable scoring, deduplication that prevents alert fatigue, full event lineage. These are the things that matter when this runs in a real operational environment — not a demo environment."

---

## 14. Architecture Brief for Founders

*This section is written for the co-founder conversation, not the README.*

### Why I built this

The hard problem in autonomous defense intelligence is not ingestion — ingestion is commodity. It's the correlation layer: deciding which events belong together, what they mean collectively, and how to express confidence in a way operators can actually act on.

Most implementations either count events (too simple — causes alert fatigue) or use black-box ML (too opaque — operators don't trust it in the field). This prototype takes a deliberate middle path: **deterministic, explainable, tunable scoring** that is transparent enough to audit and fast enough to run at the edge.

### What I would change at production scale

**1. Move fusion to the edge node.** The current prototype routes everything to a central platform. At real sensor density, you need correlation happening on the edge before data is sent up — both for latency and offline resilience. The cloud becomes aggregation and persistence, not the decision layer.

**2. Replace the fusion hot path with a compiled Rust binary deployed on Jetson.** The correlation loop is the one component where latency and memory efficiency matter most. Rust on CUDA-enabled hardware with zero-copy processing is the right architecture for that.

**3. Add a streaming backbone.** The current 30-second timer is a prototype approximation. Production needs Kafka or a lightweight equivalent to make the pipeline fully event-driven and horizontally scalable.

**4. Build a feedback loop.** Operators confirming or dismissing incidents should feed back into confidence model calibration. Without this, the system never learns and never improves beyond its initial tuning.

### The hard problems I haven't solved yet

**Track continuity.** Each fusion window is independent. A real system needs to link incidents over time — the CRITICAL at 14:32 is the same entity as the HIGH at 14:28. This requires a separate tracking layer on top of the fusion engine.

**Spoofing detection.** A compromised or jammed sensor can poison a cluster's confidence score. The system needs anomaly detection at the sensor layer itself, not just at the event layer.

**Geohash boundary artifacts.** Events near a cell edge can split across two cells and never fuse. The current `ST_DWithin` expansion helps but does not fully solve this at low event density.

**Drone swarm vs. single-actor classification.** Distinguishing a swarm of 50 Shaheds from 50 unrelated sensor hits in the same region requires temporal pattern analysis beyond what a single fusion window can see.

---

## 15. Positioning

**DM to founders:**
> "I built a working prototype of a multi-sensor intelligence fusion platform — ingest, correlation, scoring, and operator API — specifically to show how I think about the software layer your platform will need. The architecture brief at the end of the README explains both what I built and where the real hard problems are. Happy to walk through it with you."

**LinkedIn:**
> "Built Sentinel Fusion in 2 days — an edge-to-cloud intelligence pipeline that fuses raw detection, telemetry, and RF events into correlated, scored incidents. The interesting part isn't the code. It's the correlation logic and what it takes to make the output trustworthy enough for operators to act on."

**In conversation:**
> "The interesting problem isn't ingestion — that's solved. It's the correlation layer: how do you decide which events belong together, how confident should you be, and how do you make that explainable enough that an operator actually trusts it? That's what I focused on."

---

*Sentinel Fusion — built to think at the system level, not just the feature level.*