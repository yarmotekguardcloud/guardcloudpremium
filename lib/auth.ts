// lib/auth.ts – GuardCloud Premium Frontend API Wrapper

// 🔌 Pour le moment on FORCE l'API locale.
// Quand le deploy Cloudflare marchera, on changera cette constante.
const API_BASE = "http://127.0.0.1:8787";

/* eslint-disable @typescript-eslint/no-explicit-any */


console.log("🔌 GuardCloud API_BASE =", API_BASE);

/**
 * 🔐 Authentification Admin
 * Appelle le Worker GuardCloud : POST /admin/login
 */
export async function adminLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // si le JSON est cassé, on l'indique
    throw new Error(`invalid_json_response`);
  }

  if (!response.ok || !data?.ok) {
    const err =
      data?.error ||
      `http_${response.status}` ||
      "login_failed";
    throw new Error(err);
  }

  return data as {
    ok: true;
    token: string;
    user: { email: string; role: string };
  };
}

/** 🔑 Gestion simple du token admin */
const ADMIN_TOKEN_KEY = "gc_admin_token";

export function saveAdminToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
