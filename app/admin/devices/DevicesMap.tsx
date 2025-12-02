"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
} from "react-leaflet";

import L from "leaflet";

type Device = {
  deviceId: string;
  name: string;
  clientName?: string;
  category: string;
  lat: number;
  lng: number;
  battery: number | null;
  charging: boolean | null;
  lastHeartbeat?: string;
};

const { BaseLayer } = LayersControl;

// Correction des icônes Leaflet dans Next.js
// (évite le bug des marqueurs invisibles)
const defaultIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export default function DevicesMap({ devices }: { devices: Device[] }) {
  // centre par défaut : Ouaga
  const defaultCenter: [number, number] = [12.3657, -1.5339];

  // on calcule un centre moyen si on a des devices géolocalisés
  const coords = devices.filter((d) => d.lat || d.lng);
  const center: [number, number] =
    coords.length > 0
      ? [
          coords.reduce((sum, d) => sum + d.lat, 0) / coords.length,
          coords.reduce((sum, d) => sum + d.lng, 0) / coords.length,
        ]
      : defaultCenter;

  // Leaflet CSS côté client
  useEffect(() => {
    // rien de spécial, le CSS est déjà importé
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
    >
      <LayersControl position="topright">
        <BaseLayer checked name="Routier">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </BaseLayer>

        <BaseLayer name="Satellite">
          <TileLayer
            attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>
      </LayersControl>

      {coords.map((d) => (
        <Marker key={d.deviceId} position={[d.lat, d.lng]}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold mb-1">{d.name}</div>
              <div className="mb-1">
                <span className="font-medium">Client:&nbsp;</span>
                {d.clientName || "-"}
              </div>
              <div className="mb-1">
                <span className="font-medium">Catégorie:&nbsp;</span>
                {d.category}
              </div>
              {typeof d.battery === "number" && (
                <div className="mb-1">
                  <span className="font-medium">Batterie:&nbsp;</span>
                  {d.battery}%{" "}
                  <span className="text-[10px] text-gray-500">
                    {d.charging === true
                      ? "(En charge)"
                      : d.charging === false
                      ? "(Sur batterie)"
                      : ""}
                  </span>
                </div>
              )}
              {d.lastHeartbeat && (
                <div className="text-[10px] text-gray-500">
                  Dernier heartbeat:{" "}
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
      ))}
    </MapContainer>
  );
}
