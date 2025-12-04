// lib/guardcloudApi.ts
// API client pour Yarmotek GuardCloud Premium
// ----------------------------------------------------

const API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

// ----------------------------------------------------
// Types
// ----------------------------------------------------

export interface GuardCloudDevice {
  deviceId: string;

  clientId?: string | null;
  clientName?: string | null;

  deviceType?: string | null;
  category?: string | null;

  lat?: number | null;
  lng?: number | null;
  battery?: number | null;

  wifiSsid?: string | null;
  ip?: string | null;
  networkType?: string | null;

  lastHeartbeatAt?: string | null;
}

// ----------------------------------------------------
// 📡 Récupération des devices pour la carte
// ----------------------------------------------------

export async function fetchDevices(params?: {
  type?: string;
  clientId?: string;
}): Promise<GuardCloudDevice[]> {
  try {
    const url = new URL(`${API_BASE}/map/devices`);

    if (params?.type) url.searchParams.set("type", params.type);
    if (params?.clientId) url.searchParams.set("clientId", params.clientId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store", // force données réelles
    });

    if (!res.ok) {
      console.error("Erreur /map/devices:", res.status);
      return [];
    }

    const json = await res.json();

    if (!json.ok || !Array.isArray(json.devices)) {
      console.error("Réponse étrange de /map/devices:", json);
      return [];
    }

    return json.devices as GuardCloudDevice[];
  } catch (e) {
    console.error("Erreur réseau fetchDevices:", e);
    return [];
  }
}

// ----------------------------------------------------
// 🔔 Commande de sonnerie (anti-vol)
// ----------------------------------------------------

export async function ringDevice(deviceId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/admin/ring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "YGC-ADMIN",
        deviceId,
        message: "ALERTE ANTI-VOL YARMOTEK",
        durationSec: 20,
        level: "HIGH",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      console.error("Erreur RING:", data);
      alert("Erreur lors de la commande de sonnerie.");
      return;
    }

    alert(
      "Commande de sonnerie envoyée 🔔\n" +
        "➡ Le téléphone sonnera au prochain heartbeat."
    );
  } catch (e) {
    alert("Erreur réseau lors de la commande de sonnerie.");
    console.error("Erreur réseau ringDevice:", e);
  }
}
