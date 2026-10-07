import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { StatsPoint } from './api';

export function MapView({ points }: { points: StatsPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { worldCopyJump: true, minZoom: 1 }).setView(
      [20, 0],
      2,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const max = Math.max(1, ...points.map((point) => point.n));
    for (const point of points) {
      if (point.latitude === null || point.longitude === null) continue;
      const radius = 6 + 18 * Math.sqrt(point.n / max);
      L.circleMarker([point.latitude, point.longitude], {
        radius,
        color: '#4da3ff',
        weight: 1,
        fillColor: '#4da3ff',
        fillOpacity: 0.35,
      })
        .bindTooltip(`${point.city ?? point.country ?? 'unknown'}: ${point.n}`)
        .addTo(layer);
    }
  }, [points]);

  return <div ref={containerRef} className="map" />;
}
