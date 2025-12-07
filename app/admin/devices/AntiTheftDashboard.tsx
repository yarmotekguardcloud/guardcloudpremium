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

// --- Fix icônes Leaflet par défaut (avec cast propre pour Next 15) ---
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x as unknown as string,
  iconUrl: markerIcon as unknown as string,
  shadowUrl: markerShadow as unknown as string,
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
  isOnline: boolean;
}

type CommandAction = 'RING' | 'LOST_MODE' | 'LOCK';

interface CommandResponse {
  ok: boolean;
  message?: string;
  [key: string]: any;
}

// --------- Constantes API ---------

// 🔗 On parle DIRECTEMENT à ton Worker Cloudflare, comme PowerShell
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

const ADMIN_API_KEY = 'YGC-ADMIN';

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

function normalizeCategory(raw: any): DeviceCategory {
  const c = (raw.category ?? raw.deviceType ?? raw.type ?? 'PHONE')
    .toString()
    .toUpperCase();

  if (c.includes('PC')) return 'PC';
  if (c.includes('DRONE')) return 'DRONE';
  if (c.includes('IOT')) return 'IOT';
  if (c.includes('GPS')) return 'IOT';
  return 'PHONE';
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

      // 📡 On appelle ton Worker : GET /devices
      const res = await fetch(`${API_BASE}/devices`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur API devices: ${res.status} – ${txt}`);
      }

      const json = await res.json();

      const rawList: any[] =
        json.devices ??
        json.items ??
        (Array.isArray(json) ? json : []);

      const mapped: Device[] = rawList.map((d: any) => {
        const lastLat =
          d.lat ?? d.latitude ?? d.lastLat ?? null;
        const lastLng =
          d.lng ?? d.longitude ?? d.lastLng ?? null;

        return {
          id: d.deviceId ?? d.id,
          label:
            d.name ??
            d.label ??
            d.deviceName ??
            d.deviceId ??
            d.id ??
            'Appareil',
          clientName: d.clientName ?? d.client_name ?? null,
          category: normalizeCategory(d),
          lastLat:
            typeof lastLat === 'number'
              ? lastLat
              : lastLat != null
              ? Number(lastLat)
              : null,
          lastLng:
            typeof lastLng === 'number'
              ? lastLng
              : lastLng != null
              ? Number(lastLng)
              : null,
          lastSeenAt:
            d.lastSeen ??
            d.lastHeartbeat ??
            d.lastHeartbeatAt ??
            null,
          batteryLevel:
            d.battery ??
            d.batteryLevel ??
            d.battery_level ??
            null,
          isOnline:
            d.isOnline ??
            d.online ??
            (d.status === 'ONLINE') ??
            false,
        };
      });

      setDevices(mapped);

      if (!selected && mapped.length > 0) {
        setSelected(mapped[0]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(
        e?.message ??
          'Erreur inconnue lors du chargement des appareils',
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

      // 🧠 On reproduit EXACTEMENT PowerShell
      const payload = {
        apiKey: ADMIN_API_KEY,
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
        throw new Error(
          `Erreur API commande: ${res.status} – ${txt}`,
        );
      }

      const json = (await res.json()) as CommandResponse;
      const msg =
        json.message ??
        'Commande envoyée et enregistrée dans GuardCloud ✅';

      setStatusMessage(`✅ ${msg}`);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(
        e?.message ??
          "Erreur lors de l’envoi de la commande antivol",
      );
    } finally {
      setCommandBusy(false);
    }
  }

  const onlineCount = useMemo(
    () => devices.filter((d) => d.isOnline).length,
    [devices],
  );

  const phoneDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.category === 'PHONE' || d.category === undefined,
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
                eventHandlers={{
                  click: () => setSelected(d),
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">
                      {d.label}
                    </div>
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
                          d.isOnline
                            ? 'text-emerald-400'
                            : 'text-slate-400'
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
              {reloading || loading
                ? 'Rafraîchissement...'
                : 'Rafraîchir'}
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
            Sélectionne un téléphone sur la carte pour envoyer des
            commandes anti-vol (RING, LOST_MODE, LOCK).
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
                  <span className="text-slate-500">
                    Dernier signal :
                  </span>
                  <br />
                  {formatDate(selected.lastSeenAt)}
                </div>
                <div>
                  <span className="text-slate-500">
                    Batterie :
                  </span>
                  <br />
                  {selected.batteryLevel != null
                    ? `${selected.batteryLevel}%`
                    : '—'}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">
              Aucun téléphone sélectionné. Clique sur un marker sur
              la carte.
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
            🔐 Verrouiller écran (DEMO)
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
          API GuardCloud v7 • Les commandes sont stockées dans le
          Worker et lues par SahelGuard via le Heartbeat (RING,
          LOST_MODE, LOCK, etc.).
        </div>
      </div>
    </div>
  );
}
