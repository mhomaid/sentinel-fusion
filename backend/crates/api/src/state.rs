use std::sync::Arc;

use fusion::engine::FusionMetrics;
use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::opensky::AircraftCache;
use crate::sse::SseEvent;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<PgPool>,
    pub fusion_metrics: Arc<FusionMetrics>,
    pub sse_tx: Arc<broadcast::Sender<SseEvent>>,
    pub aircraft_cache: AircraftCache,
    pub started_at: std::time::Instant,
}

impl AppState {
    pub fn new(
        db: PgPool,
        fusion_metrics: Arc<FusionMetrics>,
        sse_tx: broadcast::Sender<SseEvent>,
        aircraft_cache: AircraftCache,
    ) -> Self {
        Self {
            db: Arc::new(db),
            fusion_metrics,
            sse_tx: Arc::new(sse_tx),
            aircraft_cache,
            started_at: std::time::Instant::now(),
        }
    }
}
