import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

const ADMIN_KEY = process.env.GUARDCLOUD_ADMIN_API_KEY;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!ADMIN_KEY) {
      console.error(
        "[/api/admin/tokens/by-reseller] GUARDCLOUD_ADMIN_API_KEY manquant dans .env.local",
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

    const { searchParams } = new URL(req.url);
    const resellerId = searchParams.get("resellerId") ?? "";

    if (!resellerId) {
      return NextResponse.json(
        { ok: false, error: "Paramètre resellerId manquant" },
        { status: 400 },
      );
    }

    const workerUrl = `${API_BASE}/admin/tokens/by-reseller?resellerId=${encodeURIComponent(
      resellerId,
    )}`;

    const res = await fetch(workerUrl, {
      method: "GET",
      headers: {
        "x-admin-key": ADMIN_KEY, // 🔐 clé admin envoyée aussi pour la lecture
      },
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

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("Erreur proxy /api/admin/tokens/by-reseller:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Erreur interne proxy by-reseller",
      },
      { status: 500 },
    );
  }
}
