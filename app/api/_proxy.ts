// app/api/_proxy.ts
export const runtime = "edge";

const WORKER_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

function forwardAuthHeaders(req: Request) {
  const h = new Headers();
  // On forward tout ce qui peut servir à l’admin côté Worker
  const keys = [
    "authorization",
    "x-admin-key",
    "x-api-key",
    "x-admin-token",
  ];
  for (const k of keys) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  return h;
}

export async function proxyToWorker(req: Request, workerPath: string) {
  const url = `${WORKER_BASE}${workerPath}`;

  const init: RequestInit = {
    method: req.method,
    headers: forwardAuthHeaders(req),
    cache: "no-store",
  };

  // Body uniquement si pas GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
    // content-type si présent
    const ct = req.headers.get("content-type");
    if (ct) (init.headers as Headers).set("content-type", ct);
  }

  const res = await fetch(url, init);

  // ⚠️ IMPORTANT: on renvoie EXACTEMENT le status upstream
  const outHeaders = new Headers();
  const upstreamCT = res.headers.get("content-type");
  if (upstreamCT) outHeaders.set("content-type", upstreamCT);

  return new Response(await res.text(), {
    status: res.status,
    headers: outHeaders,
  });
}
