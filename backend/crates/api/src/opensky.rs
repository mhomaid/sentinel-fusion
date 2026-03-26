//! OpenSky Network live aircraft feed.
//!
//! Polls the OpenSky REST API every 60 seconds for state vectors over GCC
//! airspace and inserts them as DRONE / TELEMETRY events into the existing
//! raw_events table so the fusion engine can correlate them into incidents.
//!
//! Graceful degradation: if OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET are
//! not set, the task logs once and exits without panicking.

use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::Value;
use sqlx::PgPool;
use tokio::sync::Mutex;

use db::models::{EventType, SourceClass};
use db::queries::events::insert_event;
use ingest::normalizer::make_event;

// Arabian Peninsula bounding box
const LAMIN: f64 = 15.0;
const LOMIN: f64 = 35.0;
const LAMAX: f64 = 32.0;
const LOMAX: f64 = 60.0;

const TOKEN_URL: &str = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL: &str = "https://opensky-network.org/api/states/all";
const POLL_SECS: u64 = 60;
// Refresh token 60s before it expires (tokens live 1800s)
const TOKEN_REFRESH_BUFFER_SECS: u64 = 60;

struct TokenCache {
    token: String,
    expires_at: Instant,
}

/// Entry point — spawned as a background task from `main.rs`.
pub async fn run_poller(pool: PgPool) {
    let client_id = match std::env::var("OPENSKY_CLIENT_ID") {
        Ok(v) => v,
        Err(_) => {
            tracing::info!("opensky: OPENSKY_CLIENT_ID not set — live feed disabled");
            return;
        }
    };
    let client_secret = match std::env::var("OPENSKY_CLIENT_SECRET") {
        Ok(v) => v,
        Err(_) => {
            tracing::info!("opensky: OPENSKY_CLIENT_SECRET not set — live feed disabled");
            return;
        }
    };

    tracing::info!("opensky: live aircraft feed starting (poll every {POLL_SECS}s)");

    let http = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .expect("reqwest client build should not fail");

    let cache: Mutex<Option<TokenCache>> = Mutex::new(None);
    let mut interval = tokio::time::interval(Duration::from_secs(POLL_SECS));

    loop {
        interval.tick().await;

        let token = match get_or_refresh_token(&http, &client_id, &client_secret, &cache).await {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!("opensky: token refresh failed — {e}");
                continue;
            }
        };

        match fetch_states(&http, &token).await {
            Ok(states) => {
                let total = states.len();
                let mut inserted = 0usize;

                for state in states {
                    if let Some(event) = state_to_event(&state) {
                        if insert_event(&pool, &event).await.is_ok() {
                            inserted += 1;
                        }
                        // Small sleep so we don't hammer the DB in a tight loop
                        tokio::time::sleep(Duration::from_millis(50)).await;
                    }
                }

                tracing::info!(
                    total,
                    inserted,
                    "opensky: aircraft states ingested"
                );
            }
            Err(e) => tracing::warn!("opensky: state fetch failed — {e}"),
        }
    }
}

// ── Token management ─────────────────────────────────────────────────────────

async fn get_or_refresh_token(
    http: &Client,
    client_id: &str,
    client_secret: &str,
    cache: &Mutex<Option<TokenCache>>,
) -> Result<String> {
    let mut guard = cache.lock().await;

    // Return cached token if it still has headroom
    if let Some(ref c) = *guard {
        if c.expires_at > Instant::now() {
            return Ok(c.token.clone());
        }
    }

    // Fetch a fresh token
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("grant_type", "client_credentials"),
    ];

    let resp: Value = http
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await?
        .json()
        .await?;

    let token = resp["access_token"]
        .as_str()
        .ok_or_else(|| anyhow!("opensky token response missing access_token"))?
        .to_string();

    let ttl = resp["expires_in"].as_u64().unwrap_or(1800);
    let valid_for = ttl.saturating_sub(TOKEN_REFRESH_BUFFER_SECS);
    let expires_at = Instant::now() + Duration::from_secs(valid_for);

    *guard = Some(TokenCache { token: token.clone(), expires_at });

    tracing::debug!(ttl, "opensky: token refreshed");
    Ok(token)
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async fn fetch_states(http: &Client, token: &str) -> Result<Vec<Value>> {
    let url = format!(
        "{STATES_URL}?lamin={LAMIN}&lomin={LOMIN}&lamax={LAMAX}&lomax={LOMAX}"
    );

    let resp: Value = http
        .get(&url)
        .bearer_auth(token)
        .send()
        .await?
        .json()
        .await?;

    let states = resp["states"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(states)
}

// ── State vector → NormalizedEvent ───────────────────────────────────────────

/// OpenSky state vector layout (index → field):
///  0  icao24, 1  callsign, 2  origin_country,
///  3  time_position, 4  last_contact,
///  5  longitude, 6  latitude, 7  baro_altitude,
///  8  on_ground, 9  velocity, 10 true_track,
///  11 vertical_rate, 12 sensors, 13 geo_altitude,
///  14 squawk, 15 spi, 16 position_source
fn state_to_event(state: &Value) -> Option<db::models::NormalizedEvent> {
    let arr = state.as_array()?;

    // Skip aircraft on the ground or with missing position
    let on_ground = arr.get(8).and_then(|v| v.as_bool()).unwrap_or(true);
    if on_ground {
        return None;
    }

    let lon = arr.get(5).and_then(|v| v.as_f64())?;
    let lat = arr.get(6).and_then(|v| v.as_f64())?;

    let icao24 = arr
        .get(0)
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let callsign = arr
        .get(1)
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let source_id = callsign.unwrap_or_else(|| icao24.clone());

    let altitude_m = arr.get(7).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let speed_ms   = arr.get(9).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let heading    = arr.get(10).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let origin     = arr.get(2).and_then(|v| v.as_str()).unwrap_or("unknown");

    let payload = serde_json::json!({
        "drone_id":       source_id,
        "icao24":         icao24,
        "origin_country": origin,
        "altitude_m":     altitude_m,
        "speed_ms":       speed_ms,
        "heading_deg":    heading,
        "source":         "opensky",
    });

    Some(make_event(
        EventType::Telemetry,
        source_id,
        SourceClass::Drone,
        lat,
        lon,
        payload,
    ))
}
