use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use db::models::{EventType, SourceClass};
use db::queries::events::insert_event;
use ingest::normalizer::make_event;

use crate::state::AppState;

// ── GCC hot-zones ─────────────────────────────────────────────────────────────
// (name, lat, lon, jitter_deg)
pub const GCC_ZONES: &[(&str, f64, f64, f64)] = &[
    ("riyadh",   24.7136, 46.6753, 0.018),
    ("jeddah",   21.5433, 39.1728, 0.012),
    ("tabuk",    28.3998, 36.5717, 0.015),
    ("jizan",    16.8892, 42.5611, 0.014),
    ("najran",   17.4933, 44.1277, 0.013),
    ("dubai",    25.2048, 55.2708, 0.010),
    ("abudhabi", 24.4539, 54.3773, 0.012),
    ("kuwait",   29.3759, 47.9774, 0.010),
];

#[derive(Serialize)]
pub struct DemoResponse {
    pub started: bool,
    pub events_queued: usize,
    pub zones: usize,
    pub fusion_eta_secs: u64,
    pub message: &'static str,
}

/// POST /api/demo/start
///
/// Fires a burst of 4 sensor events per GCC zone directly into the database.
/// Returns immediately — the fusion engine picks them up on its next 30s cycle.
pub async fn start(
    State(state): State<AppState>,
) -> Result<Json<DemoResponse>, (StatusCode, String)> {
    let pool = Arc::clone(&state.db);

    tokio::spawn(async move {
        inject_burst(&pool, GCC_ZONES).await;
    });

    Ok(Json(DemoResponse {
        started: true,
        events_queued: GCC_ZONES.len() * 4,
        zones: GCC_ZONES.len(),
        fusion_eta_secs: 30,
        message: "Events injected — incidents will appear within one fusion cycle (~30s)",
    }))
}

/// Injects one burst event for every sensor class in every zone.
pub async fn inject_burst(pool: &sqlx::PgPool, zones: &[(&str, f64, f64, f64)]) {
    for (name, lat, lon, jitter) in zones {
        let clat = lat + rand_jitter(*jitter * 0.4);
        let clon = lon + rand_jitter(*jitter * 0.4);

        let events = vec![
            // DRONE telemetry
            make_event(
                EventType::Telemetry,
                format!("sentinel-{:02}", pseudo_rand(1, 12, *lat)),
                SourceClass::Drone,
                clat + rand_jitter(*jitter),
                clon + rand_jitter(*jitter),
                json!({
                    "drone_id": format!("sentinel-{:02}", pseudo_rand(1, 12, *lat)),
                    "altitude_m": pseudo_rand(30, 300, *lon),
                    "heading_deg": pseudo_rand(0, 359, clat),
                    "speed_ms": 8.5,
                    "battery_pct": 72,
                    "zone": name,
                }),
            ),
            // CAMERA detection
            make_event(
                EventType::Detection,
                format!("cam-{:02}", pseudo_rand(1, 20, *lon)),
                SourceClass::Camera,
                clat + rand_jitter(*jitter),
                clon + rand_jitter(*jitter),
                json!({
                    "source": format!("cam-{:02}", pseudo_rand(1, 20, *lon)),
                    "objects": [{"class": "drone", "confidence": 0.91, "speed_kmh": 32}],
                    "zone": name,
                }),
            ),
            // RF_SENSOR signal
            make_event(
                EventType::Signal,
                format!("rf-{:02}", pseudo_rand(1, 8, *lat + *lon)),
                SourceClass::RfSensor,
                clat + rand_jitter(*jitter),
                clon + rand_jitter(*jitter),
                json!({
                    "sensor_id": format!("rf-{:02}", pseudo_rand(1, 8, *lat + *lon)),
                    "frequency_mhz": 915.0,
                    "strength_dbm": -58,
                    "anomaly": true,
                    "anomaly_type": "UNKNOWN_TRANSMISSION",
                    "zone": name,
                }),
            ),
            // RADAR track
            make_event(
                EventType::Detection,
                format!("radar-{:02}", pseudo_rand(1, 4, *lon)),
                SourceClass::Radar,
                clat + rand_jitter(*jitter),
                clon + rand_jitter(*jitter),
                json!({
                    "radar_id": format!("radar-{:02}", pseudo_rand(1, 4, *lon)),
                    "track_id": format!("TRK-{}", pseudo_rand(1000, 9999, *lat * *lon)),
                    "altitude_ft": pseudo_rand(0, 5000, *lat),
                    "speed_knots": pseudo_rand(20, 280, *lon),
                    "heading_deg": pseudo_rand(0, 359, clat + clon),
                    "radar_cross_section": 1.2,
                    "zone": name,
                }),
            ),
        ];

        for ev in events {
            let _ = insert_event(pool, &ev).await;
            tokio::time::sleep(tokio::time::Duration::from_millis(120)).await;
        }
    }
}

// ── Deterministic-ish helpers (no external rand crate needed) ─────────────────

fn rand_jitter(amount: f64) -> f64 {
    let seed = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()) as f64;
    let t = (seed / 1_000_000_000.0) * 2.0 - 1.0;
    t * amount
}

fn pseudo_rand(min: i64, max: i64, seed: f64) -> i64 {
    let h = (seed.abs() * 1_000_000.0) as u64;
    let v = h.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    min + (v % ((max - min + 1) as u64)) as i64
}

/// Run a single random-zone burst — used by the auto-seed background task.
pub async fn inject_random_zone(pool: &sqlx::PgPool) {
    let idx = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as usize)
        % GCC_ZONES.len();
    let zone = &GCC_ZONES[idx..idx + 1];
    inject_burst(pool, zone).await;
}

/// Generates a unique event ID to avoid duplicate key issues when called
/// multiple times in quick succession.
fn _fresh_id() -> Uuid {
    Uuid::new_v4()
}
