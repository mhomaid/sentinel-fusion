use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RawEvent {
    pub id: Uuid,
    pub event_type: String,
    pub source_id: String,
    pub source_class: String,
    // location stored as WKB; use lat/lon fields for JSON responses
    pub payload: serde_json::Value,
    pub received_at: DateTime<Utc>,
    pub normalized_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Incident {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub severity: String,
    pub confidence: f64,
    pub status: String,
    pub geohash: String,
    pub event_ids: Vec<Uuid>,
    pub event_types: Vec<String>,
    pub source_count: i32,
    pub source_diversity: i32,
    pub first_event_at: DateTime<Utc>,
    pub last_event_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Canonical normalized event — internal representation after ingestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedEvent {
    pub id: Uuid,
    pub event_type: EventType,
    pub source_id: String,
    pub source_class: SourceClass,
    pub lat: f64,
    pub lon: f64,
    pub payload: serde_json::Value,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventType {
    Detection,
    Telemetry,
    Signal,
    Status,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EventType::Detection => "DETECTION",
            EventType::Telemetry => "TELEMETRY",
            EventType::Signal    => "SIGNAL",
            EventType::Status    => "STATUS",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SourceClass {
    Drone,
    Camera,
    RfSensor,
    Radar,
}

impl SourceClass {
    pub fn as_str(&self) -> &'static str {
        match self {
            SourceClass::Drone    => "DRONE",
            SourceClass::Camera   => "CAMERA",
            SourceClass::RfSensor => "RF_SENSOR",
            SourceClass::Radar    => "RADAR",
        }
    }
}
