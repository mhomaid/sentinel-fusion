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
// (label, lat, lon, _reserved)  — 27 locations across 6 GCC countries
pub const GCC_ZONES: &[(&str, f64, f64, f64)] = &[
    // ── Saudi Arabia ──────────────────────────────────────────────────────────
    ("riyadh",            24.7136, 46.6753, 0.010),
    ("riyadh_kafd",       24.8029, 46.6336, 0.010), // King Abdullah Financial District
    ("jeddah",            21.5433, 39.1728, 0.010),
    ("jeddah_port",       21.4858, 39.1925, 0.010), // Islamic Port
    ("mecca",             21.3891, 39.8579, 0.010),
    ("madinah",           24.4672, 39.6150, 0.010),
    ("dammam",            26.4207, 50.0888, 0.010), // Eastern Province
    ("khobar",            26.2172, 50.1971, 0.010),
    ("tabuk",             28.3998, 36.5717, 0.010),
    ("jizan",             16.8892, 42.5611, 0.010),
    // ── UAE ───────────────────────────────────────────────────────────────────
    ("dubai_downtown",    25.1972, 55.2744, 0.010),
    ("dubai_marina",      25.0777, 55.1405, 0.010),
    ("abudhabi",          24.4539, 54.3773, 0.010),
    ("sharjah",           25.3463, 55.4209, 0.010),
    ("alain",             24.2075, 55.7447, 0.010),
    // ── Qatar ─────────────────────────────────────────────────────────────────
    ("doha",              25.2854, 51.5310, 0.010),
    ("doha_corniche",     25.2966, 51.5329, 0.010), // Corniche waterfront
    ("lusail",            25.4267, 51.4892, 0.010), // Lusail City
    ("al_wakrah",         25.1700, 51.6030, 0.010),
    ("al_khor",           25.6797, 51.4990, 0.010),
    // ── Kuwait ────────────────────────────────────────────────────────────────
    ("kuwait_city",       29.3759, 47.9774, 0.010),
    ("ahmadi",            29.0833, 48.0833, 0.010), // Oil region
    ("salmiya",           29.3341, 48.0787, 0.010),
    // ── Bahrain ───────────────────────────────────────────────────────────────
    ("manama",            26.2235, 50.5876, 0.010),
    ("riffa",             26.1230, 50.5558, 0.010),
    // ── Oman ──────────────────────────────────────────────────────────────────
    ("muscat",            23.5880, 58.3829, 0.010),
    ("salalah",           17.0151, 54.0924, 0.010),
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
    for (name, lat, lon, _jitter) in zones {
        // Cluster centre — small offset so successive demo calls land in
        // slightly different spots within the same city, but well inside
        // a single geohash-7 cell (≈153m × 153m).
        let clat = lat + rand_jitter(0.0008);
        let clon = lon + rand_jitter(0.0008);

        // Per-event micro-jitter keeps each sensor reading distinct while
        // staying inside the same geohash cell (≤0.0004° ≈ 44m).
        const MICRO: f64 = 0.0004;

        let events = vec![
            // DRONE telemetry
            make_event(
                EventType::Telemetry,
                format!("sentinel-{:02}", pseudo_rand(1, 12, *lat)),
                SourceClass::Drone,
                clat + rand_jitter(MICRO),
                clon + rand_jitter(MICRO),
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
                clat + rand_jitter(MICRO),
                clon + rand_jitter(MICRO),
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
                clat + rand_jitter(MICRO),
                clon + rand_jitter(MICRO),
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
                clat + rand_jitter(MICRO),
                clon + rand_jitter(MICRO),
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
