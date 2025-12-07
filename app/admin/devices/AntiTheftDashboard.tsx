// app/admin/devices/AntiTheftDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ================== API GUARDClOUD ==================

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

const DEVICES_ENDPOINT = '/devices';
const ADMIN_API_KEY = 'YGC-ADMIN';

// ================== FIX ICONES LEAFLET ==================

import markerIcon2xSrc from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconSrc from 'leaflet/dist/images/marker-icon.png';
import markerShadowSrc from 'leaflet/dist/images/marker-shadow.png';

const markerIcon2x = (markerIcon2xSrc as unknown) as string;
const markerIcon = (markerIconSrc as unknown) as string;
const markerShadow = (markerShadowSrc as unknown) as string;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ================== TYPES ==================

type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'GPS' | 'IOT' | 'OTHER';
type CommandAction = 'RING' | 'LOST_MODE' | 'LOCK';

interface Device {
  id: string;
  label: string;
  clientName?: string;
  category: DeviceCategory;
  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: string | null;
  batteryLevel?: number | null;
  isOnline: boolean;
}

interface CommandResponse {
  ok?: boolean;
  message?: string;
  status?: string;
  info?: string;
  error?: string;
}

// ================== HELPERS ==================

const OUAGADOUGOU_CENTER: LatLngExpression = [12.3714, -1.5197];

function formatDate(dateIso: string | null): string {
  if (!dateIso) return '—';
  try {
    const d = new Date(dateIso);
    return d.toLocaleString('fr-FR');
  } catch {
    return dateIso;
  }
}

function getLogicalCategory(raw: any): DeviceCategory {
  const cat = (raw.category ?? raw.deviceCategory ?? '').toString().toUpperCase();
  if (['PHONE', 'PC', 'DRONE', 'GPS', 'IOT'].includes(cat)) {
    return cat as DeviceCategory;
  }

  const t = (raw.deviceType ?? raw.device_type ?? '').toString().toUpperCase();
  if (t.includes('DRONE')) return 'DRONE';
  if (t.includes('PHONE')) return 'PHONE';
  if (t.includes('PC')) return 'PC';
  if (t.includes('GPS')) return 'GPS';
  if (t.includes('IOT')) return 'IOT';
  return 'OTHER';
}

function computeOnline(raw: any): boolean {
  const last =
    raw.lastHeartbeatAt ??
    raw.lastSeen ??
    raw.last_seen ??
    raw.last_heartbeat_at ??
    null;
  if (!last) return false;
  const t = Date.parse(last);
  if (Number.isNaN(t)) return false;
  const diffMin = (Date.now() - t) / 60000;
  return diffMin <= 30; // en ligne si < 30 min
}

// ================== COMPOSANT PRINCIPAL ==================

export default function AntiTheftDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- CHARGER LES DEVICES DEPUIS /devices ----------

  async function loadDevices() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const url = `${API_BASE}${DEVICES_ENDPOINT}?apiKey=${ADMIN_API_KEY}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Erreur API devices: ${res.status}`);
      }

      const data = await res.json();

      let arr: any[] = [];
      if (Array.isArray(data.devices)) arr = data.devices;
      else if (Array.isArray(data)) arr = data;
      else if (data.devices && Array.isArray(data.devices)) arr = data.devices;

      const mappedAll: Device[] = arr.map((r: any) => {
        const lat =
          r.lat != null
            ? Number(r.lat)
            : r.latDeg != null
            ? Number(r.latDeg)
            : null;
        const lng =
          r.lng != null
            ? Number(r.lng)
            : r.lngDeg != null
            ? Number(r.lngDeg)
            : null;

        const lastSeen =
          r.lastHeartbeatAt ?? r.lastSeen ?? r.last_seen ?? null;

        const batteryRaw =
          r.battery ?? r.batteryLevel ?? r.battery_level ?? null;

        const cat = getLogicalCategory(r);

        return {
          id: String(r.deviceId ?? ''),
          label:
            r.deviceName ??
            r.device_label ??
            r.clientName ??
            r.client_name ??
            r.deviceId ??
            'Device',
          clientName: r.clientName ?? r.client_name ?? undefined,
          category: cat,
          lastLat: lat,
          lastLng: lng,
          lastSeenAt: lastSeen,
          batteryLevel:
            batteryRaw != null ? Number(batteryRaw as number | string) : null,
          isOnline: computeOnline(r),
        };
      });

      const phones = mappedAll.filter((d) => d.category === 'PHONE');

      setDevices(phones);

      if (!selected && phones.length > 0) {
        setSelected(phones[0]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(
        e?.message ?? 'Erreur inconnue lors du chargement des devices',
      );
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  // ---------- ENVOI DES COMMANDES via /admin/command ----------

  async function sendCommand(action: CommandAction) {
    if (!selected) return;

    try {
      setCommandBusy(true);
      setStatusMessage(null);
      setErrorMessage(null);

      const payload = {
        apiKey: ADMIN_API_KEY,
        deviceId: selected.id,
        action, // "RING" | "LOST_MODE" | "LOCK"
        message:
          action === 'RING'
            ? 'TEST ANTI-VOL YARMOTEK'
            : action === 'LOST_MODE'
            ? 'Téléphone perdu / volé – contacter immédiatement Yarmotek / propriétaire.'
            : 'LOCK_SCREEN',
        durationSec: action === 'RING' ? 20 : 0,
        level: action === 'RING' ? 'HIGH' : 'NORMAL',
      };

      const res = await fetch(`${API_BASE}/admin/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur API commande: ${res.status} – ${txt}`);
      }

      const json = (await res.json()) as CommandResponse;

      if (json.ok === false) {
        throw new Error(json.error ?? 'Commande refusée par l’API');
      }

      const msg =
        json.message ?? json.status ?? json.info ?? 'Commande envoyée';

      setStatusMessage(`✅ ${msg}`);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(
        e?.message ?? 'Erreur lors de l’envoi de la commande antivol',
      );
    } finally {
      setCommandBusy(false);
    }
  }

  const onlineCount = useMemo(
    () => devices.filter((d) => d.isOnline).length,
    [devices],
  );

  const mapCenter: LatLngExpression =
    selected && selected.lastLat != null && selected.lastLng != null
      ? [selected.lastLat, selected.lastLng]
      : OUAGADOUGOU_CENTER;

  // ================== RENDU ==================

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50">
      {/* 🗺️ Carte */}
      <div className="relative flex-1">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-full w-full z-0"
          preferCanvas
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {devices
            .filter((d) => d.lastLat != null && d.lastLng != null)
            .map((d) => (
              <Marker
                key={d.id}
                position={[d.lastLat as number, d.lastLng as number]}
                eventHandlers={{ click: () => setSelected(d) }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{d.label}</div>
                    {d.clientName && (
                      <div className="text-xs text-slate-500">
                        Client : {d.clientName}
                      </div>
                    )}
                    <div className="text-xs mt-1">
                      Vu : {formatDate(d.lastSeenAt)}
                    </div>
                    {d.batteryLevel != null && (
                      <div className="text-xs">
                        Batterie : {d.batteryLevel}%
                      </div>
                    )}
                    <div className="mt-1 text-xs">
                      Statut :{' '}
                      <span
                        className={
                          d.isOnline ? 'text-emerald-400' : 'text-slate-400'
                        }
                      >
                        {d.isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Bandeau sur la carte */}
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900/80 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur">
            <div className="text-xs font-semibold text-emerald-400">
              Phones SahelGuard : {devices.length}
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="text-xs text-sky-300">En ligne : {onlineCount}</div>
            <button
              type="button"
              onClick={() => {
                setReloading(true);
                void loadDevices();
              }}
              className="ml-2 rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800 active:scale-[0.97]"
            >
              {reloading || loading ? 'Rafraîchissement…' : 'Rafraîchir'}
            </button>
          </div>
        </div>
      </div>

      {/* 🧰 Panneau latéral Antivol */}
      <div className="w-96 border-l border-slate-800 bg-slate-900/80 backdrop-blur-xl px-4 py-5 flex flex-col gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            SahelGuard • Antivol
          </div>
          <div className="mt-1 text-lg font-semibold">Dashboard GuardCloud</div>
          <div className="mt-1 text-xs text-slate-400">
            Sélectionne un téléphone sur la carte pour envoyer des commandes
            anti-vol.
          </div>
        </div>

        {/* Device sélectionné */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{selected.label}</div>
                  {selected.clientName && (
                    <div className="text-xs text-slate-400">
                      {selected.clientName}
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    selected.isOnline
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-600/40 text-slate-200'
                  }`}
                >
                  {selected.isOnline ? 'En ligne' : 'Hors ligne'}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">Dernier signal :</span>
                  <br />
                  {formatDate(selected.lastSeenAt)}
                </div>
                <div>
                  <span className="text-slate-500">Batterie :</span>
                  <br />
                  {selected.batteryLevel != null
                    ? `${selected.batteryLevel}%`
                    : '—'}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">
              Aucun téléphone sélectionné. Clique sur un marker sur la carte.
            </div>
          )}
        </div>

        {/* Boutons de commandes */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!selected || commandBusy}
            onClick={() => void sendCommand('RING')}
            className="rounded-xl border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
          >
            🔔 Faire sonner (20s)
          </button>

          <button
            type="button"
            disabled={!selected || commandBusy}
            onClick={() => void sendCommand('LOST_MODE')}
            className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
          >
            🚨 Activer mode perdu / volé
          </button>

          <button
            type="button"
            disabled={!selected || commandBusy}
            onClick={() => void sendCommand('LOCK')}
            className="rounded-xl border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
          >
            🔐 Verrouiller écran (demo)
          </button>
        </div>

        {/* Messages de statut */}
        {statusMessage && (
          <div className="rounded-xl border border-emerald-600/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-rose-600/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        )}

        <div className="mt-auto text-[11px] text-slate-500">
          API GuardCloud v7 • Les commandes sont lues par SahelGuard via le
          Heartbeat (RING, LOST_MODE, LOCK, etc.).
        </div>
      </div>
    </div>
  );
}
