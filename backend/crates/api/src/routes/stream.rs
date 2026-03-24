use axum::{
    extract::State,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use std::convert::Infallible;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

use crate::state::AppState;

/// GET /api/stream
///
/// Opens an SSE connection. Each connected client receives a fresh subscription
/// to the broadcast channel. Lagged events (when a client falls behind by more
/// than 256 messages) are skipped and the stream continues.
pub async fn handler(State(state): State<AppState>) -> impl IntoResponse {
    let rx = state.sse_tx.subscribe();

    let stream = BroadcastStream::new(rx)
        .filter_map(|result| {
            match result {
                Ok(event) => {
                    let json = serde_json::to_string(&event).ok()?;

                    // Map SseEvent variant to SSE event name
                    let event_name = match &event {
                        crate::sse::SseEvent::IncidentCreated { .. } => "incident_created",
                        crate::sse::SseEvent::IncidentUpdated { .. } => "incident_updated",
                        crate::sse::SseEvent::StatsUpdate { .. }     => "stats_update",
                        crate::sse::SseEvent::Heartbeat               => "heartbeat",
                    };

                    Some(Ok::<Event, Infallible>(
                        Event::default().event(event_name).data(json),
                    ))
                }
                // Receiver fell too far behind — skip lagged messages, keep streaming
                Err(tokio_stream::wrappers::errors::BroadcastStreamRecvError::Lagged(n)) => {
                    tracing::warn!(skipped = n, "SSE client lagged behind broadcast");
                    None
                }
            }
        });

    Sse::new(stream).keep_alive(KeepAlive::default())
}
