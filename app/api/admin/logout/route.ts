import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieName } from "../../_session";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies(); 
  store.delete(cookieName);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-api-key, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}