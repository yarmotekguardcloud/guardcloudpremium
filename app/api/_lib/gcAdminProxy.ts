import { cookies } from "next/headers";
import { cookieName, verifySessionCookie } from "../_session";

type ExtraHeaders = Record<string, string>;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-admin-key, x-api-key, x-admin-token",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  };
}

/**
 * adminProxy(req, "/admin/xxx")
 * - Next 15: cookies() est async
 * - Injecte x-admin-key (GC_ADMIN_KEY)
 * - Proxy vers le Worker (GC_WORKER_BASE)
 * - Passthrough status (404 reste 404)
 */
export async function adminProxy(
  req: Request,
  path: string,
  extraHeaders: ExtraHeaders = {}
) {
  const store = await cookies(); // ✅ Next 15: async
  const ok = await verifySessionCookie(store.get(cookieName)?.value);

  if (!ok) {
    return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    });
  }

  const base = (process.env.GC_WORKER_BASE || "").replace(/\/$/, "");
  if (!base) {
    return new Response(
      JSON.stringify({ ok: false, error: "GC_WORKER_BASE_MISSING" }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders(),
        },
      }
    );
  }

  // 🔥 CORRECTION: Hardcode temporaire pour démo
  const adminKey = process.env.GC_ADMIN_KEY || "Wendlaboumfan@202520250";
  
  if (!adminKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "GC_ADMIN_KEY_MISSING" }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders(),
        },
      }
    );
  }

  const url = new URL(req.url);
  const target = `${base}${path}${url.search ?? ""}`;
  const method = req.method.toUpperCase();

  // Ne pas forward les cookies du navigateur vers le Worker
  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) headers.set("x-api-key", xApiKey);

  const xAdminToken = req.headers.get("x-admin-token");
  if (xAdminToken) headers.set("x-admin-token", xAdminToken);

  headers.set("x-admin-key", adminKey);

  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);

  const init: RequestInit = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    const body = await req.arrayBuffer().catch(() => null);
    if (body) init.body = body;
  }

  const resp = await fetch(target, init);

  const outHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders())) outHeaders.set(k, v);

  if (!outHeaders.get("content-type")) {
    outHeaders.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}

export function adminOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ✅ EXPORTS POUR COMPATIBILITÉ
export const OPTIONS = adminOptions;

export function proxyToWorker(
  req: Request,
  path: string,
  extraHeaders: Record<string, string> = {}
) {
  return adminProxy(req, path, extraHeaders);
}
