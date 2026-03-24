use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::NormalizedEvent;

pub async fn insert_event(pool: &PgPool, event: &NormalizedEvent) -> Result<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO raw_events (id, event_type, source_id, source_class, location, payload, received_at, normalized_at)
        VALUES (
            $1, $2, $3, $4,
            ST_SetSRID(ST_MakePoint($5, $6), 4326),
            $7, $8, now()
        )
        RETURNING id
        "#,
        event.id,
        event.event_type.as_str(),
        event.source_id,
        event.source_class.as_str(),
        event.lon,
        event.lat,
        event.payload,
        event.received_at,
    )
    .fetch_one(pool)
    .await?;

    Ok(id)
}

pub async fn fetch_events_in_window(
    pool: &PgPool,
    since: DateTime<Utc>,
) -> Result<Vec<(Uuid, String, String, f64, f64, serde_json::Value, DateTime<Utc>)>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            id,
            event_type,
            source_class,
            ST_Y(location::geometry) AS "lat!: f64",
            ST_X(location::geometry) AS "lon!: f64",
            payload,
            received_at
        FROM raw_events
        WHERE received_at >= $1
          AND id NOT IN (
              SELECT UNNEST(event_ids) FROM incidents WHERE status != 'CLOSED'
          )
        ORDER BY received_at ASC
        "#,
        since,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| (r.id, r.event_type, r.source_class, r.lat, r.lon, r.payload, r.received_at))
        .collect())
}

pub async fn count_events_since(pool: &PgPool, since: DateTime<Utc>) -> Result<i64> {
    let count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM raw_events WHERE received_at >= $1",
        since
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    Ok(count)
}
