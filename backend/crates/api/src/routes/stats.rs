use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use serde::Serialize;

use db::queries::events::count_events_since;
use db::queries::incidents::{count_critical_incidents, count_open_incidents};

use crate::state::AppState;

#[derive(Serialize)]
pub struct StatsResponse {
    pub events_last_hour: i64,
    pub events_last_minute: i64,
    pub open_incidents: i64,
    pub critical_incidents: i64,
    pub fusion_runs: u64,
    pub last_fusion_at: Option<chrono::DateTime<Utc>>,
    pub avg_fusion_latency_ms: u64,
}

pub async fn handler(State(state): State<AppState>) -> Json<StatsResponse> {
    let now = Utc::now();

    let events_last_hour   = count_events_since(&state.db, now - Duration::hours(1)).await.unwrap_or(0);
    let events_last_minute = count_events_since(&state.db, now - Duration::minutes(1)).await.unwrap_or(0);
    let open_incidents     = count_open_incidents(&state.db).await.unwrap_or(0);
    let critical_incidents = count_critical_incidents(&state.db).await.unwrap_or(0);

    let fusion_runs = state
        .fusion_metrics
        .runs
        .load(std::sync::atomic::Ordering::Relaxed);
    let avg_fusion_latency_ms = state
        .fusion_metrics
        .last_latency_ms
        .load(std::sync::atomic::Ordering::Relaxed);
    let last_fusion_at = *state.fusion_metrics.last_run_at.read().await;

    Json(StatsResponse {
        events_last_hour,
        events_last_minute,
        open_incidents,
        critical_incidents,
        fusion_runs,
        last_fusion_at,
        avg_fusion_latency_ms,
    })
}
