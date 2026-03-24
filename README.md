# Sentinel Fusion

**Edge-to-intelligence pipeline for multi-sensor autonomous defense systems.**

Raw sensor events — detections, drone telemetry, RF anomalies — are ingested, normalized, spatially and temporally correlated, scored, and pushed to operators as actionable intelligence incidents in real time via Server-Sent Events.

**Live deployment:**
| Service | URL |
|---|---|
| Operator Dashboard | https://sentinel-fusion-3eujdsj4l-mohamed-homaids-projects.vercel.app |
| API (health) | https://sentinel-fusion-production-1147.up.railway.app/api/health |

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
│  · Writes to raw_events (PostgreSQL + PostGIS)              │
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
│  · Broadcasts IncidentCreated/IncidentUpdated via SSE       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE STORE                         │
│  PostgreSQL + PostGIS                                       │
│  · raw_events table                                         │
│  · incidents table (lat/lon extracted from PostGIS geometry)│
│  · Geospatial indexes on both                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              INTELLIGENCE API + SSE STREAM                  │
│  Rust · Axum REST                                           │
│  · GET /api/stream (Server-Sent Events — real-time push)    │
│  · GET /api/incidents (filterable, paginated)               │
│  · GET /api/incidents/:id (full detail + source events)     │
│  · GET /api/stats (pipeline health + throughput)            │
│  · GET /api/health                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │  SSE stream
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  OPERATOR DASHBOARD                         │
│  Next.js · Shadcn UI · Mapbox GL JS                         │
│  · Dashboard   — 4 live stat cards + map + incident table   │
│  · Incidents   — filterable table, severity/status toggles  │
│  · Event Log   — live SSE stream with pause/resume/clear    │
│  · Analytics   — 5 Recharts visualizations + 6 KPI pills   │
│  · IncidentDetailPanel — slide-in sheet, full breakdown     │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Technology |
|---|---|
| API + Ingestion | Rust · Axum · Tokio |
| Database client | SQLx (compile-time query checking) |
| Intelligence store | PostgreSQL + PostGIS |
| Real-time transport | Server-Sent Events (SSE) |
| Operator dashboard | Next.js 16 (App Router) · Shadcn UI |
| Map rendering | Mapbox GL JS · react-map-gl |
| Package manager | Bun |
| Database migrations | Python · uv · psycopg |
| Infrastructure | Docker Compose |

---

## Quick Start

**Prerequisites:** Docker, Docker Compose, Rust toolchain (`rustup`), Bun, Python 3.11+, `uv`

```bash
# 1. Clone and configure
git clone https://github.com/mhomaid/sentinel-fusion
cd sentinel-fusion
cp .env.example .env
# Edit .env and set your Mapbox token:
#   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
# Get a free token at https://account.mapbox.com

# 2. Start infrastructure
docker compose up -d

# 3. Run database migrations
cd db-migrations
uv run migrations.py migrate
cd ..

# 4. Run the backend
cd backend
cargo run --bin api
cd ..

# 5. Seed demo data (in a separate terminal)
cd db-migrations/seed
chmod +x seed.sh
./seed.sh scenario_a       # → CRITICAL incident
./seed.sh scenario_b       # → HIGH incident
./seed.sh scenario_c_part1 # → LOW incident
./seed.sh scenario_c_part2 # → escalates to MEDIUM

# 6. Start the operator dashboard
cd frontend
bun install
bun run dev
# Open http://localhost:3000/dashboard
```

---

## Real-time Event Stream

The backend exposes a persistent **Server-Sent Events** stream at `GET /api/stream`.

### Why SSE over WebSockets

The dashboard is purely **server → client**: incidents are created/updated by the fusion engine and pushed to operators. SSE is the correct transport — unidirectional, HTTP/1.1 compatible, automatic reconnect built into `EventSource`, and zero client-side complexity. WebSockets would add unnecessary bidirectional overhead with no benefit.

### Event types

| Event name | Payload | Description |
|---|---|---|
| `incident_created` | `{ incident: Incident }` | Fusion engine opened a new incident |
| `incident_updated` | `{ incident: Incident }` | Score, severity, or source list changed |
| `stats_update` | `StatsPayload` | Every 5s — pipeline throughput snapshot |
| `heartbeat` | `{}` | Every 10s — keeps proxies from closing the connection |

### Connecting from the browser

```typescript
const source = new EventSource("http://localhost:8080/api/stream");

source.addEventListener("incident_created", (e) => {
  const { incident } = JSON.parse(e.data);
  // add to list
});

source.addEventListener("stats_update", (e) => {
  const stats = JSON.parse(e.data);
  // update counters
});
```

The frontend hooks (`useSSE`, `useIncidents`, `useStats`) handle this automatically with a singleton `EventSource` shared across all components.

---

## API Reference

### SSE Stream
```
GET /api/stream
Accept: text/event-stream

→ Persistent SSE connection
```

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

Response 200: full incident with lat/lon and source event IDs
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
2. **Spatial clustering** — group by geohash (precision 7, ≈150m × 150m cells)
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
7. **SSE broadcast** — after each upsert, broadcasts `INCIDENT_CREATED` or `INCIDENT_UPDATED`
8. **Stale closure** — open incidents with no new events for 15 minutes → CLOSED

---

## Repo Structure

```
sentinel-fusion/
│
├── backend/                         # Rust workspace
│   ├── Cargo.toml
│   ├── .sqlx/                       # Cached SQLx queries (offline builds)
│   └── crates/
│       ├── api/                     # Axum HTTP server + SSE endpoint
│       ├── fusion/                  # Fusion engine + SSE broadcast
│       ├── ingest/                  # Event normalizer
│       └── db/                      # Database layer (models + queries)
│
├── db-migrations/                   # Python migration CLI (uv)
│   ├── migrations.py                # uv run migrations.py migrate/status/seed
│   ├── migrations/
│   │   ├── 001_schema.sql
│   │   └── 002_indexes.sql
│   └── seed/
│       ├── events.json              # 3 named demo scenarios
│       └── seed.sh                  # curl loop poster
│
├── frontend/                        # Next.js 16 operator dashboard
│   └── src/
│       ├── app/
│       │   ├── (ops)/layout.tsx     # Shared sidebar + header layout
│       │   ├── (ops)/dashboard/     # Live stat cards, map, incident table
│       │   ├── (ops)/incidents/     # Filterable incident table
│       │   ├── (ops)/events/        # Live SSE event log (pause/resume)
│       │   └── (ops)/analytics/     # Charts: timeline, severity, status
│       ├── components/
│       │   ├── pipeline-stats.tsx   # 4 live-data stat cards
│       │   ├── incident-map.tsx     # Mapbox GL dark map with markers
│       │   ├── incident-table.tsx   # SSE-live table with severity filter
│       │   └── incident-detail-panel.tsx  # Slide-in incident sheet
│       ├── hooks/
│       │   ├── useSSE.ts            # Singleton EventSource manager
│       │   ├── useIncidents.ts      # SSE-live incident list
│       │   └── useStats.ts          # SSE-live pipeline stats
│       └── types/
│           └── incident.ts          # Shared TypeScript types
│
├── docker/
│   ├── Dockerfile.db                # postgres:18.3-alpine + PostGIS
│   └── init/01-extensions.sql       # Enables postgis + uuid-ossp
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Simulation — Generate Live Data

The `simulate.py` script continuously POSTs sensor events across 8 global hot-zones, creating incidents that appear live on the map.

```bash
cd db-migrations

# Burst mode — fire all zones once and exit (quick smoke-test)
uv run simulate.py --burst

# Continuous mode — 1 event/s forever (watch the map update live)
uv run simulate.py

# Faster simulation — 3 events/s
uv run simulate.py --rate 3

# Focus on a single zone
uv run simulate.py --zone kyiv
```

**Zones:** Riyadh · Dubai · Tel Aviv · Cairo · Baghdad · Kabul · Kyiv · Seoul

The fusion engine runs every 30s — incidents appear on the map within ~30s of the first events.

---

## Deployment

The stack deploys as three separate services:

| Service | Platform | Notes |
|---|---|---|
| PostgreSQL + PostGIS | **Supabase** | Free tier, PostGIS enabled by default |
| Rust API | **Railway** | Docker-based, auto-deploys from `main` |
| Next.js dashboard | **Vercel** | Already your platform, zero config |

### 1. Database — Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the connection string from **Settings → Database → URI** (use the direct connection, not the pooler)
3. Set it as `SUPABASE_DATABASE_URL` in `.env.prod`
4. Run migrations: `echo "3" | uv run migrations.py migrate` (selects prod)

### 2. Backend — Railway

1. Connect GitHub repo at [railway.app](https://railway.app)
2. Create a new service → **Deploy from GitHub repo** → select `sentinel-fusion`
3. Railway picks up `railway.toml` automatically (Dockerfile in `backend/`)
4. Set environment variables in the Railway dashboard:

```
DATABASE_URL=<your Supabase connection string>
SQLX_OFFLINE=true
PORT=8080
RUST_LOG=info
FUSION_INTERVAL_SECS=30
```

5. The `/api/health` endpoint is the health check. Railway exposes a public URL like `https://sentinel-fusion-api.railway.app`.

### 3. Frontend — Vercel

1. Import the repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Set these environment variables in Vercel:

```
NEXT_PUBLIC_API_URL=https://sentinel-fusion-production-1147.up.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

4. Deploy — Vercel will use `bun install` + `bun run build` automatically

### CORS

The Rust API uses `CorsLayer::permissive()` for development. Before production, restrict it to your Vercel domain in `backend/crates/api/src/main.rs`:

```rust
use tower_http::cors::{CorsLayer, AllowOrigin};
use http::HeaderValue;

let cors = CorsLayer::new()
    .allow_origin("https://your-app.vercel.app".parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST])
    .allow_headers(Any);
```

---

## Mapbox Token Setup

The incident map requires a Mapbox public token.

1. Create a free account at [account.mapbox.com](https://account.mapbox.com)
2. Copy your default public token (starts with `pk.`)
3. Add it to `frontend/.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
   ```
   This file is automatically ignored by Next.js / git. Do not commit it.

For development without a token, the map shows a placeholder message and all other dashboard features work normally.

---

## Design Decisions

### Why SSE over WebSockets

The dashboard is a **read-only consumer** of intelligence events. The fusion engine writes, the operator reads. SSE is the right fit: it uses standard HTTP, reconnects automatically, works through load balancers without upgrade headers, and requires zero protocol state on the server. The `broadcast::channel` in Tokio is the sole source of truth — any number of SSE clients subscribe independently.

### Why Mapbox GL over Leaflet

Mapbox GL renders the map via WebGL rather than DOM-manipulated tiles. This makes it orders of magnitude faster for animated, dynamically updated markers — exactly what a real-time incident map needs. The `dark-v11` style provides an appropriate tactical backdrop.

### Why deterministic scoring over ML

The hard problem in autonomous defense intelligence is not ingestion — it's the correlation layer. Most implementations either count events (causes alert fatigue) or use black-box ML (operators don't trust opaque output in the field). This prototype takes a deliberate middle path: **deterministic, explainable, tunable scoring** that is transparent enough to audit and fast enough to run at the edge.

Every incident's confidence score can be traced back to the exact event count, source diversity, and recency values that produced it.

### Why Rust

Memory safety without a GC, zero-cost abstractions, and a compiler that eliminates entire classes of production failures. The fusion hot path and the API server share a single async runtime (Tokio) with no thread-per-request overhead. The same binary runs identically on a cloud instance or embedded Jetson hardware.

### Why PostGIS over a custom spatial index

`ST_DWithin`, `ST_GeoHash`, and `ST_MakePoint` are exactly what the fusion engine needs. Building spatial indexing from scratch would trade weeks of engineering for something PostGIS has already solved and battle-tested. Supabase (production target) ships with PostGIS enabled.

### Deduplication design

A naïve implementation would create one incident per fusion cycle, drowning operators in duplicates. The deduplication step checks for an open incident at the same geohash within the last 10 minutes before inserting. Matching incidents are updated in place — event list appended, score recalculated, status set to `UPDATING`. The operator sees a live update in the SSE stream, not a new noisy alert.

---

## What Changes at Production Scale

1. **Move fusion to the edge node.** At real sensor density, correlation needs to happen on-device before data is sent up — both for latency and offline resilience. The cloud becomes aggregation and persistence, not the decision layer.
2. **Compiled Rust binary on Jetson hardware.** The correlation loop is where latency and memory efficiency matter most. Rust on CUDA-enabled hardware with zero-copy processing is the right architecture.
3. **Streaming backbone.** The 30-second timer is a prototype approximation. Production needs Kafka or a lightweight equivalent for a fully event-driven, horizontally scalable pipeline.
4. **Operator feedback loop.** Confirmed or dismissed incidents feed back into confidence model calibration. Without this, the system never improves beyond its initial tuning.

---

*Sentinel Fusion — built to think at the system level, not just the feature level.*
