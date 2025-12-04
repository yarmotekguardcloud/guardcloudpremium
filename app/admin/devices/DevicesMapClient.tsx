'use client';

import React, {
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
// @ts-ignore – plugin JS sans types
import 'leaflet.heat';
// @ts-ignore – on utilisera supercluster en any
import supercluster from 'supercluster';
import Image from 'next/image';

/* -----------------------------------------------------------
   TYPES
----------------------------------------------------------- */
type DeviceCategory = 'PHONE' | 'PC' | 'DRONE' | 'GPS' | 'IOT' | 'OTHER';
type Filter = 'ALL' | 'PHONE' | 'PC' | 'DRONE';
type HistoryShortcut = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST7';
type BaseLayer = 'MAP' | 'SATELLITE';

type DeviceStatus = 'ONLINE' | 'LOW' | 'OFFLINE';

interface Device {
  deviceId: string;
  hardwareId?: string;
  clientId?: string | null;
  clientName?: string | null;
  resellerId?: string | null;
  deviceType: string;
  category?: DeviceCategory | string;
  lat: number | null;
  lng: number | null;
  battery?: number | null;
  wifiSsid?: string | null;
  ip?: string | null;
  networkType?: string | null;
  lastSeen?: string | null;
}

interface DeviceHistoryPoint {
  ts: string;
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

/* -----------------------------------------------------------
   API
----------------------------------------------------------- */
const API_BASE =
  process.env.NEXT_PUBLIC_GUARDCLOUD_API_BASE ??
  'https://yarmotek-guardcloud-api.myarbanga.workers.dev';

const DEVICES_ENDPOINT = '/devices';
const HISTORY_ENDPOINT = '/device/history';
const ADMIN_API_KEY = 'YGC-ADMIN';

/* -----------------------------------------------------------
   LEAFLET ICONS / BADGES
----------------------------------------------------------- */

type LeafletAnyIcon = L.Icon | L.DivIcon;

function makeBadgeIcon(label: string, color: string, ring: string): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="
        width:38px;
        height:38px;
        border-radius:999px;
        background:radial-gradient(circle at 30% 30%, #ffffff22, ${ring});
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid #020617;
        box-shadow:0 0 10px ${ring};
      ">
        <div style="
          width:24px;
          height:24px;
          border-radius:999px;
          background:${color};
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:600;
          font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI';
          color:#e5e7eb;
        ">
          ${label}
        </div>
      </div>
    `,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 36],
  });
}

// Pack “SpaceX” par type + statut
const iconMap: Record<
  DeviceCategory,
  Record<DeviceStatus, LeafletAnyIcon>
> = {
  PHONE: {
    ONLINE: makeBadgeIcon('Ph', '#0ea5e9', '#22d3ee'),
    LOW: makeBadgeIcon('Ph', '#f97316', '#fed7aa'),
    OFFLINE: makeBadgeIcon('Ph', '#4b5563', '#9ca3af'),
  },
  PC: {
    ONLINE: makeBadgeIcon('PC', '#22c55e', '#bbf7d0'),
    LOW: makeBadgeIcon('PC', '#facc15', '#fef08a'),
    OFFLINE: makeBadgeIcon('PC', '#4b5563', '#9ca3af'),
  },
  DRONE: {
    ONLINE: makeBadgeIcon('DR', '#a855f7', '#d8b4fe'),
    LOW: makeBadgeIcon('DR', '#fb923c', '#fed7aa'),
    OFFLINE: makeBadgeIcon('DR', '#4b5563', '#9ca3af'),
  },
  GPS: {
    ONLINE: makeBadgeIcon('GP', '#0ea5e9', '#22d3ee'),
    LOW: makeBadgeIcon('GP', '#f97316', '#fed7aa'),
    OFFLINE: makeBadgeIcon('GP', '#4b5563', '#9ca3af'),
  },
  IOT: {
    ONLINE: makeBadgeIcon('Io', '#22c55e', '#bbf7d0'),
    LOW: makeBadgeIcon('Io', '#facc15', '#fef08a'),
    OFFLINE: makeBadgeIcon('Io', '#4b5563', '#9ca3af'),
  },
  OTHER: {
    ONLINE: makeBadgeIcon('Y', '#38bdf8', '#bfdbfe'),
    LOW: makeBadgeIcon('Y', '#f59e0b', '#fed7aa'),
    OFFLINE: makeBadgeIcon('Y', '#4b5563', '#9ca3af'),
  },
};

const replayIcon: LeafletAnyIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/* -----------------------------------------------------------
   GEOFENCES
----------------------------------------------------------- */
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
    name: 'Zone rouge (sensible)',
    type: 'FORBID',
    polygon: [
      [12.365, -1.54],
      [12.365, -1.528],
      [12.373, -1.528],
      [12.373, -1.54],
    ],
  },
];

/* -----------------------------------------------------------
   UTILS
----------------------------------------------------------- */
function getLogicalCategory(d: Device): DeviceCategory {
  if (d.category) {
    const c = d.category.toString().toUpperCase();
    if (['PHONE', 'PC', 'DRONE', 'GPS', 'IOT'].includes(c)) {
      return c as DeviceCategory;
    }
  }
  const t = (d.deviceType || '').toUpperCase();
  if (t.includes('DRONE')) return 'DRONE';
  if (t.includes('PHONE')) return 'PHONE';
  if (t.includes('PC')) return 'PC';
  if (t.includes('GPS')) return 'GPS';
  if (t.includes('IOT')) return 'IOT';
  return 'OTHER';
}

function isDeviceOnline(d: Device, nowTs: number): boolean {
  if (!d.lastSeen) return false;
  const t = Date.parse(d.lastSeen);
  if (Number.isNaN(t)) return false;
  return (nowTs - t) / 60000 <= 30;
}

function getIconForDevice(d: Device, nowTs: number): LeafletAnyIcon {
  const cat = getLogicalCategory(d);
  let status: DeviceStatus = 'ONLINE';

  const online = isDeviceOnline(d, nowTs);
  const battery =
    typeof d.battery === 'number' ? d.battery : d.battery ?? null;

  if (!online) status = 'OFFLINE';
  else if (battery !== null && battery <= 20) status = 'LOW';

  return iconMap[cat][status];
}

function formatDateTime(ts?: string | null): string {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleString('fr-FR');
}

// Point-in-polygon (ray casting)
function isPointInPolygon(point: LatLngTuple, polygon: LatLngTuple[]): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* -----------------------------------------------------------
   HEATMAP LAYER
----------------------------------------------------------- */
interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

const HeatmapLayer: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!(L as any).heatLayer) return;
    if (!points.length) return;

    const heat = (L as any).heatLayer(
      points.map((p) => [p.lat, p.lng, p.intensity]),
      {
        radius: 28,
        blur: 35,
        maxZoom: 17,
        gradient: {
          0.1: '#1d4ed8',
          0.3: '#22d3ee',
          0.5: '#a3e635',
          0.7: '#f97316',
          1.0: '#ef4444',
        },
      },
    ).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]);

  return null;
};

/* -----------------------------------------------------------
   CLUSTER LAYER (supercluster)
----------------------------------------------------------- */
interface ClusterLayerProps {
  devices: {
    lat: number;
    lng: number;
    deviceId: string;
    icon: LeafletAnyIcon;
  }[];
  onSelect: (id: string) => void;
}

const ClusterLayer: React.FC<ClusterLayerProps> = ({ devices, onSelect }) => {
  const map = useMap();

  const index = useMemo(() => {
    const pts = devices.map((d) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        deviceId: d.deviceId,
      },
      geometry: {
        type: 'Point',
        coordinates: [d.lng, d.lat],
      },
    }));

    return new supercluster({
      radius: 55,
      maxZoom: 18,
    }).load(pts as any);
  }, [devices]);

  useEffect(() => {
    const update = () => {
      const b = map.getBounds();
      const z = map.getZoom();
      const clusters = index.getClusters(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        z,
      );

      map.eachLayer((layer: any) => {
        if (layer.options?.pane === 'markerPane') map.removeLayer(layer);
      });

      clusters.forEach((c: any) => {
        const [lng, lat] = c.geometry.coordinates;

        if (c.properties.cluster) {
          const count = c.properties.point_count;

          const icon = L.divIcon({
            html: `<div style="
              width:48px;
              height:48px;
              background:radial-gradient(circle at 30% 30%, #ffffff33, #facc15);
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:14px;
              font-weight:700;
              border:2px solid #020617;
              box-shadow:0 0 10px #facc15;
            ">${count}</div>`,
            className: '',
            iconSize: [48, 48],
          });

          const mk = L.marker([lat, lng], { icon });
          mk.addTo(map);
          mk.on('click', () => map.setView([lat, lng], z + 2));
        } else {
          const dev = devices.find(
            (d) => d.deviceId === c.properties.deviceId,
          );
          if (!dev) return;
          const mk = L.marker([lat, lng], { icon: dev.icon });
          mk.addTo(map);
          mk.on('click', () => onSelect(dev.deviceId));
        }
      });
    };

    update();
    map.on('zoomend moveend', update);
    return () => {
      map.off('zoomend moveend', update);
    };
  }, [index, devices, map, onSelect]);

  return null;
};

/* -----------------------------------------------------------
   ANIMATED MARKER
----------------------------------------------------------- */
interface AnimatedMarkerProps {
  device: Device;
  icon: LeafletAnyIcon;
  onClick: () => void;
  children?: ReactNode;
}

const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({
  device,
  icon,
  onClick,
  children,
}) => {
  const [pos, setPos] = useState<LatLngTuple | null>(() =>
    device.lat != null && device.lng != null ? [device.lat, device.lng] : null,
  );

  useEffect(() => {
    if (device.lat == null || device.lng == null) return;
    setPos([device.lat, device.lng]);
  }, [device.lat, device.lng]);

  if (!pos) return null;

  return (
    <Marker position={pos} icon={icon as any} eventHandlers={{ click: onClick }}>
      {children}
    </Marker>
  );
};

/* -----------------------------------------------------------
   MAIN COMPONENT
----------------------------------------------------------- */
const DevicesMapClient: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('MAP');
  const [showHeatmap, setShowHeatmap] = useState(false);

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const [history, setHistory] = useState<DeviceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyShortcut, setHistoryShortcut] =
    useState<HistoryShortcut>('ALL');

  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const defaultCenter: LatLngTuple = [12.3657, -1.5339];

  useEffect(() => setMounted(true), []);

  /* -------- LOAD DEVICES -------- */
  const loadDevices = useCallback(async () => {
    try {
      const url = `${API_BASE}${DEVICES_ENDPOINT}?apiKey=${ADMIN_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      let arr: any[] = [];
      if (Array.isArray(data.devices)) arr = data.devices;
      else if (Array.isArray(data)) arr = data;
      else if (data.devices && Array.isArray(data.devices)) arr = data.devices;

      const mapped: Device[] = arr.map((r: any) => ({
        deviceId: String(r.deviceId ?? ''),
        hardwareId: r.hardwareId ?? r.hardware_id ?? null,
        clientId: r.clientId ?? r.client_id ?? null,
        clientName: r.clientName ?? r.client_name ?? null,
        resellerId: r.resellerId ?? r.reseller_id ?? null,
        deviceType: r.deviceType ?? r.device_type ?? 'UNKNOWN',
        category: r.category ?? r.deviceCategory ?? null,
        lat:
          r.lat != null
            ? Number(r.lat)
            : r.latDeg != null
            ? Number(r.latDeg)
            : null,
        lng:
          r.lng != null
            ? Number(r.lng)
            : r.lngDeg != null
            ? Number(r.lngDeg)
            : null,
        battery:
          r.battery ?? r.batteryLevel ?? r.battery_level
            ? Number(r.battery ?? r.batteryLevel ?? r.battery_level)
            : null,
        wifiSsid: r.wifiSsid ?? r.ssid ?? null,
        ip: r.ip ?? null,
        networkType: r.networkType ?? r.network_type ?? null,
        lastSeen: r.lastHeartbeatAt ?? r.lastSeen ?? null,
      }));

      setDevices(mapped);
    } catch (e) {
      console.error('Error loading devices', e);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadDevices();
    const id = window.setInterval(loadDevices, 5000);
    return () => window.clearInterval(id);
  }, [mounted, loadDevices]);

  /* -------- LOAD HISTORY -------- */
  const loadHistory = useCallback(async (deviceId: string) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      setHistory([]);
      setIsPlaying(false);
      setPlayIndex(0);

      const url = `${API_BASE}${HISTORY_ENDPOINT}?deviceId=${encodeURIComponent(
        deviceId,
      )}&limit=400`;
      const res = await fetch(url);
      const data = await res.json();

      let arr: any[] = [];
      if (Array.isArray(data.history)) arr = data.history;
      else if (Array.isArray(data)) arr = data;

      const mapped: DeviceHistoryPoint[] = arr
        .map((h) => {
          const r = h as Record<string, any>;
          const lat =
            r.lat != null
              ? Number(r.lat)
              : r.latitude != null
              ? Number(r.latitude)
              : null;
          const lng =
            r.lng != null
              ? Number(r.lng)
              : r.longitude != null
              ? Number(r.longitude)
              : null;

          const ts =
            (r.ts as string) ??
            (r.timestamp as string) ??
            (r.time as string) ??
            '';

          const batteryRaw =
            r.battery ?? r.batteryLevel ?? r.battery_level ?? null;

          return {
            ts,
            lat,
            lng,
            battery:
              batteryRaw != null
                ? Number(batteryRaw as number | string)
                : null,
            networkType:
              (r.networkType as string | undefined) ??
              (r.network_type as string | undefined) ??
              null,
            source: (r.source as string | undefined) ?? null,
          };
        })
        .filter((h) => !!h.ts);

      mapped.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

      setHistory(mapped);
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Erreur historique');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDevice?.deviceId) {
      loadHistory(selectedDevice.deviceId);
    } else {
      setHistory([]);
      setHistoryError(null);
      setIsPlaying(false);
      setPlayIndex(0);
    }
  }, [selectedDevice?.deviceId, loadHistory]);

  /* -------- FILTERS -------- */
  const clientOptions = useMemo(() => {
    const mapCli = new Map<string, string>();
    devices.forEach((d) => {
      const id = d.clientId ?? d.clientName ?? '';
      if (!id) return;
      if (!mapCli.has(id)) {
        mapCli.set(id, d.clientName ?? d.clientId ?? id);
      }
    });
    return Array.from(mapCli.entries()).map(([id, label]) => ({
      id,
      label,
    }));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (d.lat == null || d.lng == null) return false;

      if (filter === 'PHONE' && getLogicalCategory(d) !== 'PHONE') return false;
      if (filter === 'PC' && getLogicalCategory(d) !== 'PC') return false;
      if (filter === 'DRONE' && getLogicalCategory(d) !== 'DRONE') {
        return false;
      }

      if (clientFilter !== 'ALL') {
        const cli = d.clientId ?? d.clientName ?? '';
        if (cli !== clientFilter) return false;
      }

      if (search.trim().length > 0) {
        const q = search.toLowerCase();
        const hay = [
          d.clientName,
          d.clientId,
          d.deviceId,
          d.hardwareId,
          d.resellerId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [devices, filter, search, clientFilter]);

  const center: LatLngTuple = useMemo(() => {
    const d =
      filteredDevices.find((x) => x.lat && x.lng) ??
      devices.find((x) => x.lat && x.lng);
    return d
      ? ([d.lat as number, d.lng as number] as LatLngTuple)
      : defaultCenter;
  }, [filteredDevices, devices]);

  /* -------- HISTORY / REPLAY -------- */
  const filteredHistory = useMemo(() => {
    if (!history.length) return [];
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startYesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const start7DaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    );

    return history.filter((h) => {
      if (!h.ts) return false;
      const d = new Date(h.ts);

      if (historyShortcut === 'TODAY' && d < startToday) return false;
      if (
        historyShortcut === 'YESTERDAY' &&
        (d < startYesterday || d >= startToday)
      ) {
        return false;
      }
      if (historyShortcut === 'LAST7' && d < start7DaysAgo) return false;

      return h.lat != null && h.lng != null;
    });
  }, [history, historyShortcut]);

  const ghostPolyline: LatLngTuple[] = useMemo(() => {
    if (!filteredHistory.length) return [];
    const maxIndex = Math.min(playIndex, filteredHistory.length - 1);
    return filteredHistory
      .slice(0, maxIndex + 1)
      .map(
        (h) => [h.lat as number, h.lng as number] as LatLngTuple,
      );
  }, [filteredHistory, playIndex]);

  const currentReplayPoint =
    filteredHistory.length > 0
      ? filteredHistory[Math.min(playIndex, filteredHistory.length - 1)]
      : undefined;

  useEffect(() => {
    if (!isPlaying || filteredHistory.length <= 1) return;

    const baseInterval = 800;
    const interval = baseInterval / (speedMultiplier || 1);

    const id = window.setInterval(() => {
      setPlayIndex((prev) => {
        const next = prev + 1;
        if (next >= filteredHistory.length) {
          return filteredHistory.length - 1;
        }
        return next;
      });
    }, interval);

    return () => window.clearInterval(id);
  }, [isPlaying, filteredHistory, speedMultiplier]);

  useEffect(() => {
    setPlayIndex(0);
    setIsPlaying(false);
  }, [selectedDevice?.deviceId, historyShortcut, history.length]);

  /* -------- GEOFENCE ALERTS -------- */
  const deviceGeofences: { zone: Geofence; status: 'INSIDE' | 'OUTSIDE' }[] =
    useMemo(() => {
      if (!selectedDevice || selectedDevice.lat == null || selectedDevice.lng == null) {
        return [];
      }
      const pt: LatLngTuple = [
        selectedDevice.lat as number,
        selectedDevice.lng as number,
      ];
      return GEOFENCES.map((g) => ({
        zone: g,
        status: isPointInPolygon(pt, g.polygon) ? 'INSIDE' : 'OUTSIDE',
      }));
    }, [selectedDevice]);

  /* -------- TELECOMMANDE -------- */
  const sendCommand = async (
    action: 'RING' | 'LOCK' | 'MESSAGE' | 'WIPE',
  ) => {
    if (!selectedDevice) return;
    try {
      setCommandStatus('Envoi de la commande…');

      const endpoint =
        action === 'RING'
          ? '/admin/ring'
          : action === 'LOCK'
          ? '/admin/lock'
          : action === 'MESSAGE'
          ? '/admin/message'
          : '/admin/wipe';

      const body: any = {
        apiKey: ADMIN_API_KEY,
        deviceId: selectedDevice.deviceId,
      };

      if (action === 'RING') {
        body.message = 'ALERTE YARMOTEK – SONNE';
        body.durationSec = 20;
        body.level = 'HIGH';
      }
      if (action === 'MESSAGE') {
        body.message =
          'Message Yarmotek GuardCloud : Votre appareil a été localisé.';
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        setCommandStatus(`Erreur API (${res.status}) : ${txt}`);
        return;
      }

      setCommandStatus(`Commande ${action} envoyée avec succès ✅`);
      setTimeout(() => setCommandStatus(null), 3500);
    } catch (e: any) {
      setCommandStatus(`Erreur : ${e?.message ?? 'Inconnue'}`);
      setTimeout(() => setCommandStatus(null), 3500);
    }
  };

  const tileUrl =
    baseLayer === 'MAP'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const heatmapPoints: HeatmapPoint[] = useMemo(
    () =>
      filteredDevices
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          lat: d.lat as number,
          lng: d.lng as number,
          intensity: isDeviceOnline(d, nowTs) ? 0.9 : 0.4,
        })),
    [filteredDevices, nowTs],
  );

  if (!mounted) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-white">
        Initialisation…
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 text-white">
      {/* TOP BAR MAP (logo GuardCloud Premium 2025) */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-sky-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <span className="text-[11px] font-bold tracking-tight leading-tight text-slate-900">
              YG
              <br />
              25
            </span>
          </div>

          <div className="leading-tight">
            <span className="font-bold text-sm">
              YARMOTEK <span className="text-amber-400">GUARDCLOUD</span>
            </span>
            <div className="text-[11px] text-slate-400">
              Universal Tracking – Phones • PC • Drones • IoT
            </div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wide">
              PREMIUM 2025 · LIVE MAP
            </div>
          </div>

          <div className="ml-6 flex gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/60">
              Online :{' '}
              {devices.filter((d) => isDeviceOnline(d, nowTs)).length}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              Phones :{' '}
              {
                devices.filter((d) => getLogicalCategory(d) === 'PHONE')
                  .length
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              PC :{' '}
              {
                devices.filter((d) => getLogicalCategory(d) === 'PC')
                  .length
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700/80">
              Drones :{' '}
              {
                devices.filter((d) => getLogicalCategory(d) === 'DRONE')
                  .length
              }
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] outline-none"
          >
            <option value="ALL">Tous les clients</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (client, device, HW)…"
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-[11px] outline-none w-56"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setBaseLayer('MAP')}
              className={`px-2 py-1 rounded-full text-[11px] border ${
                baseLayer === 'MAP'
                  ? 'bg-slate-200 text-slate-900 border-slate-100'
                  : 'bg-slate-800 text-slate-100 border-slate-700'
              }`}
            >
              Carte
            </button>
            <button
              onClick={() => setBaseLayer('SATELLITE')}
              className={`px-2 py-1 rounded-full text-[11px] border ${
                baseLayer === 'SATELLITE'
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'bg-slate-800 text-slate-100 border-slate-700'
              }`}
            >
              Satellite
            </button>

            <button
              onClick={() => setShowHeatmap((s) => !s)}
              className={`ml-2 px-2 py-1 rounded-full text-[11px] border ${
                showHeatmap
                  ? 'bg-rose-500 text-black border-rose-300'
                  : 'bg-slate-800 text-slate-100 border-slate-700'
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>
      </div>

      {/* FILTRES LIGNE 2 */}
      <div className="px-6 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 text-[11px]">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-full border ${
            filter === 'ALL'
              ? 'bg-amber-500 text-black border-amber-300'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilter('PHONE')}
          className={`px-3 py-1 rounded-full border ${
            filter === 'PHONE'
              ? 'bg-sky-500 text-black border-sky-300'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Phones
        </button>
        <button
          onClick={() => setFilter('PC')}
          className={`px-3 py-1 rounded-full border ${
            filter === 'PC'
              ? 'bg-emerald-500 text-black border-emerald-300'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          PC
        </button>
        <button
          onClick={() => setFilter('DRONE')}
          className={`px-3 py-1 rounded-full border ${
            filter === 'DRONE'
              ? 'bg-fuchsia-500 text-black border-fuchsia-300'
              : 'bg-slate-800 text-slate-100 border-slate-700'
          }`}
        >
          Drones
        </button>

        <button
          onClick={loadDevices}
          className="ml-4 px-3 py-1 rounded-full bg-slate-200 text-slate-900 border border-slate-100"
        >
          Rafraîchir
        </button>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-sky-400" />
            Phone
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            PC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-fuchsia-400" />
            Drone
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Batterie &lt;= 20%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-violet-500" />
            Offline
          </span>
        </div>
      </div>

      {/* STATUS COMMANDES */}
      {commandStatus && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-xs px-3 py-1 rounded shadow z-40">
          {commandStatus}
        </div>
      )}

      {/* PANEL LATERAL (device sélectionné) */}
      {selectedDevice && (
        <div className="absolute top-[96px] right-0 w-80 h-[calc(100%-96px)] bg-slate-950/98 shadow-2xl z-30 p-4 overflow-y-auto border-l border-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm truncate flex-1">
              {selectedDevice.deviceId}
            </h3>
            <button
              onClick={() => setSelectedDevice(null)}
              className="text-slate-400 hover:text-white text-xl leading-none ml-2"
            >
              ×
            </button>
          </div>

          {/* Device Info */}
          <div className="space-y-3 text-xs">
            <InfoRow label="Hardware ID" value={selectedDevice.hardwareId} />
            <InfoRow label="Client" value={selectedDevice.clientName || selectedDevice.clientId} />
            <InfoRow label="Type" value={selectedDevice.deviceType} />
            <InfoRow label="Catégorie" value={selectedDevice.category} />
            <InfoRow
              label="Position"
              value={
                selectedDevice.lat && selectedDevice.lng
                  ? `${selectedDevice.lat.toFixed(6)}, ${selectedDevice.lng.toFixed(6)}`
                  : null
              }
            />
            <InfoRow
              label="Batterie"
              value={
                typeof selectedDevice.battery === 'number'
                  ? `${selectedDevice.battery}%`
                  : null
              }
            />
            <InfoRow label="WiFi" value={selectedDevice.wifiSsid} />
            <InfoRow label="IP" value={selectedDevice.ip} />
            <InfoRow label="Réseau" value={selectedDevice.networkType} />
            <InfoRow
              label="Dernière activité"
              value={
                selectedDevice.lastSeen
                  ? formatDateTime(selectedDevice.lastSeen)
                  : null
              }
            />
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">
              Actions rapides
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (selectedDevice.lat && selectedDevice.lng) {
                    const url = `https://www.google.com/maps?q=${selectedDevice.lat},${selectedDevice.lng}`;
                    window.open(url, '_blank');
                  }
                }}
                disabled={!selectedDevice.lat || !selectedDevice.lng}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs py-2 px-3 rounded"
              >
                Google Maps
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${selectedDevice.lat}, ${selectedDevice.lng}`
                  );
                  setCommandStatus('Coordonnées copiées !');
                  setTimeout(() => setCommandStatus(null), 2000);
                }}
                disabled={!selectedDevice.lat || !selectedDevice.lng}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs py-2 px-3 rounded"
              >
                Copier GPS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARTE PRINCIPALE */}
      <div className="flex-1">
        <MapContainer
          center={center}
          zoom={13}
          className="w-full h-full z-0"
          preferCanvas={true}
        >
          <TileLayer attribution="© OpenStreetMap / ESRI" url={tileUrl} />

          {showHeatmap && heatmapPoints.length > 0 && (
            <HeatmapLayer points={heatmapPoints} />
          )}

          <ClusterLayer
            devices={filteredDevices.map((d) => ({
              lat: d.lat as number,
              lng: d.lng as number,
              deviceId: d.deviceId,
              icon: getIconForDevice(d, nowTs),
            }))}
            onSelect={(id) => {
              const dev = devices.find((x) => x.deviceId === id);
              if (dev) setSelectedDevice(dev);
            }}
          />

          {ghostPolyline.length >= 2 && (
            <>
              <Polyline positions={ghostPolyline} pathOptions={{ weight: 3 }} />
              {ghostPolyline.map((pos, idx) => (
                <CircleMarker key={idx} center={pos} radius={3} />
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
                icon={replayIcon as any}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-bold mb-1">
                      Point #{playIndex + 1} / {filteredHistory.length}
                    </div>
                    <div>{formatDateTime(currentReplayPoint.ts)}</div>
                    {typeof currentReplayPoint.battery === 'number' && (
                      <div>Batterie : {currentReplayPoint.battery}%</div>
                    )}
                    {currentReplayPoint.networkType && (
                      <div>Réseau : {currentReplayPoint.networkType}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

          {GEOFENCES.map((g) => (
            <Polygon
              key={g.id}
              positions={g.polygon}
              pathOptions={{
                color: g.type === 'FORBID' ? '#ef4444' : '#22c55e',
                weight: 2,
                fillColor:
                  g.type === 'FORBID'
                    ? 'rgba(239,68,68,0.25)'
                    : 'rgba(34,197,94,0.18)',
                fillOpacity: 0.4,
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

/* Helper: InfoRow for device detail panel */
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium text-right max-w-[160px] truncate">
        {value}
      </span>
    </div>
  );
}

export default DevicesMapClient;
