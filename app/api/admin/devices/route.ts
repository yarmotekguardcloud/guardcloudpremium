import { cookies } from "next/headers";
import { cookieName, verifySessionCookie } from "../../_session";
import { proxyToWorker } from "../../_gc";

export const runtime = "edge";

export async function GET(req: Request) {
  const ok = await verifySessionCookie(cookies().get(cookieName())?.value);
  if (!ok) return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 });

  const adminKey = process.env.GC_ADMIN_KEY || "";
  if (!adminKey) return new Response(JSON.stringify({ ok: false, error: "GC_ADMIN_KEY_MISSING" }), { status: 500 });

  return proxyToWorker(req, "/admin/devices", { "x-admin-key": adminKey });
}

export async function HEAD(req: Request) {
  return GET(req);
}
