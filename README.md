# Sentinel Fusion

**Real-time intelligence for autonomous defense and security systems.**

---

## The Problem

Modern autonomous platforms — drones, cameras, RF sensors, radar — generate thousands of raw events per minute. Operators can't process that volume. The result is either alert fatigue from too much noise, or missed threats from too much filtering.

The gap isn't in the sensors. It's in the layer that connects raw detection to human decision-making.

---

## What Sentinel Fusion Does

Sentinel Fusion is a real-time multi-sensor intelligence fusion platform. It takes raw sensor events from across a monitored area, correlates them in space and time, scores them by confidence and severity, and delivers a single clear intelligence picture to the operator — live, as events unfold.

A drone detection, an RF anomaly, a radar contact, and a camera trigger happening within the same 150-meter cell in the same 3-minute window are not four separate alerts. They are one incident. Sentinel Fusion treats them that way.

**From sensor event to operator screen in under 100ms.**

---

## Live Demo

**[sentinel-fusion-pro.vercel.app](https://sentinel-fusion-pro.vercel.app)**

Open the demo, click "Launch Live Demo", and watch the system respond. Incidents appear on the map within 30 seconds as the fusion engine processes the incoming sensor stream across 27 locations in Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, and Oman.

---

## The Operator Experience

**Dashboard** — A live tactical map showing active incidents as they form, color-coded by severity. Critical incidents pulse. The map updates the moment the fusion engine writes a new result.

**Incident List** — Every active incident in one filterable view. Severity, status, confidence score, time of first detection. Click any row to drill into the full detail.

**Incident Detail** — The full intelligence picture for a single incident: the drone animating in real-time along its observed path, live telemetry data (speed, altitude, heading), radar track information, RF signal analysis, camera detection confidence, and a complete chronological timeline of every correlated sensor event that contributed to the assessment.

**Event Log** — The raw live stream of all incoming sensor events, updated in real-time with millisecond precision. Useful for verifying pipeline health and understanding what the fusion engine is seeing.

**Analytics** — Pipeline throughput over time, incident severity distribution, sensor type coverage, and confidence histograms. Situational awareness at the system level.

---

## What Makes It Different

**No alert fatigue.** The fusion engine groups correlated events into a single incident, not a flood of individual alerts. An operator sees what matters, not everything that happened.

**Explainable confidence.** Every incident has a confidence score derived from a transparent formula: event volume, source diversity (how many different sensor types agree), and recency. No black box. Every score is fully traceable back to the sensor data that produced it.

**Multi-sensor by design.** The system is built around the assumption that no single sensor is authoritative. Confidence grows when multiple independent sensor classes agree. A drone detection alone is a signal. A drone detection confirmed by RF anomaly, radar track, and camera detection is an incident.

**Edge-ready architecture.** The intelligence layer is written in Rust — no garbage collector, no runtime, compiles to embedded hardware. The same correlation logic that runs on a cloud server today can run on a sensor node or drone onboard computer tomorrow.

**Live by default.** Every operator view updates in real-time via a persistent event stream. There is no refresh button. The moment an incident is created or updated, it appears on every connected dashboard.

---

## Geographic Coverage

The simulation covers 27 locations across the GCC region:

| Country | Locations |
|---|---|
| Saudi Arabia | Riyadh (Downtown + KAFD), Jeddah, Jeddah Port, Mecca, Madinah, Dammam, Al Khobar, Tabuk, Jizan |
| UAE | Dubai (Downtown + Marina), Abu Dhabi, Sharjah, Al Ain |
| Qatar | Doha, Doha Corniche, Lusail City, Al Wakrah, Al Khor |
| Kuwait | Kuwait City, Ahmadi, Salmiya |
| Bahrain | Manama, Riffa |
| Oman | Muscat, Salalah |

---

## The Vision

This is a prototype of the infrastructure layer that autonomous defense systems need but rarely have.

At real operational scale, the fusion engine moves to the edge — running on the sensor node or drone onboard computer, correlating in milliseconds before data ever reaches the cloud. The cloud becomes aggregation, persistence, and command — not the decision layer. The architecture is designed with that transition in mind.

The next step is not a better dashboard. It is connecting this layer to real sensor hardware and moving the intelligence as close to the source as physically possible.

---

*Sentinel Fusion — built to think at the system level, not just the feature level.*
