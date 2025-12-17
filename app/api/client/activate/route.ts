import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  // ✅ IMPORTANT: getRequestContext() UNIQUEMENT ici (jamais top-level)
  const { env } = getRequestContext();

  // ⚠️ Exemple: on lit le JSON dans le handler
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  // TODO: ta logique d’activation ici (KV, etc.) en utilisant `env`
  // ex: await env.CLIENTS_KV.put(...)

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
