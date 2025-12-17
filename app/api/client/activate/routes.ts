import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Redirige /api/client/activate?... vers /client/activate?... (mêmes query params)
  const target = new URL("/client/activate", url);
  target.search = url.search;

  return NextResponse.redirect(target, 302);
}
