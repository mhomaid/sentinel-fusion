use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Incident;

pub struct NewIncident {
    pub title: String,
    pub summary: String,
    pub severity: String,
    pub confidence: f64,
    pub geohash: String,
    pub lat: f64,
    pub lon: f64,
    pub event_ids: Vec<Uuid>,
    pub event_types: Vec<String>,
    pub source_count: i32,
    pub source_diversity: i32,
    pub first_event_at: DateTime<Utc>,
    pub last_event_at: DateTime<Utc>,
}

pub async fn insert_incident(pool: &PgPool, inc: &NewIncident) -> Result<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
        INSERT INTO incidents (
            title, summary, severity, confidence, status,
            location, geohash,
            event_ids, event_types,
            source_count, source_diversity,
            first_event_at, last_event_at
        ) VALUES (
            $1, $2, $3, $4, 'OPEN',
            ST_SetSRID(ST_MakePoint($5, $6), 4326), $7,
            $8, $9,
            $10, $11,
            $12, $13
        )
        RETURNING id
        "#,
        inc.title,
        inc.summary,
        inc.severity,
        inc.confidence,
        inc.lon,
        inc.lat,
        inc.geohash,
        &inc.event_ids,
        &inc.event_types,
        inc.source_count,
        inc.source_diversity,
        inc.first_event_at,
        inc.last_event_at,
    )
    .fetch_one(pool)
    .await?;

    Ok(id)
}

pub async fn find_open_incident_at_geohash(
    pool: &PgPool,
    geohash: &str,
    since: DateTime<Utc>,
) -> Result<Option<Incident>> {
    let row = sqlx::query_as!(
        Incident,
        r#"
        SELECT id, title, summary, severity, confidence, status, geohash,
               event_ids, event_types, source_count, source_diversity,
               first_event_at, last_event_at, created_at, updated_at
        FROM incidents
        WHERE geohash = $1
          AND status != 'CLOSED'
          AND last_event_at >= $2
        ORDER BY last_event_at DESC
        LIMIT 1
        "#,
        geohash,
        since,
    )
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn update_incident(
    pool: &PgPool,
    id: Uuid,
    severity: &str,
    confidence: f64,
    new_event_ids: &[Uuid],
    new_event_types: &[String],
    source_count: i32,
    source_diversity: i32,
    last_event_at: DateTime<Utc>,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE incidents SET
            severity         = $2,
            confidence       = $3,
            status           = 'UPDATING',
            event_ids        = event_ids || $4,
            event_types      = event_types || $5,
            source_count     = $6,
            source_diversity = $7,
            last_event_at    = $8,
            updated_at       = now()
        WHERE id = $1
        "#,
        id,
        severity,
        confidence,
        new_event_ids,
        new_event_types,
        source_count,
        source_diversity,
        last_event_at,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn close_stale_incidents(pool: &PgPool, stale_before: DateTime<Utc>) -> Result<u64> {
    let result = sqlx::query!(
        r#"
        UPDATE incidents
        SET status = 'CLOSED', updated_at = now()
        WHERE status != 'CLOSED'
          AND last_event_at < $1
        "#,
        stale_before,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn list_incidents(
    pool: &PgPool,
    severities: Option<&[String]>,
    statuses: Option<&[String]>,
    since: Option<DateTime<Utc>>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<Incident>, i64)> {
    // Dynamic filtering is implemented with raw SQL; SQLx offline mode
    // will need queries pre-checked once DATABASE_URL is available.
    let rows = sqlx::query_as!(
        Incident,
        r#"
        SELECT id, title, summary, severity, confidence, status, geohash,
               event_ids, event_types, source_count, source_diversity,
               first_event_at, last_event_at, created_at, updated_at
        FROM incidents
        WHERE ($1::text[]  IS NULL OR severity = ANY($1))
          AND ($2::text[]  IS NULL OR status   = ANY($2))
          AND ($3::timestamptz IS NULL OR last_event_at >= $3)
        ORDER BY last_event_at DESC
        LIMIT $4 OFFSET $5
        "#,
        severities,
        statuses,
        since,
        limit,
        offset,
    )
    .fetch_all(pool)
    .await?;

    let total = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM incidents
        WHERE ($1::text[]  IS NULL OR severity = ANY($1))
          AND ($2::text[]  IS NULL OR status   = ANY($2))
          AND ($3::timestamptz IS NULL OR last_event_at >= $3)
        "#,
        severities,
        statuses,
        since,
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0);

    Ok((rows, total))
}

pub async fn get_incident_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Incident>> {
    let row = sqlx::query_as!(
        Incident,
        r#"
        SELECT id, title, summary, severity, confidence, status, geohash,
               event_ids, event_types, source_count, source_diversity,
               first_event_at, last_event_at, created_at, updated_at
        FROM incidents WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub async fn count_open_incidents(pool: &PgPool) -> Result<i64> {
    Ok(sqlx::query_scalar!(
        "SELECT COUNT(*) FROM incidents WHERE status != 'CLOSED'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0))
}

pub async fn count_critical_incidents(pool: &PgPool) -> Result<i64> {
    Ok(sqlx::query_scalar!(
        "SELECT COUNT(*) FROM incidents WHERE severity = 'CRITICAL' AND status != 'CLOSED'"
    )
    .fetch_one(pool)
    .await?
    .unwrap_or(0))
}
