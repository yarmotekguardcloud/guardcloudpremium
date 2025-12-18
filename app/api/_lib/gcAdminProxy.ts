import { NextRequest, NextResponse } from "next/server";

function getEnv(name: string): string | undefined {
  // Next on Pages/Edge: process.env peut être vide en build, donc on tolère
  // et on sappuie surtout sur variables Cloudflare injectées à runtime.
  // Sur Pages Functions, process.env est souvent dispo à runtime aussi.
  return (process.env as any)?.[name];
}

function joinUrl(base: string, path: string, req: NextRequest) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const u = new URL(req.url);
  return `${b}${p}${u.search || ""}`;
}

function pickForwardHeaders(req: NextRequest, extra?: Record<string, string>) {
  const h = new Headers();
  const ct = req.headers.get("content-type");
  const auth = req.headers.get("authorization");
  if (ct) h.set("content-type", ct);
  if (auth) h.set("authorization", auth);

  // Admin key
  const adminKey = getEnv("GC_ADMIN_KEY");
  if (adminKey) h.set("x-admin-key", adminKey);

  // Optionnel: token admin si tu en utilises un côté worker
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken) h.set("x-admin-token", adminToken);

  if (extra) {
    for (const [k, v] of Object.entries(extra)) h.set(k, v);
  }
  return h;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: true, data: JSON.parse(text), raw: text };
  } catch {
    return { ok: false, data: null as any, raw: text };
  }
}

export async function proxyToWorker(req: NextRequest, workerPath: string) {
  const base = getEnv("GC_WORKER_BASE") || "https://yarmotek-guardcloud-api.myarbanga.workers.dev";
  const url = joinUrl(base, workerPath, req);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer().catch(() => undefined) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers: pickForwardHeaders(req),
      body: body as any,
      cache: "no-store",
    });
  } catch (e) {
    console.error("proxyToWorker fetch failed", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_FETCH_FAILED" }, { status: 502 });
  }

  const parsed = await safeJson(upstream);

  // Si upstream répond JSON, on renvoie JSON ; sinon on renvoie le raw en wrap
  if (parsed.ok) {
    return NextResponse.json(parsed.data, { status: upstream.status });
  }
  return NextResponse.json(
    {
      ok: false,
      error: upstream.ok ? "UPSTREAM_NON_JSON" : `HTTP ${upstream.status}`,
      raw: parsed.raw?.slice(0, 2000),
    },
    { status: upstream.ok ? 502 : upstream.status }
  );
}

// Preflight CORS (si besoin)
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
