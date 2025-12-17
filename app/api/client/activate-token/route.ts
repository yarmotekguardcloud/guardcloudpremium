// app/api/client/activate-token/route.ts
import { NextRequest, NextResponse } from "next/server";

const GUARDCLOUD_API_BASE =
  process.env.GUARDCLOUD_API_BASE ||
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ||
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiUrl = `${GUARDCLOUD_API_BASE}/client/activate-token`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[API] /api/client/activate-token error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne /client/activate-token",
      },
      { status: 500 },
    );
  }
}
