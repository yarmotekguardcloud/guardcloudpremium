// lib/auth.ts
import { adminLogin as loginFn } from "./api";

const ADMIN_TOKEN_KEY = "gc_admin_token";

export async function adminLogin(login: string, password: string) {
  return await loginFn(login, password);
}

export function saveAdminToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem("YGC_JWT", token);
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem("YGC_JWT");
  localStorage.removeItem("YGC_ROLE");
}
