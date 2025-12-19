import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieName } from "../../_session";

// Impératif pour Cloudflare Pages
export const runtime = "edge";

export async function POST() {
  // Avec Next.js 15, cookies() est asynchrone
  const store = await cookies(); 
  store.delete(cookieName);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}

/**
 * Cette fonction gère les requêtes de pré-vérification (CORS).
 * Note : Ne pas ajouter d'export "proxyToWorker" ou "OPTIONS" en bas du fichier 
 * si cela crée un conflit avec cette déclaration.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-admin-key, x-api-key, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}