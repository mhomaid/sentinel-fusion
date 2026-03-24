use anyhow::Result;
use serde_json::Value;

use db::models::{EventType, NormalizedEvent, SourceClass};

use crate::normalizer::make_event;

/// Normalize a radar track payload.
///
/// Expected shape:
/// ```json
/// { "radar_id": "radar-north-01", "track_id": "TRK-0042",
///   "range_km": 4.2, "azimuth_deg": 312, "rcs_dbsm": -8.5,
///   "lat": 24.720, "lon": 46.680 }
/// ```
pub fn normalize(raw: Value) -> Result<NormalizedEvent> {
    let source_id = raw["radar_id"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("radar: missing 'radar_id'"))?
        .to_string();

    let lat = raw["lat"].as_f64().ok_or_else(|| anyhow::anyhow!("radar: missing 'lat'"))?;
    let lon = raw["lon"].as_f64().ok_or_else(|| anyhow::anyhow!("radar: missing 'lon'"))?;

    Ok(make_event(
        EventType::Detection,
        source_id,
        SourceClass::Radar,
        lat,
        lon,
        raw,
    ))
}
