import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DEFAULT_API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

const API_BASE =
  process.env.GUARDCLOUD_API_BASE ??
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  DEFAULT_API_BASE;

function noStoreHeaders() {
  return {
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    pragma: "no-cache",
    expires: "0",
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: noStoreHeaders() });
}

function pickServerOnlyHeaders() {
  const h: Record<string, string> = {};
  const adminKey = process.env.GUARDCLOUD_ADMIN_KEY;
  if (adminKey) h["x-admin-key"] = adminKey;
  h["accept"] = "application/json";
  return h;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const deviceId = (searchParams.get("deviceId") ?? "").trim();
    if (!deviceId) return jsonError("Paramètre 'deviceId' requis.", 400);

    const sinceParam = (searchParams.get("since") ?? "").trim();
    const since = sinceParam || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const limitParam = (searchParams.get("limit") ?? "").trim();
    let limit: number | null = null;
    if (limitParam) {
      const n = parseInt(limitParam, 10);
      if (Number.isFinite(n) && n > 0) limit = Math.min(n, 5000);
    }

    // ✅ On utilise la route admin sécurisée
    const url = new URL("/admin/device/history", API_BASE);
    url.searchParams.set("deviceId", deviceId);
    url.searchParams.set("since", since);
    if (limit != null) url.searchParams.set("limit", String(limit));

    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: pickServerOnlyHeaders(),
      cache: "no-store",
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      return jsonError("Réponse backend invalide (JSON).", 502);
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? `Backend history HTTP ${upstream.status}`, upstreamStatus: upstream.status },
        { status: upstream.status, headers: noStoreHeaders() },
      );
    }

    if (data?.ok === false) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Backend history ok=false" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { ok: true, items: data?.items ?? [], meta: data?.meta ?? null },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (e: any) {
    return jsonError(e?.message ?? "Erreur interne route /api/admin/device-history", 500);
  }
}
