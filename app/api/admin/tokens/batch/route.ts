import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = await fetch(`${process.env.GC_WORKER_BASE}/admin/tokens/batch`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-admin-key": process.env.GC_ADMIN_KEY || "" 
    },
    body: await req.text(),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}