import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

async function forward(req: NextRequest, path: string) {
  const base = (process.env.GC_WORKER_BASE || process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE || "").replace(/\/+$/, "");
  const adminKey = process.env.GC_ADMIN_KEY || process.env.ADMIN_API_KEY;

  if (!base) return NextResponse.json({ ok: false, error: "CONFIG_MISSING_GC_WORKER_BASE" }, { status: 500 });
  if (!adminKey) return NextResponse.json({ ok: false, error: "CONFIG_MISSING_GC_ADMIN_KEY" }, { status: 500 });

  const url = new URL(req.url);
  const target = `${base}${path}${url.search || ""}`;

  const headers = new Headers();
  headers.set("x-admin-key", adminKey);

  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "POST" ? await req.text() : undefined,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => ({ ok: false, error: "INVALID_JSON_FROM_WORKER" }));
    return NextResponse.json(data, { status: res.status });
  }
  const text = await res.text().catch(() => "");
  return NextResponse.json({ ok: res.ok, status: res.status, body: text || null }, { status: res.status });
}

export async function GET(req: NextRequest) {
  return forward(req, "/admin/tokens");
}

export async function POST(req: NextRequest) {
  return forward(req, "/admin/tokens");
}
