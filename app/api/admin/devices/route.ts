export const runtime = "edge";

function parseCookie(req: Request, name: string) {
  const h = req.headers.get("cookie") || "";
  const m = h.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function verifySession(req: Request) {
  const v = parseCookie(req, "gc_admin");
  if (!v) return false;

  const [payloadB64, sig] = v.split(".");
  if (!payloadB64 || !sig) return false;

  const secret = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "fallback";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const goodSigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const goodSig = Buffer.from(goodSigBuf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  if (goodSig !== sig) return false;

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  return typeof payload?.exp === "number" && Date.now() < payload.exp;
}

function normalizeDevice(d: any) {
  const lat = typeof d.lat === "number" ? d.lat : (d.lastLocation?.lat ?? null);
  const lng = typeof d.lng === "number" ? d.lng : (d.lastLocation?.lng ?? null);
  const accuracy_m = d.accuracy_m ?? d.accuracy ?? d.lastLocation?.accuracy_m ?? null;

  const lastHeartbeat =
    d.lastHeartbeat ?? d.lastHeartbeatAt ?? d.lastUpdatedAt ?? d.lastSeenAt ?? d.lastSeen ?? null;

  return {
    id: d.id ?? d.deviceId,
    deviceId: d.deviceId ?? d.id,
    name: d.name ?? d.clientName ?? d.deviceId ?? d.id,
    category: d.category ?? d.deviceType ?? "PHONE",
    deviceType: d.deviceType ?? d.type ?? d.category ?? "PHONE",
    lat,
    lng,
    accuracy_m,
    lastHeartbeat,
    online: d.online ?? null,
    status: d.status ?? null,
    clientId: d.clientId ?? null,
    clientName: d.clientName ?? null,
    lastLocation: d.lastLocation ?? (lat && lng ? { lat, lng, accuracy_m } : null),
  };
}

export async function GET(req: Request) {
  const ok = await verifySession(req);
  if (!ok) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const WORKER_BASE = process.env.GUARDCLOUD_WORKER_BASE;
  const ADMIN_KEY = process.env.ADMIN_API_KEY; // secret côté Pages

  if (!WORKER_BASE || !ADMIN_KEY) {
    return Response.json({ ok: false, error: "Missing GUARDCLOUD_WORKER_BASE or ADMIN_API_KEY" }, { status: 500 });
  }

  const r = await fetch(`${WORKER_BASE.replace(/\/$/, "")}/admin/devices`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) return Response.json({ ok: false, error: "Upstream error", upstream: data }, { status: r.status });

  const items = Array.isArray(data?.items) ? data.items : [];
  return Response.json({ ok: true, items: items.map(normalizeDevice) });
}
