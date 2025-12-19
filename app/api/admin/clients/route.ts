import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL("/admin/clients", process.env.GC_WORKER_BASE);
  url.search = new URL(req.url).search;
  const res = await fetch(url.toString(), {
    headers: { "x-admin-key": process.env.GC_ADMIN_KEY || "" },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
export const POST = GET; export const PUT = GET; export const DELETE = GET;