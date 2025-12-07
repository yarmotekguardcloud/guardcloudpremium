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

// 🛠 Fix icônes Leaflet (pour build Next + Cloudflare)
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x as string,
  iconUrl: markerIcon as string,
  shadowUrl: markerShadow as string,
});

// -------- Types --------

type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'IOT' | 'OTHER';

interface Device {
  id: string;
  label: string;
  clientName?: string;
  category: DeviceCategory;
  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: string | null;
  batteryLevel?: number | null;
  isOnline?: boolean;          // bool optionnel
  online?: boolean;            // compat backend
  status?: 'ONLINE' | 'OFFLINE' | string; // compat backend
}

type CommandAction = 'RING' | 'LOST_MODE' | 'LOCK';

interface CommandResponse {
  ok: boolean;
  message?: string;
  status?: string;
  info?: string;
}

// --------- Helpers ---------

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

// Détermine si le device est “en ligne” à partir des différents champs
function isDeviceOnlineFlag(d: Device): boolean {
  if (typeof d.isOnline === 'boolean') return d.isOnline;
  if (typeof d.online === 'boolean') return d.online;
  if (typeof d.status === 'string') return d.status.toUpperCase() === 'ONLINE';
  return false;
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

      // ⛓️ URL API GuardCloud → adapte si tu changes le routeur
      const res = await fetch(
        'https://yarmotek-guardcloud-api.myarbanga.workers.dev/devices',
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Erreur API devices: ${res.status}`);
      }

      const json = await res.json();

      // Compat avec différents formats de réponse
      const source = (json.devices || json.items || json || []) as any[];

      const mapped: Device[] = source.map((d: any) => ({
        id: d.id ?? d.deviceId,
        label: d.label ?? d.name ?? d.deviceName ?? d.deviceId,
        clientName: d.clientName ?? d.client_name ?? d.clientId ?? null,
        category: (d.category ?? 'PHONE') as DeviceCategory,
        lastLat:
          d.lastLat ??
          d.lat ??
          d.latitude ??
          d.latDeg ??
          d.lat_deg ??
          null,
        lastLng:
          d.lastLng ??
          d.lng ??
          d.longitude ??
          d.lngDeg ??
          d.long_deg ??
          null,
        lastSeenAt:
          d.lastSeenAt ??
          d.lastSeen ??
          d.lastHeartbeat ??
          d.lastHeartbeatAt ??
          null,
        batteryLevel:
          d.battery ??
          d.batteryLevel ??
          d.battery_percent ??
          d.battery_level ??
          null,
        isOnline: d.isOnline,
        online: d.online,
        status: d.status,
      }));

      setDevices(mapped);

      if (!selected && mapped.length > 0) {
        setSelected(mapped[0]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message ?? 'Erreur inconnue lors du chargement des devices');
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

      const res = await fetch(
        'https://yarmotek-guardcloud-api.myarbanga.workers.dev/admin/commands',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur API commande: ${res.status} – ${txt}`);
      }

      const json = (await res.json()) as CommandResponse | any;

      const msg =
        json?.message ||
        json?.status ||
        json?.info ||
        'Commande envoyée avec succès';

      setStatusMessage(`✅ ${msg}`);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(
        e.message ?? 'Erreur lors de l’envoi de la commande antivol',
      );
    } finally {
      setCommandBusy(false);
    }
  }

  // -------- Métriques / dérivés --------

  const onlineCount = useMemo(
    () => devices.filter((d) => isDeviceOnlineFlag(d)).length,
    [devices],
  );

  const phoneDevices = useMemo(
    () =>
      devices.filter(
        (d) => d.category === 'PHONE' || !d.category,
      ),
    [devices],
  );

  const mapCenter: LatLngExpression =
    selected && selected.lastLat != null && selected.lastLng != null
      ? [selected.lastLat, selected.lastLng]
      : OUAGADOUGOU_CENTER;

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
            .map((d) => (
              <Marker
                key={d.id}
                position={[d.lastLat as number, d.lastLng as number]}
                eventHandlers={{
                  click: () => setSelected(d),
                }}
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
                          isDeviceOnlineFlag(d)
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }
                      >
                        {isDeviceOnlineFlag(d) ? 'En ligne' : 'Hors ligne'}
                      </span>
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
            anti-vol.
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
                </div>
                <div
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isDeviceOnlineFlag(selected)
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-600/40 text-slate-200'
                  }`}
                >
                  {isDeviceOnlineFlag(selected) ? 'En ligne' : 'Hors ligne'}
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
