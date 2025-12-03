"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

export type DeviceMapItem = {
  deviceId: string;
  name?: string;
  clientName?: string;

  lat?: number | null;
  lng?: number | null;

  category?: string;
  battery?: number | null;
  lastHeartbeat?: string | null;
};

type DevicesMapProps = {
  devices: DeviceMapItem[];
};

const defaultCenter: [number, number] = [12.3657, -1.5339]; // Ouagadougou

// =====================================================
//  Icône Leaflet via CDN (pas d'import d'images locales)
// =====================================================
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

export default function DevicesMap({ devices }: DevicesMapProps) {
  const validDevices = useMemo(
    () =>
      (devices || []).filter((d) => {
        const latOK = typeof d.lat === "number" && !Number.isNaN(d.lat);
        const lngOK = typeof d.lng === "number" && !Number.isNaN(d.lng);
        return latOK && lngOK;
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
                <div className="font-semibold mb-1">{title}</div>

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
                    {new Date(d.lastHeartbeat).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
