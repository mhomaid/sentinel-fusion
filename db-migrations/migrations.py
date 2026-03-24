"""
Sentinel Fusion — Database Migration CLI
Run with:  uv run migrations.py [COMMAND] [OPTIONS]
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from typing import Annotated, Optional

import psycopg
import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table
from rich import print as rprint

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent
MIGRATIONS  = ROOT / "migrations"
SEED_DIR    = ROOT / "seed"
ENV_LOCAL   = ROOT.parent / ".env"
ENV_UAT     = ROOT.parent / ".env.uat"
ENV_PROD    = ROOT.parent / ".env.prod"

console = Console()
app     = typer.Typer(
    name="migrate",
    help="Sentinel Fusion database migration and seed CLI.",
    add_completion=False,
    no_args_is_help=True,
)

# ─────────────────────────────────────────────────────────────────────────────
# Environment helpers
# ─────────────────────────────────────────────────────────────────────────────

ENV_OPTIONS = {
    "1": ("local", ENV_LOCAL,  "DATABASE_URL"),
    "2": ("uat",   ENV_UAT,    "UAT_DATABASE_URL"),
    "3": ("prod",  ENV_PROD,   "SUPABASE_DATABASE_URL"),
}


def select_environment(env_flag: Optional[str]) -> tuple[str, str]:
    """
    Resolve the target environment and return (env_name, dsn).
    If env_flag is provided it must be 'local', 'uat', or 'prod'.
    Otherwise, an interactive prompt is shown.
    """
    if env_flag:
        match = next(
            ((name, path, key) for name, path, key in ENV_OPTIONS.values() if name == env_flag),
            None,
        )
        if not match:
            console.print(f"[red]Unknown environment '{env_flag}'. Choose local, uat, or prod.[/red]")
            raise typer.Exit(1)
        name, env_path, url_key = match
    else:
        console.print(
            Panel(
                "[bold]Select environment[/bold]\n\n"
                "  [cyan][1][/cyan] local  — DATABASE_URL from [dim].env[/dim]\n"
                "  [cyan][2][/cyan] uat    — UAT_DATABASE_URL from [dim].env.uat[/dim]\n"
                "  [cyan][3][/cyan] prod   — SUPABASE_DATABASE_URL from [dim].env.prod[/dim]",
                title="Sentinel Fusion Migrations",
                border_style="blue",
            )
        )
        choice = Prompt.ask("Choice", choices=["1", "2", "3"], default="1")
        name, env_path, url_key = ENV_OPTIONS[choice]

    if env_path.exists():
        load_dotenv(env_path, override=True)
    else:
        load_dotenv(ENV_LOCAL, override=False)

    dsn = os.environ.get(url_key)
    if not dsn:
        console.print(
            f"[red]'{url_key}' not set. "
            f"Create [bold]{env_path.name}[/bold] with this variable.[/red]"
        )
        raise typer.Exit(1)

    if name == "prod":
        console.print(
            Panel(
                "[bold red]WARNING — Production Database[/bold red]\n\n"
                "You are about to run migrations against [bold]Supabase (prod)[/bold].\n"
                "This cannot be undone. Make sure you have a backup.",
                border_style="red",
            )
        )
        confirmed = Confirm.ask("[bold red]Are you sure?[/bold red]", default=False)
        if not confirmed:
            console.print("[yellow]Aborted.[/yellow]")
            raise typer.Exit(0)

    return name, dsn


# ─────────────────────────────────────────────────────────────────────────────
# Migration tracking
# ─────────────────────────────────────────────────────────────────────────────

TRACKING_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def ensure_tracking_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(TRACKING_DDL)
    conn.commit()


def applied_versions(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        return {row[0] for row in cur.fetchall()}


def mark_applied(conn: psycopg.Connection, version: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING",
            (version,),
        )
    conn.commit()


def pending_migration_files(applied: set[str]) -> list[Path]:
    """Return sorted SQL files not yet in schema_migrations."""
    if not MIGRATIONS.exists():
        return []
    files = sorted(
        f for f in MIGRATIONS.glob("*.sql")
        if f.name not in applied
    )
    return files


# ─────────────────────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────────────────────

EnvOption = Annotated[
    Optional[str],
    typer.Option("--env", "-e", help="Environment: local | uat | prod"),
]


@app.command()
def migrate(
    env: EnvOption = None,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Print SQL without executing")] = False,
) -> None:
    """Apply all pending migrations in order."""
    env_name, dsn = select_environment(env)
    console.print(f"\n[bold green]→ Connecting to[/bold green] [cyan]{env_name}[/cyan]")

    with psycopg.connect(dsn) as conn:
        ensure_tracking_table(conn)
        applied = applied_versions(conn)
        pending = pending_migration_files(applied)

        if not pending:
            console.print("[green]✓ All migrations already applied. Nothing to do.[/green]\n")
            return

        console.print(f"[bold]Found {len(pending)} pending migration(s):[/bold]")
        for f in pending:
            console.print(f"  [yellow]→[/yellow] {f.name}")

        console.print()

        for migration_file in pending:
            sql = migration_file.read_text()
            console.print(f"[bold blue]Applying:[/bold blue] {migration_file.name}")

            if dry_run:
                console.print(f"[dim]{sql[:300]}...[/dim]" if len(sql) > 300 else f"[dim]{sql}[/dim]")
                console.print("[yellow](dry-run — not executed)[/yellow]\n")
                continue

            try:
                with conn.cursor() as cur:
                    cur.execute(sql)
                conn.commit()
                mark_applied(conn, migration_file.name)
                console.print(f"  [green]✓ Done[/green]\n")
            except Exception as exc:
                conn.rollback()
                console.print(f"  [red]✗ Failed: {exc}[/red]")
                raise typer.Exit(1) from exc

    console.print("[bold green]✓ All migrations applied successfully.[/bold green]\n")


@app.command()
def status(env: EnvOption = None) -> None:
    """Show which migrations have been applied and which are pending."""
    env_name, dsn = select_environment(env)
    console.print(f"\n[bold green]→ Connecting to[/bold green] [cyan]{env_name}[/cyan]\n")

    with psycopg.connect(dsn) as conn:
        ensure_tracking_table(conn)
        applied = applied_versions(conn)

        all_files = sorted(MIGRATIONS.glob("*.sql")) if MIGRATIONS.exists() else []

        table = Table(title=f"Migration Status — {env_name}", show_lines=True)
        table.add_column("File",       style="bold")
        table.add_column("Status",     justify="center")
        table.add_column("Applied At", justify="center")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT version, applied_at FROM schema_migrations ORDER BY version"
            )
            records = {row[0]: row[1] for row in cur.fetchall()}

        for f in all_files:
            if f.name in records:
                table.add_row(f.name, "[green]✓ applied[/green]", str(records[f.name]))
            else:
                table.add_row(f.name, "[yellow]⏳ pending[/yellow]", "—")

        console.print(table)
        console.print()


@app.command()
def rollback(env: EnvOption = None) -> None:
    """
    Rollback is not automated — SQL migrations are intentionally forward-only.

    To rollback manually:
      1. Connect to the database directly.
      2. Run the inverse SQL.
      3. DELETE FROM schema_migrations WHERE version = '<file>';
    """
    console.print(
        Panel(
            "[bold yellow]Manual rollback required.[/bold yellow]\n\n"
            "Automated rollback is not supported — migrations are forward-only.\n\n"
            "To undo a migration:\n"
            "  1. Connect to the database.\n"
            "  2. Run the inverse SQL statements.\n"
            "  3. [bold]DELETE FROM schema_migrations WHERE version = '\\<file\\>';[/bold]",
            title="Rollback",
            border_style="yellow",
        )
    )


@app.command()
def seed(
    env: EnvOption = None,
    scenario: Annotated[
        str,
        typer.Argument(
            help="Scenario to seed: scenario_a | scenario_b | scenario_c_part1 | scenario_c_part2 | all"
        ),
    ] = "all",
    api_url: Annotated[
        str,
        typer.Option("--api-url", help="Base URL for the Sentinel Fusion API"),
    ] = "http://localhost:8080",
) -> None:
    """Post seed events to the Sentinel Fusion ingest API."""
    events_file = SEED_DIR / "events.json"
    if not events_file.exists():
        console.print(f"[red]Seed file not found: {events_file}[/red]")
        raise typer.Exit(1)

    data: dict = json.loads(events_file.read_text())

    scenarios_to_run: list[str] = (
        [k for k in data if not k.startswith("_")]
        if scenario == "all"
        else [scenario]
    )

    for sc in scenarios_to_run:
        if sc not in data:
            console.print(f"[red]Unknown scenario '{sc}'[/red]")
            continue

        sc_data = data[sc]
        events  = sc_data.get("events", [])
        desc    = sc_data.get("description", sc)

        console.print(
            Panel(
                f"[bold]{sc}[/bold]\n[dim]{desc}[/dim]",
                border_style="cyan",
            )
        )

        success = 0
        for i, event in enumerate(events, 1):
            payload = json.dumps(event).encode()
            req = urllib.request.Request(
                f"{api_url}/api/events",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    body = json.loads(resp.read())
                    event_id = body.get("id", "?")
                    console.print(f"  [{i:02d}] [green]✓[/green] {event_id}")
                    success += 1
            except Exception as exc:
                console.print(f"  [{i:02d}] [red]✗ {exc}[/red]")

        console.print(
            f"\n  [bold green]Sent {success}/{len(events)} event(s).[/bold green] "
            f"Fusion fires every 30s — check [cyan]{api_url}/api/incidents[/cyan]\n"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app()
