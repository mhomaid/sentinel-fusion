# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

WORKDIR /app

# Install build deps
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies before copying source
COPY Cargo.toml Cargo.lock ./
COPY crates/api/Cargo.toml     crates/api/Cargo.toml
COPY crates/db/Cargo.toml      crates/db/Cargo.toml
COPY crates/fusion/Cargo.toml  crates/fusion/Cargo.toml
COPY crates/ingest/Cargo.toml  crates/ingest/Cargo.toml

# Stub src files so cargo can resolve the workspace
RUN mkdir -p crates/api/src crates/db/src crates/fusion/src crates/ingest/src \
    && echo 'fn main(){}' > crates/api/src/main.rs \
    && echo '' > crates/db/src/lib.rs \
    && echo '' > crates/fusion/src/lib.rs \
    && echo '' > crates/ingest/src/lib.rs

# Build deps-only layer (cached unless Cargo.toml changes)
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin api 2>/dev/null || true
RUN rm -rf crates/*/src

# Copy real source + sqlx query cache
COPY crates ./crates
COPY .sqlx ./.sqlx

# Build the final binary
RUN cargo build --release --bin api

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api /usr/local/bin/api

EXPOSE 8080

ENV RUST_LOG=info
ENV PORT=8080

CMD ["/usr/local/bin/api"]
