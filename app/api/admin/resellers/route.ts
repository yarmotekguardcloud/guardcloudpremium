import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

const ADMIN_KEY = process.env.GUARDCLOUD_ADMIN_KEY ?? "YGC-ADMIN";

export async function GET() {
  try {
    const url = `${API_BASE}/admin/resellers`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-admin-key": ADMIN_KEY,
      },
      cache: "no-store",
    });

    const raw = await res.text();

    if (!res.ok) {
      console.error("GuardCloud /admin/resellers HTTP error:", res.status, raw);
      return NextResponse.json(
        { ok: false, error: `HTTP ${res.status}` },
        { status: 500 },
      );
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("JSON invalide pour /admin/resellers", e, raw);
      return NextResponse.json(
        { ok: false, error: "Réponse JSON invalide du Worker" },
        { status: 500 },
      );
    }

    const items =
      data.items ??
      data.resellers ??
      data.data ??
      [];

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    console.error("Erreur /api/admin/resellers:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Erreur interne" },
      { status: 500 },
    );
  }
}
