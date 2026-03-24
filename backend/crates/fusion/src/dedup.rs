use anyhow::Result;
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use db::queries::incidents::{
    close_stale_incidents, find_open_incident_at_geohash, insert_incident, update_incident,
    NewIncident,
};

use crate::clustering::EventRow;
use crate::scoring::ClusterScore;
use crate::templates::{generate_summary, generate_title};

/// Upsert a scored cluster into the incidents table.
///
/// - If an OPEN incident exists at the same geohash within the last 10
///   minutes, update it in place (append events, recalculate score).
/// - Otherwise insert a new incident.
pub async fn upsert_incident(
    pool: &PgPool,
    geohash: &str,
    events: &[&EventRow],
    score: &ClusterScore,
) -> Result<Uuid> {
    let dedup_window = Utc::now() - Duration::minutes(10);
    let existing = find_open_incident_at_geohash(pool, geohash, dedup_window).await?;

    let event_ids: Vec<Uuid> = events.iter().map(|e| e.id).collect();
    let event_types: Vec<String> = {
        let mut types: Vec<_> = events.iter().map(|e| e.event_type.clone()).collect();
        types.dedup();
        types
    };

    let first_event_at = events.iter().map(|e| e.received_at).min().unwrap();
    let last_event_at  = events.iter().map(|e| e.received_at).max().unwrap();

    if let Some(inc) = existing {
        update_incident(
            pool,
            inc.id,
            score.severity.as_str(),
            score.confidence,
            &event_ids,
            &event_types,
            score.source_count,
            score.source_diversity,
            last_event_at,
        )
        .await?;
        return Ok(inc.id);
    }

    let title   = generate_title(events, geohash);
    let summary = generate_summary(events, geohash);

    let centroid = centroid(events);

    let id = insert_incident(
        pool,
        &NewIncident {
            title,
            summary,
            severity: score.severity.as_str().to_string(),
            confidence: score.confidence,
            geohash: geohash.to_string(),
            lat: centroid.0,
            lon: centroid.1,
            event_ids,
            event_types,
            source_count: score.source_count,
            source_diversity: score.source_diversity,
            first_event_at,
            last_event_at,
        },
    )
    .await?;

    Ok(id)
}

/// Close all incidents that have received no new events for `stale_minutes`.
pub async fn close_stale(pool: &PgPool, stale_minutes: i64) -> Result<u64> {
    let threshold = Utc::now() - Duration::minutes(stale_minutes);
    close_stale_incidents(pool, threshold).await
}

fn centroid(events: &[&EventRow]) -> (f64, f64) {
    let n = events.len() as f64;
    let lat = events.iter().map(|e| e.lat).sum::<f64>() / n;
    let lon = events.iter().map(|e| e.lon).sum::<f64>() / n;
    (lat, lon)
}
