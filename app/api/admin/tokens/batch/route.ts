import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

const ADMIN_KEY = process.env.GUARDCLOUD_ADMIN_API_KEY;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_KEY) {
      console.error(
        "[/api/admin/tokens/batch] GUARDCLOUD_ADMIN_API_KEY manquant dans .env.local",
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            "Clé admin non configurée côté serveur (GUARDCLOUD_ADMIN_API_KEY).",
        },
        { status: 500 },
      );
    }

    const payload = await req.json();

    const workerUrl = `${API_BASE}/admin/tokens/batch`;

    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_KEY, // 🔐 clé admin envoyée au Worker
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Réponse non JSON du Worker (${res.status})`,
          raw: text.slice(0, 200),
        },
        { status: 502 },
      );
    }

    // on renvoie la réponse du Worker telle quelle (statut compris)
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("Erreur proxy /api/admin/tokens/batch:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne proxy batch",
      },
      { status: 500 },
    );
  }
}
