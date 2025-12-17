// app/api/client/activate/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Même base que pour les autres proxys (tokens…)
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const workerUrl = `${API_BASE}/client/activate-token`;
    console.log("[proxy] POST ->", workerUrl, payload);

    const res = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text();
    console.log("[proxy] Réponse brute Worker", res.status, text.slice(0, 200));

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // Le Worker n'a pas répondu en JSON → on remonte une erreur claire
      return NextResponse.json(
        {
          ok: false,
          error: `Réponse non JSON du Worker (${res.status})`,
          raw: text.slice(0, 200),
        },
        { status: 502 },
      );
    }

    // On renvoie tel quel ce que renvoie le Worker
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("Erreur proxy /api/client/activate:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne proxy client/activate",
      },
      { status: 500 },
    );
  }
}
