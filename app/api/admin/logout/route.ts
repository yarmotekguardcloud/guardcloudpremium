import { NextResponse } from "next/server";
import { cookieName } from "../../_session";

export const runtime = "edge";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), "", { path: "/", maxAge: 0 });
  return res;
}
