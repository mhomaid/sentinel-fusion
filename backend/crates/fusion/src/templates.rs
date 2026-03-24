use std::collections::HashSet;

use crate::clustering::EventRow;

/// Generate a human-readable incident title from the event cluster.
pub fn generate_title(events: &[&EventRow], geohash: &str) -> String {
    let types: HashSet<&str> = events.iter().map(|e| e.event_type.as_str()).collect();

    let has_detection  = types.contains("DETECTION");
    let has_signal     = types.contains("SIGNAL");
    let has_telemetry  = types.contains("TELEMETRY");

    if has_detection && has_signal && has_telemetry {
        format!("Multi-sensor convergence — Grid {geohash}")
    } else if has_detection && has_signal {
        format!("RF-corroborated detection — {geohash}")
    } else if has_signal && events.len() >= 3 {
        format!("Multi-source RF anomaly cluster — Grid {geohash}")
    } else if has_telemetry && !has_detection && !has_signal {
        format!("Unresolved aerial activity — {geohash}")
    } else {
        format!("Sensor activity — Grid {geohash}")
    }
}

/// Generate an incident summary derived from actual field values in the
/// cluster. Output is deterministic and fully traceable to the source events.
pub fn generate_summary(events: &[&EventRow], geohash: &str) -> String {
    let types: HashSet<&str> = events.iter().map(|e| e.event_type.as_str()).collect();

    let has_detection  = types.contains("DETECTION");
    let has_signal     = types.contains("SIGNAL");
    let has_telemetry  = types.contains("TELEMETRY");

    let duration_secs = if events.len() > 1 {
        let times: Vec<_> = events.iter().map(|e| e.received_at).collect();
        let min = times.iter().min().unwrap();
        let max = times.iter().max().unwrap();
        max.signed_duration_since(*min).num_seconds()
    } else {
        0
    };

    let source_count = events.len();

    if has_detection && has_signal && has_telemetry {
        let freq = events.iter()
            .find(|e| e.event_type == "SIGNAL")
            .and_then(|e| e.payload.get("frequency_mhz"))
            .and_then(|v| v.as_f64());

        let freq_str = freq.map_or(String::new(), |f| format!(" on {f} MHz"));
        format!(
            "Vehicle detection, RF anomaly{freq_str}, and aerial observation correlated \
             within {duration_secs}s at {geohash}. {source_count} sources, {} sensor classes.",
            types.len()
        )
    } else if has_detection && has_signal {
        let freq = events.iter()
            .find(|e| e.event_type == "SIGNAL")
            .and_then(|e| e.payload.get("frequency_mhz"))
            .and_then(|v| v.as_f64());
        let src = events.iter()
            .find(|e| e.event_type == "SIGNAL")
            .map(|e| e.source_id.as_str())
            .unwrap_or("unknown");
        let freq_str = freq.map_or(String::new(), |f| format!(" on {f:.1} MHz"));
        format!(
            "Object detection at {geohash} corroborated by RF anomaly{freq_str} from {src}."
        )
    } else if has_signal && source_count >= 3 {
        let freq = events.iter()
            .find(|e| e.event_type == "SIGNAL")
            .and_then(|e| e.payload.get("frequency_mhz"))
            .and_then(|v| v.as_f64());
        let freq_str = freq.map_or(String::new(), |f| format!("~{f:.0} MHz"));
        format!(
            "{source_count} RF sensors reporting anomalous transmission on {freq_str} within 300m \
             radius. Possible drone control frequency. No visual corroboration yet."
        )
    } else if has_telemetry && !has_detection && !has_signal {
        format!(
            "Drone telemetry cluster at {geohash} without visual or signal corroboration. \
             Monitoring."
        )
    } else {
        format!(
            "{source_count} sensor event(s) at {geohash} within {duration_secs}s. \
             Further corroboration pending."
        )
    }
}
