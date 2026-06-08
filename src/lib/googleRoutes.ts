import type { LatLng } from '../types/tracking';

export interface RouteResult {
  points: LatLng[];
  distanceText: string;
  durationText: string;
  distanceKm: number;
  isAirRoute: boolean;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function greatCirclePoints(origin: LatLng, destination: LatLng, n = 80): LatLng[] {
  const D = Math.PI / 180;
  const R = 1 / D;
  const oLat = origin.lat * D;
  const oLng = origin.lng * D;
  const dLat = destination.lat * D;
  const dLng = destination.lng * D;

  const dLa = dLat - oLat;
  const dLo = dLng - oLng;
  const a =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(oLat) * Math.cos(dLat) * Math.sin(dLo / 2) ** 2;
  const ang = 2 * Math.asin(Math.sqrt(Math.min(1, a)));

  if (ang < 1e-6) return [origin, destination];

  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const A = Math.sin((1 - t) * ang) / Math.sin(ang);
    const B = Math.sin(t * ang) / Math.sin(ang);
    const x = A * Math.cos(oLat) * Math.cos(oLng) + B * Math.cos(dLat) * Math.cos(dLng);
    const y = A * Math.cos(oLat) * Math.sin(oLng) + B * Math.cos(dLat) * Math.sin(dLng);
    const z = A * Math.sin(oLat) + B * Math.sin(dLat);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * R;
    const lng = Math.atan2(y, x) * R;
    return { lat, lng };
  });
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km).toLocaleString()} km`;
}

function estimateDuration(km: number): string {
  if (km < 500) {
    const hours = Math.ceil(km / 60);
    return hours <= 24 ? `${hours} hrs` : `${Math.ceil(hours / 24)} days`;
  }
  // International air + handling
  const flightHours = Math.ceil(km / 800);
  const totalDays = Math.ceil(flightHours / 24) + 3;
  return `${totalDays}–${totalDays + 4} days`;
}

async function tryRoutesApi(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string,
): Promise<{ points: LatLng[]; distanceKm: number; durationText: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
        computeAlternativeRoutes: false,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return null;
    const km = (route.distanceMeters ?? 0) / 1000;
    const durationSec = parseInt(route.duration ?? '0', 10);
    const durationText =
      durationSec > 0
        ? durationSec < 3600
          ? `${Math.ceil(durationSec / 60)} min`
          : `${Math.ceil(durationSec / 3600)} hrs`
        : estimateDuration(km);
    return {
      points: decodePolyline(route.polyline.encodedPolyline),
      distanceKm: km,
      durationText,
    };
  } catch {
    return null;
  }
}

export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RouteResult> {
  const distKm = haversineKm(originLat, originLng, destLat, destLng);
  const isAirRoute = distKm > 800;
  const origin = { lat: originLat, lng: originLng };
  const dest = { lat: destLat, lng: destLng };

  // For short routes try the Routes API for real road geometry
  if (!isAirRoute) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (apiKey) {
      const road = await tryRoutesApi(originLat, originLng, destLat, destLng, apiKey);
      if (road && road.points.length > 1) {
        return {
          points: road.points,
          distanceKm: road.distanceKm,
          distanceText: formatDistance(road.distanceKm),
          durationText: road.durationText,
          isAirRoute: false,
        };
      }
    }
  }

  // Great circle for international / fallback
  const points = greatCirclePoints(origin, dest);
  return {
    points,
    distanceKm: distKm,
    distanceText: formatDistance(distKm),
    durationText: estimateDuration(distKm),
    isAirRoute,
  };
}
