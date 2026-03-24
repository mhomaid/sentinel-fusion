mod middleware;
mod routes;
mod state;

use std::sync::Arc;

use anyhow::Result;
use axum::{
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use fusion::engine::{FusionConfig, FusionMetrics};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a valid u16");

    let pool = db::connect(&database_url).await?;
    tracing::info!("database connection established");

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

    let pool_arc = Arc::new(pool.clone());
    let metrics_clone = Arc::clone(&fusion_metrics);
    tokio::spawn(async move {
        fusion::engine::run(pool_arc, config, metrics_clone).await;
    });

    let state = AppState::new(pool, fusion_metrics);

    let app = Router::new()
        .route("/api/health",            get(routes::health::handler))
        .route("/api/stats",             get(routes::stats::handler))
        .route("/api/events",            post(routes::events::ingest))
        .route("/api/incidents",         get(routes::incidents::list))
        .route("/api/incidents/:id",     get(routes::incidents::get_by_id))
        .layer(axum_middleware::from_fn(middleware::metrics::track))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!(port, "sentinel-fusion API listening");
    axum::serve(listener, app).await?;

    Ok(())
}
