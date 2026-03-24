use anyhow::{bail, Result};
use serde_json::Value;

use db::models::{EventType, NormalizedEvent, SourceClass};

use crate::normalizer::make_event;

/// Normalize a camera / computer-vision detection payload.
///
/// Expected shape:
/// ```json
/// { "source": "cam-alpha-07", "type": "detection",
///   "objects": [...], "lat": 24.7136, "lon": 46.6753, "ts": 1711200121 }
/// ```
pub fn normalize(raw: Value) -> Result<NormalizedEvent> {
    let source_id = raw["source"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("camera: missing 'source'"))?
        .to_string();

    let lat = raw["lat"].as_f64().ok_or_else(|| anyhow::anyhow!("camera: missing 'lat'"))?;
    let lon = raw["lon"].as_f64().ok_or_else(|| anyhow::anyhow!("camera: missing 'lon'"))?;

    let event_type = match raw["type"].as_str() {
        Some("detection") => EventType::Detection,
        Some("status")    => EventType::Status,
        other => bail!("camera: unknown event type '{:?}'", other),
    };

    Ok(make_event(event_type, source_id, SourceClass::Camera, lat, lon, raw))
}
