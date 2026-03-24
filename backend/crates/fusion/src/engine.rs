use std::sync::Arc;
use std::time::Instant;

use anyhow::Result;
use chrono::{Duration, Utc};
use sqlx::PgPool;
use tokio::sync::broadcast;
use tokio::time;
use tracing::{error, info};

use db::models::Incident;
use db::queries::events::fetch_events_in_window;

use crate::clustering::{apply_temporal_window, cluster_by_geohash, EventRow};
use crate::dedup::{close_stale, upsert_incident};
use crate::scoring::score_cluster;

// ─────────────────────────────────────────────────────────────────────────────
// SSE event types (kept minimal to avoid a circular crate dependency).
// The api crate defines the full SseEvent enum; the fusion crate uses this
// lightweight mirror and the api crate converts it.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum FusionSseEvent {
    IncidentCreated(Incident),
    IncidentUpdated(Incident),
}

// ─────────────────────────────────────────────────────────────────────────────
// Config + metrics
// ─────────────────────────────────────────────────────────────────────────────

pub struct FusionConfig {
    pub interval_secs: u64,
    pub window_secs: i64,
    pub geohash_precision: usize,
    pub stale_close_secs: i64,
    pub temporal_window_secs: i64,
}

impl Default for FusionConfig {
    fn default() -> Self {
        Self {
            interval_secs: 30,
            window_secs: 300,
            geohash_precision: 7,
            stale_close_secs: 900,
            temporal_window_secs: 180,
        }
    }
}

#[derive(Default)]
pub struct FusionMetrics {
    pub runs: std::sync::atomic::AtomicU64,
    pub last_latency_ms: std::sync::atomic::AtomicU64,
    pub last_run_at: tokio::sync::RwLock<Option<chrono::DateTime<Utc>>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine loop
// ─────────────────────────────────────────────────────────────────────────────

/// Spawn the fusion engine loop. Runs until the process exits.
///
/// `sse_tx` — broadcast sender for incident events. Pass a clone of the
/// channel from the API layer so the dashboard updates in real time.
pub async fn run(
    pool: Arc<PgPool>,
    config: FusionConfig,
    metrics: Arc<FusionMetrics>,
    sse_tx: broadcast::Sender<FusionSseEvent>,
) {
    let mut interval = time::interval(time::Duration::from_secs(config.interval_secs));
    loop {
        interval.tick().await;
        let start = Instant::now();

        match run_cycle(&pool, &config, &sse_tx).await {
            Ok(incidents_written) => {
                let elapsed = start.elapsed().as_millis() as u64;
                metrics.runs.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                metrics.last_latency_ms.store(elapsed, std::sync::atomic::Ordering::Relaxed);
                *metrics.last_run_at.write().await = Some(Utc::now());
                info!(incidents = incidents_written, latency_ms = elapsed, "fusion cycle complete");
            }
            Err(e) => {
                error!(error = %e, "fusion cycle failed");
            }
        }
    }
}

async fn run_cycle(
    pool: &PgPool,
    config: &FusionConfig,
    sse_tx: &broadcast::Sender<FusionSseEvent>,
) -> Result<usize> {
    let since = Utc::now() - Duration::seconds(config.window_secs);
    let raw_rows = fetch_events_in_window(pool, since).await?;

    if raw_rows.is_empty() {
        close_stale(pool, config.stale_close_secs / 60).await?;
        return Ok(0);
    }

    let events: Vec<EventRow> = raw_rows
        .into_iter()
        .map(|(id, event_type, source_class, lat, lon, payload, received_at)| EventRow {
            id,
            event_type,
            source_class,
            lat,
            lon,
            payload,
            received_at,
        })
        .collect();

    let clusters = cluster_by_geohash(events, config.geohash_precision);
    let mut incidents_written = 0;

    for cluster in &clusters {
        let windows = apply_temporal_window(cluster, config.temporal_window_secs);
        for window_events in windows {
            if window_events.is_empty() {
                continue;
            }
            let score = score_cluster(&window_events, config.window_secs as f64);
            let result = upsert_incident(pool, &cluster.geohash, &window_events, &score).await?;

            // Broadcast to SSE clients (ignore send errors — no subscribers is fine)
            let evt = if result.is_new {
                FusionSseEvent::IncidentCreated(result.incident)
            } else {
                FusionSseEvent::IncidentUpdated(result.incident)
            };
            let _ = sse_tx.send(evt);

            incidents_written += 1;
        }
    }

    close_stale(pool, config.stale_close_secs / 60).await?;
    Ok(incidents_written)
}
