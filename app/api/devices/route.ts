// app/api/devices/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

function toIso(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function normalizeDevice(raw: any) {
  const lat = raw?.lat ?? raw?.lastLocation?.lat ?? null;
  const lng = raw?.lng ?? raw?.lastLocation?.lng ?? null;

  const accuracy_m =
    raw?.accuracy_m ??
    raw?.accuracy ??
    raw?.lastLocation?.accuracy_m ??
    null;

  const lastSeenAt =
    toIso(raw?.lastSeenAt) ??
    toIso(raw?.lastHeartbeatAt) ??
    toIso(raw?.lastHeartbeat) ??
    toIso(raw?.lastUpdatedAt) ??
    toIso(raw?.lastLocationAt) ??
    toIso(raw?.lastSeen) ??
    null;

  const deviceId = raw?.deviceId ?? raw?.id ?? null;

  // online: si fourni, sinon calcul simple
  let online = raw?.online;
  if (typeof online !== "boolean") {
    if (!lastSeenAt) online = false;
    else {
      const ageMs = Date.now() - new Date(lastSeenAt).getTime();
      online = ageMs <= 5 * 60 * 1000; // 5 min
    }
  }

  return {
    deviceId,
    name: raw?.name ?? null,
    clientId: raw?.clientId ?? null,
    clientName: raw?.clientName ?? null,
    category: raw?.category ?? raw?.deviceType ?? raw?.type ?? "UNKNOWN",
    deviceType: raw?.deviceType ?? raw?.type ?? "UNKNOWN",
    lat,
    lng,
    accuracy_m: typeof accuracy_m === "number" ? accuracy_m : null,
    lastSeenAt,
    online,
    status: raw?.status ?? (online ? "ONLINE" : "OFFLINE"),
    battery: typeof raw?.battery === "number" ? raw.battery : null,
    charging: typeof raw?.charging === "boolean" ? raw.charging : null,
    networkType: raw?.networkType ?? null,
    wifiSsid: raw?.wifiSsid ?? null,
    simOperator: raw?.simOperator ?? null,
    airplaneMode: typeof raw?.airplaneMode === "boolean" ? raw.airplaneMode : null,
    simChangedRecently: typeof raw?.simChangedRecently === "boolean" ? raw.simChangedRecently : false,
    currentZoneId: raw?.currentZoneId ?? null,
    lastZoneEvent: raw?.lastZoneEvent ?? null,
  };
}

export async function GET() {
  const res = await fetch(`${API_BASE}/devices`, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!data?.ok || !Array.isArray(data?.items)) {
    return NextResponse.json(
      { ok: false, error: "UPSTREAM_BAD_RESPONSE", upstream: data },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const items = data.items.map(normalizeDevice);

  return NextResponse.json(
    { ok: true, items },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
