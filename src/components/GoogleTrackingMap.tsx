import { useEffect, useRef } from 'react';
import type { RouteStatus, LatLng } from '../types/tracking';

declare global {
  interface Window {
    google: any;
    __gmapsCb?: () => void;
  }
}

let _mapsPromise: Promise<boolean> | null = null;

function loadGoogleMaps(): Promise<boolean> {
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve) => {
    if (window.google?.maps) { resolve(true); return; }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) { resolve(false); return; }
    window.__gmapsCb = () => resolve(true);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&callback=__gmapsCb&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => { _mapsPromise = null; resolve(false); };
    document.head.appendChild(script);
  });
  return _mapsPromise;
}

const STATUS_COLOR: Record<RouteStatus, string> = {
  pending:          '#eab308',
  escrow_locked:    '#a855f7',
  assigned:         '#22d3ee',
  picked_up:        '#60a5fa',
  in_transit:       '#3b82f6',
  customs:          '#f97316',
  out_for_delivery: '#22c55e',
  delivered:        '#22c55e',
  disputed:         '#ef4444',
};

const STATUS_PROGRESS: Record<RouteStatus, number> = {
  pending:          0.00,
  escrow_locked:    0.02,
  assigned:         0.06,
  picked_up:        0.14,
  in_transit:       0.52,
  customs:          0.72,
  out_for_delivery: 0.88,
  delivered:        1.00,
  disputed:         0.52,
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, D = Math.PI / 180;
  const dLat = (lat2 - lat1) * D, dLng = (lng2 - lng1) * D;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function greatCirclePoints(origin: LatLng, destination: LatLng, n = 80): LatLng[] {
  const D = Math.PI / 180, R = 1 / D;
  const oLat = origin.lat * D, oLng = origin.lng * D;
  const dLat = destination.lat * D, dLng = destination.lng * D;
  const dLa = dLat - oLat, dLo = dLng - oLng;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(oLat) * Math.cos(dLat) * Math.sin(dLo / 2) ** 2;
  const ang = 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (ang < 1e-6) return [origin, destination];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const A = Math.sin((1 - t) * ang) / Math.sin(ang);
    const B = Math.sin(t * ang) / Math.sin(ang);
    const x = A * Math.cos(oLat) * Math.cos(oLng) + B * Math.cos(dLat) * Math.cos(dLng);
    const y = A * Math.cos(oLat) * Math.sin(oLng) + B * Math.cos(dLat) * Math.sin(dLng);
    const z = A * Math.sin(oLat) + B * Math.sin(dLat);
    return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * R, lng: Math.atan2(y, x) * R };
  });
}

function svgToUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Small glowing circle dots — no teardrop/pin shape
const ORIGIN_SVG = svgToUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">` +
  `<circle cx="6" cy="6" r="5.5" fill="#3b82f6" opacity="0.28"/>` +
  `<circle cx="6" cy="6" r="3.5" fill="#3b82f6" stroke="white" stroke-width="1.5"/>` +
  `</svg>`
);

function destSvg(color: string) {
  return svgToUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">` +
    `<circle cx="6" cy="6" r="5.5" fill="${color}" opacity="0.28"/>` +
    `<circle cx="6" cy="6" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>` +
    `</svg>`
  );
}

function pkgSvg(color: string) {
  return svgToUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">` +
    `<circle cx="5" cy="5" r="4.5" fill="${color}" opacity="0.30"/>` +
    `<circle cx="5" cy="5" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>` +
    `</svg>`
  );
}

export interface GoogleTrackingMapProps {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  routePoints?: LatLng[];
  status: RouteStatus;
  className?: string;
  trackingCode?: string;
}

export default function GoogleTrackingMap({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  routePoints,
  status,
  className = '',
  trackingCode,
}: GoogleTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((ok) => {
      if (!ok || cancelled || !containerRef.current || mapRef.current) return;

      const G = window.google.maps;
      const color = STATUS_COLOR[status] ?? '#3b82f6';
      const progress = STATUS_PROGRESS[status] ?? 0.5;

      const origin = { lat: originLat, lng: originLng };
      const dest = { lat: destinationLat, lng: destinationLng };

      // Compute route points (provided or great circle)
      const distKm = haversineKm(originLat, originLng, destinationLat, destinationLng);
      const useArc = distKm > 600 || !routePoints || routePoints.length < 2;
      const pts: LatLng[] = routePoints && routePoints.length > 1 ? routePoints : greatCirclePoints(origin, dest);

      // Map center = midpoint at index 50%
      const midPt = pts[Math.floor(pts.length / 2)];

      const map = new G.Map(containerRef.current, {
        center: midPt,
        zoom: useArc ? 3 : 8,
        mapTypeId: 'hybrid',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: G.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: 'cooperative',
        restriction: null,
      });
      mapRef.current = map;

      // Fit bounds to route
      const bounds = new G.LatLngBounds();
      pts.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });

      // Split route into completed / remaining
      const splitIdx = Math.min(Math.floor(progress * pts.length), pts.length - 1);
      const completedPts = pts.slice(0, splitIdx + 1);
      const remainingPts = pts.slice(splitIdx);

      // Completed portion — thin dotted line in status colour
      if (completedPts.length > 1) {
        new G.Polyline({
          path: completedPts,
          strokeOpacity: 0,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.90, strokeColor: color, scale: 3 },
            offset: '0',
            repeat: '14px',
          }],
          map,
          geodesic: useArc,
        });
      }

      // Remaining portion — dim dotted line
      if (remainingPts.length > 1) {
        new G.Polyline({
          path: remainingPts,
          strokeOpacity: 0,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.35, strokeColor: '#64748b', scale: 3 },
            offset: '0',
            repeat: '14px',
          }],
          map,
          geodesic: useArc,
        });
      }

      // Origin marker — small circle dot, centered anchor (no pin shape)
      const originMarker = new G.Marker({
        position: origin,
        map,
        icon: { url: ORIGIN_SVG, scaledSize: new G.Size(12, 12), anchor: new G.Point(6, 6) },
        title: 'Origin',
        zIndex: 10,
      });

      // Destination marker — small circle dot
      const destMarker = new G.Marker({
        position: dest,
        map,
        icon: { url: destSvg(color), scaledSize: new G.Size(12, 12), anchor: new G.Point(6, 6) },
        title: 'Destination',
        zIndex: 10,
      });

      // Package position marker — small dot at current status position (static)
      const pkgMarker = new G.Marker({
        position: pts[splitIdx],
        map,
        icon: { url: pkgSvg(color), scaledSize: new G.Size(10, 10), anchor: new G.Point(5, 5) },
        title: trackingCode ?? 'Package',
        zIndex: 20,
      });

      // Animated travel particle — loops origin→destination continuously
      const travelIcon = {
        path: G.SymbolPath.CIRCLE,
        scale: 3.5,
        fillColor: '#67e8f9',
        fillOpacity: 0.95,
        strokeColor: '#ffffff',
        strokeWeight: 1,
      };
      const travelLine = new G.Polyline({ path: pts, strokeOpacity: 0, geodesic: useArc, map });
      travelLine.set('icons', [{ icon: travelIcon, offset: '0%' }]);
      let travelPct = Math.random() * 100;
      const travelId = setInterval(() => {
        if (cancelled) { clearInterval(travelId); return; }
        travelPct = (travelPct + 0.4) % 100;
        travelLine.set('icons', [{ icon: travelIcon, offset: `${travelPct.toFixed(1)}%` }]);
      }, 50);

      cleanupRef.current = () => {
        clearInterval(travelId);
        originMarker.setMap(null);
        destMarker.setMap(null);
        pkgMarker.setMap(null);
        travelLine.setMap(null);
      };
    });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode ?? `${originLat},${originLng},${destinationLat},${destinationLng},${status}`]);

  return (
    <div className={className} ref={containerRef} style={{ touchAction: 'pan-y', userSelect: 'none' }} />
  );
}
