import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // Proxy vers le backend Worker (source de vérité)
    const res = await fetch(`${API_BASE}/client/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Edge-friendly
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_BACKEND_JSON",
          status: res.status,
          raw: text?.slice?.(0, 2000) ?? "",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data ?? { ok: true }, { status: res.status });
  } catch (e) {
    console.error("ACTIVATE_FAILED", e);
    return NextResponse.json(
      { ok: false, error: "ACTIVATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "USE_POST" }, { status: 405 });
}
