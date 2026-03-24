use anyhow::Result;
use serde_json::Value;

use db::models::{EventType, NormalizedEvent, SourceClass};

use crate::normalizer::make_event;

/// Normalize an RF sensor anomaly payload.
///
/// Expected shape:
/// ```json
/// { "sensor_id": "rf-sensor-03", "frequency_mhz": 433.9,
///   "strength_dbm": -62, "anomaly": true,
///   "anomaly_type": "UNKNOWN_TRANSMISSION",
///   "position": { "lat": 24.7141, "lon": 46.6748 } }
/// ```
pub fn normalize(raw: Value) -> Result<NormalizedEvent> {
    let source_id = raw["sensor_id"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("rf_sensor: missing 'sensor_id'"))?
        .to_string();

    let pos = raw.get("position").ok_or_else(|| anyhow::anyhow!("rf_sensor: missing 'position'"))?;
    let lat = pos["lat"].as_f64().ok_or_else(|| anyhow::anyhow!("rf_sensor: missing 'position.lat'"))?;
    let lon = pos["lon"].as_f64().ok_or_else(|| anyhow::anyhow!("rf_sensor: missing 'position.lon'"))?;

    Ok(make_event(
        EventType::Signal,
        source_id,
        SourceClass::RfSensor,
        lat,
        lon,
        raw,
    ))
}
