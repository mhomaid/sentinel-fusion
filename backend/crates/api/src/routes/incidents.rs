use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use db::models::{Incident, IncidentEvent};
use db::queries::events::fetch_events_by_ids;
use db::queries::incidents::{get_incident_by_id, list_incidents};

use crate::state::AppState;

#[derive(Deserialize)]
pub struct ListParams {
    /// Comma-separated list of severities, e.g. "HIGH,CRITICAL"
    pub severity: Option<String>,
    /// Comma-separated list of statuses, e.g. "OPEN"
    pub status: Option<String>,
    pub since: Option<DateTime<Utc>>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Serialize)]
pub struct ListResponse {
    pub incidents: Vec<Incident>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list(
    State(state): State<AppState>,
    Query(params): Query<ListParams>,
) -> Result<Json<ListResponse>, (StatusCode, String)> {
    let severities: Option<Vec<String>> = params
        .severity
        .map(|s| s.split(',').map(|v| v.trim().to_uppercase()).collect());
    let statuses: Option<Vec<String>> = params
        .status
        .map(|s| s.split(',').map(|v| v.trim().to_uppercase()).collect());

    let (incidents, total) = list_incidents(
        &state.db,
        severities.as_deref(),
        statuses.as_deref(),
        params.since,
        params.limit,
        params.offset,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ListResponse {
        incidents,
        total,
        limit: params.limit,
        offset: params.offset,
    }))
}

pub async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Incident>, (StatusCode, String)> {
    match get_incident_by_id(&state.db, id).await {
        Ok(Some(incident)) => Ok(Json(incident)),
        Ok(None) => Err((StatusCode::NOT_FOUND, format!("incident {id} not found"))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

/// GET /api/incidents/:id/events
///
/// Returns every raw sensor event that contributed to this incident,
/// ordered chronologically.  Useful for the detail page timeline and
/// drone-path animation.
pub async fn get_incident_events(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IncidentEvent>>, (StatusCode, String)> {
    let incident = match get_incident_by_id(&state.db, id).await {
        Ok(Some(i)) => i,
        Ok(None) => return Err((StatusCode::NOT_FOUND, format!("incident {id} not found"))),
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    let events = fetch_events_by_ids(&state.db, &incident.event_ids)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(events))
}
