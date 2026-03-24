"""
simulate.py — Continuous Sentinel Fusion event simulator

Generates a realistic stream of multi-sensor events across global hot-zones,
sending them to the ingest API so the fusion engine creates live incidents on
the dashboard map.

Usage:
    uv run simulate.py               # default: 1 event/s, run forever
    uv run simulate.py --rate 3      # 3 events/second
    uv run simulate.py --burst 5     # post 5 quick scenarios and exit
    uv run simulate.py --zone riyadh # only generate events for one zone
"""

import time
import random
import argparse
import signal
import sys
from datetime import datetime, timezone
from typing import Any

import httpx
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

console = Console()

# ── Hot-zone definitions ──────────────────────────────────────────────────────
# Each zone has a centre lat/lon and a jitter radius (degrees ~≈ km scale).
ZONES: dict[str, dict] = {
    "riyadh":   {"lat": 24.7136, "lon": 46.6753, "jitter": 0.015, "label": "Riyadh, SA"},
    "dubai":    {"lat": 25.2048, "lon": 55.2708, "jitter": 0.012, "label": "Dubai, UAE"},
    "tel_aviv": {"lat": 32.0853, "lon": 34.7818, "jitter": 0.010, "label": "Tel Aviv, IL"},
    "cairo":    {"lat": 30.0444, "lon": 31.2357, "jitter": 0.018, "label": "Cairo, EG"},
    "baghdad":  {"lat": 33.3152, "lon": 44.3661, "jitter": 0.020, "label": "Baghdad, IQ"},
    "kabul":    {"lat": 34.5553, "lon": 69.2075, "jitter": 0.016, "label": "Kabul, AF"},
    "kyiv":     {"lat": 50.4501, "lon": 30.5234, "jitter": 0.022, "label": "Kyiv, UA"},
    "seoul":    {"lat": 37.5665, "lon": 126.9780, "jitter": 0.014, "label": "Seoul, KR"},
}

# ── Event generators ──────────────────────────────────────────────────────────

def _jitter(base: float, amount: float) -> float:
    return base + random.uniform(-amount, amount)


def gen_camera_event(lat: float, lon: float) -> dict[str, Any]:
    obj_class = random.choice(["vehicle", "person", "aircraft", "drone"])
    confidence = round(random.uniform(0.72, 0.98), 2)
    return {
        "source": f"cam-{random.randint(1, 20):02d}",
        "type": "detection",
        "objects": [{"class": obj_class, "confidence": confidence, "speed_kmh": random.randint(0, 120)}],
        "lat": lat,
        "lon": lon,
    }


def gen_rf_event(lat: float, lon: float) -> dict[str, Any]:
    freq = round(random.choice([433.9, 915.0, 2400.0, 5800.0, 868.0]) + random.uniform(-0.5, 0.5), 1)
    return {
        "sensor_id": f"rf-{random.randint(1, 8):02d}",
        "frequency_mhz": freq,
        "strength_dbm": random.randint(-75, -45),
        "anomaly": True,
        "anomaly_type": random.choice(["UNKNOWN_TRANSMISSION", "FREQUENCY_HOP", "BURST_SIGNAL"]),
        "position": {"lat": lat, "lon": lon},
    }


def gen_drone_event(lat: float, lon: float) -> dict[str, Any]:
    return {
        "drone_id": f"sentinel-{random.randint(1, 12):02d}",
        "altitude_m": random.randint(30, 300),
        "heading_deg": random.randint(0, 359),
        "speed_ms": round(random.uniform(4.0, 22.0), 1),
        "battery_pct": random.randint(15, 95),
        "lat": lat,
        "lon": lon,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def gen_radar_event(lat: float, lon: float) -> dict[str, Any]:
    return {
        "radar_id": f"radar-{random.randint(1, 4):02d}",
        "track_id": f"TRK-{random.randint(1000, 9999)}",
        "lat": lat,
        "lon": lon,
        "altitude_ft": random.randint(0, 15000),
        "speed_knots": random.randint(0, 450),
        "heading_deg": random.randint(0, 359),
        "radar_cross_section": round(random.uniform(0.1, 8.0), 2),
    }


GENERATORS = [gen_camera_event, gen_rf_event, gen_drone_event, gen_radar_event]

# ── Scenario builder ──────────────────────────────────────────────────────────

def make_scenario(zone_name: str, burst: bool = False) -> list[dict]:
    """
    Build a realistic multi-event scenario for a zone.

    burst=True → all sensor types together → likely CRITICAL
    burst=False → 1-2 random events → LOW/MEDIUM
    """
    z = ZONES[zone_name]
    centre_lat = _jitter(z["lat"], z["jitter"] * 0.3)
    centre_lon = _jitter(z["lon"], z["jitter"] * 0.3)

    if burst:
        events = [gen(centre_lat, centre_lon) for gen in GENERATORS]
    else:
        n = random.randint(1, 3)
        gens = random.sample(GENERATORS, n)
        events = []
        for g in gens:
            lat = _jitter(centre_lat, z["jitter"])
            lon = _jitter(centre_lon, z["jitter"])
            events.append(g(lat, lon))

    return events


# ── Poster ────────────────────────────────────────────────────────────────────

class Simulator:
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip("/")
        self.sent = 0
        self.ok = 0
        self.errors = 0
        self.zone_counts: dict[str, int] = {z: 0 for z in ZONES}
        self.running = True
        self.log: list[str] = []

    def post_event(self, event: dict) -> bool:
        try:
            r = httpx.post(f"{self.api_url}/api/events", json=event, timeout=5)
            return r.status_code == 202
        except Exception:
            return False

    def post_scenario(self, zone_name: str, burst: bool = False) -> int:
        events = make_scenario(zone_name, burst=burst)
        succeeded = 0
        for ev in events:
            ok = self.post_event(ev)
            self.sent += 1
            if ok:
                self.ok += 1
                succeeded += 1
            else:
                self.errors += 1
        if succeeded:
            self.zone_counts[zone_name] += succeeded
        return succeeded

    def _make_table(self) -> Table:
        t = Table(
            box=box.MINIMAL,
            show_header=True,
            header_style="bold bright_green",
            border_style="bright_black",
            padding=(0, 1),
        )
        t.add_column("Zone",    style="white",       min_width=20)
        t.add_column("Events",  style="bright_green", justify="right", min_width=8)
        t.add_column("Status",  justify="center",    min_width=10)
        for name, z in ZONES.items():
            count = self.zone_counts[name]
            bar = "█" * min(count // 2, 20) if count else "·"
            t.add_row(z["label"], str(count), f"[green]{bar}[/]" if count else "[dim]idle[/]")
        return t

    def _make_panel(self) -> Panel:
        sent_txt = Text(f"Sent {self.ok:,} / {self.sent:,}", style="bold green")
        err_txt  = Text(f"  ✗ {self.errors}", style="red") if self.errors else Text("")
        status   = Text.assemble(sent_txt, err_txt)

        log_lines = "\n".join(self.log[-6:]) if self.log else "[dim]waiting for first event...[/dim]"

        content = Text.assemble(
            status, "\n\n",
            Text("Recent activity:\n", style="dim"),
            Text(log_lines, style="bright_black"),
        )
        return Panel(
            content,
            title="[bold green]SENTINEL FUSION — LIVE SIMULATOR[/]",
            border_style="green",
            subtitle=f"[dim]{self.api_url}[/dim]",
        )

    def add_log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log.append(f"[dim]{ts}[/dim] {msg}")

    def run(self, rate: float = 1.0, zone_filter: str | None = None):
        """Run the simulator indefinitely at `rate` events/second."""
        zones = [zone_filter] if zone_filter else list(ZONES.keys())
        delay = 1.0 / rate

        with Live(self._make_panel(), refresh_per_second=4, console=console) as live:
            while self.running:
                zone = random.choice(zones)
                burst = random.random() < 0.15  # 15% chance of a burst scenario
                n = self.post_scenario(zone, burst=burst)

                label = ZONES[zone]["label"]
                kind  = "BURST" if burst else "event"
                style = "bold red" if burst else "green"
                self.add_log(f"[{style}]{label}[/] → {n} {kind}(s) posted")

                live.update(
                    Panel(
                        Text.assemble(
                            Text(f"Sent {self.ok:,} / {self.sent:,}", style="bold green"),
                            Text(f"  ✗ {self.errors}", style="red") if self.errors else Text(""),
                            Text("\n\nRecent activity:\n", style="dim"),
                            Text("\n".join(self.log[-6:]), style="bright_black"),
                        ),
                        title="[bold green]SENTINEL FUSION — LIVE SIMULATOR[/]",
                        border_style="green",
                        subtitle=f"[dim]{self.api_url} · {rate:.0f} req/s · fusion cycle: 30s[/dim]",
                    )
                )
                live.update(self._make_table(), refresh=False)

                time.sleep(delay)

    def run_burst_all(self):
        """Fire all scenarios once and exit — useful for quick smoke-test."""
        for zone in ZONES:
            n = self.post_scenario(zone, burst=True)
            console.print(f"  [green]✓[/] {ZONES[zone]['label']} — {n} events")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Sentinel Fusion live event simulator")
    ap.add_argument("--api",   default="http://localhost:8080", help="API base URL")
    ap.add_argument("--rate",  type=float, default=1.0,  help="Events per second (default: 1)")
    ap.add_argument("--burst", action="store_true",       help="Fire one burst per zone and exit")
    ap.add_argument("--zone",  default=None,              help="Only simulate a specific zone")
    args = ap.parse_args()

    sim = Simulator(api_url=args.api)

    def handle_sigint(sig, frame):
        sim.running = False
        console.print("\n[dim]Stopping simulator...[/dim]")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sigint)

    if args.burst:
        console.print(Panel("[bold green]BURST MODE — one scenario per zone[/]", border_style="green"))
        sim.run_burst_all()
        console.print(f"\n[green]Done.[/] {sim.ok}/{sim.sent} events posted. Fusion runs in ~30s.")
        return

    if args.zone and args.zone not in ZONES:
        console.print(f"[red]Unknown zone '{args.zone}'. Valid: {', '.join(ZONES)}[/]")
        sys.exit(1)

    sim.run(rate=args.rate, zone_filter=args.zone)


if __name__ == "__main__":
    main()
