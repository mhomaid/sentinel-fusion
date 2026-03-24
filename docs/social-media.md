# Sentinel Fusion — Social Media & Outreach

**Live demo:** https://sentinel-fusion-3eujdsj4l-mohamed-homaids-projects.vercel.app  
**Repo:** https://github.com/mhomaid/sentinel-fusion  
**API health:** https://sentinel-fusion-production-1147.up.railway.app/api/health

---

## X (Twitter)

### Post 1 — Technical launch

```
Built a real-time multi-sensor fusion engine from scratch.

Drone telemetry + RF anomaly + camera detections + radar events →
spatial clustering → scored incidents → live operator dashboard.

Under 100ms from sensor to screen. Zero alert fatigue by design.

Stack: Rust · Axum · PostGIS · Next.js · SSE

Demo: [link]
```

---

### Post 2 — Engineering angle (thread opener)

```
How do you turn a flood of raw sensor events into one clear
intelligence picture for an operator?

That's the hard problem. Here's how I built it 🧵
```

**Thread continuation:**
```
1/ The naive approach: show every event on a map.
   Result: hundreds of markers per minute. Operators go blind.
   
   The real problem isn't ingestion — it's correlation.
```
```
2/ My approach: a fusion engine that runs every 30s on a sliding
   5-minute window.
   
   It clusters events by geohash (150m × 150m cells), scores each
   cluster by volume + source diversity + recency, and writes a
   single incident — not a noise dump.
```
```
3/ The scoring formula is deliberately deterministic:

   confidence =
     (event_count / 5)       × 0.30  // volume
   + (distinct_sources / 4)  × 0.40  // diversity ← most important
   + (1 - avg_age / 300)     × 0.30  // recency

   Every score is fully auditable. No black box.
```
```
4/ The whole thing is Rust — the fusion loop, the API, the SSE
   broadcaster. Single Tokio runtime. Zero GC pauses.
   
   The same binary runs on a cloud instance or a Jetson at the edge.
```
```
5/ The operator dashboard connects via Server-Sent Events and updates
   live — new incidents appear on the map within 30s of the first
   correlated events.
   
   Live: [link]
   Repo: [link]
```

---

### Post 3 — Short punchy version

```
Spent the last few weeks building Sentinel Fusion.

Real-time intelligence pipeline:
→ ingest raw sensor events (drone, RF, camera, radar)
→ cluster spatially with PostGIS
→ score and deduplicate
→ push to operator dashboard via SSE

Rust backend, deployed on Railway. Next.js frontend on Vercel.

Try the live demo: [link]
```

---

## LinkedIn

### Full post

```
I built Sentinel Fusion — a real-time multi-sensor intelligence
fusion engine for autonomous defense systems.

The problem it solves:
Modern autonomous platforms generate thousands of raw sensor events
per minute — drone detections, RF anomalies, camera triggers, radar
contacts. Showing every event to an operator creates noise, not
awareness. You need a correlation layer.

What I built:

→ Rust ingestion layer — validates, normalizes, and timestamps every
  incoming event from any sensor class. Writes to PostgreSQL + PostGIS.

→ Fusion engine — runs on a configurable sliding time window, clusters
  events by geohash proximity, and scores each cluster using a
  deterministic formula weighted on event volume, sensor source
  diversity, and recency. No ML black box — every confidence score
  is fully traceable.

→ Real-time SSE stream — the moment an incident is created or updated,
  it's pushed to every connected operator via Server-Sent Events. Under
  100ms fusion-to-dashboard latency.

→ Operator dashboard — built in Next.js. Live incident map (Mapbox GL),
  filterable incident table, live event log, and an analytics view with
  pipeline throughput charts. All data live from the SSE stream.

Tech: Rust · Axum · Tokio · SQLx · PostgreSQL + PostGIS · Next.js 16 ·
Deployed: Railway (backend) · Vercel (frontend) · Supabase (database)

The architecture is designed to eventually run at the edge — Rust
compiles to embedded targets, the correlation logic needs to move
onto the drone/sensor node itself at production density.

Live demo: [link]
Open source: [link]

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

Your timing is good: they posted 42 minutes ago. They're actively
recruiting and in early formation — the window where a working demo
carries maximum weight.

**What makes this credible vs. noise:**
- You have a live, deployed system — not a slide deck
- It runs on the same sensor classes they're building around (drones,
  autonomy, detection)
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

Live demo: [link]
Code: [link]

The architecture is designed for edge deployment — same binary runs
on a cloud instance or a Jetson. The correlation logic sits exactly
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

Demo: [link]
Repo: [link]

I'm specifically interested in the "Big Data Infrastructure" layer
and edge deployment. Worth a conversation if you're still looking.
```

---

## Notes on the demo before sharing

Before sending these links, run the simulator to seed real data:

```bash
cd db-migrations
uv run simulate.py --rate 2
```

Let it run for ~2 minutes so there are visible incidents on the map
when someone opens the dashboard. An empty map is underwhelming —
the live updating is what's impressive.
