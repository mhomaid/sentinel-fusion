mod middleware;
mod routes;
mod sse;
mod state;

use std::sync::Arc;

use anyhow::Result;
use axum::{
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use chrono::{Duration, Utc};
use fusion::engine::{FusionConfig, FusionMetrics};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::sse::SseEvent;
use state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Log every unhandled panic so Railway captures it even if the process exits immediately.
    std::panic::set_hook(Box::new(|info| {
        let msg = info.payload().downcast_ref::<&str>().copied()
            .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("unknown panic payload");
        let loc = info.location().map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());
        eprintln!("PANIC at {loc}: {msg}");
    }));

    tracing::info!("sentinel-fusion starting up");

    let database_url = match std::env::var("DATABASE_URL") {
        Ok(v) => v,
        Err(_) => {
            tracing::error!("DATABASE_URL environment variable is not set — aborting");
            std::process::exit(1);
        }
    };

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    tracing::info!(port, "config loaded — DATABASE_URL present");

    let pool = match db::connect(&database_url) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "failed to create database pool — aborting");
            std::process::exit(1);
        }
    };
    tracing::info!("database pool initialised (lazy connect)");

    // ── SSE broadcast channel ────────────────────────────────────────────────
    let sse_tx = sse::channel();

    // ── Fusion engine ────────────────────────────────────────────────────────
    let fusion_metrics = Arc::new(FusionMetrics::default());

    let config = FusionConfig {
        interval_secs: std::env::var("FUSION_INTERVAL_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30),
        window_secs: std::env::var("FUSION_WINDOW_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(300),
        geohash_precision: std::env::var("FUSION_GEOHASH_PRECISION")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(7),
        stale_close_secs: std::env::var("FUSION_STALE_CLOSE_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(900),
        ..Default::default()
    };

    // Bridge channel: fusion emits FusionSseEvent, api layer converts to SseEvent
    let (fusion_tx, mut fusion_rx) = tokio::sync::broadcast::channel::<fusion::engine::FusionSseEvent>(256);
    let bridge_sse_tx = sse_tx.clone();
    tokio::spawn(async move {
        loop {
            match fusion_rx.recv().await {
                Ok(evt) => {
                    let sse_evt = match evt {
                        fusion::engine::FusionSseEvent::IncidentCreated(inc) =>
                            SseEvent::IncidentCreated { incident: inc },
                        fusion::engine::FusionSseEvent::IncidentUpdated(inc) =>
                            SseEvent::IncidentUpdated { incident: inc },
                    };
                    let _ = bridge_sse_tx.send(sse_evt);
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!(skipped = n, "fusion→sse bridge lagged");
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let pool_arc    = Arc::new(pool.clone());
    let metrics_arc = Arc::clone(&fusion_metrics);

    tokio::spawn(async move {
        fusion::engine::run(pool_arc, config, metrics_arc, fusion_tx).await;
    });

    // ── Heartbeat task (every 10s) ───────────────────────────────────────────
    {
        let tx = sse_tx.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
            loop {
                interval.tick().await;
                let _ = tx.send(SseEvent::Heartbeat);
            }
        });
    }

    // ── Auto-seed task (every 4 min) ─────────────────────────────────────────
    // Keeps at least one GCC zone active so the dashboard is never empty.
    {
        let seed_pool = pool.clone();
        tokio::spawn(async move {
            // Initial seed on startup so the map is populated immediately.
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            routes::demo::inject_burst(&seed_pool, routes::demo::GCC_ZONES).await;
            tracing::info!("auto-seed: initial burst complete");

            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(240));
            loop {
                interval.tick().await;
                routes::demo::inject_random_zone(&seed_pool).await;
                tracing::info!("auto-seed: zone refreshed");
            }
        });
    }

    // ── Stats broadcast task (every 5s) ─────────────────────────────────────
    {
        let tx      = sse_tx.clone();
        let db_pool = pool.clone();
        let metrics = Arc::clone(&fusion_metrics);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            loop {
                interval.tick().await;

                let now = Utc::now();
                let events_last_hour   = db::queries::events::count_events_since(&db_pool, now - Duration::hours(1)).await.unwrap_or(0);
                let events_last_minute = db::queries::events::count_events_since(&db_pool, now - Duration::minutes(1)).await.unwrap_or(0);
                let open_incidents     = db::queries::incidents::count_open_incidents(&db_pool).await.unwrap_or(0);
                let critical_incidents = db::queries::incidents::count_critical_incidents(&db_pool).await.unwrap_or(0);

                let fusion_runs = metrics.runs.load(std::sync::atomic::Ordering::Relaxed);
                let avg_fusion_latency_ms = metrics.last_latency_ms.load(std::sync::atomic::Ordering::Relaxed);
                let last_fusion_at = *metrics.last_run_at.read().await;

                let _ = tx.send(SseEvent::StatsUpdate {
                    events_last_hour,
                    events_last_minute,
                    open_incidents,
                    critical_incidents,
                    fusion_runs,
                    last_fusion_at,
                    avg_fusion_latency_ms,
                });
            }
        });
    }

    // ── App state + router ───────────────────────────────────────────────────
    let state = AppState::new(pool, fusion_metrics, sse_tx);

    let app = Router::new()
        .route("/api/health",        get(routes::health::handler))
        .route("/api/stats",         get(routes::stats::handler))
        .route("/api/events",        post(routes::events::ingest))
        .route("/api/demo/start",    post(routes::demo::start))
        .route("/api/incidents",     get(routes::incidents::list))
        .route("/api/incidents/:id", get(routes::incidents::get_by_id))
        .route("/api/stream",        get(routes::stream::handler))
        .layer(axum_middleware::from_fn(middleware::metrics::track))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = match tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(port, error = %e, "failed to bind TCP listener — aborting");
            std::process::exit(1);
        }
    };
    tracing::info!(port, "sentinel-fusion API listening");
    axum::serve(listener, app).await?;

    Ok(())
}
