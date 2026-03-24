use std::sync::Arc;

use fusion::engine::FusionMetrics;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<PgPool>,
    pub fusion_metrics: Arc<FusionMetrics>,
    pub started_at: std::time::Instant,
}

impl AppState {
    pub fn new(db: PgPool, fusion_metrics: Arc<FusionMetrics>) -> Self {
        Self {
            db: Arc::new(db),
            fusion_metrics,
            started_at: std::time::Instant::now(),
        }
    }
}
