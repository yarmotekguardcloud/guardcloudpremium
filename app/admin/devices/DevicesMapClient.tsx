'use client';

import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Device = {
  deviceId: string;
  clientId?: string;
  clientName?: string;
  name?: string;
  deviceType?: string;
  category?: string;
  lat?: number;
  lng?: number;
  battery?: number;
  networkType?: string;
  updatedAt?: string;
  lastHeartbeat?: string;
  lastHeartbeatAt?: string;
  lastUpdatedAt?: string;
  source?: string;
};

type Filter = 'ALL' | 'PHONE' | 'PC' | 'DRONE';

// 🔗 URL du Worker Cloudflare (API GuardCloud)
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

// Fix icônes Leaflet sur Next
const DefaultIcon = L.icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
(L.Marker as any).prototype.options.icon = DefaultIcon;

export default function DevicesMapClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const center: LatLngTuple = [12.3657, -1.5339]; // Ouaga

  const lastUpdateText = (d: Device) =>
    d.updatedAt ||
    d.lastUpdatedAt ||
    d.lastHeartbeatAt ||
    d.lastHeartbeat ||
    '—';

  // --------- Chargement des devices depuis le Worker ---------
  async function loadDevices() {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch(`${API_BASE}/devices`, {
        method: 'GET',
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erreur API /devices');
      }

      const list: Device[] =
        (data.devices || data.items || data.rows || []).filter(
          (d: any) =>
            typeof d.lat === 'number' && typeof d.lng === 'number'
        );

      setDevices(list);
    } catch (e: any) {
      console.error('loadDevices error', e);
      setError(e.message || 'Erreur de chargement des appareils');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, 15000); // rafraîchit toutes les 15s
    return () => clearInterval(id);
  }, []);

  // --------- Filtre front (Tous / Phones / PC / Drones) ---------
  const filteredDevices = devices.filter((d) => {
    if (filter === 'ALL') return true;
    const cat = (d.category || d.deviceType || '').toUpperCase();
    if (filter === 'PHONE') return cat.includes('PHONE');
    if (filter === 'PC') return cat.includes('PC') || cat.includes('LAPTOP');
    if (filter === 'DRONE') return cat.includes('DRONE');
    return true;
  });

  // --------- Envoi commande SONNER vers le Worker ---------
  async function ringDevice(device: Device) {
    if (!device.deviceId) return;

    try {
      setSendingId(device.deviceId);
      setError(null);

      const res = await fetch(`${API_BASE}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.deviceId,
          action: 'RING',
          message: 'Téléphone volé – SahelGuard Yarmotek',
          durationSec: 20,
          level: 'HIGH',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Commande refusée');
      }

      alert(
        `Commande de sonnerie envoyée à ${
          device.clientName || device.name || device.deviceId
        }`
      );
    } catch (e: any) {
      console.error('ringDevice error', e);
      alert(`Erreur envoi commande: ${e.message || e}`);
    } finally {
      setSendingId(null);
    }
  }

  // --------- UI ---------
  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col bg-slate-900">
      {/* Barre haute filtres */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              filter === 'ALL'
                ? 'bg-amber-400 text-slate-900'
                : 'bg-slate-800 text-slate-200'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilter('PHONE')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              filter === 'PHONE'
                ? 'bg-cyan-400 text-slate-900'
                : 'bg-slate-800 text-slate-200'
            }`}
          >
            Phones
          </button>
          <button
            onClick={() => setFilter('PC')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              filter === 'PC'
                ? 'bg-blue-400 text-slate-900'
                : 'bg-slate-800 text-slate-200'
            }`}
          >
            PC
          </button>
          <button
            onClick={() => setFilter('DRONE')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              filter === 'DRONE'
                ? 'bg-fuchsia-400 text-slate-900'
                : 'bg-slate-800 text-slate-200'
            }`}
          >
            Drones
          </button>

          <button
            onClick={loadDevices}
            className="ml-3 px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 hover:bg-slate-600"
          >
            Rafraîchir
          </button>
        </div>

        <div className="text-xs text-slate-300">
          Appareils visibles : {filteredDevices.length}
          {loading && ' · chargement…'}
          {error && (
            <span className="ml-2 text-red-400">
              Erreur : {error}
            </span>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="flex-1">
        <MapContainer
          center={center}
          zoom={12}
          className="w-full h-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredDevices.map((d) => (
            <Marker
              key={d.deviceId}
              position={[d.lat!, d.lng!] as LatLngTuple}
            >
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">
                    {d.name || d.deviceType || 'Appareil'}
                  </div>
                  <div>
                    Client :{' '}
                    <span className="font-medium">
                      {d.clientName || d.clientId || '—'}
                    </span>
                  </div>
                  <div>
                    ID :{' '}
                    <span className="font-mono break-all">
                      {d.deviceId}
                    </span>
                  </div>
                  <div>Batterie : {d.battery ?? '—'}%</div>
                  <div>Réseau : {d.networkType || '—'}</div>
                  <div>Dernier signal : {lastUpdateText(d)}</div>

                  <button
                    className="mt-2 px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60"
                    onClick={() => ringDevice(d)}
                    disabled={sendingId === d.deviceId}
                  >
                    {sendingId === d.deviceId
                      ? 'Envoi…'
                      : 'Faire sonner (ANTIVOL)'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
