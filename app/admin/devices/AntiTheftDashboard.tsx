'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Tooltip,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ------------------------
//  Patch icônes Leaflet
// ------------------------
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// On récupère la vraie URL string (Next Image -> .src)
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

// -------- Types --------

type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'IOT' | 'OTHER';

interface Device {
  id: string;
  label: string;
  clientName?: string;
  clientPhone?: string;
  category: DeviceCategory;
  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  batteryLevel?: number | null;
  isOnline: boolean;
  ip?: string;
  wifi?: string;
  networkType?: string;
  accuracyM?: number | null;
}

type CommandAction = 'RING' | 'LOST_MODE' | 'LOCK';

interface CommandResponse {
  ok: boolean;
  message?: string;
  status?: string;
  info?: string;
}

// --------- Constantes API + helpers ---------

const OUAGADOUGOU_CENTER: LatLngExpression = [12.3714, -1.5197];

// On garde la même base que le Worker Cloudflare
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

function formatDate(dateIso: string | null): string {
  if (!dateIso) return '—';
  try {
    const d = new Date(dateIso);
    return d.toLocaleString('fr-FR');
  } catch {
    return dateIso ?? '—';
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

/**
 * Donne une couleur de statut pour les marqueurs et badges.
 */
function statusColor(d: Device): string {
  if (!d.isOnline) return '#64748b'; // gris
  if (d.batteryLevel != null && d.batteryLevel <= 15) return '#f97316'; // orange low battery
  return '#22c55e'; // vert en ligne
}

// --------- Composant principal ---------

export default function AntiTheftDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les devices au montage
  useEffect(() => {
    void loadDevices();
  }, []);

  // -------- API: chargement devices --------

  async function loadDevices() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const url = `${API_BASE}/devices`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Erreur API devices: ${res.status}`);
      }

      const json = await res.json();

      const list: any[] =
        json.devices ??
        json.items ??
        (Array.isArray(json) ? json : []);

      const mapped: Device[] = list
        .map((d: any) => {
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

          const online =
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
              : batteryRaw != null && !Number.isNaN(Number(batteryRaw))
              ? Number(batteryRaw)
              : null;

          return {
            id,
            label:
              d.name ??
              d.deviceName ??
              d.label ??
              d.deviceId ??
              d.id ??
              'Device',
            clientName: d.clientName ?? d.client_id ?? undefined,
            clientPhone: d.clientPhone ?? d.client_phone ?? undefined,
            category: normalizeCategory(d.category ?? d.deviceType ?? 'PHONE'),
            lastLat: lat,
            lastLng: lng,
            lastSeenAt:
              d.lastSeen ??
              d.lastSeenIso ??
              d.updatedAt ??
              d.lastHeartbeat ??
              null,
            lastHeartbeatAt: d.lastHeartbeat ?? null,
            batteryLevel: battery,
            isOnline: !!online,
            ip: d.ip ?? '',
            wifi: d.wifi ?? d.ssid ?? '',
            networkType: d.networkType ?? d.network ?? '',
            accuracyM: d.accuracy_m ?? d.accuracy ?? null,
          } as Device;
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

  // -------- API: envoi des commandes antivol --------

  async function sendCommand(action: CommandAction) {
    if (!selected) return;

    try {
      setCommandBusy(true);
      setStatusMessage(null);
      setErrorMessage(null);

      const payload = {
        apiKey: 'YGC-ADMIN',
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

      // On tape directement le Worker Cloudflare
      const res = await fetch(`${API_BASE}/admin/commands`, {
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

  // -------- Helpers UI Map --------

  function deviceMarkerIcon(d: Device) {
    const color = statusColor(d);
    return L.divIcon({
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
      html: `
        <div class="relative flex items-center justify-center">
          <div
            class="rounded-full bg-slate-900/80 border border-slate-700 shadow-lg shadow-black/40 px-2 py-1 text-[10px] font-semibold text-slate-50"
          >
            ${d.label.substring(0, 12)}
          </div>
          <span
            class="absolute -bottom-1 h-2 w-2 rounded-full ring-2 ring-slate-900"
            style="background:${color};"
          ></span>
        </div>
      `,
    });
  }

  // -------- Rendu --------

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-950 text-slate-50">
      {/* 🗺️ Carte principale */}
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

          {phoneDevices
            .filter((d) => d.lastLat != null && d.lastLng != null)
            .map((d) => {
              const pos: LatLngExpression = [
                d.lastLat as number,
                d.lastLng as number,
              ];
              const color = statusColor(d);

              return (
                <Marker
                  key={d.id}
                  position={pos}
                  icon={deviceMarkerIcon(d)}
                  eventHandlers={{
                    click: () => setSelected(d),
                  }}
                >
                  {/* Halo de précision */}
                  {d.accuracyM != null && d.accuracyM > 0 && (
                    <CircleMarker
                      center={pos}
                      radius={Math.min(30, Math.max(8, d.accuracyM / 10))}
                      pathOptions={{
                        color,
                        opacity: 0.25,
                        fillOpacity: 0.08,
                      }}
                    />
                  )}

                  <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                    <span className="text-xs font-medium">
                      {d.label} –{' '}
                      <span
                        style={{ color }}
                      >
                        {d.isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </span>
                  </Tooltip>

                  <Popup>
                    <div className="text-xs space-y-2 min-w-[220px]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">
                            {d.label}
                          </div>
                          {d.clientName && (
                            <div className="text-[11px] text-slate-500">
                              {d.clientName}
                              {d.clientPhone
                                ? ` • ${d.clientPhone}`
                                : ''}
                            </div>
                          )}
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${statusColor(d)}22`,
                            color,
                          }}
                        >
                          {d.isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                        </span>
                      </div>

                      <div className="h-px bg-slate-800" />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Dernier signal
                          </div>
                          <div>{formatDate(d.lastSeenAt)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Dernier heartbeat
                          </div>
                          <div>
                            {formatDate(d.lastHeartbeatAt ?? d.lastSeenAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Batterie
                          </div>
                          <div>
                            {d.batteryLevel != null
                              ? `${d.batteryLevel}%`
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Précision GPS
                          </div>
                          <div>
                            {d.accuracyM != null
                              ? `${d.accuracyM} m`
                              : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-slate-800" />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Lat / Lng
                          </div>
                          <div>
                            {d.lastLat?.toFixed(5) ?? '—'} /{' '}
                            {d.lastLng?.toFixed(5) ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Réseau
                          </div>
                          <div>
                            {d.networkType || '—'}
                            {d.wifi ? ` • Wi-Fi: ${d.wifi}` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            IP
                          </div>
                          <div>{d.ip || '—'}</div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <div className="text-[10px] uppercase text-slate-500 mb-1">
                          Actions rapides
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(d);
                              void sendCommand('RING');
                            }}
                            className="flex-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200 border border-amber-500/40 hover:bg-amber-500/20"
                          >
                            🔔 Faire sonner
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(d);
                              void sendCommand('LOST_MODE');
                            }}
                            className="flex-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-200 border border-rose-500/40 hover:bg-rose-500/20"
                          >
                            🚨 Mode perdu
                          </button>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
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
      <div className="w-96 border-l border-slate-800 bg-slate-900/80 backdrop-blur-xl px-4 py-5 flex flex-col gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            SahelGuard • Antivol
          </div>
          <div className="mt-1 text-lg font-semibold">
            Dashboard GuardCloud
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Sélectionne un téléphone sur la carte pour envoyer des commandes
            anti-vol en temps quasi réel.
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
                      {selected.clientPhone
                        ? ` • ${selected.clientPhone}`
                        : ''}
                    </div>
                  )}
                </div>
                <div
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${statusColor(selected)}22`,
                    color: statusColor(selected),
                  }}
                >
                  {selected.isOnline ? 'En ligne' : 'Hors ligne'}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Dernier signal
                  </span>
                  <br />
                  {formatDate(selected.lastSeenAt)}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Batterie
                  </span>
                  <br />
                  {selected.batteryLevel != null
                    ? `${selected.batteryLevel}%`
                    : '—'}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Coordonnées
                  </span>
                  <br />
                  {selected.lastLat != null && selected.lastLng != null
                    ? `${selected.lastLat.toFixed(
                        5,
                      )} / ${selected.lastLng.toFixed(5)}`
                    : '—'}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Réseau
                  </span>
                  <br />
                  {selected.networkType || '—'}
                  {selected.wifi ? ` • Wi-Fi: ${selected.wifi}` : ''}
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
          API GuardCloud v7 • Les commandes RING / LOST_MODE / LOCK sont
          exécutées par SahelGuard via le Heartbeat.
        </div>
      </div>
    </div>
  );
}
