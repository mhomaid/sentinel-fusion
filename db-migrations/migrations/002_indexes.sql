-- ─────────────────────────────────────────────────────────────────────────────
-- raw_events indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_raw_events_location    ON raw_events USING GIST(location);
CREATE INDEX idx_raw_events_received_at ON raw_events(received_at DESC);
CREATE INDEX idx_raw_events_type        ON raw_events(event_type);
CREATE INDEX idx_raw_events_source_id   ON raw_events(source_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- incidents indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_incidents_location   ON incidents USING GIST(location);
CREATE INDEX idx_incidents_severity   ON incidents(severity);
CREATE INDEX idx_incidents_status     ON incidents(status);
CREATE INDEX idx_incidents_geohash    ON incidents(geohash);
CREATE INDEX idx_incidents_last_event ON incidents(last_event_at DESC);
