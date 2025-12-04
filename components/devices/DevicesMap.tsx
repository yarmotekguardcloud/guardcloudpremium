"use client";

import { useEffect, useState } from "react";

type Device = {
  deviceId: string;
  name: string;
  clientName?: string;
  category: string;
  lat: number | null;
  lng: number | null;
  battery: number | null;
  charging: boolean | null;
  lastHeartbeat?: string;
};

// 🌍 Centre par défaut : Ouaga
const DEFAULT_CENTER: [number, number] = [12.3657, -1.5339];

export default function DevicesMap({ devices }: { devices: Device[] }) {
  const [isClient, setIsClient] = useState(false);
  const [LeafletComponents, setLeafletComponents] = useState<any>(null);

  useEffect(() => {
    // Import Leaflet only on client side
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([L, reactLeaflet]) => {
      // Configure default icon
      const defaultIcon = L.default.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.default.Marker.prototype.options.icon = defaultIcon;

      setLeafletComponents({
        MapContainer: reactLeaflet.MapContainer,
        TileLayer: reactLeaflet.TileLayer,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        LayersControl: reactLeaflet.LayersControl,
      });
      setIsClient(true);
    });
  }, []);

  if (!isClient || !LeafletComponents) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500">Chargement de la carte...</div>;
  }

  const { MapContainer, TileLayer, Marker, Popup, LayersControl } = LeafletComponents;
  const { BaseLayer } = LayersControl;

  // Dedupe by deviceId, then filter for valid coords
  const seen = new Set<string>();
  const coords = (devices || []).filter((d) => {
    if (seen.has(d.deviceId)) return false;
    seen.add(d.deviceId);
    return (
      typeof d.lat === "number" &&
      !Number.isNaN(d.lat) &&
      typeof d.lng === "number" &&
      !Number.isNaN(d.lng)
    );
  });

  // Centre moyen des devices ou centre par défaut
  let center: [number, number] = DEFAULT_CENTER;
  if (coords.length > 0) {
    const sumLat = coords.reduce((sum, d) => sum + (d.lat as number), 0);
    const sumLng = coords.reduce((sum, d) => sum + (d.lng as number), 0);
    center = [sumLat / coords.length, sumLng / coords.length];
  }

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="w-full h-full"
    >
      <LayersControl position="topright">
        <BaseLayer checked name="Routier (OSM)">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </BaseLayer>

        <BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>
      </LayersControl>

      {coords.map((d) => (
        <Marker
          key={d.deviceId}
          position={[d.lat as number, d.lng as number]}
        >
          <Popup>
            <div className="text-xs leading-tight">
              <div className="font-semibold mb-1">{d.name}</div>

              <div className="mb-1">
                <span className="font-medium">Client&nbsp;:</span>{" "}
                {d.clientName || "-"}
              </div>

              <div className="mb-1">
                <span className="font-medium">Catégorie&nbsp;:</span>{" "}
                {d.category}
              </div>

              {typeof d.battery === "number" && (
                <div className="mb-1">
                  <span className="font-medium">Batterie&nbsp;:</span>{" "}
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
                  Dernier HB&nbsp;:
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
