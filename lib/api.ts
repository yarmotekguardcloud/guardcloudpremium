// lib/api.ts

export interface GuardCloudDevice {
  deviceId: string;
  hardwareId?: string;
  type?: string;
  category?: string; // "PHONE" | "PC" | ...
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

const DEFAULT_API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8787"
    : "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE || DEFAULT_API_BASE;

console.log("🔌 GuardCloud API_BASE =", API_BASE);

// -------- DEVICES --------

export async function fetchAdminDevices(): Promise<GuardCloudDevice[]> {
  const res = await fetch(`${API_BASE}/map/devices`, { cache: "no-store" });
  if (!res.ok) throw new Error("map_devices_failed");
  const data = await res.json();
  return (data.devices || []) as GuardCloudDevice[];
}

export async function fetchClientDevices(
  clientId: string
): Promise<GuardCloudDevice[]> {
  const url = `${API_BASE}/client/devices?clientId=${encodeURIComponent(
    clientId
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("client_devices_failed");
  const data = await res.json();
  return (data.devices || []) as GuardCloudDevice[];
}

export async function fetchResellerDevices(
  resellerId: string
): Promise<GuardCloudDevice[]> {
  const all = await fetchAdminDevices();
  return all.filter(
    (d) =>
      (d.resellerId || "").toLowerCase() === resellerId.toLowerCase() ||
      (d.resellerName || "").toLowerCase() === resellerId.toLowerCase()
  );
}

// -------- ADMIN RESELLERS --------

export async function fetchAdminResellers(
  adminToken: string
): Promise<Reseller[]> {
  const res = await fetch(`${API_BASE}/admin/resellers/list`, {
    method: "GET",
    headers: {
      "x-api-key": adminToken,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("resellers_list_failed");
  }

  const data = await res.json();
  return (data.items || []) as Reseller[];
}
