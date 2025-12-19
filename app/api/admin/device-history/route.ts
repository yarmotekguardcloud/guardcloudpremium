import { NextRequest, NextResponse } from "next/server";

// Ces deux lignes sont CRITIQUES pour Cloudflare Pages
export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export async function GET(req: NextRequest) {
  const API_BASE = process.env.GUARDCLOUD_API_BASE || DEFAULT_API_BASE;
  const adminKey = process.env.GUARDCLOUD_ADMIN_KEY;
  
  const url = new URL("/admin/device-history", API_BASE);
  const { searchParams } = new URL(req.url);
  url.search = searchParams.toString();

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-key": adminKey } : {}),
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Ajoutez POST si nécessaire, sinon laissez juste GET
export async function POST(req: NextRequest) {
  const API_BASE = process.env.GUARDCLOUD_API_BASE || DEFAULT_API_BASE;
  const adminKey = process.env.GUARDCLOUD_ADMIN_KEY;
  const body = await req.text();

  try {
    const res = await fetch(`${API_BASE}/admin/device-history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-key": adminKey } : {}),
      },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}