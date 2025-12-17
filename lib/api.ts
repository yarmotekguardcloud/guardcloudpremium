// lib/api.ts
export interface GuardCloudDevice {
  deviceId: string;
  hardwareId?: string;
  type?: string;
  category?: string;
  name?: string;
  clientId?: string;
  clientName?: string;
  resellerId?: string | null;
  resellerName?: string | null;
  lat?: number | null;
  lng?: number | null;
  battery?: number | null;
  charging?: boolean | null;
  lastHeartbeat?: string | null;
}

export interface Reseller {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  tokens?: number;
  revenueXof?: number;
  bonusXof?: number;
  createdAt?: string;
}

// ✅ IMPORTANT: on utilise les routes Next-on-Pages (Edge) en relatif
export const APP_API_BASE = "/api";

// -------- ADMIN LOGIN (via Next) --------
export type LoginResponse = {
  ok: boolean;
  token?: string;
  role?: string;
  error?: string;
};

export async function adminLogin(login: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${APP_API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });

  const data = (await res.json().catch(() => null)) as LoginResponse | null;

  if (!res.ok || !data?.ok || !data.token) {
    throw new Error(data?.error || `http_${res.status}`);
  }

  return data;
}

// -------- DEVICES (via Next proxy) --------
export async function fetchAdminDevices(): Promise<GuardCloudDevice[]> {
  const res = await fetch(`${APP_API_BASE}/devices`, { cache: "no-store" });
  if (!res.ok) throw new Error("map_devices_failed");
  const data = await res.json();
  return (data.devices || []) as GuardCloudDevice[];
}

export async function fetchClientDevices(clientId: string): Promise<GuardCloudDevice[]> {
  const res = await fetch(`${APP_API_BASE}/devices?clientId=${encodeURIComponent(clientId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("client_devices_failed");
  const data = await res.json();
  return (data.devices || []) as GuardCloudDevice[];
}

export async function fetchResellerDevices(resellerId: string): Promise<GuardCloudDevice[]> {
  const all = await fetchAdminDevices();
  return all.filter(
    (d) =>
      (d.resellerId || "").toLowerCase() === resellerId.toLowerCase() ||
      (d.resellerName || "").toLowerCase() === resellerId.toLowerCase()
  );
}

// -------- ADMIN RESELLERS (via Next proxy) --------
export async function fetchAdminResellers(adminJwt: string): Promise<Reseller[]> {
  const res = await fetch(`${APP_API_BASE}/admin/resellers`, {
    method: "GET",
    headers: {
      // ✅ on envoie le JWT (pas x-api-key)
      Authorization: `Bearer ${adminJwt}`,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`resellers_failed_${res.status}`);
  const data = await res.json();
  return (data.items || []) as Reseller[];
}
