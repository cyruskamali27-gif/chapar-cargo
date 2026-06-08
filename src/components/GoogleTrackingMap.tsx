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

const ORIGIN_SVG = svgToUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
      fill="#fbbf24" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="7" fill="white" opacity="0.95"/>
    <circle cx="18" cy="18" r="3" fill="#fbbf24"/>
  </svg>`);

function destSvg(color: string) {
  return svgToUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
      fill="${color}" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="7" fill="white" opacity="0.95"/>
    <circle cx="18" cy="18" r="3" fill="${color}"/>
  </svg>`);
}

function pkgSvg(color: string) {
  return svgToUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="${color}" stroke="white" stroke-width="2.5"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
    <circle cx="14" cy="14" r="2.5" fill="${color}"/>
  </svg>`);
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

      if (completedPts.length > 1) {
        new G.Polyline({
          path: completedPts,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: useArc ? 3 : 4,
          map,
          geodesic: useArc,
        });
      }

      if (remainingPts.length > 1) {
        new G.Polyline({
          path: remainingPts,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.5,
          strokeWeight: useArc ? 2 : 3,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '18px' }],
          map,
          geodesic: useArc,
        });
      }

      // Origin marker
      const originMarker = new G.Marker({
        position: origin,
        map,
        icon: { url: ORIGIN_SVG, scaledSize: new G.Size(36, 44), anchor: new G.Point(18, 44) },
        title: 'Origin',
        zIndex: 10,
      });

      // Destination marker
      const destMarker = new G.Marker({
        position: dest,
        map,
        icon: { url: destSvg(color), scaledSize: new G.Size(36, 44), anchor: new G.Point(18, 44) },
        title: 'Destination',
        zIndex: 10,
      });

      // Package (animated)
      const pkgIcon = { url: pkgSvg(color), scaledSize: new G.Size(28, 28), anchor: new G.Point(14, 14) };
      const pkgMarker = new G.Marker({
        position: pts[splitIdx],
        map,
        icon: pkgIcon,
        title: trackingCode ?? 'Package',
        zIndex: 20,
      });

      // Animate package along route with small drift
      let rafId: number;
      let drift = 0;
      let dir = 1;
      const DRIFT_MAX = Math.min(0.02, 0.5 / pts.length);

      const tick = () => {
        if (cancelled) return;
        if (status !== 'delivered' && status !== 'pending' && status !== 'escrow_locked') {
          drift += 0.0003 * dir;
          if (drift > DRIFT_MAX) dir = -1;
          if (drift < -DRIFT_MAX) dir = 1;
          const idx = Math.max(0, Math.min(pts.length - 1, Math.floor((progress + drift) * pts.length)));
          pkgMarker.setPosition(pts[idx]);
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      // Origin label
      new G.InfoWindow({
        content: `<div style="font-size:12px;font-weight:600;color:#1e293b">📦 Origin</div>`,
        disableAutoPan: true,
      });

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        originMarker.setMap(null);
        destMarker.setMap(null);
        pkgMarker.setMap(null);
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
