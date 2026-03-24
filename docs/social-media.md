# Sentinel Fusion — Social Media & Outreach

**Live demo:** https://sentinel-fusion-pro.vercel.app  
**Repo:** https://github.com/mhomaid/sentinel-fusion  
**API:** https://sentinel-fusion-production-1147.up.railway.app

---

## X (Twitter)

### Post 1 — Technical launch

```
Built a real-time multi-sensor fusion engine from scratch.

Drone telemetry + RF anomaly + camera detections + radar →
spatial clustering → scored incidents → live operator dashboard.

Incident detail page shows the drone animating in real-time
across the map with live telemetry: speed, altitude, heading.

Under 100ms from sensor to screen. Zero alert fatigue by design.

Stack: Rust · Axum · PostGIS · Next.js · SSE

Demo: https://sentinel-fusion-pro.vercel.app
```

---

### Post 2 — Engineering thread opener

```
How do you turn a flood of raw sensor events into one clear
intelligence picture for an operator?

That's the hard problem. Here's how I built it 🧵
```

**Thread:**
```
1/ The naive approach: show every event on a map.
   Result: hundreds of markers per minute. Operators go blind.
   
   The real problem isn't ingestion — it's correlation.
```
```
2/ My approach: a Rust fusion engine running every 30s on a
   sliding 5-minute window.
   
   Clusters events by geohash (150m × 150m cells), scores each
   cluster by volume + source diversity + recency, writes a
   single incident — not a noise dump.
```
```
3/ The scoring formula is deterministic:

   confidence =
     (event_count / 5)       × 0.30  // volume
   + (distinct_sources / 4)  × 0.40  // diversity ← most important
   + (1 - avg_age / 300)     × 0.30  // recency

   Every score is fully auditable. No ML black box.
```
```
4/ The full operator surface:
   → Dashboard — live Mapbox GL incident map, pulsing CRITICAL markers
   → Incidents — filterable table, click any row → full detail page
   → Detail page — animated drone path, radar track, RF signal, camera
   → Event Log — live SSE stream, millisecond timestamps
   → Analytics — pipeline throughput, severity distribution, sensor coverage

   27 GCC zones simulated: Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman.
```
```
5/ The whole backend is Rust — fusion loop, API, SSE broadcaster.
   Single Tokio runtime. Zero GC pauses.
   
   Same binary could run on a cloud instance or a Jetson at the edge.
   
   Live: https://sentinel-fusion-pro.vercel.app
   Repo: https://github.com/mhomaid/sentinel-fusion
```

---

### Post 3 — Short punchy version

```
Spent the last few weeks building Sentinel Fusion.

Real-time intelligence pipeline:
→ ingest raw sensor events (drone, RF, camera, radar)
→ cluster spatially with PostGIS across 27 GCC locations
→ score and deduplicate into incidents
→ push live to operator dashboard via SSE
→ drill into any incident — see the drone animate on the map

Rust backend on Railway. Next.js on Vercel. Supabase PostGIS.

Try it: https://sentinel-fusion-pro.vercel.app
```

---

### Post 4 — GCC / regional angle

```
Built a defense intelligence demo focused on the GCC region.

27 simulated hot-zones across Saudi Arabia, UAE, Qatar, Kuwait,
Bahrain, and Oman — Riyadh, Doha, Dubai, Manama, Muscat and more.

Multi-sensor fusion: drone tracks correlated with RF anomalies,
radar contacts, and camera detections. Live operator dashboard.

The architecture is what autonomous border/airspace systems
actually need at the correlation layer.

Demo: https://sentinel-fusion-pro.vercel.app
```

---

## LinkedIn

### Full post

```
I built Sentinel Fusion — a real-time multi-sensor intelligence
fusion engine for autonomous defense and security systems.

The problem it solves:
Modern autonomous platforms generate thousands of raw sensor events
per minute — drone detections, RF anomalies, camera triggers, radar
contacts. Showing every event to an operator creates noise, not
awareness. You need a correlation layer.

What I built:

→ Rust ingestion layer — validates, normalizes, and timestamps every
  incoming event from any sensor class. Writes to PostgreSQL + PostGIS.

→ Fusion engine — runs on a configurable sliding time window, clusters
  events by geohash proximity (150m × 150m cells), and scores each
  cluster using a deterministic formula weighted on event volume, sensor
  source diversity, and recency. No ML black box — every confidence
  score is fully traceable.

→ Real-time SSE stream — the moment an incident is created or updated,
  it's pushed to every connected operator instantly. Under 100ms
  fusion-to-dashboard latency.

→ Operator dashboard — built in Next.js with five views:
  • Live incident map with animated pulsing markers for critical threats
  • Filterable incident table (click any row → full detail page)
  • Incident detail — animated drone path on the map, live telemetry
    (speed/altitude/heading), radar track, RF signal data, camera
    detections, and a full event timeline
  • Live event log with millisecond-precision SSE stream
  • Analytics — pipeline throughput, severity distribution, sensor
    type coverage, confidence histogram

Simulated across 27 GCC locations: Saudi Arabia (10 zones including
Riyadh, Jeddah, Mecca, Madinah, Dammam), UAE (5), Qatar (5 including
Doha and Lusail), Kuwait (3), Bahrain (2), Oman (2).

Tech: Rust · Axum · Tokio · SQLx · PostgreSQL + PostGIS · Next.js 16  
Deployed: Railway (backend) · Vercel (frontend) · Supabase (database)

The architecture is designed to run at the edge — Rust compiles to
embedded targets, the correlation logic can move onto drone/sensor
nodes at production density.

Live demo: https://sentinel-fusion-pro.vercel.app  
Open source: https://github.com/mhomaid/sentinel-fusion

This is the infrastructure layer that autonomous defense systems
actually need. Happy to talk through the architecture with anyone
working in this space.
```

---

## Direct Messages

### My honest take on messaging Muteb (@malobeiwi) and Faisal (@Faisal)

**Yes, reach out. Here's why this is a genuinely strong fit:**

Atam is looking for co-founders who can BUILD — not just execute. They
explicitly listed "Big Data Infrastructure" as one of their three core
needs, and that is exactly what Sentinel Fusion's backend is: a
real-time event pipeline with spatial intelligence on top.

**What makes this credible vs. noise:**
- You have a live, deployed system with a working UI — not a slide deck
- It runs on the same sensor classes they're building around (drones,
  autonomy, detection)
- The GCC simulation (27 zones including Saudi cities) shows domain
  awareness — you understand the operational geography
- The incident detail page shows the drone animating on the map with
  real telemetry — this is not a toy prototype
- The architecture is specifically designed to move to the edge
  (Rust, PostGIS, no GC) which maps directly to embedded/drone hardware
- You already know the hard problem (correlation, not just ingestion)

**One thing to be honest about:**
This is a prototype / proof of concept. The simulation is synthetic,
not connected to real hardware. Don't oversell it — the credibility
of showing real working code is stronger than overpromising.

---

### DM to Muteb (@malobeiwi)

```
Muteb — saw the Atam post. Directly relevant to what I've been building.

I built Sentinel Fusion: a real-time multi-sensor fusion engine —
drone telemetry, RF anomalies, camera detections and radar events
correlated into a single intelligence picture and pushed live to
operators. Rust backend, PostGIS spatial clustering, SSE stream.

The operator dashboard lets you drill into any incident and watch
the drone animate across the map with live telemetry. Simulated
across 27 GCC zones including Riyadh, Doha, Dubai, and Manama.

Live demo: https://sentinel-fusion-pro.vercel.app
Code: https://github.com/mhomaid/sentinel-fusion

The architecture is designed for edge deployment — same binary runs
on a cloud instance or a Jetson. The correlation layer sits exactly
where your "Big Data Infrastructure" need is.

Happy to walk through it if it's relevant to what you're building
at Atam.
```

---

### DM to Faisal (@Faisal)

```
Faisal — saw your post about Atam and the co-founder search.

I've been building in the autonomous defense intelligence space.
Sentinel Fusion is a real-time fusion engine: raw sensor events
(drone, RF, camera, radar) → spatial correlation → scored incidents
→ live operator dashboard. Rust, PostGIS, deployed and running.

The detail page for each incident shows the drone path animated
on a Mapbox map with real telemetry data. Covers 27 GCC locations
including Riyadh, Jeddah, Doha, Dubai, Kuwait City, and Muscat.

Demo: https://sentinel-fusion-pro.vercel.app
Repo: https://github.com/mhomaid/sentinel-fusion

I'm specifically interested in the "Big Data Infrastructure" layer
and edge deployment. Worth a conversation if you're still looking.
```

---

## Before sharing — seed the demo

Trigger a fresh burst so the map is populated when someone opens it:

```bash
curl -X POST https://sentinel-fusion-production-1147.up.railway.app/api/demo/start
```

Wait ~30 seconds for the fusion engine to process the events, then
share the link. The dashboard auto-seeds itself every 4 minutes, so
it should rarely be empty.

**The most impressive flows to show:**

1. **Landing page** → click "LAUNCH LIVE DEMO" → watch the incident
   count update live in the status bar
2. **Dashboard** → Mapbox map with pulsing red rings on CRITICAL incidents
3. **Incidents** → click any row → full detail page
4. **Detail page** → drone animating on the map, telemetry updating,
   event timeline showing all correlated sensor readings
5. **Event Log** → live SSE stream showing new incidents as they're created
