export const runtime = 'edge';

// app/api/reseller/tokens/route.ts
import { NextRequest, NextResponse } from "next/server";

const GUARDCLOUD_API_BASE =
  process.env.GUARDCLOUD_API_BASE ||
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ||
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const resellerId = url.searchParams.get("resellerId");

    if (!resellerId) {
      return NextResponse.json(
        { ok: false, error: "resellerId requis" },
        { status: 400 },
      );
    }

    const apiUrl = `${GUARDCLOUD_API_BASE}/reseller/tokens?resellerId=${encodeURIComponent(
      resellerId,
    )}`;

    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[API] /api/reseller/tokens error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne /reseller/tokens",
      },
      { status: 500 },
    );
  }
}
