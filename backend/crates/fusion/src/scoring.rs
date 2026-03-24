use std::collections::HashSet;

use crate::clustering::EventRow;

#[derive(Debug, Clone)]
pub struct ClusterScore {
    pub confidence: f64,
    pub severity: Severity,
    pub source_count: i32,
    pub source_diversity: i32,
    pub has_signal_anomaly: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Low      => "LOW",
            Severity::Medium   => "MEDIUM",
            Severity::High     => "HIGH",
            Severity::Critical => "CRITICAL",
        }
    }

    fn escalate(&self) -> Severity {
        match self {
            Severity::Low      => Severity::Medium,
            Severity::Medium   => Severity::High,
            Severity::High     => Severity::Critical,
            Severity::Critical => Severity::Critical,
        }
    }
}

/// Score a temporal window of events within a spatial cluster.
///
/// Confidence formula (from PRD §9):
///   volume    = min(event_count / 5, 1.0)           × 0.30
///   diversity = (distinct_source_classes / 4)        × 0.40
///   recency   = (1.0 - avg_age_seconds / window_max) × 0.30
pub fn score_cluster(events: &[&EventRow], window_secs: f64) -> ClusterScore {
    let event_count = events.len() as f64;
    let now = chrono::Utc::now();

    let source_classes: HashSet<&str> =
        events.iter().map(|e| e.source_class.as_str()).collect();
    let distinct = source_classes.len() as f64;

    let avg_age = events
        .iter()
        .map(|e| now.signed_duration_since(e.received_at).num_seconds() as f64)
        .sum::<f64>()
        / event_count;

    let volume_score    = (event_count / 5.0).min(1.0) * 0.30;
    let diversity_score = (distinct / 4.0) * 0.40;
    let recency_score   = (1.0 - (avg_age / window_secs).min(1.0)) * 0.30;

    let confidence = (volume_score + diversity_score + recency_score).clamp(0.0, 1.0);

    let has_signal_anomaly = events.iter().any(|e| {
        e.event_type == "SIGNAL"
            && e.payload.get("anomaly").and_then(|v| v.as_bool()).unwrap_or(false)
    });

    let source_diversity = distinct as i32;
    let mut severity = base_severity(confidence, source_diversity);

    if has_signal_anomaly && event_count > 1.0 {
        severity = severity.escalate();
    }

    ClusterScore {
        confidence,
        severity,
        source_count: event_count as i32,
        source_diversity,
        has_signal_anomaly,
    }
}

fn base_severity(confidence: f64, source_diversity: i32) -> Severity {
    if confidence >= 0.85 && source_diversity >= 4 {
        Severity::Critical
    } else if confidence >= 0.70 || source_diversity >= 3 {
        Severity::High
    } else if confidence >= 0.50 || source_diversity >= 2 {
        Severity::Medium
    } else {
        Severity::Low
    }
}
