'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ----------------------------
//  Fix icônes Leaflet (Next.js)
// ----------------------------

// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const markerIcon2xUrl: string =
  (markerIcon2x as any)?.src ?? (markerIcon2x as any);
const markerIconUrl: string =
  (markerIcon as any)?.src ?? (markerIcon as any);
const markerShadowUrl: string =
  (markerShadow as any)?.src ?? (markerShadow as any);

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

// ----------------------------
//  Types
// ----------------------------

type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'IOT' | 'OTHER';
type CommandAction = 'RING' | 'LOST_MODE' | 'LOCK';

interface Device {
  id: string;
  label: string;
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;

  category: DeviceCategory;

  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;

  gpsAccuracy?: number | null;
  batteryLevel?: number | null;
  networkType?: string | null;
  ip?: string | null;

  isOnline: boolean;
}

interface CommandResponse {
  ok: boolean;
  message?: string;
  status?: string;
  info?: string;
}

// ----------------------------
//  Constantes API + helpers
// ----------------------------

const OUAGADOUGOU_CENTER: LatLngExpression = [12.3714, -1.5197];

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

/**
 * API proxy côté Next.js pour les commandes antivol :
 * /api/guardcloud/command → Worker Cloudflare /admin/commands
 */
const COMMAND_API = '/api/guardcloud/command';

function formatDate(dateIso?: string | null): string {
  if (!dateIso) return '—';
  try {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return dateIso;
    return d.toLocaleString('fr-FR');
  } catch {
    return dateIso;
  }
}

function normalizeCategory(raw: any): DeviceCategory {
  const c = String(raw ?? '').toUpperCase();
  if (c.includes('PHONE')) return 'PHONE';
  if (c.includes('PC')) return 'PC';
  if (c.includes('DRONE')) return 'DRONE';
  if (c.includes('IOT')) return 'IOT';
  return 'OTHER';
}

// ===== Helpers pour marqueurs intelligents =====

function getShortLabel(label: string): string {
  if (!label) return '…';
  const trimmed = label.trim();
  if (trimmed.length <= 10) return trimmed;
  return trimmed.slice(0, 10);
}

function createDeviceIcon(device: Device): L.DivIcon {
  const battery = device.batteryLevel ?? 100;

  // Couleur de l’anneau selon statut + batterie
  let ringColor = '#22c55e'; // vert : en ligne OK
  if (!device.isOnline) {
    ringColor = '#64748b'; // gris : hors ligne
  } else if (battery <= 5) {
    ringColor = '#dc2626'; // rouge : critique
  } else if (battery <= 20) {
    ringColor = '#f97316'; // orange : faible
  }

  const label = getShortLabel(device.label);

  const html = `
    <div style="
      position: relative;
      transform: translate(-50%, -50%);
    ">
      <!-- Capsule avec nom du device -->
      <div style="
        min-width: 64px;
        max-width: 120px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(2,6,23,0.95);
        color: #f9fafb;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 10px 25px rgba(15,23,42,0.65);
        border: 1px solid rgba(30,64,175,0.7);
        white-space: nowrap;
      ">
        ${label}
      </div>

      <!-- Pastille sur la position précise -->
      <div style="
        position: absolute;
        left: 50%;
        top: 100%;
        transform: translate(-50%, 4px);
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, #e5e7eb, #020617);
        border: 3px solid ${ringColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'sahelguard-device-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// ----------------------------
//  Composant principal
// ----------------------------

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

  // -------- Chargement devices --------

  async function loadDevices() {
    try {
      setLoading(true);
      setErrorMessage(null);

      let res: Response | null = null;

      // 1️⃣ On tente d’abord l’API proxy Next.js (si déployée)
      try {
        res = await fetch('/api/admin/devices', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          // on force le fallback
          res = null;
        }
      } catch {
        res = null;
      }

      // 2️⃣ Fallback direct vers le Worker Cloudflare
      if (!res) {
        res = await fetch(`${API_BASE}/devices`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
      }

      if (!res.ok) {
        throw new Error(`Erreur API devices: ${res.status}`);
      }

      const json = await res.json();

      const list: any[] =
        json.devices ??
        json.items ??
        (Array.isArray(json) ? json : []);

      const mapped: Device[] = list
        .map((d: any): Device | null => {
          const id = String(d.deviceId ?? d.id ?? '');
          if (!id) return null;

          const lat =
            typeof d.lat === 'number'
              ? d.lat
              : typeof d.latitude === 'number'
              ? d.latitude
              : null;

          const lng =
            typeof d.lng === 'number'
              ? d.lng
              : typeof d.longitude === 'number'
              ? d.longitude
              : null;

          const rawOnline =
            typeof d.isOnline === 'boolean'
              ? d.isOnline
              : typeof d.online === 'boolean'
              ? d.online
              : d.status === 'ONLINE';

          const batteryRaw =
            d.battery ?? d.batteryLevel ?? d.battery_level ?? null;
          const battery =
            typeof batteryRaw === 'number'
              ? batteryRaw
              : batteryRaw != null
              ? Number(batteryRaw)
              : null;

          const gpsAccRaw =
            d.accuracy_m ?? d.accuracy ?? d.locationAccuracy ?? null;
          const gpsAccuracy =
            typeof gpsAccRaw === 'number'
              ? gpsAccRaw
              : gpsAccRaw != null
              ? Number(gpsAccRaw)
              : null;

          const lastSeen =
            d.lastSeen ??
            d.lastSeenIso ??
            d.updatedAt ??
            d.lastHeartbeat ??
            null;

          const lastHb =
            d.lastHeartbeat ??
            d.lastHeartbeatAt ??
            d.lastSeen ??
            d.updatedAt ??
            null;

          return {
            id,
            label:
              d.name ??
              d.deviceName ??
              d.label ??
              d.deviceId ??
              d.id ??
              'Device',

            clientId: d.clientId ?? d.client_id ?? null,
            clientName: d.clientName ?? d.client_name ?? null,
            clientPhone: d.clientPhone ?? d.client_phone ?? null,

            category: normalizeCategory(
              d.category ?? d.deviceType ?? d.type ?? 'PHONE',
            ),

            lastLat: lat,
            lastLng: lng,
            lastSeenAt: lastSeen,
            lastHeartbeatAt: lastHb,

            gpsAccuracy,
            batteryLevel: battery,
            networkType: d.networkType ?? d.network ?? null,
            ip: d.ip ?? null,

            isOnline: !!rawOnline,
          };
        })
        .filter(Boolean) as Device[];

      setDevices(mapped);

      if (!selected && mapped.length > 0) {
        setSelected(mapped[0]);
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

  // -------- Envoi commandes antivol --------

  async function sendCommand(action: CommandAction) {
    if (!selected) return;

    try {
      setCommandBusy(true);
      setStatusMessage(null);
      setErrorMessage(null);

      const payload = {
        deviceId: selected.id,
        action,
        message:
          action === 'RING'
            ? 'TEST ANTI-VOL YARMOTEK'
            : action === 'LOST_MODE'
            ? 'Téléphone perdu – contacter Yarmotek'
            : 'LOCK_SCREEN',
        durationSec: action === 'RING' ? 20 : 0,
        level: action === 'RING' ? 'HIGH' : 'NORMAL',
      };

      const res = await fetch(COMMAND_API, {
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

      const json = (await res.json()) as CommandResponse | any;
      const msg =
        json?.message ?? json?.status ?? json?.info ?? 'Commande envoyée';

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

  // -------- Mémos --------

  const phoneDevices = useMemo(
    () => devices.filter((d) => d.category === 'PHONE'),
    [devices],
  );

  const onlineCount = useMemo(
    () => devices.filter((d) => d.isOnline).length,
    [devices],
  );

  const mapCenter: LatLngExpression =
    selected && selected.lastLat != null && selected.lastLng != null
      ? [selected.lastLat, selected.lastLng]
      : OUAGADOUGOU_CENTER;

  // ----------------------------
  //  Rendu
  // ----------------------------

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50">
      {/* 🗺️ Carte principale */}
      <div className="relative flex-1">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="h-full w-full z-0"
          preferCanvas
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {phoneDevices
            .filter((d) => d.lastLat != null && d.lastLng != null)
            .map((d) => (
              <Marker
                key={d.id}
                position={[d.lastLat as number, d.lastLng as number]}
                icon={createDeviceIcon(d)}
                eventHandlers={{
                  click: () => setSelected(d),
                }}
              >
                <Popup>
                  {/* Popup pro détaillé */}
                  <div className="text-xs text-slate-900 min-w-[260px] max-w-[320px]">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div>
                        <div className="text-sm font-semibold">
                          {d.label}
                        </div>
                        {d.clientName && (
                          <div className="text-[11px] text-slate-500">
                            {d.clientName}
                          </div>
                        )}
                        {d.clientId && (
                          <div className="text-[11px] text-slate-400">
                            ID client : {d.clientId}
                          </div>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          d.isOnline
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                      </span>
                    </div>

                    <div className="border-t border-slate-200 my-2" />

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
                      <div>
                        <div className="text-[10px] text-slate-500">
                          DERNIER SIGNAL
                        </div>
                        <div>{formatDate(d.lastSeenAt)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          DERNIER HEARTBEAT
                        </div>
                        <div>{formatDate(d.lastHeartbeatAt)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          BATTERIE
                        </div>
                        <div>
                          {d.batteryLevel != null
                            ? `${d.batteryLevel}%`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          PRÉCISION GPS
                        </div>
                        <div>
                          {d.gpsAccuracy != null
                            ? `${Math.round(d.gpsAccuracy)} m`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          LAT / LNG
                        </div>
                        <div>
                          {d.lastLat?.toFixed(5)} /{' '}
                          {d.lastLng?.toFixed(5)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          RÉSEAU
                        </div>
                        <div>{d.networkType ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          IP
                        </div>
                        <div>{d.ip ?? '—'}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 my-2" />

                    <div className="text-[10px] text-slate-500 mb-1">
                      ACTIONS RAPIDES
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className="flex-1 rounded-full border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        🔔 Faire sonner
                      </button>
                      <button
                        type="button"
                        disabled
                        className="flex-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-400"
                      >
                        🚨 Mode perdu
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Bandeau top sur la carte */}
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900/80 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur">
            <div className="text-xs font-semibold text-emerald-400">
              Phones SahelGuard : {phoneDevices.length}
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="text-xs text-sky-300">
              En ligne : {onlineCount}
            </div>
            <button
              type="button"
              onClick={() => {
                setReloading(true);
                void loadDevices();
              }}
              className="ml-2 rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800 active:scale-[0.97]"
            >
              {reloading || loading ? 'Rafraîchissement...' : 'Rafraîchir'}
            </button>
          </div>
        </div>
      </div>

      {/* 🧰 Panneau latéral Antivol */}
      <div className="flex w-96 flex-col gap-4 border-l border-slate-800 bg-slate-900/80 px-4 py-5 backdrop-blur-xl">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            SahelGuard • Antivol
          </div>
          <div className="mt-1 text-lg font-semibold">
            Dashboard GuardCloud
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Sélectionne un téléphone sur la carte pour envoyer des
            commandes anti-vol en temps quasi réel.
          </div>
        </div>

        {/* Device sélectionné */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {selected.label}
                  </div>
                  {selected.clientName && (
                    <div className="text-xs text-slate-400">
                      {selected.clientName}
                    </div>
                  )}
                  {selected.clientId && (
                    <div className="text-[11px] text-slate-500">
                      ID client : {selected.clientId}
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

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">
                    Dernier signal :
                  </span>
                  <br />
                  {formatDate(selected.lastSeenAt)}
                </div>
                <div>
                  <span className="text-slate-500">
                    Dernier heartbeat :
                  </span>
                  <br />
                  {formatDate(selected.lastHeartbeatAt)}
                </div>
                <div>
                  <span className="text-slate-500">Batterie :</span>
                  <br />
                  {selected.batteryLevel != null
                    ? `${selected.batteryLevel}%`
                    : '—'}
                </div>
                <div>
                  <span className="text-slate-500">
                    Coordonnées :
                  </span>
                  <br />
                  {selected.lastLat?.toFixed(5)} /{' '}
                  {selected.lastLng?.toFixed(5)}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">
              Aucun téléphone sélectionné. Clique sur un marker sur la
              carte.
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
          API GuardCloud v7 • Les commandes sont lues par SahelGuard via
          le Heartbeat (RING, LOST_MODE, LOCK, etc.).
        </div>
      </div>
    </div>
  );
}
