use axum::{extract::State, http::StatusCode, Json};

use crate::opensky::LiveAircraft;
use crate::state::AppState;

/// GET /api/aircraft/live
///
/// Returns the last cached batch of airborne aircraft over GCC airspace
/// from the OpenSky Network poller. Empty array if the poller hasn't run yet
/// or if OpenSky credentials are not configured.
pub async fn live(
    State(state): State<AppState>,
) -> Result<Json<Vec<LiveAircraft>>, (StatusCode, String)> {
    let aircraft = state.aircraft_cache.read().await.clone();
    Ok(Json(aircraft))
}
