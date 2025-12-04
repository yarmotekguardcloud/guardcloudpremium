"use client";

import { useEffect, useState } from "react";
import DevicesMap from "./DevicesMap";

export type Device = {
  deviceId: string;
  name: string;
  clientName?: string;
  category: string;
  lat: number | null;
  lng: number | null;
  battery: number | null;
  charging: boolean | null;
  lastHeartbeat?: string;
};

type DevicesViewProps = {
  clientId?: string;
  resellerId?: string;
};

const API_BASE =
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export default function DevicesView(props: DevicesViewProps) {
  const { clientId, resellerId } = props;

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDevices() {
    try {
      setLoading(true);
      setError(null);

      // 🔥 Pour l’instant, on récupère tout et on filtre côté front si besoin
      const res = await fetch(`${API_BASE}/device/list?token=YGC-ADMIN`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const raw = Array.isArray(json.devices)
        ? json.devices
        : Array.isArray(json.items)
        ? json.items
        : [];

      const cleaned: Device[] = raw.map((d: any) => ({
        deviceId: d.deviceId || d.id || "UNKNOWN",
        name:
          d.name ||
          d.deviceId ||
          d.id ||
          `Device-${String(d.deviceId || d.id || "").slice(-4)}`,
        clientName: d.clientName || d.client || d.owner || undefined,
        category: d.category || d.type || "OTHER",
        lat:
          typeof d.lat === "number"
            ? d.lat
            : typeof d.latitude === "number"
            ? d.latitude
            : null,
        lng:
          typeof d.lng === "number"
            ? d.lng
            : typeof d.longitude === "number"
            ? d.longitude
            : null,
        battery:
          typeof d.battery === "number" ? d.battery : d.batteryLevel ?? null,
        charging:
          typeof d.charging === "boolean"
            ? d.charging
            : d.power === "AC"
            ? true
            : d.power === "BATTERY"
            ? false
            : null,
        lastHeartbeat: d.lastHeartbeat || d.lastSeen || d.updatedAt || undefined,
      }));

      // 🔎 Filtrage logique si on utilise clientId / resellerId
      let filtered = cleaned;
      if (clientId) {
        filtered = filtered.filter(
          (dev) =>
            String(dev.clientName || "")
              .toLowerCase()
              .includes(clientId.toLowerCase()) ||
            String(dev.deviceId || "").includes(clientId)
        );
      }
      if (resellerId) {
        filtered = filtered; // placeholder si plus tard tu ajoutes un champ resellerId
      }

      setDevices(filtered);
    } catch (e: any) {
      console.error("Erreur de chargement devices:", e);
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, 20000);
    return () => clearInterval(id);
  }, [clientId, resellerId]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Bandeau d'infos */}
      <div className="px-4 py-2 bg-black text-white text-xs flex items-center justify-between">
        <div>
          <span className="font-semibold">
            🌍 Yarmotek GuardCloud – Vue devices
          </span>
          <span className="ml-2 text-gray-300">
            ({devices.length} appareil(s) chargés)
          </span>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-[11px] text-blue-300">
              Chargement…
            </span>
          )}
          {error && (
            <span className="text-[11px] text-red-300">
              Erreur API : {error}
            </span>
          )}
          <button
            type="button"
            onClick={loadDevices}
            className="border border-emerald-400 px-2 py-1 rounded text-[11px] hover:bg-emerald-500/20"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Carte pleine page */}
      <div className="flex-1">
        <DevicesMap devices={devices} />
      </div>
    </div>
  );
}
