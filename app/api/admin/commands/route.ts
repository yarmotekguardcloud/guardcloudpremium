import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DEFAULT_API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

function noStoreHeaders() {
  return {
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    pragma: "no-cache",
    expires: "0",
  };
}

export async function POST(req: NextRequest) {
  const API_BASE =
    process.env.GUARDCLOUD_API_BASE ||
    process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ||
    DEFAULT_API_BASE;

  const adminKey = process.env.GUARDCLOUD_ADMIN_KEY; // ✅ serveur only

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const url = new URL("/api/admin/commands", API_BASE);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-key": adminKey } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Backend JSON invalide", raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "GuardCloud commands error", upstreamStatus: res.status, upstream: data },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(data, { status: 200, headers: noStoreHeaders() });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "GuardCloud commands proxy error" },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
