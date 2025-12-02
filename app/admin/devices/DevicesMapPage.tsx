'use client';

import React, {
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  Polygon,
} from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --------- Types ---------

type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'GPS' | 'IOT' | 'OTHER';
type Filter = 'ALL' | 'PHONE' | 'PC' | 'DRONE';
type HistoryShortcut = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST7';
type BaseLayer = 'MAP' | 'SATELLITE';

interface Device {
  deviceId: string;
  hardwareId?: string;
  clientId?: string | null;
  clientName?: string | null;
  deviceType: string;
  category?: DeviceCategory | string;
  lat: number | null;
  lng: number | null;
  battery?: number | null;
  wifiSsid?: string | null;
  ip?: string | null;
  networkType?: string | null;
  lastSeen?: string | null; // mappé depuis lastHeartbeatAt / lastSeen
}

interface DeviceHistoryPoint {
  ts: string; // ISO
  lat: number | null;
  lng: number | null;
  battery?: number | null;
  networkType?: string | null;
  source?: string | null;
}

type GeofenceType = 'ALLOW' | 'FORBID';

interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  polygon: LatLngTuple[];
}

// --------- Config API ---------

const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

const DEVICES_ENDPOINT = '/map/devices';
const HISTORY_ENDPOINT = '/device/history';

// --------- Icônes ---------

const blueIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const orangeIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const violetIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// marqueur spécial pour le replay
const replayIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// --------- Géofences (exemples Ouaga) ---------

const GEOFENCES: Geofence[] = [
  {
    id: 'AEROLAB',
    name: 'Yarmotek AéroLab (zone autorisée)',
    type: 'ALLOW',
    polygon: [
      [12.2505, -1.5105],
      [12.2505, -1.4995],
      [12.2595, -1.4995],
      [12.2595, -1.5105],
    ],
  },
  {
    id: 'ZONE_ROUGE_1',
    name: 'Zone rouge - sensible',
    type: 'FORBID',
    polygon: [
      [12.365, -1.54],
      [12.365, -1.528],
      [12.373, -1.528],
      [12.373, -1.54],
    ],
  },
];

// --------- Utils ---------

function getLogicalCategory(d: Device): DeviceCategory {
  if (d.category) {
    const c = d.category.toString().toUpperCase();
    if (c === 'PHONE') return 'PHONE';
    if (c === 'PC') return 'PC';
    if (c === 'DRONE') return 'DRONE';
    if (c === 'GPS') return 'GPS';
    if (c === 'IOT') return 'IOT';
  }

  const t = (d.deviceType || '').toUpperCase();
  if (t.startsWith('DRONE')) return 'DRONE';
  if (t.startsWith('PHONE')) return 'PHONE';
  if (t.startsWith('PC')) return 'PC';
  if (t.startsWith('GPS')) return 'GPS';
  if (t.startsWith('IOT')) return 'IOT';

  return 'OTHER';
}

function isDeviceOnline(d: Device, nowTs: number): boolean {
  if (!d.lastSeen) return true;
  const t = Date.parse(d.lastSeen);
  if (Number.isNaN(t)) return true;
  const diffMs = nowTs - t;
  const diffMin = diffMs / 60000;
  return diffMin <= 30;
}

function getIconForDevice(d: Device, nowTs: number): L.Icon {
  const online = isDeviceOnline(d, nowTs);
  const cat = getLogicalCategory(d);
  const battery = d.battery ?? 100;

  if (!online) return violetIcon;
  if (battery <= 20) return redIcon;

  if (cat === 'PHONE') return blueIcon;
  if (cat === 'PC') return orangeIcon;

  return blueIcon;
}

function formatDateTime(d?: string | null): string {
  if (!d) return '–';
  const ts = Date.parse(d);
  if (Number.isNaN(ts)) return d;
  return new Date(ts).toLocaleString('fr-FR');
}

function matchHistoryShortcut(ts: string, shortcut: HistoryShortcut): boolean {
  if (shortcut === 'ALL') return true;

  const d = new Date(ts);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const startOf7DaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6,
  );

  if (shortcut === 'TODAY') {
    return d >= startOfToday;
  }
  if (shortcut === 'YESTERDAY') {
    return d >= startOfYesterday && d < startOfToday;
  }
  if (shortcut === 'LAST7') {
    return d >= startOf7DaysAgo;
  }
  return true;
}

function matchDateRange(ts: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const d = new Date(ts);
  if (from) {
    const [y, m, day] = from.split('-').map(Number);
    const fromDate = new Date(y, m - 1, day);
    if (d < fromDate) return false;
  }
  if (to) {
    const [y, m, day] = to.split('-').map(Number);
    const toDateEnd = new Date(y, m - 1, day + 1);
    if (d >= toDateEnd) return false;
  }
  return true;
}

function triggerDownload(filename: string, content: string, mime: string) {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // silencieux
  }
}

function buildGpx(points: DeviceHistoryPoint[], deviceId: string): string {
  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Yarmotek GuardCloud" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    `<trk><name>${deviceId}</name><trkseg>\n`;

  const body = points
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const time = p.ts;
      return `<trkpt lat="${p.lat}" lon="${p.lng}"><time>${time}</time></trkpt>`;
    })
    .join('\n');

  const footer = '\n</trkseg></trk></gpx>';
  return header + body + footer;
}

function buildKml(points: DeviceHistoryPoint[], deviceId: string): string {
  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
    '<Document>\n' +
    `<name>${deviceId}</name>\n` +
    '<Placemark>\n' +
    `<name>Trajet ${deviceId}</name>\n` +
    '<LineString>\n<coordinates>\n';

  const body = points
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => `${p.lng},${p.lat},0`)
    .join('\n');

  const footer =
    '\n</coordinates>\n</LineString>\n</Placemark>\n</Document>\n</kml>';
  return header + body + footer;
}

// point in polygon (ray casting)
function isPointInPolygon(
  point: LatLngTuple,
  polygon: LatLngTuple[],
): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const denom = yj - yi || 1e-9;
    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// --------- Animated Marker ---------

interface AnimatedMarkerProps {
  device: Device;
  icon: L.Icon;
  onClick: () => void;
  children?: ReactNode;
}

const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({
  device,
  icon,
  onClick,
  children,
}) => {
  const [position, setPosition] = useState<LatLngTuple | null>(() =>
    device.lat != null && device.lng != null
      ? [device.lat, device.lng]
      : null,
  );
  const [lastTarget, setLastTarget] = useState<LatLngTuple | null>(() =>
    device.lat != null && device.lng != null
      ? [device.lat, device.lng]
      : null,
  );

  useEffect(() => {
    if (device.lat == null || device.lng == null) return;
    const target: LatLngTuple = [device.lat, device.lng];

    if (!lastTarget) {
      setPosition(target);
      setLastTarget(target);
      return;
    }

    const [startLat, startLng] = lastTarget;
    const [endLat, endLng] = target;

    if (startLat === endLat && startLng === endLng) return;

    setLastTarget(target);

    const duration = 600;
    const startTime = performance.now();
    let frameId: number;

    const animate = (time: number) => {
      const t = Math.min(1, (time - startTime) / duration);
      const eased = t * (2 - t); // easeOutQuad
      const lat = startLat + (endLat - startLat) * eased;
      const lng = startLng + (endLng - startLng) * eased;
      setPosition([lat, lng]);
      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.lat, device.lng]);

  if (!position) return null;

  return (
    <Marker position={position} icon={icon} eventHandlers={{ click: onClick }}>
      {children}
    </Marker>
  );
};

// --------- Composant principal ---------

const DevicesMapPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState<string>('');
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('MAP');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // temps courant pour calcul ONLINE (évite Date.now dans le render)
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Historique brut du device sélectionné
  const [history, setHistory] = useState<DeviceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [historyShortcut, setHistoryShortcut] =
    useState<HistoryShortcut>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [fullscreenReplay, setFullscreenReplay] = useState(false);

  const defaultCenter: LatLngTuple = [12.3657, -1.5339];

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE}${DEVICES_ENDPOINT}?apiKey=YGC-ADMIN`;
      const res = await fetch(url);
      const data = (await res.json()) as unknown;

      if (!res.ok) {
        setError(`Erreur HTTP ${res.status}`);
        return;
      }

      let rawDevices: unknown[] = [];
      if (
        typeof data === 'object' &&
        data !== null &&
        Array.isArray((data as { devices?: unknown }).devices)
      ) {
        rawDevices = (data as { devices?: unknown[] }).devices ?? [];
      } else if (Array.isArray(data)) {
        rawDevices = data as unknown[];
      }

      const mapped: Device[] = rawDevices.map((raw) => {
        const r = raw as Record<string, unknown>;

        const lastSeen: string | null =
          (r.lastHeartbeatAt as string | undefined) ??
          (r.lastSeen as string | undefined) ??
          null;

        const rawLat = r.lat;
        const rawLng = r.lng;

        const lat =
          typeof rawLat === 'number'
            ? rawLat
            : rawLat != null
            ? Number(rawLat)
            : null;

        const lng =
          typeof rawLng === 'number'
            ? rawLng
            : rawLng != null
            ? Number(rawLng)
            : null;

        const batteryRaw =
          r.battery ?? r.batteryLevel ?? r.battery_level ?? null;

        return {
          deviceId: String(r.deviceId ?? ''),
          hardwareId:
            (r.hardwareId as string | undefined) ??
            (r.hardware_id as string | undefined),
          clientId:
            (r.clientId as string | undefined) ??
            (r.client_id as string | undefined) ??
            null,
          clientName:
            (r.clientName as string | undefined) ??
            (r.client_name as string | undefined) ??
            null,
          deviceType:
            (r.deviceType as string | undefined) ??
            (r.device_type as string | undefined) ??
            'UNKNOWN',
          category:
            (r.category as string | undefined) ??
            (r.deviceCategory as string | undefined),
          lat,
          lng,
          battery:
            batteryRaw != null ? Number(batteryRaw as number | string) : null,
          wifiSsid:
            (r.wifiSsid as string | undefined) ??
            (r.ssid as string | undefined) ??
            null,
          ip: (r.ip as string | undefined) ?? null,
          networkType:
            (r.networkType as string | undefined) ??
            (r.network_type as string | undefined) ??
            null,
          lastSeen,
        };
      });

      setDevices(mapped);
      setLastRefresh(new Date());
    } catch (e) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (deviceId: string) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const url = `${API_BASE}${HISTORY_ENDPOINT}?deviceId=${encodeURIComponent(
        deviceId,
      )}&limit=200`;
      const res = await fetch(url);
      const data = (await res.json()) as unknown;

      if (!res.ok) {
        setHistoryError(`Erreur HTTP ${res.status}`);
        setHistory([]);
        return;
      }

      const arr: unknown[] = Array.isArray(
        (data as { history?: unknown[] }).history,
      )
        ? ((data as { history?: unknown[] }).history as unknown[])
        : [];

      const mapped: DeviceHistoryPoint[] = arr.map((h) => {
        const r = h as Record<string, unknown>;
        const rawLat = r.lat;
        const rawLng = r.lng;

        const lat =
          typeof rawLat === 'number'
            ? rawLat
            : rawLat != null
            ? Number(rawLat)
            : null;
        const lng =
          typeof rawLng === 'number'
            ? rawLng
            : rawLng != null
            ? Number(rawLng)
            : null;

        const batteryRaw =
          r.battery ?? r.batteryLevel ?? r.battery_level ?? null;

        return {
          ts: String(r.ts ?? r.timestamp ?? ''),
          lat,
          lng,
          battery:
            batteryRaw != null ? Number(batteryRaw as number | string) : null,
          networkType:
            (r.networkType as string | undefined) ??
            (r.network_type as string | undefined) ??
            null,
          source: (r.source as string | undefined) ?? null,
        };
      });

      setHistory(mapped);
      setPlayIndex(0);
      setIsPlaying(false);
    } catch (e) {
      const err = e as { message?: string };
      setHistoryError(err?.message ?? 'Erreur inconnue');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Auto-refresh via HTTP
  useEffect(() => {
    loadDevices();
    const t = window.setInterval(loadDevices, 5_000);
    return () => window.clearInterval(t);
  }, []);

  // Essai WebSocket temps réel
  useEffect(() => {
    try {
      const base = API_BASE.replace('https://', 'wss://').replace(
        'http://',
        'ws://',
      );
      const wsUrl = `${base}/ws/devices?apiKey=YGC-ADMIN`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;

          if (
            typeof payload === 'object' &&
            payload !== null &&
            'device' in payload
          ) {
            const d = (payload as { device: unknown }).device as Record<
              string,
              unknown
            >;

            setDevices((prev) => {
              const idx = prev.findIndex(
                (x) => x.deviceId === String(d.deviceId ?? ''),
              );
              if (idx === -1) return prev;
              const updated = [...prev];
              const existing = updated[idx];

              const lastSeen: string | null =
                (d.lastHeartbeatAt as string | undefined) ??
                (d.lastSeen as string | undefined) ??
                existing.lastSeen ??
                null;

              const latRaw = d.lat ?? existing.lat;
              const lngRaw = d.lng ?? existing.lng;

              const lat =
                typeof latRaw === 'number'
                  ? latRaw
                  : latRaw != null
                  ? Number(latRaw)
                  : existing.lat ?? null;
              const lng =
                typeof lngRaw === 'number'
                  ? lngRaw
                  : lngRaw != null
                  ? Number(lngRaw)
                  : existing.lng ?? null;

              updated[idx] = {
                ...existing,
                lat,
                lng,
                lastSeen,
              };
              return updated;
            });
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      return () => ws.close();
    } catch {
      return;
    }
  }, []);

  // Recharger l'historique quand on change de device
  useEffect(() => {
    if (selectedDevice?.deviceId) {
      loadHistory(selectedDevice.deviceId);
    } else {
      setHistory([]);
      setHistoryError(null);
      setIsPlaying(false);
      setPlayIndex(0);
    }
  }, [selectedDevice?.deviceId]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (d.lat == null || d.lng == null) return false;

      const cat = getLogicalCategory(d);
      if (filter === 'PHONE' && cat !== 'PHONE') return false;
      if (filter === 'PC' && cat !== 'PC') return false;
      if (filter === 'DRONE' && cat !== 'DRONE') return false;

      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const haystack = [
          d.clientName,
          d.clientId,
          d.deviceId,
          d.hardwareId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [devices, filter, search]);

  const filteredHistory: DeviceHistoryPoint[] = useMemo(() => {
    return history.filter((h) => {
      if (!h.ts) return false;
      if (!matchHistoryShortcut(h.ts, historyShortcut)) return false;
      if (!matchDateRange(h.ts, dateFrom || undefined, dateTo || undefined)) {
        return false;
      }
      return h.lat != null && h.lng != null;
    });
  }, [history, historyShortcut, dateFrom, dateTo]);

  const historyPolyline: LatLngTuple[] = useMemo(
    () =>
      filteredHistory.map(
        (h) => [h.lat as number, h.lng as number] as LatLngTuple,
      ),
    [filteredHistory],
  );

  const center = useMemo<LatLngTuple>(() => {
    const d =
      filteredDevices.find((x) => x.lat && x.lng) ??
      devices.find((x) => x.lat && x.lng);
    return d ? ([d.lat as number, d.lng as number] as LatLngTuple) : defaultCenter;
  }, [filteredDevices, devices]);

  const formatLastRefresh = () => {
    if (!lastRefresh) return '…';
    return lastRefresh.toLocaleTimeString('fr-FR');
  };

  // Replay animation
  useEffect(() => {
    if (!isPlaying || filteredHistory.length <= 1) return;

    const baseInterval = 800;
    const interval = baseInterval / (speedMultiplier || 1);

    const id = window.setInterval(() => {
      setPlayIndex((prev) => {
        const next = prev + 1;
        if (next >= filteredHistory.length) {
          setIsPlaying(false);
          return filteredHistory.length - 1;
        }
        return next;
      });
    }, interval);

    return () => window.clearInterval(id);
  }, [isPlaying, filteredHistory.length, speedMultiplier, filteredHistory]);

  useEffect(() => {
    setPlayIndex(0);
    setIsPlaying(false);
  }, [
    historyShortcut,
    dateFrom,
    dateTo,
    selectedDevice?.deviceId,
    history.length,
  ]);

  const currentReplayPoint =
    filteredHistory.length > 0
      ? filteredHistory[Math.min(playIndex, filteredHistory.length - 1)]
      : undefined;

  const handleExportGpx = () => {
    if (!selectedDevice || filteredHistory.length === 0) return;
    const gpx = buildGpx(filteredHistory, selectedDevice.deviceId);
    triggerDownload(`${selectedDevice.deviceId}.gpx`, gpx, 'application/gpx+xml');
  };

  const handleExportKml = () => {
    if (!selectedDevice || filteredHistory.length === 0) return;
    const kml = buildKml(filteredHistory, selectedDevice.deviceId);
    triggerDownload(
      `${selectedDevice.deviceId}.kml`,
      kml,
      'application/vnd.google-earth.kml+xml',
    );
  };

  const deviceGeofences: Geofence[] = useMemo(() => {
    if (
      !selectedDevice ||
      selectedDevice.lat == null ||
      selectedDevice.lng == null
    ) {
      return [];
    }
    const point: LatLngTuple = [
      selectedDevice.lat as number,
      selectedDevice.lng as number,
    ];
    return GEOFENCES.filter((g) => isPointInPolygon(point, g.polygon));
  }, [selectedDevice]);

  const tileUrl =
    baseLayer === 'MAP'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  // Heatmap “maison” = cercles pondérés
  const heatmapPoints = useMemo(
    () =>
      filteredDevices
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          lat: d.lat as number,
          lng: d.lng as number,
          intensity: isDeviceOnline(d, nowTs)
            ? 1
            : 0.4,
        })),
    [filteredDevices, nowTs],
  );

  return (
    <div className="w-full h-screen flex flex-col relative bg-slate-950 text-white">
      {/* Top bar branding */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 bg-slate-900" />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-slate-200">
                YARMOTEK <span className="text-amber-400">GUARDCLOUD</span>
              </span>
              <span className="text-[11px] text-slate-400">
                UNIVERSAL TRACKING • PHONES • PC • DRONES • GPS • IOT
              </span>
            </div>
          </div>

          <div className="ml-6 flex gap-3 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/60">
              Online:{' '}
              {
                devices.filter((d) => isDeviceOnline(d, nowTs))
                  .length
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              Phones:{' '}
              {
                devices.filter(
                  (d) => getLogicalCategory(d) === 'PHONE',
                ).length
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              PCs:{' '}
              {
                devices.filter((d) => getLogicalCategory(d) === 'PC')
                  .length
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              Drones:{' '}
              {
                devices.filter(
                  (d) => getLogicalCategory(d) === 'DRONE',
                ).length
              }
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Dernier refresh : {formatLastRefresh()}</span>
        </div>
      </div>

      {/* Filtres principaux */}
      <div className="px-6 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-full text-xs border ${
            filter === 'ALL'
              ? 'bg-amber-500 text-black border-amber-400'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilter('PHONE')}
          className={`px-3 py-1 rounded-full text-xs border ${
            filter === 'PHONE'
              ? 'bg-emerald-500 text-black border-emerald-400'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Phones
        </button>
        <button
          onClick={() => setFilter('PC')}
          className={`px-3 py-1 rounded-full text-xs border ${
            filter === 'PC'
              ? 'bg-sky-500 text-black border-sky-400'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          PCs
        </button>
        <button
          onClick={() => setFilter('DRONE')}
          className={`px-3 py-1 rounded-full text-xs border ${
            filter === 'DRONE'
              ? 'bg-fuchsia-500 text-black border-fuchsia-400'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Drones
        </button>

        <button
          onClick={loadDevices}
          className="ml-4 px-3 py-1 rounded-full text-xs bg-slate-200 text-slate-900 font-medium hover:bg-white transition"
        >
          Rafraîchir maintenant
        </button>

        {/* Recherche */}
        <div className="ml-4 flex items-center gap-2 flex-1 max-w-md">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, device ID, HW..."
            className="w-full rounded-full bg-slate-900 border border-slate-700 px-3 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-400/60"
          />
        </div>

        {/* Carte / satellite */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBaseLayer('MAP')}
            className={`px-3 py-1 rounded-full text-xs border ${
              baseLayer === 'MAP'
                ? 'bg-slate-200 text-slate-900 border-slate-100'
                : 'bg-slate-800 text-slate-100 border-slate-700'
            }`}
          >
            Carte
          </button>
          <button
            onClick={() => setBaseLayer('SATELLITE')}
            className={`px-3 py-1 rounded-full text-xs border ${
              baseLayer === 'SATELLITE'
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800 text-slate-100 border-slate-700'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Heatmap toggle (cercles d'intensité) */}
        <button
          onClick={() => setShowHeatmap((s) => !s)}
          className={`ml-3 px-3 py-1 rounded-full text-xs border ${
            showHeatmap
              ? 'bg-rose-500 text-black border-rose-300'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Heatmap
        </button>

        <div className="flex items-center gap-4 text-[11px] text-slate-400 ml-4">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            Phone
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            PC
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
            Drone
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            Batterie &lt;= 20%
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            Offline &gt; 30 min
          </div>
        </div>
      </div>

      {/* Messages haut */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded shadow z-40 text-sm">
          {error}
        </div>
      )}
      {loading && (
        <div className="absolute top-24 left-4 bg-slate-900 px-2 py-1 text-xs rounded shadow z-40 border border-slate-700">
          Chargement des appareils…
        </div>
      )}

      {/* Panel latéral */}
      {selectedDevice && (
        <div className="absolute top-[96px] right-0 w-80 h-[calc(100%-96px)] bg-slate-950/98 shadow-2xl z-30 p-4 overflow-y-auto border-l border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm text-slate-100">
              {selectedDevice.clientName ||
                selectedDevice.clientId ||
                selectedDevice.deviceId}
            </div>
            <button
              className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
              onClick={() => setSelectedDevice(null)}
            >
              Fermer
            </button>
          </div>

          {/* Fiche appareil */}
          <div className="text-[11px] space-y-1 mb-3">
            <div>
              <span className="text-slate-400">Device ID :</span>{' '}
              <span className="font-mono text-slate-100">
                {selectedDevice.deviceId}
              </span>
            </div>
            {selectedDevice.hardwareId && (
              <div>
                <span className="text-slate-400">Hardware :</span>{' '}
                <span className="font-mono text-slate-100">
                  {selectedDevice.hardwareId}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Type :</span>{' '}
              <span className="text-slate-100">
                {selectedDevice.deviceType}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Catégorie :</span>{' '}
              <span className="text-slate-100">
                {getLogicalCategory(selectedDevice)}
              </span>
            </div>
            {selectedDevice.battery != null && (
              <div>
                <span className="text-slate-400">Batterie :</span>{' '}
                <span className="text-slate-100">
                  {selectedDevice.battery} %
                </span>
              </div>
            )}
            {selectedDevice.wifiSsid && (
              <div>
                <span className="text-slate-400">Wi-Fi :</span>{' '}
                <span className="text-slate-100">
                  {selectedDevice.wifiSsid}
                </span>
              </div>
            )}
            {selectedDevice.ip && (
              <div>
                <span className="text-slate-400">IP :</span>{' '}
                <span className="text-slate-100">
                  {selectedDevice.ip}
                </span>
              </div>
            )}
            {selectedDevice.networkType && (
              <div>
                <span className="text-slate-400">Réseau :</span>{' '}
                <span className="text-slate-100">
                  {selectedDevice.networkType}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Dernier HB :</span>{' '}
              <span className="text-slate-100">
                {formatDateTime(selectedDevice.lastSeen)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Statut :</span>{' '}
              {isDeviceOnline(selectedDevice, nowTs) ? (
                <span className="text-emerald-400 font-semibold">
                  ✔ Online
                </span>
              ) : (
                <span className="text-violet-400 font-semibold">
                  ● Offline &gt; 30 min
                </span>
              )}
            </div>
            {selectedDevice.lat != null &&
              selectedDevice.lng != null && (
                <div>
                  <span className="text-slate-400">Position :</span>{' '}
                  <span className="text-slate-100">
                    {selectedDevice.lat.toFixed(5)},{" "}
                    {selectedDevice.lng.toFixed(5)}
                  </span>
                </div>
              )}

            {/* Info géofencing */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-slate-400">Zones :</span>{' '}
              {deviceGeofences.length === 0 && (
                <span className="text-slate-500">
                  Hors des géo-clôtures définies.
                </span>
              )}
              {deviceGeofences.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {deviceGeofences.map((g) => (
                    <li key={g.id}>
                      <span
                        className={
                          g.type === 'FORBID'
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }
                      >
                        ● {g.name}{' '}
                        {g.type === 'FORBID'
                          ? '(INTERDITE)'
                          : '(AUTORISÉE)'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Historique / replay / export */}
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-100">
                Historique des positions (max 200)
              </div>
              <button
                onClick={() => loadHistory(selectedDevice.deviceId)}
                className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
              >
                Recharger
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setHistoryShortcut('ALL')}
                className={`px-2 py-0.5 rounded-full text-[11px] border ${
                  historyShortcut === 'ALL'
                    ? 'bg-slate-200 text-slate-900 border-slate-100'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setHistoryShortcut('TODAY')}
                className={`px-2 py-0.5 rounded-full text-[11px] border ${
                  historyShortcut === 'TODAY'
                    ? 'bg-emerald-500 text-black border-emerald-300'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                Aujourd&apos;hui
              </button>
              <button
                onClick={() => setHistoryShortcut('YESTERDAY')}
                className={`px-2 py-0.5 rounded-full text-[11px] border ${
                  historyShortcut === 'YESTERDAY'
                    ? 'bg-amber-500 text-black border-amber-300'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                Hier
              </button>
              <button
                onClick={() => setHistoryShortcut('LAST7')}
                className={`px-2 py-0.5 rounded-full text-[11px] border ${
                  historyShortcut === 'LAST7'
                    ? 'bg-sky-500 text-black border-sky-300'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                7 jours
              </button>
            </div>

            <div className="flex flex-col gap-1 mb-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Du :</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Au :</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 text-[11px]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    filteredHistory.length > 0 &&
                    (setIsPlaying((p) => !p),
                    setPlayIndex((i) => (i === 0 ? 0 : i)))
                  }
                  disabled={filteredHistory.length === 0}
                  className={`px-2 py-1 rounded border ${
                    filteredHistory.length === 0
                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-emerald-600 text-black border-emerald-400'
                  }`}
                >
                  {isPlaying ? 'Pause' : 'Lire'}
                </button>
                <button
                  onClick={() => {
                    setPlayIndex(0);
                    setIsPlaying(false);
                  }}
                  disabled={filteredHistory.length === 0}
                  className={`px-2 py-1 rounded border ${
                    filteredHistory.length === 0
                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-200 border-slate-600'
                  }`}
                >
                  ⏮ Début
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 ml-2">
                <span className="text-slate-400">Vitesse</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={speedMultiplier}
                  onChange={(e) =>
                    setSpeedMultiplier(Number(e.target.value) || 1)
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 text-[11px]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportGpx}
                  disabled={filteredHistory.length === 0}
                  className={`px-2 py-1 rounded border ${
                    filteredHistory.length === 0
                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  Export GPX
                </button>
                <button
                  onClick={handleExportKml}
                  disabled={filteredHistory.length === 0}
                  className={`px-2 py-1 rounded border ${
                    filteredHistory.length === 0
                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  Export KML
                </button>
              </div>

              <button
                onClick={() =>
                  filteredHistory.length > 0 &&
                  setFullscreenReplay(true)
                }
                disabled={filteredHistory.length === 0}
                className={`px-2 py-1 rounded border text-[11px] ${
                  filteredHistory.length === 0
                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-900 border-slate-100'
                }`}
              >
                Plein écran
              </button>
            </div>

            {historyLoading && (
              <div className="text-[11px] text-slate-400 mb-1">
                Chargement de l&apos;historique…
              </div>
            )}
            {historyError && (
              <div className="text-[11px] text-red-400 mb-1">
                {historyError}
              </div>
            )}

            {filteredHistory.length === 0 &&
              !historyLoading &&
              !historyError && (
                <div className="text-[11px] text-slate-500">
                  Aucun point d&apos;historique pour les filtres choisis.
                </div>
              )}

            {filteredHistory.length > 0 && (
              <div className="text-[11px] text-slate-200 space-y-1 max-h-64 overflow-y-auto mt-1">
                {filteredHistory.map((h, idx) => (
                  <div
                    key={`${h.ts}-${idx}`}
                    className={`flex flex-col border-b border-slate-800/70 pb-1 ${
                      idx === playIndex ? 'bg-slate-800/40' : ''
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {formatDateTime(h.ts)}
                      </span>
                      {typeof h.battery === 'number' && (
                        <span
                          className={
                            h.battery <= 20
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }
                        >
                          🔋 {h.battery}%
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>
                        {h.lat != null && h.lng != null
                          ? `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}`
                          : 'Position inconnue'}
                      </span>
                      <span>
                        {h.networkType ? h.networkType : h.source || ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Carte principale */}
      <div className="flex-1">
        <MapContainer
          center={center}
          zoom={13}
          className="w-full h-full z-0"
        >
          <TileLayer attribution="© OpenStreetMap / ESRI" url={tileUrl} />

          {/* Heatmap maison (cercles) */}
          {showHeatmap &&
            heatmapPoints.map((p, idx) => (
              <CircleMarker
                key={`heat-${idx}`}
                center={[p.lat, p.lng]}
                radius={12}
                pathOptions={{
                  weight: 0,
                  fillOpacity: p.intensity === 1 ? 0.35 : 0.18,
                }}
              />
            ))}

          {/* Polyline historique */}
          {historyPolyline.length >= 2 && (
            <>
              <Polyline positions={historyPolyline} pathOptions={{ weight: 3 }} />
              {historyPolyline.map((pos, idx) => (
                <CircleMarker key={idx} center={pos} radius={3} />
              ))}
            </>
          )}

          {/* Marker replay courant */}
          {currentReplayPoint &&
            currentReplayPoint.lat != null &&
            currentReplayPoint.lng != null && (
              <Marker
                position={[
                  currentReplayPoint.lat as number,
                  currentReplayPoint.lng as number,
                ]}
                icon={replayIcon}
              />
            )}

          {/* Géofences */}
          {GEOFENCES.map((g) => (
            <Polygon
              key={g.id}
              positions={g.polygon}
              pathOptions={{
                color: g.type === 'FORBID' ? '#f97373' : '#22c55e',
                weight: 2,
                fillOpacity: 0.08,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold mb-1">{g.name}</div>
                  <div>
                    Type:{' '}
                    {g.type === 'FORBID'
                      ? 'Zone interdite'
                      : 'Zone autorisée'}
                  </div>
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Markers devices live (animated) */}
          {filteredDevices.map((d) => {
            if (d.lat == null || d.lng == null) return null;

            const title =
              d.clientName || d.clientId || d.deviceId || 'Appareil';

            return (
              <AnimatedMarker
                key={d.deviceId}
                device={d}
                icon={getIconForDevice(d, nowTs)}
                onClick={() => setSelectedDevice(d)}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-base mb-1">
                      {title}
                    </div>
                    <div>
                      <b>ID :</b> {d.deviceId}
                    </div>
                    {d.hardwareId && (
                      <div>
                        <b>HW :</b> {d.hardwareId}
                      </div>
                    )}
                    <div>
                      <b>Type :</b> {d.deviceType}
                    </div>
                    <div>
                      <b>Catégorie :</b> {getLogicalCategory(d)}
                    </div>
                    {d.battery != null && (
                      <div>
                        <b>Batterie :</b> {d.battery} %
                      </div>
                    )}
                    {d.wifiSsid && (
                      <div>
                        <b>Wi-Fi :</b> {d.wifiSsid}
                      </div>
                    )}
                    {d.ip && (
                      <div>
                        <b>IP :</b> {d.ip}
                      </div>
                    )}
                    {d.networkType && (
                      <div>
                        <b>Réseau :</b> {d.networkType}
                      </div>
                    )}
                    <div>
                      <b>Dernier HB :</b>{' '}
                      {formatDateTime(d.lastSeen)}
                    </div>
                    <div>
                      <b>Statut :</b>{' '}
                      {isDeviceOnline(d, nowTs)
                        ? '✅ Online'
                        : '🟣 Offline (>30 min)'}
                    </div>
                  </div>
                </Popup>
              </AnimatedMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Vue replay plein écran */}
      {fullscreenReplay && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <div className="text-sm font-semibold text-slate-100">
              🎬 Replay GuardCloud –{' '}
              {selectedDevice?.clientName ||
                selectedDevice?.deviceId ||
                'Appareil'}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={() =>
                  filteredHistory.length > 0 &&
                  setIsPlaying((p) => !p)
                }
                disabled={filteredHistory.length === 0}
                className={`px-3 py-1 rounded border ${
                  filteredHistory.length === 0
                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-emerald-500 text-black border-emerald-300'
                }`}
              >
                {isPlaying ? 'Pause' : 'Lire'}
              </button>
              <button
                onClick={() => {
                  setPlayIndex(0);
                  setIsPlaying(false);
                }}
                disabled={filteredHistory.length === 0}
                className={`px-3 py-1 rounded border ${
                  filteredHistory.length === 0
                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 text-slate-200 border-slate-600'
                }`}
              >
                ⏮ Début
              </button>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Vitesse</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={speedMultiplier}
                  onChange={(e) =>
                    setSpeedMultiplier(Number(e.target.value) || 1)
                  }
                />
              </div>
              <button
                onClick={() => setFullscreenReplay(false)}
                className="ml-2 px-3 py-1 rounded border bg-slate-800 text-slate-200 border-slate-600"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="flex-1">
            <MapContainer
              center={
                currentReplayPoint?.lat != null &&
                currentReplayPoint.lng != null
                  ? ([
                      currentReplayPoint.lat as number,
                      currentReplayPoint.lng as number,
                    ] as LatLngTuple)
                  : center
              }
              zoom={14}
              className="w-full h-full"
            >
              <TileLayer attribution="© OpenStreetMap / ESRI" url={tileUrl} />

              {historyPolyline.length >= 2 && (
                <>
                  <Polyline
                    positions={historyPolyline}
                    pathOptions={{ weight: 4 }}
                  />
                  {historyPolyline.map((pos, idx) => (
                    <CircleMarker
                      key={idx}
                      center={pos}
                      radius={4}
                    />
                  ))}
                </>
              )}

              {currentReplayPoint &&
                currentReplayPoint.lat != null &&
                currentReplayPoint.lng != null && (
                  <Marker
                    position={[
                      currentReplayPoint.lat as number,
                      currentReplayPoint.lng as number,
                    ]}
                    icon={replayIcon}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold mb-1">
                          Point #{playIndex + 1} /{' '}
                          {filteredHistory.length}
                        </div>
                        <div>{formatDateTime(currentReplayPoint.ts)}</div>
                        {typeof currentReplayPoint.battery ===
                          'number' && (
                          <div>
                            Batterie : {currentReplayPoint.battery}%
                          </div>
                        )}
                        {currentReplayPoint.networkType && (
                          <div>
                            Réseau : {currentReplayPoint.networkType}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesMapPage;
