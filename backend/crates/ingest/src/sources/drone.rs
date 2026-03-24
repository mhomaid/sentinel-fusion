use anyhow::Result;
use chrono::{DateTime, Utc};
use serde_json::Value;

use db::models::{EventType, NormalizedEvent, SourceClass};

use crate::normalizer::make_event;

/// Normalize a drone telemetry payload.
///
/// Expected shape:
/// ```json
/// { "drone_id": "sentinel-02", "altitude_m": 120, "heading_deg": 247,
///   "speed_ms": 12.4, "battery_pct": 61,
///   "lat": 24.7138, "lon": 46.6751,
///   "timestamp": "2026-03-23T14:22:03Z" }
/// ```
pub fn normalize(raw: Value) -> Result<NormalizedEvent> {
    let source_id = raw["drone_id"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("drone: missing 'drone_id'"))?
        .to_string();

    let lat = raw["lat"].as_f64().ok_or_else(|| anyhow::anyhow!("drone: missing 'lat'"))?;
    let lon = raw["lon"].as_f64().ok_or_else(|| anyhow::anyhow!("drone: missing 'lon'"))?;

    Ok(make_event(
        EventType::Telemetry,
        source_id,
        SourceClass::Drone,
        lat,
        lon,
        raw,
    ))
}
