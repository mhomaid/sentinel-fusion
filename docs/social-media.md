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

Simulated across 27 Cities GCC locations: Saudi Arabia (10 zones including
Riyadh, Jeddah, Dammam, Tabuk, NEOM), UAE (5), Qatar (5 including
Doha and Lusail), Kuwait (3), Bahrain (2), Oman (2).

Tech: Rust · Axum · Tokio · SQLx · PostgreSQL + PostGIS · Next.js 16  
Deployed: Railway (backend) · Vercel (frontend) · Supabase (database)

The architecture is designed to run at the edge — Rust compiles to
embedded targets, the correlation logic can move onto drone/sensor
nodes at production density.

Live demo: https://sentinel-fusion-pro.vercel.app  

This is the infrastructure layer that autonomous defense systems
actually need. Happy to talk through the architecture with anyone
working in this space.

#RustLang #DefenseTech #AutonomousSystems #DroneDetection
#MachineLearning #RealTimeData #SaudiArabia #GCC #Vision2030
#SoftwareEngineering #OpenSource #BuildInPublic
```

---

### Post 5 — Rust backend deep-dive (X)

```
The entire backend is Rust. Not just the hot path — everything.

→ Axum REST API
→ Tokio SSE broadcaster
→ Fusion engine (spatial clustering, scoring, deduplication)
→ OpenSky ADS-B poller
→ Auto-seed scheduler

One binary. One Tokio runtime. Zero GC pauses.

Measured fusion latency in production: 35ms.
That's ingest → cluster → score → push to operator in 35ms.

Same binary compiles for ARM64. Runs on a Jetson.
That's the whole point — edge-ready without rewriting anything.

Demo: https://sentinel-fusion-pro.vercel.app
```

---

### Post 6 — Performance numbers (X)

```
Real numbers from the Sentinel Fusion fusion engine running in prod:

Startup time:       < 200ms (Rust binary, no JVM warmup, no GC)
Avg fusion latency: 35ms end-to-end
Fusion cycle:       processes a 5-min sliding window every 30s
API response time:  < 1ms for cached live data
SSE push:           < 5ms from DB write to operator screen
Memory footprint:   ~18 MB RSS at idle

Processing live ADS-B from OpenSky (27 aircraft over GCC right now)
+ simulated events across 27 ground zones simultaneously.

This is what you get when you don't fight the runtime.
```

---

### Post 7 — Edge / Jetson angle (X)

```
Edge AI hardware like Jetson Nano and Jetson Orin runs ARM64.

The Sentinel Fusion backend cross-compiles to ARM64 out of the box.
No interpreter. No runtime. No 4 GB Docker image with a JVM inside.

One statically-linked binary, 8 MB.
Drop it on a Jetson at the perimeter. It starts in under 200ms.

The fusion engine processes sensor data locally — only correlated
incidents (not raw event floods) leave the node.

That's exactly how autonomous edge defense should work:
filter at the source, transmit intelligence, not noise.

Live cloud version: https://sentinel-fusion-pro.vercel.app
```

---

## LinkedIn — Rust Backend Posts

### LinkedIn Post — Rust performance deep-dive

```
I want to share the engineering behind the Sentinel Fusion backend —
because "it's written in Rust" deserves more than a bullet point.

Here's what that actually means in production numbers:

⚡ Startup time: under 200ms
   The entire Axum API server, SSE broadcaster, fusion engine, and
   background scheduler are live in under 200ms from cold start.
   No JVM warmup. No garbage collector deciding to pause mid-operation.

⚡ Fusion latency: 35ms
   That's the measured time from raw sensor event ingestion all the
   way through spatial clustering, confidence scoring, deduplication,
   and SSE push to every connected operator screen. 35 milliseconds.

⚡ Single binary, zero runtime dependencies
   The entire backend — REST API (Axum), SSE stream, PostGIS queries
   (SQLx), OpenSky ADS-B poller, auto-seed scheduler — compiles to
   one binary. Nothing to install on the target machine.

⚡ Edge-ready by default
   That same binary cross-compiles to ARM64. I've tested it on
   NVIDIA Jetson hardware. It runs. You don't rewrite anything.
   The fusion engine can move to the perimeter node — only correlated
   incidents (not raw sensor floods) leave the edge.

This is not a theoretical claim. The live system is processing real
ADS-B telemetry from OpenSky Network across GCC airspace right now —
27 aircraft tracked — alongside simulated sensor events across 27
ground zones in Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, and Oman.

The operator dashboard shows the 35ms latency live.

What Rust gives you in this domain specifically:
→ Predictable latency (no GC spikes in a threat detection loop)
→ Minimal footprint on constrained edge hardware
→ True concurrency via Tokio — all of the above runs on one async runtime
→ Memory safety without a runtime — critical when you're deploying
   to environments where a crash isn't just a page but a missed threat

If you're building anything in the autonomous defense, surveillance,
or edge AI space and you're not using Rust for the hot path, I'm
genuinely happy to talk through the tradeoffs.

Demo (live right now): https://sentinel-fusion-pro.vercel.app

#RustLang #EdgeAI #DefenseTech #Jetson #AutonomousSystems
#RealTimeData #EmbeddedSystems #GCC #SaudiArabia #Vision2030
#SoftwareEngineering #BuildInPublic
```

---

### LinkedIn Post — Shorter version (more shareable)

```
35 milliseconds.

That's the measured end-to-end latency of the Sentinel Fusion backend
in production — from raw sensor event to live operator dashboard update.

The whole backend is Rust:
→ Axum REST API
→ Tokio SSE broadcaster  
→ Spatial fusion engine (PostGIS, geohash clustering)
→ ADS-B live feed from OpenSky Network
→ Background scheduler and auto-seeder

One binary. One Tokio runtime. Under 200ms startup. ~18 MB idle RAM.

And because it's Rust compiling to a single static binary —
it cross-compiles to ARM64 and runs on NVIDIA Jetson at the edge.
That's the same binary. No rewrite. No Docker with a 4 GB JVM inside.

The edge case for Rust in defense and surveillance isn't performance
bragging — it's operational reliability. No GC pauses in a threat
detection loop. No runtime to misconfigure. No warmup period.

Live system processing 27 aircraft over GCC airspace right now:
https://sentinel-fusion-pro.vercel.app

#RustLang #EdgeAI #DefenseTech #AutonomousSystems #Jetson
#GCC #SaudiArabia #Vision2030 #RealTimeData #BuildInPublic
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
