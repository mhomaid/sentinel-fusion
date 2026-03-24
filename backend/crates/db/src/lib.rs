pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::Executor as _;
use sqlx::PgPool;
use std::str::FromStr;

pub fn connect(database_url: &str) -> Result<PgPool> {
    // Disable the client-side prepared-statement cache so SQLx sends
    // CLOSE after every query instead of accumulating named statements.
    //
    // Additionally, run DEALLOCATE ALL via simple-query protocol on every
    // new connection: when PgBouncer recycles a backend connection, the
    // previous session's prepared statements (e.g. sqlx_s_1) are still
    // present on the server.  Clearing them on acquire prevents the
    // "prepared statement already exists" error that fires on the first
    // fusion cycle after a redeploy.
    let opts = PgConnectOptions::from_str(database_url)?
        .statement_cache_capacity(0);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                // Use the simple-query path so this never itself tries
                // to create a prepared statement.
                conn.execute(sqlx::raw_sql("DEALLOCATE ALL")).await.ok();
                Ok(())
            })
        })
        .connect_lazy_with(opts);

    Ok(pool)
}
