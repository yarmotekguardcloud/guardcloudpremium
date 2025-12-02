'use client';

import { useEffect, useMemo } from 'react';
import L, { Marker } from 'leaflet';
import { useMap } from 'react-leaflet';
import supercluster from 'supercluster';

interface ClusterLayerProps {
  devices: {
    lat: number;
    lng: number;
    deviceId: string;
    icon: L.Icon;
  }[];
  onSelect: (id: string) => void;
}

export default function ClusterLayer({ devices, onSelect }: ClusterLayerProps) {
  const map = useMap();

  const index = useMemo(() => {
    const points = devices.map((d) => ({
      type: 'Feature',
      properties: { cluster: false, deviceId: d.deviceId },
      geometry: {
        type: 'Point',
        coordinates: [d.lng, d.lat],
      },
    }));

    return new supercluster({
      radius: 60,
      maxZoom: 18,
    }).load(points as any);
  }, [devices]);

  useEffect(() => {
    const updateClusters = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const clusters = index.getClusters(
        [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ],
        zoom
      );

      // Clear old markers
      map.eachLayer((layer: any) => {
        if (layer.options?.pane === 'markerPane') map.removeLayer(layer);
      });

      clusters.forEach((c: any) => {
        const [lng, lat] = c.geometry.coordinates;

        if (c.properties.cluster) {
          const count = c.properties.point_count;

          const clusterIcon = L.divIcon({
            html: `<div style="
              width:45px;
              height:45px;
              background:rgba(255,200,0,0.9);
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:700;
              font-size:14px;
              color:#000;
              border:2px solid #111;
            ">${count}</div>`,
            className: '',
            iconSize: [45, 45],
          });

          const marker = L.marker([lat, lng], { icon: clusterIcon });
          marker.addTo(map);

          // Zoom sur cluster
          marker.on('click', () => {
            map.setView([lat, lng], zoom + 2);
          });
        } else {
          const device = devices.find(
            (d) => d.deviceId === c.properties.deviceId
          );

          if (!device) return;

          const marker = L.marker([lat, lng], { icon: device.icon });
          marker.addTo(map);

          marker.on('click', () => onSelect(device.deviceId));
        }
      });
    };

    updateClusters();
    map.on('moveend zoomend', updateClusters);

    return () => {
      map.off('moveend zoomend', updateClusters);
    };
  }, [index, map, devices, onSelect]);

  return null;
}
