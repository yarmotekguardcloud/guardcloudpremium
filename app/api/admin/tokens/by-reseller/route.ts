import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = new URL("/admin/tokens/by-reseller", process.env.GC_WORKER_BASE);
  url.search = searchParams.toString();
  
  const res = await fetch(url.toString(), {
    headers: { "x-admin-key": process.env.GC_ADMIN_KEY || "" },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}