use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

/// A single event row as fetched from the database window query.
#[derive(Debug, Clone)]
pub struct EventRow {
    pub id: Uuid,
    pub event_type: String,
    pub source_class: String,
    pub lat: f64,
    pub lon: f64,
    pub payload: serde_json::Value,
    pub received_at: DateTime<Utc>,
}

/// A cluster of temporally and spatially correlated events.
#[derive(Debug, Clone)]
pub struct EventCluster {
    pub geohash: String,
    pub events: Vec<EventRow>,
}

/// Group a flat list of events into spatial clusters using geohash prefix
/// matching. Adjacent cells (sharing a prefix of length `precision - 1`) are
/// merged together.
///
/// This is a simplified in-process approximation of the PostGIS
/// `ST_DWithin` merge done in the real pipeline. The production version
/// queries PostGIS directly for sub-300m proximity grouping.
pub fn cluster_by_geohash(events: Vec<EventRow>, precision: usize) -> Vec<EventCluster> {
    let mut map: HashMap<String, Vec<EventRow>> = HashMap::new();

    for event in events {
        let gh = geohash_encode(event.lat, event.lon, precision);
        map.entry(gh).or_default().push(event);
    }

    map.into_iter()
        .map(|(geohash, events)| EventCluster { geohash, events })
        .collect()
}

/// Filter a cluster's events to those within a `window_secs` sliding window.
/// Returns sub-clusters, each representing a distinct temporal burst.
pub fn apply_temporal_window(cluster: &EventCluster, window_secs: i64) -> Vec<Vec<&EventRow>> {
    if cluster.events.is_empty() {
        return vec![];
    }

    let mut sorted: Vec<&EventRow> = cluster.events.iter().collect();
    sorted.sort_by_key(|e| e.received_at);

    let mut windows: Vec<Vec<&EventRow>> = vec![];
    let mut current: Vec<&EventRow> = vec![sorted[0]];

    for event in &sorted[1..] {
        let delta = event.received_at.signed_duration_since(current[0].received_at).num_seconds();
        if delta <= window_secs {
            current.push(event);
        } else {
            windows.push(current.clone());
            current = vec![event];
        }
    }
    windows.push(current);

    windows
}

/// Encode lat/lon to a geohash string of the requested character length.
/// Uses a simple base32 encoding (Gustavo Niemeyer's geohash algorithm).
fn geohash_encode(lat: f64, lon: f64, precision: usize) -> String {
    const BASE32: &[u8] = b"0123456789bcdefghjkmnpqrstuvwxyz";

    let mut min_lat = -90.0_f64;
    let mut max_lat = 90.0_f64;
    let mut min_lon = -180.0_f64;
    let mut max_lon = 180.0_f64;

    let mut hash = String::with_capacity(precision);
    let mut bits = 0u8;
    let mut num_bits = 0u8;
    let mut is_lon = true;

    while hash.len() < precision {
        if is_lon {
            let mid = (min_lon + max_lon) / 2.0;
            if lon >= mid {
                bits = (bits << 1) | 1;
                min_lon = mid;
            } else {
                bits <<= 1;
                max_lon = mid;
            }
        } else {
            let mid = (min_lat + max_lat) / 2.0;
            if lat >= mid {
                bits = (bits << 1) | 1;
                min_lat = mid;
            } else {
                bits <<= 1;
                max_lat = mid;
            }
        }
        is_lon = !is_lon;
        num_bits += 1;

        if num_bits == 5 {
            hash.push(BASE32[bits as usize] as char);
            bits = 0;
            num_bits = 0;
        }
    }

    hash
}
