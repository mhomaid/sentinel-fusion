-- Extensions enabled on first container start.
-- PostGIS and uuid-ossp must be installed in the Docker image before
-- these statements can succeed (see docker/Dockerfile.db).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
