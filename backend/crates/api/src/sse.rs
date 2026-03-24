use chrono::{DateTime, Utc};
use serde::Serialize;
use tokio::sync::broadcast;

use db::models::Incident;

/// All event types pushed to connected SSE clients.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SseEvent {
    /// A new incident was created by the fusion engine.
    IncidentCreated { incident: Incident },
    /// An existing incident was updated (new events appended, score changed).
    IncidentUpdated { incident: Incident },
    /// Periodic pipeline stats snapshot.
    StatsUpdate {
        events_last_hour: i64,
        events_last_minute: i64,
        open_incidents: i64,
        critical_incidents: i64,
        fusion_runs: u64,
        last_fusion_at: Option<DateTime<Utc>>,
        avg_fusion_latency_ms: u64,
    },
    /// Keep-alive ping — prevents proxy / browser timeout.
    Heartbeat,
}

/// Create the broadcast channel used by all SSE subscribers.
/// Returns `(Sender, first_Receiver)`. The receiver is immediately dropped
/// after construction since each SSE connection subscribes independently.
pub fn channel() -> broadcast::Sender<SseEvent> {
    let (tx, _) = broadcast::channel(256);
    tx
}
