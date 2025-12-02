"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// 🔒 Pour la vue Client on force l’API sur le Worker en ligne
const API_BASE = "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

// Même clé que ton login client
const CLIENT_ID_KEY = "gc_client_id";

// On réutilise la même carte que l’admin
const DevicesMap = dynamic(() => import("../../admin/devices/DevicesMap"), {
  ssr: false,
});

type Device = {
  deviceId: string;
  hardwareId?: string;
  type: string;
  category: string;
  name: string;
  clientId?: string;
  clientName?: string;
  lat: number;
  lng: number;
  battery: number | null;
  charging: boolean | null;
  lastHeartbeat?: string;
};

type FilterCategory = "ALL" | "PHONE" | "PC";

function normalizeDevices(src: any[]): Device[] {
  return (src || []).map((d: any) => ({
    deviceId: d.deviceId,
    hardwareId: d.hardwareId,
    type: d.type,
    category: d.category,
    name: d.name || d.deviceId,
    clientId: d.clientId,
    clientName: d.clientName,
    lat: Number(d.lat ?? 0),
    lng: Number(d.lng ?? 0),
    battery: typeof d.battery === "number" ? d.battery : null,
    charging: typeof d.charging === "boolean" ? d.charging : null,
    lastHeartbeat: d.lastHeartbeat,
  }));
}

export default function ClientDevicesPage() {
  const router = useRouter();

  const [clientId, setClientId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] =
    useState<FilterCategory>("ALL");
  const [onlyActive, setOnlyActive] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // 1) récupérer l’ID client stocké au login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      router.replace("/client/login");
    } else {
      setClientId(id);
    }
  }, [router]);

  // 2) charger les devices via /map/devices puis filtrer par clientId
  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    const currentId = clientId.toLowerCase(); // ✅ sécurisé

    async function fetchDevices() {
      try {
        setError(null);
        setLoading(true);

        console.log("🔌 ClientDevices API_BASE =", API_BASE);

        const url = `${API_BASE}/map/devices`;
        const res = await fetch(url);

        if (!res.ok) {
          const txt = await res.text();
          console.error("❌ /map/devices error:", res.status, txt);
          throw new Error(`http_${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const all = normalizeDevices(data.devices || data.items || []);

        const items = all.filter((d) => {
          const cid = (d.clientId || "").toLowerCase();
          const cname = (d.clientName || "").toLowerCase();
          return (
            cid === currentId ||
            cname === currentId ||
            cid.endsWith(currentId) ||
            currentId.endsWith(cid) ||
            cname.includes(currentId)
          );
        });

        console.log(
          `✅ /map/devices – ${items.length} appareil(s) pour`,
          currentId
        );

        if (!cancelled) {
          setDevices(items);
          setLastRefresh(new Date());
          setLoading(false);
        }
      } catch (e: any) {
        console.error("❌ fetch client devices error:", e);
        if (!cancelled) {
          setError(
            `Impossible de récupérer vos appareils (${e?.message || "erreur inconnue"}).`
          );
          setLoading(false);
        }
      }
    }

    fetchDevices();
    const timer = setInterval(fetchDevices, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [clientId]);

  const now = Date.now();
  const FIVE_MIN_MS = 5 * 60 * 1000;

  function isActive(d: Device): boolean {
    if (!d.lastHeartbeat) return false;
    const t = new Date(d.lastHeartbeat).getTime();
    if (Number.isNaN(t)) return false;
    return now - t <= FIVE_MIN_MS;
  }

  const stats = useMemo(() => {
    const total = devices.length;
    const phones = devices.filter((d) => d.category === "PHONE").length;
    const pcs = devices.filter((d) => d.category === "PC").length;
    const active = devices.filter((d) => isActive(d)).length;
    return { total, phones, pcs, active };
  }, [devices, now]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (filterCategory === "PHONE" && d.category !== "PHONE") return false;
      if (filterCategory === "PC" && d.category !== "PC") return false;
      if (onlyActive && !isActive(d)) return false;
      return true;
    });
  }, [devices, filterCategory, onlyActive, now]);

  const filteredCount = filteredDevices.length;

  const lastRefreshStr = lastRefresh
    ? lastRefresh.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "---";

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CLIENT_ID_KEY);
    }
    router.push("/client/login");
  }

  const titleClientId = clientId || "Client";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Topbar */}
      <nav className="bg-[#05060f] text-white h-14 flex items-center justify-between px-6">
        <div className="font-semibold text-lg">
          Yarmotek GuardCloud – Espace Client
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-70">ID : {titleClientId}</span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-xs font-medium px-4 py-1.5 rounded-lg"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col px-6 py-4">
        <div className="max-w-6xl w-full mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-semibold">Mes appareils GuardCloud</h1>
            <p className="text-xs text-gray-500 mt-1">
              Vue temps réel de vos appareils (PC &amp; smartphones) liés à
              votre compte.
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Dernier rafraîchissement&nbsp;: {lastRefreshStr}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label="Appareils suivis" value={stats.total} />
            <StatCard label="Smartphones" value={stats.phones} />
            <StatCard label="PC" value={stats.pcs} />
            <StatCard label="Actifs (< 5 min)" value={stats.active} />
          </div>

          {/* Filtres + Carte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {/* Filtres */}
            <div className="bg-white rounded-2xl shadow border border-gray-200 p-4">
              <h2 className="text-sm font-semibold mb-3">Filtres</h2>
              <div className="flex gap-2 mb-3">
                <FilterPill
                  label="Tous"
                  active={filterCategory === "ALL"}
                  onClick={() => setFilterCategory("ALL")}
                />
                <FilterPill
                  label="Phones"
                  active={filterCategory === "PHONE"}
                  onClick={() => setFilterCategory("PHONE")}
                />
                <FilterPill
                  label="PC"
                  active={filterCategory === "PC"}
                  onClick={() => setFilterCategory("PC")}
                />
              </div>

              <label className="flex items-center gap-2 text-xs mt-1">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="rounded"
                />
                Afficher uniquement les appareils actifs (&lt; 5 min)
              </label>

              <p className="mt-3 text-[11px] text-gray-400">
                {filteredCount} appareil(s) affiché(s).
              </p>
            </div>

            {/* Carte */}
            <div className="bg-white rounded-2xl shadow border border-gray-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">
                  Carte temps réel – Mes appareils
                </h2>
                <span className="text-[11px] text-gray-400">
                  Fond OSM / Satellite
                </span>
              </div>
              <div className="flex-1 min-h-[260px] rounded-xl overflow-hidden border border-gray-100">
                <DevicesMap devices={filteredDevices} />
              </div>
            </div>
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">
              Détail de mes appareils ({filteredCount})
            </h2>

            {loading ? (
              <div className="text-xs text-gray-500">
                Chargement de vos appareils…
              </div>
            ) : error ? (
              <div className="text-xs text-red-600">Erreur : {error}</div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-xs text-gray-500">
                Aucun appareil enregistré pour ce compte.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <Th>APPAREIL</Th>
                      <Th>DEVICE ID</Th>
                      <Th>CATÉGORIE</Th>
                      <Th>COORDONNÉES</Th>
                      <Th>BATTERIE</Th>
                      <Th>ACTIF</Th>
                      <Th>DERNIER HEARTBEAT</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((d) => (
                      <tr
                        key={d.deviceId}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <Td>
                          <div className="font-medium text-[11px]">
                            {d.name}
                          </div>
                        </Td>
                        <Td>
                          <div className="font-mono text-[11px]">
                            {d.deviceId}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {d.hardwareId || ""}
                          </div>
                        </Td>
                        <Td>{d.category || "-"}</Td>
                        <Td>
                          {d.lat || d.lng
                            ? `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}`
                            : "-"}
                        </Td>
                        <Td>
                          {typeof d.battery === "number" ? (
                            <>
                              {d.battery}%{" "}
                              <span className="text-[10px] text-gray-500">
                                {d.charging === true
                                  ? "(En charge)"
                                  : d.charging === false
                                  ? "(Sur batterie)"
                                  : ""}
                              </span>
                            </>
                          ) : (
                            "-"
                          )}
                        </Td>
                        <Td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${
                              isActive(d)
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {isActive(d) ? "Actif" : "Inactif"}
                          </span>
                        </Td>
                        <Td>
                          {d.lastHeartbeat
                            ? new Date(d.lastHeartbeat).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// UI helpers
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 px-4 py-3 flex flex-col justify-between">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-medium px-3 py-2 border-b border-gray-100">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
