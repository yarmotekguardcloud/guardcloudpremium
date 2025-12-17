export const runtime = "edge";

function b64url(bytes: ArrayBuffer) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSHA256(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

export async function POST(req: Request) {
  const { login, password } = await req.json().catch(() => ({}));

  const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "YGC-ADMIN";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // à définir dans Cloudflare Pages (env var)

  if (!ADMIN_PASSWORD) return Response.json({ ok: false, error: "ADMIN_PASSWORD not set" }, { status: 500 });
  if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) {
    return Response.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET ?? ADMIN_PASSWORD;
  const exp = Date.now() + 12 * 60 * 60 * 1000; // 12h
  const payload = JSON.stringify({ exp });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = await hmacSHA256(secret, payloadB64);
  const cookieVal = `${payloadB64}.${sig}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `gc_admin=${cookieVal}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${12 * 60 * 60}`,
    },
  });
}
