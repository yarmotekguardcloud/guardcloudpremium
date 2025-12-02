"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix icônes Leaflet pour Next/Webpack
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Corriger le prototype par défaut (bug classique Leaflet + Next)
delete (L.Icon.Default as any).prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export type DeviceMapItem = {
  deviceId: string;
  name?: string;
  clientName?: string;

  // ⚠️ peuvent être number | null | undefined (on filtre avant affichage)
  lat?: number | null;
  lng?: number | null;

  category?: string;
  battery?: number | null;

  // ✅ Autoriser null pour matcher GuardCloudDevice
  lastHeartbeat?: string | null;
};

type DevicesMapProps = {
  devices: DeviceMapItem[];
};

const defaultCenter: [number, number] = [12.3657, -1.5339]; // Ouagadougou

export default function DevicesMap({ devices }: DevicesMapProps) {
  // On garde seulement les devices avec des coordonnées valides
  const validDevices = useMemo(
    () =>
      (devices || []).filter((d) => {
        const hasLat =
          typeof d.lat === "number" && !Number.isNaN(d.lat);
        const hasLng =
          typeof d.lng === "number" && !Number.isNaN(d.lng);
        return hasLat && hasLng;
      }),
    [devices]
  );

  const center = useMemo<[number, number]>(() => {
    if (validDevices.length > 0) {
      return [
        validDevices[0].lat as number,
        validDevices[0].lng as number,
      ];
    }
    return defaultCenter;
  }, [validDevices]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="w-full h-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {validDevices.map((d) => {
        const title = d.name || d.clientName || d.deviceId;

        return (
          <Marker
            key={d.deviceId}
            position={[d.lat as number, d.lng as number]}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-semibold mb-1">
                  {title}
                </div>
                <div>
                  <b>ID :</b> {d.deviceId}
                </div>
                {d.category && (
                  <div>
                    <b>Catégorie :</b> {d.category}
                  </div>
                )}
                {typeof d.battery === "number" && (
                  <div>
                    <b>Batterie :</b> {d.battery}%
                  </div>
                )}
                {d.lastHeartbeat && (
                  <div>
                    <b>Dernier HB :</b>{" "}
                    {new Date(d.lastHeartbeat).toLocaleString(
                      "fr-FR",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
