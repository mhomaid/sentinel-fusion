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
# GCC / Saudi-Arabia-first zones.
# Riyadh has 3x weight — it dominates the map as the primary zone.
ZONES: dict[str, dict] = {
    # ── Saudi Arabia (primary, higher weights) ────────────────────────────────
    "riyadh":          {"lat": 24.7136, "lon": 46.6753, "jitter": 0.008, "label": "Riyadh (Downtown), SA",    "weight": 4},
    "riyadh_kafd":     {"lat": 24.8029, "lon": 46.6336, "jitter": 0.008, "label": "Riyadh (KAFD), SA",        "weight": 3},
    "jeddah":          {"lat": 21.5433, "lon": 39.1728, "jitter": 0.008, "label": "Jeddah, SA",                "weight": 2},
    "jeddah_port":     {"lat": 21.4858, "lon": 39.1925, "jitter": 0.008, "label": "Jeddah Islamic Port, SA",   "weight": 2},
    "mecca":           {"lat": 21.3891, "lon": 39.8579, "jitter": 0.008, "label": "Mecca, SA",                 "weight": 2},
    "madinah":         {"lat": 24.4672, "lon": 39.6150, "jitter": 0.008, "label": "Madinah, SA",               "weight": 2},
    "dammam":          {"lat": 26.4207, "lon": 50.0888, "jitter": 0.008, "label": "Dammam, SA",                "weight": 2},
    "khobar":          {"lat": 26.2172, "lon": 50.1971, "jitter": 0.008, "label": "Al Khobar, SA",             "weight": 1},
    "tabuk":           {"lat": 28.3998, "lon": 36.5717, "jitter": 0.008, "label": "Tabuk, SA",                 "weight": 2},
    "jizan":           {"lat": 16.8892, "lon": 42.5611, "jitter": 0.008, "label": "Jizan, SA",                 "weight": 2},
    # ── UAE ───────────────────────────────────────────────────────────────────
    "dubai_downtown":  {"lat": 25.1972, "lon": 55.2744, "jitter": 0.008, "label": "Dubai (Downtown), UAE",     "weight": 2},
    "dubai_marina":    {"lat": 25.0777, "lon": 55.1405, "jitter": 0.008, "label": "Dubai Marina, UAE",         "weight": 1},
    "abudhabi":        {"lat": 24.4539, "lon": 54.3773, "jitter": 0.008, "label": "Abu Dhabi, UAE",            "weight": 2},
    "sharjah":         {"lat": 25.3463, "lon": 55.4209, "jitter": 0.008, "label": "Sharjah, UAE",              "weight": 1},
    "alain":           {"lat": 24.2075, "lon": 55.7447, "jitter": 0.008, "label": "Al Ain, UAE",               "weight": 1},
    # ── Qatar ─────────────────────────────────────────────────────────────────
    "doha":            {"lat": 25.2854, "lon": 51.5310, "jitter": 0.008, "label": "Doha, QA",                  "weight": 2},
    "doha_corniche":   {"lat": 25.2966, "lon": 51.5329, "jitter": 0.008, "label": "Doha Corniche, QA",         "weight": 1},
    "lusail":          {"lat": 25.4267, "lon": 51.4892, "jitter": 0.008, "label": "Lusail City, QA",           "weight": 1},
    "al_wakrah":       {"lat": 25.1700, "lon": 51.6030, "jitter": 0.008, "label": "Al Wakrah, QA",             "weight": 1},
    "al_khor":         {"lat": 25.6797, "lon": 51.4990, "jitter": 0.008, "label": "Al Khor, QA",               "weight": 1},
    # ── Kuwait ────────────────────────────────────────────────────────────────
    "kuwait_city":     {"lat": 29.3759, "lon": 47.9774, "jitter": 0.008, "label": "Kuwait City, KW",           "weight": 2},
    "ahmadi":          {"lat": 29.0833, "lon": 48.0833, "jitter": 0.008, "label": "Ahmadi (Oil Zone), KW",     "weight": 1},
    "salmiya":         {"lat": 29.3341, "lon": 48.0787, "jitter": 0.008, "label": "Salmiya, KW",               "weight": 1},
    # ── Bahrain ───────────────────────────────────────────────────────────────
    "manama":          {"lat": 26.2235, "lon": 50.5876, "jitter": 0.008, "label": "Manama, BH",                "weight": 1},
    "riffa":           {"lat": 26.1230, "lon": 50.5558, "jitter": 0.008, "label": "Riffa, BH",                 "weight": 1},
    # ── Oman ──────────────────────────────────────────────────────────────────
    "muscat":          {"lat": 23.5880, "lon": 58.3829, "jitter": 0.008, "label": "Muscat, OM",                "weight": 1},
    "salalah":         {"lat": 17.0151, "lon": 54.0924, "jitter": 0.008, "label": "Salalah, OM",               "weight": 1},
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
        if zone_filter:
            zones = [zone_filter]
        else:
            # Build weighted list so high-weight zones are picked more often
            zones = []
            for name, z in ZONES.items():
                zones.extend([name] * z.get("weight", 1))
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
    ap.add_argument("--api",   default="https://sentinel-fusion-production-1147.up.railway.app", help="API base URL")
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
