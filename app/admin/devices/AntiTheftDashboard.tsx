"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { DeviceHistoryPanel } from "./DeviceHistoryPanel";

// ✅ Proxy Next (pas de CORS) : /api/admin/device-history -> appelle Worker
const DEVICE_HISTORY_API = "/api/admin/device-history";

// -----------------------------
// Dynamic imports react-leaflet
// -----------------------------
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), {
  ssr: false,
});
const Circle = dynamic(() => import("react-leaflet").then((m) => m.Circle), {
  ssr: false,
});

// -----------------------------
// Types
// -----------------------------
export type Device = {
  id: string;
  deviceId: string;
  name: string;
  category: string;
  type: string;
  deviceType: string;
  lat: number | null;
  lng: number | null;
  accuracy_m?: number | null;
  status: "ONLINE" | "OFFLINE";
  online: boolean;
  lastHeartbeat: string;
  battery?: number | null;
  networkType?: string;
  clientId?: string | null;
  clientName?: string;
  clientPhone?: string;
  simOperator?: string;
  simCountry?: string;
  simSerialLast4?: string;
  simChangedRecently?: boolean;
  airplaneMode?: boolean;
  currentZoneId?: string | null;
  lastZoneEvent?: {
    type: "ENTER" | "EXIT";
    zoneId: string;
    timestampIso: string;
  } | null;

  resellerId?: string | null;
  resellerName?: string | null;
};

type DevicesResponse = {
  ok?: boolean;
  items?: any[];
  devices?: any[];
  error?: string;
};

type TabId = "LIVE" | "HISTORY";
type RoleView = "SUPER_ADMIN" | "RESELLER" | "CLIENT";
type MapMode = "PLAN" | "SATELLITE";

export type HistoryPoint = {
  deviceId: string;
  timestampIso: string;
  lat: number | null;
  lng: number | null;
  accuracy_m?: number | null;
  battery?: number | null;
  networkType?: string;
  simChanged?: boolean;
  airplaneMode?: boolean;
};

type CommandAction = "RING" | "LOST_MODE" | "LOCK" | "LOCATION_ONCE" | "LOCATION_STREAM";

type CommandLogEntry = {
  id: string;
  action: CommandAction;
  label: string;
  at: string;
  status: "OK" | "ERROR";
  details?: string;
};

type RiskLevel = "NORMAL" | "MODERATE" | "HIGH" | "CRITICAL";

// -----------------------------
// Leaflet instance (client only)
// -----------------------------
let Leaflet: typeof import("leaflet") | null = null;

// -----------------------------
// Helpers
// -----------------------------
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function hasValidPosition(d: Device | HistoryPoint): boolean {
  return (
    typeof d.lat === "number" &&
    typeof d.lng === "number" &&
    !Number.isNaN(d.lat) &&
    !Number.isNaN(d.lng)
  );
}

function normalizeDevice(raw: any): Device {
  const lat =
    asNumber(raw.lat) ??
    asNumber(raw.latitude) ??
    asNumber(raw.location?.lat) ??
    asNumber(raw.lastLocation?.lat);

  const lng =
    asNumber(raw.lng) ??
    asNumber(raw.longitude) ??
    asNumber(raw.location?.lng) ??
    asNumber(raw.lastLocation?.lng);

  const online =
    typeof raw.online === "boolean"
      ? raw.online
      : raw.status === "ONLINE" || raw.status === "online";

  const status: "ONLINE" | "OFFLINE" = online ? "ONLINE" : "OFFLINE";

  const lastHeartbeatRaw = raw.lastHeartbeat || raw.timestampIso || raw.updatedAt || raw.createdAt;
  const lastHeartbeat =
    typeof lastHeartbeatRaw === "string" && lastHeartbeatRaw.length > 0
      ? lastHeartbeatRaw
      : new Date().toISOString();

  return {
    id: String(raw.id || raw.deviceId || raw.clientId || "UNKNOWN"),
    deviceId: String(raw.deviceId || raw.id || "UNKNOWN"),
    name: String(raw.name || raw.clientName || raw.deviceId || "Device"),
    category: String(raw.category || raw.deviceType || "PHONE"),
    type: String(raw.type || raw.deviceType || "PHONE"),
    deviceType: String(raw.deviceType || raw.type || "PHONE"),
    lat,
    lng,
    accuracy_m:
      asNumber(raw.accuracy_m) ??
      asNumber(raw.accuracy) ??
      asNumber(raw.location?.accuracyM) ??
      asNumber(raw.lastLocation?.accuracy_m) ??
      null,
    status,
    online,
    lastHeartbeat,
    battery: asNumber(raw.battery) ?? asNumber(raw.batteryLevel) ?? null,
    networkType: raw.networkType ?? null,
    clientId: raw.clientId ?? null,
    clientName: raw.clientName ?? null,
    clientPhone: raw.clientPhone ?? null,
    simOperator: raw.simOperator ?? raw.simInfo?.simOperator ?? null,
    simCountry: raw.simCountry ?? raw.simInfo?.simCountry ?? null,
    simSerialLast4: raw.simSerialLast4 ?? raw.simInfo?.simSerialLast4 ?? null,
    simChangedRecently: raw.simChangedRecently ?? raw.simChanged ?? raw.simInfo?.simChanged ?? false,
    airplaneMode: raw.airplaneMode ?? raw.deviceFlags?.airplaneMode ?? false,
    currentZoneId: raw.currentZoneId ?? null,
    lastZoneEvent: raw.lastZoneEvent ?? null,
    resellerId: raw.resellerId ?? null,
    resellerName: raw.resellerName ?? null,
  };
}

function computeRisk(device: Device): { score: number; level: RiskLevel } {
  let score = 10;

  const lastTs = Date.parse(device.lastHeartbeat);
  const lastAgeMin =
    !Number.isNaN(lastTs) && lastTs ? Math.round((Date.now() - lastTs) / 60000) : null;

  if (!device.online) score += 40;
  if (device.simChangedRecently) score += 30;
  if (device.airplaneMode) score += 20;
  if (lastAgeMin != null && lastAgeMin > 10) score += 15;
  if (device.battery != null && device.battery < 20) score += 10;

  score = Math.min(score, 100);

  let level: RiskLevel = "NORMAL";
  if (score >= 80) level = "CRITICAL";
  else if (score >= 50) level = "HIGH";
  else if (score >= 25) level = "MODERATE";

  return { score, level };
}

function getDeviceIcon(d: Device, isSelected: boolean, focusMode: boolean): any {
  if (!Leaflet) return undefined;

  const { level } = computeRisk(d);

  let mainColor = "#22c55e";
  let glowColor = "rgba(34,197,94,0.45)";

  if (level === "CRITICAL") {
    mainColor = "#ef4444";
    glowColor = "rgba(239,68,68,0.6)";
  } else if (level === "HIGH") {
    mainColor = "#f59e0b";
    glowColor = "rgba(245,158,11,0.55)";
  } else if (!d.online) {
    mainColor = "#64748b";
    glowColor = "rgba(148,163,184,0.4)";
  }

  const borderColor = isSelected || focusMode ? "#22c55e" : "#0f172a";
  const size = isSelected || focusMode ? 40 : 30;

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;transform:translateY(-6px);">
      <div style="position:absolute;width:${size}px;height:${size}px;border-radius:999px;background:${glowColor};box-shadow:0 0 18px ${glowColor};opacity:${d.online ? "1" : "0.85"};"></div>
      <div style="position:relative;width:${size - 10}px;height:${size - 10}px;border-radius:999px;background:#020617;border:2px solid ${borderColor};box-shadow:0 8px 18px rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;color:${mainColor};font-size:11px;font-weight:600;">
        ${(d.category || "P").slice(0, 1)}
      </div>
    </div>
  `;

  return Leaflet.divIcon({
    className: "yarmotek-device-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function fitMapToDevices(map: any | null, devices: Device[]) {
  if (!map || !Leaflet) return;

  const points = devices
    .filter(hasValidPosition)
    .map((d) => [d.lat as number, d.lng as number] as [number, number]);

  if (points.length === 0) return;

  if (points.length === 1) {
    map.setView(points[0], Math.max(map.getZoom(), 15));
    return;
  }

  map.fitBounds(Leaflet.latLngBounds(points), { padding: [40, 40] });
}

function panMapToDevice(
  map: any | null,
  device: Device | null | undefined,
  opts?: { zoom?: number; smooth?: boolean },
) {
  if (!map || !device) return;
  if (!hasValidPosition(device)) return;

  const target: LatLngExpression = [device.lat as number, device.lng as number];
  const zoom = opts?.zoom ?? Math.max(map.getZoom(), 15);

  if (opts?.smooth === false) map.setView(target, zoom);
  else map.flyTo(target, zoom, { duration: 0.4 });
}

// -----------------------------
// Component
// -----------------------------
type AntiTheftDashboardProps = { initialRole?: RoleView };

export default function AntiTheftDashboard({ initialRole = "SUPER_ADMIN" }: AntiTheftDashboardProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("LIVE");

  const [deviceFilter, setDeviceFilter] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("PLAN");
  const [roleView, setRoleView] = useState<RoleView>(initialRole);

  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFocus, setHistoryFocus] = useState<HistoryPoint | null>(null);

  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const mapRef = useRef<any | null>(null);
  const [mapKey, setMapKey] = useState(0);

  // ✅ Leaflet init + marker icon fix
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;
      if (Leaflet) return;

      const L = await import("leaflet");
      if (cancelled) return;
      Leaflet = L;

      const [{ default: markerIcon2x }, { default: markerIcon }, { default: markerShadow }] =
        await Promise.all([
          import("leaflet/dist/images/marker-icon-2x.png"),
          import("leaflet/dist/images/marker-icon.png"),
          import("leaflet/dist/images/marker-shadow.png"),
        ]);

      // @ts-ignore
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: (markerIcon2x as any).src ?? markerIcon2x,
        iconUrl: (markerIcon as any).src ?? markerIcon,
        shadowUrl: (markerShadow as any).src ?? markerShadow,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Load devices + polling 15s
  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const fetchDevices = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/admin/devices", { method: "GET", cache: "no-store" });
        const json = (await res.json()) as DevicesResponse;

        if (!res.ok) throw new Error(json?.error ?? `Erreur API devices (HTTP ${res.status})`);
        if (json.ok === false) throw new Error(json.error ?? "L’API devices a retourné une erreur.");

        const rawList = json.items ?? json.devices ?? [];
        const normalized = (rawList ?? []).map((r) => normalizeDevice(r));

        if (!cancelled) {
          const nowMs = Date.now();
          const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

          const freshList = normalized.filter((d) => {
            const t = Date.parse(d.lastHeartbeat);
            if (!t || Number.isNaN(t)) return false;
            return nowMs - t <= FRESH_WINDOW_MS;
          });

          setDevices(freshList);
          setSelectedDeviceId((prev) => {
            if (!prev && freshList.length > 0) return freshList[0].deviceId;
            if (prev && !freshList.some((d) => d.deviceId === prev)) {
              return freshList.length > 0 ? freshList[0].deviceId : null;
            }
            return prev;
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur lors du chargement des devices.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchDevices();
    interval = window.setInterval(fetchDevices, 15_000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, []);

  // ✅ Load history 24h for selected device (poll 60s)
  useEffect(() => {
    if (!selectedDeviceId) {
      setHistoryPoints([]);
      setHistoryFocus(null);
      setPlaybackPlaying(false);
      setPlaybackIndex(0);
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const url = `${DEVICE_HISTORY_API}?deviceId=${encodeURIComponent(
          selectedDeviceId,
        )}&since=${encodeURIComponent(since)}`;

        const res = await fetch(url, { method: "GET", cache: "no-store" });
        const json = await res.json();

        if (!json?.ok) {
          if (!cancelled) {
            setHistoryPoints([]);
            setHistoryFocus(null);
            setPlaybackPlaying(false);
            setPlaybackIndex(0);
          }
          return;
        }

        const items = (json.items ?? []) as HistoryPoint[];
        if (!cancelled) {
          setHistoryPoints(items);
          setPlaybackPlaying(false);
          setPlaybackIndex(0);
        }
      } catch {
        if (!cancelled) {
          setHistoryPoints([]);
          setHistoryFocus(null);
          setPlaybackPlaying(false);
          setPlaybackIndex(0);
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void fetchHistory();
    interval = window.setInterval(fetchHistory, 60_000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [selectedDeviceId]);

  const selected = useMemo(
    () => devices.find((d) => d.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const scopedDevices = useMemo(() => {
    if (roleView === "SUPER_ADMIN") return devices;
    if (!selected) return devices;

    if (roleView === "CLIENT") {
      const cid = selected.clientId;
      if (!cid) return devices;
      return devices.filter((d) => d.clientId === cid);
    }
    if (roleView === "RESELLER") {
      const rid = selected.resellerId;
      if (!rid) return devices;
      return devices.filter((d) => d.resellerId === rid);
    }
    return devices;
  }, [devices, roleView, selected]);

  const scopedDevicesWithPosition = useMemo(
    () => scopedDevices.filter(hasValidPosition),
    [scopedDevices],
  );
  const scopedDevicesWithoutPosition = scopedDevices.length - scopedDevicesWithPosition.length;

  const filteredDevices = useMemo(() => {
    const q = deviceFilter.trim().toLowerCase();
    if (!q) return scopedDevices;
    return scopedDevices.filter((d) => {
      const fields = [d.name, d.clientName, d.clientId, d.clientPhone, d.deviceId];
      return fields
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [scopedDevices, deviceFilter]);

  const mapDevices = useMemo(() => {
    const q = deviceFilter.trim();
    if (!q) return scopedDevicesWithPosition;

    const ids = new Set(filteredDevices.filter(hasValidPosition).map((d) => d.deviceId));
    const base = scopedDevicesWithPosition.filter((d) => ids.has(d.deviceId));
    const extra = selected && hasValidPosition(selected) && !ids.has(selected.deviceId) ? [selected] : [];
    return [...base, ...extra];
  }, [scopedDevicesWithPosition, filteredDevices, selected, deviceFilter]);

  const initialCenter: LatLngExpression = useMemo(() => {
    if (selected && hasValidPosition(selected)) return [selected.lat as number, selected.lng as number];
    const first = scopedDevicesWithPosition[0];
    if (first) return [first.lat as number, first.lng as number];
    return [12.35, -1.52];
  }, [selected, scopedDevicesWithPosition]);

  const orderedHistoryPoints = useMemo(() => {
    if (!historyPoints?.length) return [];
    return [...historyPoints].sort(
      (a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime(),
    );
  }, [historyPoints]);

  const historyPath: LatLngExpression[] = useMemo(() => {
    if (!orderedHistoryPoints.length) return [];
    return orderedHistoryPoints.filter(hasValidPosition).map((p) => [p.lat as number, p.lng as number]);
  }, [orderedHistoryPoints]);

  const totalOnline = scopedDevices.filter((d) => d.online).length;
  const filterActive = deviceFilter.trim().length > 0;

  // ▶ Playback timeline
  useEffect(() => {
    if (!playbackPlaying || orderedHistoryPoints.length === 0) return;

    const interval = window.setInterval(() => {
      setPlaybackIndex((prev) => {
        const next = (prev + 1) % Math.max(orderedHistoryPoints.length, 1);
        const point = orderedHistoryPoints[next];
        if (point) setHistoryFocus(point);
        return next;
      });
    }, 1200);

    return () => window.clearInterval(interval);
  }, [playbackPlaying, orderedHistoryPoints]);

  // map recenter on historyFocus
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (historyFocus && hasValidPosition(historyFocus)) {
      map.flyTo([historyFocus.lat as number, historyFocus.lng as number], Math.max(map.getZoom(), 17), {
        duration: 0.6,
      });
    }
  }, [historyFocus]);

  // map recenter on selected changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (historyFocus) return;

    const currentSelected = devices.find((d) => d.deviceId === selectedDeviceId) ?? null;
    if (currentSelected && hasValidPosition(currentSelected)) {
      panMapToDevice(map, currentSelected, { zoom: focusMode ? 17 : 15, smooth: true });
    } else if (scopedDevicesWithPosition.length > 0) {
      fitMapToDevices(map, scopedDevicesWithPosition);
    }
  }, [selectedDeviceId, devices, focusMode, historyFocus, scopedDevicesWithPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();

      const currentSelected = devices.find((d) => d.deviceId === selectedDeviceId) ?? null;
      if (currentSelected && hasValidPosition(currentSelected)) {
        panMapToDevice(map, currentSelected, { zoom: focusMode ? 17 : 15, smooth: true });
      } else if (scopedDevicesWithPosition.length > 0) {
        fitMapToDevices(map, scopedDevicesWithPosition);
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [focusMode, devices, selectedDeviceId, scopedDevicesWithPosition]);

  const mapWrapperClass = focusMode
    ? "relative flex min-h-0 flex-1 rounded-2xl border-2 border-emerald-500/80 bg-slate-950/95 shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
    : "relative flex min-h-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 shadow-[0_20px_45px_rgba(0,0,0,0.7)]";

  const roleLabelShort =
    roleView === "SUPER_ADMIN" ? "Admin" : roleView === "RESELLER" ? "Revendeurs" : "Clients";

  const currentPlaybackPoint =
    orderedHistoryPoints[Math.min(playbackIndex, Math.max(orderedHistoryPoints.length - 1, 0))];

  return (
    <div className="relative flex h-[calc(100vh-80px)] flex-col gap-4 bg-slate-950/95 px-4 pb-4 pt-2 text-slate-100">
      {/* Header */}
      <div className="relative z-40 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-lg shadow-black/40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Yarmotek GuardCloud • <span className="text-emerald-400">Command Center</span>
          </h1>
          <p className="text-xs text-slate-400">
            Poursuite en temps quasi réel des smartphones SahelGuard : localisation, géofencing,
            commandes antivol et diagnostics avancés.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <Link
            href="/reseller/tokens"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-emerald-400"
          >
            Espace revendeur
          </Link>

          <Link
            href="/client/activate"
            className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/20"
          >
            Activer une licence
          </Link>

          <Link
            href="/admin/tokens"
            className="rounded-full border border-sky-500/70 bg-sky-500/10 px-3 py-1 text-xs text-sky-100 hover:bg-sky-500/20"
          >
            Gestion tokens (Admin)
          </Link>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            <span className={`mr-2 inline-flex h-2 w-2 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-400"}`} />
            {loading ? "Mise à jour…" : "Live connecté"}
          </div>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            Devices récents (48h)&nbsp;: <span className="font-semibold">{scopedDevices.length}</span>
          </div>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            En ligne&nbsp;: <span className="font-semibold text-emerald-400">{totalOnline}</span>
          </div>

          <div className="rounded-full bg-slate-900 px-3 py-1">
            Localisés sur carte&nbsp;:{" "}
            <span className="font-semibold">{scopedDevicesWithPosition.length}</span>
          </div>

          {scopedDevicesWithoutPosition > 0 && (
            <div className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-amber-200">
              {scopedDevicesWithoutPosition} appareil(s) sans position (API)
            </div>
          )}

          {/* Role toggle */}
          <div className="flex items-center rounded-full bg-slate-900 px-1 py-1 text-[11px]">
            {(["SUPER_ADMIN", "RESELLER", "CLIENT"] as RoleView[]).map((role) => {
              const label = role === "SUPER_ADMIN" ? "Admin" : role === "RESELLER" ? "Revendeurs" : "Clients";
              const active = roleView === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleView(role)}
                  className={`rounded-full px-2 py-0.5 transition ${
                    active ? "bg-emerald-500/20 text-emerald-200" : "text-slate-400 hover:text-emerald-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Map mode */}
          <div className="flex items-center rounded-full bg-slate-900 px-1 py-1 text-[11px]">
            <button
              type="button"
              onClick={() => setMapMode("PLAN")}
              className={`rounded-full px-2 py-0.5 transition ${
                mapMode === "PLAN" ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Plan
            </button>
            <button
              type="button"
              onClick={() => setMapMode("SATELLITE")}
              className={`rounded-full px-2 py-0.5 transition ${
                mapMode === "SATELLITE" ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Focus */}
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              setFocusMode((v) => !v);
              setMapKey((k) => k + 1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              focusMode
                ? "border border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                : "border border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400"
            } disabled:opacity-40`}
          >
            {focusMode ? "Quitter vue Focus" : "Vue Focus device"}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="relative z-40 flex min-h-0 flex-1 gap-4">
        {/* Device list */}
        <div
          className={`flex w-72 flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.55)] ${
            focusMode ? "hidden" : ""
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Appareils (48h) • {roleLabelShort}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
              Sélectionne pour piloter
            </span>
          </div>

          <div className="mb-2">
            <input
              type="text"
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              placeholder="Filtrer par nom, client ou ID…"
              className="w-full rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            {filterActive && (
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>{filteredDevices.length} appareil(s) trouvé(s)</span>
                <button
                  type="button"
                  onClick={() => setDeviceFilter("")}
                  className="text-emerald-400 hover:underline"
                >
                  Réinitialiser
                </button>
              </div>
            )}
          </div>

          <div className="max-h-full flex-1 overflow-y-auto pr-1">
            {filteredDevices.map((d) => {
              const isSelected = d.deviceId === selectedDeviceId;
              const last = Date.parse(d.lastHeartbeat);
              const ageMin =
                !Number.isNaN(last) && last ? Math.round((Date.now() - last) / 60000) : null;
              const ageLabel =
                ageMin != null && ageMin >= 0 ? (ageMin === 0 ? "à l’instant" : `il y a ${ageMin} min`) : "";

              const hasPos = hasValidPosition(d);

              return (
                <button
                  key={d.deviceId}
                  type="button"
                  onClick={() => {
                    setSelectedDeviceId(d.deviceId);
                    setHistoryFocus(null);
                    setPlaybackPlaying(false);
                    setPlaybackIndex(0);

                    const map = mapRef.current;
                    if (map && hasPos) {
                      panMapToDevice(map, d, { zoom: focusMode ? 17 : 15, smooth: true });
                    }
                  }}
                  className={`mb-2 w-full rounded-xl border px-3 py-2 text-left shadow-sm transition ${
                    isSelected
                      ? "border-emerald-400 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900"
                      : "border-slate-800 bg-slate-900/60 hover:border-emerald-500/60 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold">{d.name || d.deviceId.slice(-6)}</span>
                      <span className="text-[10px] text-slate-400">{d.clientName || "Client N/A"}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                          d.online ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${d.online ? "bg-emerald-400" : "bg-slate-500"}`} />
                        {d.online ? "Online" : "Offline"}
                      </span>
                      {ageLabel && <span className="text-[9px] text-slate-500">{ageLabel}</span>}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {d.category}
                      {!hasPos && " · pas de position"}
                    </span>
                    <span>{d.battery != null ? `${d.battery}%` : "Batterie N/A"}</span>
                  </div>
                </button>
              );
            })}

            {filteredDevices.length === 0 && !loading && (
              <div className="mt-4 rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400">
                Aucun appareil ne correspond au filtre.
                <br />
                Modifie le texte ou réinitialise le filtre.
              </div>
            )}

            {scopedDevices.length === 0 && !loading && !filterActive && (
              <div className="mt-4 rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400">
                Aucun device récent dans cette vue ({roleLabelShort}). Envoie un heartbeat depuis SahelGuard (dans les 48
                dernières heures) pour le voir apparaître ici.
              </div>
            )}
          </div>
        </div>

        {/* Map + side panel */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Map */}
          <div className={mapWrapperClass}>
            <MapContainer
              key={mapKey}
              center={initialCenter}
              zoom={15}
              className="h-full w-full rounded-2xl"
              scrollWheelZoom
              ref={(map: any | null) => {
                mapRef.current = map;
              }}
              whenReady={() => {
                const map = mapRef.current;
                if (map) setTimeout(() => map.invalidateSize(), 50);
              }}
            >
              <TileLayer
                attribution={
                  mapMode === "PLAN"
                    ? "&copy; OpenStreetMap contributors"
                    : "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                }
                url={
                  mapMode === "PLAN"
                    ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    : "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                }
              />

              {historyPath.length > 1 && <Polyline positions={historyPath} />}

              {(focusMode && selected && hasValidPosition(selected) ? [selected] : mapDevices)
                .filter(hasValidPosition)
                .map((d) => {
                  const isSel = selected?.deviceId === d.deviceId;
                  const icon = getDeviceIcon(d, isSel, focusMode);

                  return (
                    <Fragment key={d.deviceId}>
                      <Marker
                        position={[d.lat as number, d.lng as number]}
                        icon={icon}
                        eventHandlers={{
                          click: () => {
                            setSelectedDeviceId(d.deviceId);
                            setHistoryFocus(null);
                            setPlaybackPlaying(false);
                            setPlaybackIndex(0);

                            const map = mapRef.current;
                            if (map) panMapToDevice(map, d, { zoom: focusMode ? 17 : 15, smooth: true });
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">{d.name || d.deviceId}</div>
                            <div className="text-slate-500">{d.clientName || "Client N/A"}</div>
                            <div className="mt-1">
                              Dernier heartbeat : {new Date(d.lastHeartbeat).toLocaleString()}
                            </div>
                            {d.battery != null && <div>Batterie : {d.battery}%</div>}
                            <div>Réseau : {d.networkType || "?"}</div>
                          </div>
                        </Popup>
                      </Marker>

                      {typeof d.accuracy_m === "number" && d.accuracy_m > 0 && (
                        <Circle
                          center={[d.lat as number, d.lng as number]}
                          radius={d.accuracy_m}
                          pathOptions={{
                            color: "rgba(56,189,248,0.8)",
                            fillColor: "rgba(56,189,248,0.18)",
                            fillOpacity: 0.18,
                            weight: 1,
                          }}
                        />
                      )}
                    </Fragment>
                  );
                })}

              {historyFocus && hasValidPosition(historyFocus) && (
                <Fragment>
                  <Marker position={[historyFocus.lat as number, historyFocus.lng as number]}>
                    <Popup>
                      <div className="text-xs">
                        <div className="font-semibold">Position historique</div>
                        <div>{new Date(historyFocus.timestampIso).toLocaleString()}</div>
                        {typeof historyFocus.accuracy_m === "number" && (
                          <div>Précision&nbsp;: ±{Math.round(historyFocus.accuracy_m)} m</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>

                  {typeof historyFocus.accuracy_m === "number" && historyFocus.accuracy_m > 0 && (
                    <Circle
                      center={[historyFocus.lat as number, historyFocus.lng as number]}
                      radius={historyFocus.accuracy_m}
                      pathOptions={{
                        color: "rgba(251,191,36,0.9)",
                        fillColor: "rgba(251,191,36,0.22)",
                        fillOpacity: 0.22,
                        weight: 1,
                      }}
                    />
                  )}
                </Fragment>
              )}
            </MapContainer>

            {/* Top-left HUD */}
            <div className="pointer-events-none absolute left-3 top-3 z-50 flex flex-col gap-2 text-[11px]">
              <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-slate-900/90 px-4 py-1 shadow-lg shadow-black/40">
                <span className="font-semibold text-emerald-300">Phones SahelGuard : {scopedDevices.length}</span>
                <span className="text-slate-300">
                  En ligne : <span className="font-semibold text-emerald-400">{totalOnline}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const map = mapRef.current;
                    if (!map) return;
                    fitMapToDevices(map, scopedDevicesWithPosition);
                  }}
                  className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
                >
                  Rafraîchir vue
                </button>
              </div>

              {historyLoading && (
                <div className="pointer-events-auto inline-flex rounded-full bg-slate-900/85 px-3 py-1 text-[11px] text-slate-200 shadow-md shadow-black/30">
                  Mise à jour du trajet…
                </div>
              )}
            </div>

            {/* Focus banner */}
            {focusMode && selected && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-emerald-600/25 px-4 py-1 text-[11px] text-emerald-100 backdrop-blur">
                🎯 Mode poursuite : <span className="font-semibold">{selected.name || selected.deviceId}</span>
              </div>
            )}

            {/* Timeline */}
            {orderedHistoryPoints.length > 1 && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-50 flex items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-[11px] text-slate-100 shadow-lg shadow-black/40">
                <button
                  type="button"
                  onClick={() => {
                    const next = !playbackPlaying;
                    setPlaybackPlaying(next);
                    if (next && orderedHistoryPoints.length > 0) {
                      setPlaybackIndex(0);
                      setHistoryFocus(orderedHistoryPoints[0]);
                    }
                  }}
                  className="pointer-events-auto rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold hover:bg-slate-700"
                >
                  {playbackPlaying ? "⏸ Pause trajet" : "▶ Rejouer trajet"}
                </button>

                <div className="pointer-events-none flex items-center gap-2">
                  <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-700/70">
                    <div
                      className="h-full bg-emerald-400"
                      style={{
                        width: `${
                          orderedHistoryPoints.length > 0
                            ? Math.round(((playbackIndex + 1) / orderedHistoryPoints.length) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  {currentPlaybackPoint && (
                    <span className="text-[10px] text-slate-300">
                      {new Date(currentPlaybackPoint.timestampIso).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Center button */}
            {selected && hasValidPosition(selected) && (
              <div className="pointer-events-none absolute bottom-3 right-3 z-50">
                <button
                  type="button"
                  onClick={() => {
                    const map = mapRef.current;
                    if (!map) return;
                    panMapToDevice(map, selected, { zoom: focusMode ? 17 : 15, smooth: true });
                  }}
                  className="pointer-events-auto rounded-full bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-100 shadow-lg shadow-black/40 hover:bg-slate-800"
                >
                  🎯 Centrer sur <span className="font-semibold">{selected.name || selected.deviceId.slice(-6)}</span>
                </button>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div
            className={`flex w-[420px] flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs shadow-[0_20px_45px_rgba(0,0,0,0.7)] ${
              focusMode ? "hidden" : ""
            }`}
          >
            <div className="mb-2 flex rounded-full bg-slate-900/80 p-1 text-[11px]">
              <button
                type="button"
                className={`flex-1 rounded-full px-2 py-1 transition ${
                  tab === "LIVE"
                    ? "bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-slate-50"
                    : "text-slate-400"
                }`}
                onClick={() => setTab("LIVE")}
              >
                Vue en direct
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-2 py-1 transition ${
                  tab === "HISTORY"
                    ? "bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-slate-50"
                    : "text-slate-400"
                }`}
                onClick={() => setTab("HISTORY")}
              >
                Historique
              </button>
            </div>

            {tab === "LIVE" && <LivePanel device={selected} error={error} />}
            {tab === "HISTORY" && (
              <DeviceHistoryPanel
                deviceId={selected?.deviceId ?? null}
                historyPoints={orderedHistoryPoints}
                onSelectPoint={(p) => {
                  setHistoryFocus(p);
                  setPlaybackPlaying(false);
                  const idx = orderedHistoryPoints.findIndex((h) => h.timestampIso === p.timestampIso);
                  if (idx >= 0) setPlaybackIndex(idx);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// LIVE PANEL
// -----------------------------
function LivePanel({ device, error }: { device: Device | null; error: string | null }) {
  const [actionLoading, setActionLoading] = useState<CommandAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);

  const pushLog = (entry: CommandLogEntry) => {
    setCommandLog((prev) => [entry, ...prev].slice(0, 6));
  };

  if (!device) {
    return (
      <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-300">
        Sélectionne un appareil dans la liste pour voir son statut en temps réel et envoyer des commandes anti-vol SahelGuard.
      </div>
    );
  }

  const lastTs = Date.parse(device.lastHeartbeat);
  const lastAgeMin =
    !Number.isNaN(lastTs) && lastTs ? Math.round((Date.now() - lastTs) / 60000) : null;

  const { score: risk, level: riskLevel } = computeRisk(device);

  const riskLabel =
    riskLevel === "CRITICAL" ? "Critique" : riskLevel === "HIGH" ? "Élevé" : riskLevel === "MODERATE" ? "Modéré" : "Normal";

  const riskColor =
    riskLevel === "CRITICAL"
      ? "from-red-500/30 to-red-600/20 border-red-500/70"
      : riskLevel === "HIGH"
      ? "from-amber-500/30 to-amber-600/20 border-amber-400/70"
      : riskLevel === "MODERATE"
      ? "from-emerald-500/20 to-emerald-600/10 border-emerald-400/70"
      : "from-emerald-500/15 to-emerald-600/5 border-emerald-300/60";

  const sendCommand = async (action: CommandAction) => {
    try {
      setActionLoading(action);
      setActionMessage(null);

      const res = await fetch("/api/admin/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          deviceId: device.deviceId,
          action,
          durationSec: action === "RING" ? 20 : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `Commande refusée (HTTP ${res.status})`);

      let msg = "";
      let label = "";

      switch (action) {
        case "RING":
          msg = "✅ Sonnerie envoyée au téléphone (20s).";
          label = "Faire sonner 20s";
          break;
        case "LOST_MODE":
          msg = "✅ Mode perdu / volé activé. Le message d’alerte s’affichera sur le téléphone.";
          label = "Mode perdu / volé";
          break;
        case "LOCK":
          msg = "✅ Commande de verrouillage envoyée. Le téléphone se bloquera au prochain heartbeat.";
          label = "Verrouillage écran (PIN admin)";
          break;
        case "LOCATION_ONCE":
          msg = "✅ Demande de localisation instantanée envoyée. La carte va se mettre à jour au prochain heartbeat.";
          label = "Localiser maintenant";
          break;
        case "LOCATION_STREAM":
          msg = "✅ Suivi intensif activé. Le téléphone enverra des positions régulières pendant l’alerte.";
          label = "Suivi intensif";
          break;
      }

      setActionMessage(msg);

      // ✅ TS clean (status union)
      const entryOk = {
        id: `${Date.now()}-${action}`,
        action,
        label,
        at: new Date().toLocaleTimeString(),
        status: "OK" as const,
      } satisfies CommandLogEntry;

      pushLog(entryOk);
    } catch (e: any) {
      const msg = `❌ Erreur envoi commande : ${e?.message ?? "erreur inconnue"}`;
      setActionMessage(msg);

      const entryErr = {
        id: `${Date.now()}-${action}`,
        action,
        label: action,
        at: new Date().toLocaleTimeString(),
        status: "ERROR" as const,
        details: e?.message,
      } satisfies CommandLogEntry;

      pushLog(entryErr);
    } finally {
      setActionLoading(null);
    }
  };

  const disableCommands = !device.online;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/85 p-3 text-xs text-slate-100">
      {error && <div className="rounded-xl bg-red-950/60 p-2 text-[11px] text-red-200">{error}</div>}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">SAHELGuard • Antivol</div>
          <div className="text-sm font-semibold">{device.name || device.deviceId}</div>
          <div className="text-[11px] text-slate-400">
            {device.clientName || "Client N/A"} · ID device : {device.deviceId.slice(-8)}
          </div>
        </div>
        <div className={`rounded-xl border bg-gradient-to-br px-3 py-2 text-right text-[11px] ${riskColor}`}>
          <div className="text-[10px] uppercase tracking-wide text-slate-200">Niveau de risque</div>
          <div className="text-xs font-semibold">{riskLabel}</div>
          <div className="text-[10px] text-slate-200/80">Score&nbsp;: {risk}/100</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoCard label="Statut" value={device.online ? "En ligne" : "Hors ligne"} accent={device.online ? "emerald" : "slate"} />
        <InfoCard
          label="Dernier heartbeat"
          value={
            lastAgeMin == null
              ? new Date(device.lastHeartbeat).toLocaleTimeString()
              : lastAgeMin === 0
              ? "à l’instant"
              : `il y a ${lastAgeMin} min`
          }
        />
        <InfoCard label="Batterie" value={device.battery != null ? `${device.battery}%` : "N/A"} />
        <InfoCard label="Réseau" value={device.networkType || "N/A"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoCard label="SIM opérateur" value={device.simOperator || "N/A"} />
        <InfoCard label="Pays SIM" value={device.simCountry || "N/A"} />
        <InfoCard label="SIM changée" value={device.simChangedRecently ? "OUI" : "Non"} />
        <InfoCard label="Mode avion" value={device.airplaneMode ? "Activé" : "Désactivé"} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Géofencing</div>
        <div className="text-xs text-slate-100">
          {device.currentZoneId ? `Zone actuelle : ${device.currentZoneId}` : "Zone actuelle : hors zone"}
        </div>
        {device.lastZoneEvent && (
          <div className="text-[11px] text-slate-400">
            Dernier évènement : {device.lastZoneEvent.type} {device.lastZoneEvent.zoneId} ·{" "}
            {new Date(device.lastZoneEvent.timestampIso).toLocaleString()}
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Commandes anti-vol</div>

        <button
          type="button"
          onClick={() => void sendCommand("RING")}
          disabled={actionLoading !== null || disableCommands}
          className="flex items-center justify-between gap-2 rounded-2xl border border-amber-400/70 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-slate-900 px-4 py-2 text-sm font-semibold text-amber-100 shadow-md shadow-amber-900/30 hover:from-amber-500/25 hover:via-amber-500/10 hover:to-slate-900 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">🔔 Faire sonner (20s)</span>
          {!device.online && <span className="text-[10px] text-amber-100/80">Device hors ligne</span>}
        </button>

        <button
          type="button"
          onClick={() => void sendCommand("LOST_MODE")}
          disabled={actionLoading !== null || disableCommands}
          className="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/80 bg-gradient-to-r from-rose-600/20 via-rose-500/10 to-slate-900 px-4 py-2 text-sm font-semibold text-rose-100 shadow-md shadow-rose-900/40 hover:from-rose-600/30 hover:via-rose-500/15 hover:to-slate-900 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">🚨 Activer mode perdu / volé</span>
          <span className="text-[10px] text-rose-100/80">Verrou + message d’alerte</span>
        </button>

        <button
          type="button"
          onClick={() => void sendCommand("LOCK")}
          disabled={actionLoading !== null || disableCommands}
          className="flex items-center justify-between gap-2 rounded-2xl border border-cyan-500/70 bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-slate-900 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-md shadow-cyan-900/40 hover:from-cyan-500/30 hover:via-cyan-500/15 hover:to-slate-900 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">🔒 Verrouiller écran (PIN admin)</span>
          <span className="text-[10px] text-cyan-100/80">Au prochain heartbeat</span>
        </button>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void sendCommand("LOCATION_ONCE")}
            disabled={actionLoading !== null || disableCommands}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            🎯 Localiser maintenant
          </button>

          <button
            type="button"
            onClick={() => void sendCommand("LOCATION_STREAM")}
            disabled={actionLoading !== null || disableCommands}
            className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/70 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            📡 Suivi intensif
          </button>
        </div>

        {actionMessage && <div className="mt-2 rounded-xl bg-slate-800/80 p-2 text-[11px] text-slate-100">{actionMessage}</div>}
      </div>

      <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="uppercase tracking-wide text-slate-500">Journal des commandes</span>
          <span className="text-[10px] text-slate-500">Dernières actions envoyées</span>
        </div>

        {commandLog.length === 0 ? (
          <div className="text-[11px] text-slate-500">Aucune commande envoyée pour cette session.</div>
        ) : (
          <ul className="space-y-1 text-[11px]">
            {commandLog.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-slate-900/90 px-2 py-1">
                <div>
                  <div className="font-medium text-slate-100">{c.label}</div>
                  <div className="text-[10px] text-slate-400">
                    {c.at}
                    {c.details ? ` • ${c.details}` : ""}
                  </div>
                </div>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                    c.status === "OK" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/20 text-red-200"
                  }`}
                >
                  {c.status === "OK" ? "OK" : "Erreur"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "slate" }) {
  const accentCls =
    accent === "emerald"
      ? "border-emerald-500/60 bg-gradient-to-br from-emerald-500/20 to-slate-950"
      : "border-slate-700 bg-slate-950";

  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] shadow-sm ${accentCls}`}>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xs text-slate-100">{value}</div>
    </div>
  );
}
