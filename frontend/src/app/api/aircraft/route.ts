import { NextResponse } from "next/server";

const CLIENT_ID     = process.env.OPENSKY_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET ?? "";
const TOKEN_URL     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
// GCC bounding box: lat 15–32 N, lon 35–60 E
const STATES_URL    = "https://opensky-network.org/api/states/all?lamin=15&lomin=35&lamax=32&lomax=60";

// Module-level token cache (survives across warm invocations on Vercel)
let cachedToken = "";
let tokenExpiresAt = 0;

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[opensky] token fetch failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  cachedToken    = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function GET() {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json([], { status: 200 });
    }

    const res = await fetch(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[opensky] states fetch failed: ${res.status}`);
      return NextResponse.json([], { status: 200 });
    }

    const raw = await res.json();
    const states: unknown[] = raw.states ?? [];

    const aircraft = states
      .map((s) => {
        const a = s as unknown[];
        const lon       = a[5] as number | null;
        const lat       = a[6] as number | null;
        const onGround  = a[8] as boolean;
        if (lon == null || lat == null || onGround) return null;
        return {
          icao24:         (a[0] as string) ?? "",
          callsign:       ((a[1] as string) ?? "").trim() || null,
          origin_country: (a[2] as string) ?? "",
          lat, lon,
          altitude_m:     (a[7]  as number) ?? 0,
          speed_ms:       (a[9]  as number) ?? 0,
          heading_deg:    (a[10] as number) ?? 0,
          on_ground:      false,
        };
      })
      .filter(Boolean);

    return NextResponse.json(aircraft, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[opensky] error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
