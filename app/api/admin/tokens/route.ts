import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const TARGET_PATH = "/admin/tokens";
const DEFAULT_API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

function getHeaders() {
  const adminKey = process.env.GUARDCLOUD_ADMIN_KEY;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(adminKey ? { "x-admin-key": adminKey } : {}),
  };
}

async function handleRequest(req: NextRequest) {
  const API_BASE = process.env.GUARDCLOUD_API_BASE || DEFAULT_API_BASE;
  const url = new URL(TARGET_PATH, API_BASE);
  const { searchParams } = new URL(req.url);
  url.search = searchParams.toString();

  try {
    const method = req.method;
    const body = (method !== "GET" && method !== "HEAD") ? await req.text() : undefined;
    const res = await fetch(url.toString(), {
      method,
      headers: getHeaders(),
      body,
      cache: "no-store",
    });
    const data = await res.text();
    let json;
    try { json = JSON.parse(data); } catch { json = { data }; }
    return NextResponse.json(json, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => handleRequest(req);
export const POST = (req: NextRequest) => handleRequest(req);
export const PUT = (req: NextRequest) => handleRequest(req);
export const PATCH = (req: NextRequest) => handleRequest(req);
export const DELETE = (req: NextRequest) => handleRequest(req);
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    },
  });
}