// app/admin/clients/ClientsListClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClientDevice = {
  deviceId: string;
  name: string;
  online: boolean;
  lastSeen: string;
};

type Client = {
  name: string;
  clientId: string;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: ClientDevice[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  "https://yarmotek-guardcloud-api.myarbanga.workers.dev";

export default function ClientsListClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  async function loadClients() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/admin/clients`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setClients(json.clients ?? []);
    } catch (e: any) {
      console.error("Erreur chargement clients:", e);
      setError("Impossible de charger la liste des clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  const totalDevices = clients.reduce((sum, c) => sum + c.deviceCount, 0);
  const totalOnline = clients.reduce((sum, c) => sum + c.onlineCount, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-4 py-2 bg-slate-900 text-white text-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Clients</span>
          <span className="text-slate-400">
            {clients.length} client(s) - {totalDevices} appareils ({totalOnline} en ligne)
          </span>
          {loading && <span className="text-blue-400">Chargement...</span>}
          {error && <span className="text-red-400">{error}</span>}
        </div>
        <button
          type="button"
          onClick={loadClients}
          className="px-3 py-1 text-xs rounded border border-emerald-500 text-emerald-400 hover:bg-emerald-500/20"
        >
          Rafraîchir
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Chargement des clients...
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center h-full text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && clients.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Aucun client trouvé
          </div>
        )}

        {!loading && !error && clients.length > 0 && (
          <div className="grid gap-3 max-w-4xl mx-auto">
            {clients.map((client) => (
              <div
                key={client.name}
                className="bg-white rounded-lg border shadow-sm overflow-hidden"
              >
                {/* Client header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedClient(
                      expandedClient === client.name ? null : client.name
                    )
                  }
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {client.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {client.deviceCount} appareil(s)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        {client.onlineCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        {client.offlineCount}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedClient === client.name ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded devices list */}
                {expandedClient === client.name && (
                  <div className="border-t bg-gray-50 px-4 py-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Appareils
                    </div>
                    <div className="space-y-1">
                      {client.devices.map((device) => (
                        <div
                          key={device.deviceId}
                          className="flex items-center justify-between py-1 px-2 bg-white rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                device.online ? "bg-green-500" : "bg-gray-300"
                              }`}
                            />
                            <span className="text-gray-700">{device.name}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {device.lastSeen
                              ? new Date(device.lastSeen).toLocaleString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
