use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use db::models::{EventType, NormalizedEvent, SourceClass};

use crate::sources::{camera, drone, radar, rf_sensor};

/// Detect source type from the raw JSON payload and normalize to a
/// canonical `NormalizedEvent`. Returns an error if the payload cannot
/// be attributed to any known source class.
pub fn normalize(raw: Value) -> Result<NormalizedEvent> {
    if raw.get("source").is_some() && raw.get("objects").is_some() {
        return camera::normalize(raw);
    }
    if raw.get("drone_id").is_some() {
        return drone::normalize(raw);
    }
    if raw.get("sensor_id").is_some() && raw.get("frequency_mhz").is_some() {
        return rf_sensor::normalize(raw);
    }
    if raw.get("radar_id").is_some() {
        return radar::normalize(raw);
    }

    anyhow::bail!("Unknown source format — cannot normalize payload: {raw}")
}

pub fn make_event(
    event_type: EventType,
    source_id: String,
    source_class: SourceClass,
    lat: f64,
    lon: f64,
    payload: Value,
) -> NormalizedEvent {
    NormalizedEvent {
        id: Uuid::new_v4(),
        event_type,
        source_id,
        source_class,
        lat,
        lon,
        payload,
        received_at: Utc::now(),
    }
}
