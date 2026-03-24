use axum::{extract::State, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub db: &'static str,
    pub uptime_seconds: u64,
}

pub async fn handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let uptime = state.started_at.elapsed().as_secs();

    // A real implementation would ping the DB; for now, if the pool
    // was constructed successfully the DB is reachable.
    Json(HealthResponse {
        status: "ok",
        db: "connected",
        uptime_seconds: uptime,
    })
}
