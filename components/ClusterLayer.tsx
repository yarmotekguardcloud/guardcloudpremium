"use client";

import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";

export interface ClusterDevice {
  lat: number;
  lng: number;
  deviceId: string;
  icon?: L.Icon | L.DivIcon;
}

export interface ClusterLayerProps {
  devices: ClusterDevice[];
  onSelect?: (deviceId: string) => void;
  onClusterClick?: (lat: number, lng: number) => void;
}

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function ClusterLayer({ devices, onSelect }: ClusterLayerProps) {
  const map = useMap();

  const validDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          typeof d.lat === "number" &&
          typeof d.lng === "number" &&
          !isNaN(d.lat) &&
          !isNaN(d.lng) &&
          d.lat !== 0 &&
          d.lng !== 0
      ),
    [devices]
  );

  return (
    <>
      {validDevices.map((device) => (
        <Marker
          key={device.deviceId}
          position={[device.lat, device.lng]}
          icon={device.icon || defaultIcon}
          eventHandlers={{
            click: () => {
              if (onSelect) onSelect(device.deviceId);
            },
          }}
        >
          <Popup>
            <div className="text-xs">
              <strong>{device.deviceId}</strong>
              <br />
              {device.lat.toFixed(6)}, {device.lng.toFixed(6)}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
