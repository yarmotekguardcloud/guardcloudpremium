import { NextResponse } from "next/server";
import { makeSessionCookie } from "../../_session";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = (body?.login ?? "").toString().trim();
  const password = (body?.password ?? "").toString();

  const ok =
    login === (process.env.GC_ADMIN_LOGIN || "YGC-ADMIN") &&
    password === (process.env.GC_ADMIN_PASSWORD || "");

  if (!ok) return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });

  const c = await makeSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  return res;
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
