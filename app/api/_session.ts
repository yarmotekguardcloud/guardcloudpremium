const encoder = new TextEncoder();

export const cookieName = "gc_admin_session";

// -------- base64url helpers (Edge + Node build safe) --------
function b64urlEncodeBytes(bytes: Uint8Array): string {
  // Node build
  // @ts-ignore
  if (typeof Buffer !== "undefined") {
    // @ts-ignore
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  // Edge runtime
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncodeJson(obj: any): string {
  const json = JSON.stringify(obj);
  const bytes = encoder.encode(json);
  return b64urlEncodeBytes(bytes);
}

function b64urlDecodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  // @ts-ignore
  if (typeof Buffer !== "undefined") {
    // @ts-ignore
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function safeJsonParse<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64urlEncodeBytes(new Uint8Array(sig));
}

function getSecret(): string | null {
  const s = (process.env as any)?.GC_SESSION_SECRET;
  return typeof s === "string" && s.length >= 16 ? s : null;
}

// -------- Public API expected by existing routes --------

// value = "<payloadB64url>.<sigB64url>"
export async function verifySessionCookie(value?: string | null): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !value) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;

  const expected = await hmacSign(secret, payloadB64);
  if (!timingSafeEqual(expected, sigB64)) return false;

  const payloadBytes = b64urlDecodeToBytes(payloadB64);
  const payloadStr = new TextDecoder().decode(payloadBytes);
  const payload = safeJsonParse<{ exp?: number }>(payloadStr);
  if (!payload?.exp || typeof payload.exp !== "number") return false;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return false;

  return true;
}

// retourne la *valeur* du cookie (pas lobjet cookie)
export async function makeSessionCookie(login: string = "YGC-ADMIN", ttlSeconds: number = 60 * 60 * 12): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    // En dernier recours on renvoie un token non signé (mais ça sera refusé par verify)
    // => ça force à configurer GC_SESSION_SECRET
    return "missing_secret";
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, login, iat: now, exp: now + ttlSeconds };

  const payloadB64 = b64urlEncodeJson(payload);
  const sigB64 = await hmacSign(secret, payloadB64);

  return `${payloadB64}.${sigB64}`;
}
