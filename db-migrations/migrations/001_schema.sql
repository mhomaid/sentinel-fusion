-- PostGIS extension (required before any GEOMETRY columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─────────────────────────────────────────────────────────────────────────────
-- Raw events from any sensor source
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE raw_events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    TEXT        NOT NULL CHECK (event_type IN ('DETECTION', 'TELEMETRY', 'SIGNAL', 'STATUS')),
    source_id     TEXT        NOT NULL,
    source_class  TEXT        NOT NULL CHECK (source_class IN ('DRONE', 'CAMERA', 'RF_SENSOR', 'RADAR')),
    location      GEOMETRY(Point, 4326),
    payload       JSONB       NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    normalized_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fused intelligence incidents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE incidents (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL,
    summary          TEXT        NOT NULL,
    severity         TEXT        NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confidence       FLOAT       NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    status           TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UPDATING', 'CLOSED')),
    location         GEOMETRY(Point, 4326),
    geohash          TEXT        NOT NULL,
    event_ids        UUID[]      NOT NULL,
    event_types      TEXT[]      NOT NULL,
    source_count     INT         NOT NULL,
    source_diversity INT         NOT NULL,
    first_event_at   TIMESTAMPTZ NOT NULL,
    last_event_at    TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
