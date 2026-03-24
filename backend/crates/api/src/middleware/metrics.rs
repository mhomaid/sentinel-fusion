// Request timing middleware — logs method, path, status, and latency for every
// HTTP request. Wraps the tower_http TraceLayer with structured fields.

use axum::{body::Body, http::Request, middleware::Next, response::Response};
use std::time::Instant;
use tracing::info;

pub async fn track(req: Request<Body>, next: Next) -> Response {
    let method = req.method().clone();
    let path   = req.uri().path().to_string();
    let start  = Instant::now();

    let response = next.run(req).await;

    info!(
        method  = %method,
        path    = %path,
        status  = response.status().as_u16(),
        latency_ms = start.elapsed().as_millis(),
        "request"
    );

    response
}
