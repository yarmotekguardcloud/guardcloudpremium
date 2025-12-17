"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// -----------------------------------------------------------------------------
//  Fix icônes Leaflet (Next.js / Webpack)
// -----------------------------------------------------------------------------
/**
 * ⚠️ Si tu as déjà ce fix ailleurs, tu peux supprimer cette section pour éviter
 * les doublons. Sinon, elle corrige les icônes manquantes par défaut.
 */
// @ts-ignore
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
// @ts-ignore
import markerIcon from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import markerShadow from "leaflet/dist/images/marker-shadow.png";

if (typeof window !== "undefined") {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x.src || markerIcon2x,
    iconUrl: markerIcon.src || markerIcon,
    shadowUrl: markerShadow.src || markerShadow,
  });
}

// -----------------------------------------------------------------------------
//  Types souples pour s’adapter à ton modèle existant
// -----------------------------------------------------------------------------

export interface HistoryPoint {
  lat: number;
  lng: number;
  timestampIso?: string;
  accuracy_m?: number | null;
  battery?: number | null;
  networkType?: string;
}

export interface SelectedDevice {
  id: string;
  name?: string;
  clientName?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

interface DevicesMapClientProps {
  selectedDevice: SelectedDevice | null;
  historyPoints: HistoryPoint[];
}

/**
 * Carte Leaflet :
 *  - Affiche la position LIVE du device sélectionné.
 *  - Trace le TRAJET (polyline) pour l’historique (24h/48h).
 */
export function DevicesMapClient({
  selectedDevice,
  historyPoints,
}: DevicesMapClientProps) {
  // Position live du device (priorité à latitude/longitude)
  const livePos: LatLngExpression | null = useMemo(() => {
    if (!selectedDevice) return null;

    const lat =
      typeof selectedDevice.latitude === "number"
        ? selectedDevice.latitude
        : selectedDevice.lat;
    const lng =
      typeof selectedDevice.longitude === "number"
        ? selectedDevice.longitude
        : selectedDevice.lng;

    if (typeof lat === "number" && typeof lng === "number") {
      return [lat, lng];
    }
    return null;
  }, [selectedDevice]);

  // Points de l’historique → polyline
  const pathPositions: LatLngExpression[] = useMemo(() => {
    if (!historyPoints || historyPoints.length === 0) return [];
    return historyPoints
      .filter(
        (p) =>
          typeof p.lat === "number" &&
          !Number.isNaN(p.lat) &&
          typeof p.lng === "number" &&
          !Number.isNaN(p.lng),
      )
      .map((p) => [p.lat, p.lng] as LatLngExpression);
  }, [historyPoints]);

  // Centre par défaut (Ouaga) si aucun device sélectionné
  const defaultCenter: LatLngExpression = livePos || [12.3686, -1.5272];

  return (
    <div className="h-full w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* TRAJET HISTORIQUE : polyline */}
        {pathPositions.length > 1 && (
          <Polyline positions={pathPositions} />
        )}

        {/* MARQUEUR LIVE */}
        {livePos && (
          <Marker position={livePos}>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
              <div className="text-xs">
                <div className="font-semibold">
                  {selectedDevice?.name || "Appareil"}
                </div>
                {selectedDevice?.clientName && (
                  <div>{selectedDevice.clientName}</div>
                )}
                <div>LIVE</div>
              </div>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

export default DevicesMapClient;
