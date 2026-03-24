use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use db::queries::events::insert_event;
use ingest::normalizer::normalize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct IngestResponse {
    pub id: Uuid,
    pub received_at: chrono::DateTime<Utc>,
    pub normalized: bool,
}

pub async fn ingest(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<(StatusCode, Json<IngestResponse>), (StatusCode, String)> {
    let event = normalize(payload).map_err(|e| {
        (
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("normalization failed: {e}"),
        )
    })?;

    let id = insert_event(&state.db, &event).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("db error: {e}"),
        )
    })?;

    Ok((
        StatusCode::ACCEPTED,
        Json(IngestResponse {
            id,
            received_at: event.received_at,
            normalized: true,
        }),
    ))
}
