pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use std::str::FromStr;

pub fn connect(database_url: &str) -> Result<PgPool> {
    // Parse the URL so we can disable the prepared-statement cache.
    // Supabase's session pooler (PgBouncer) does not support prepared
    // statements in transaction mode — disabling the cache makes SQLx
    // use simple query protocol instead, which works with any pooler.
    let opts = PgConnectOptions::from_str(database_url)?
        .statement_cache_capacity(0);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect_lazy_with(opts);

    Ok(pool)
}
