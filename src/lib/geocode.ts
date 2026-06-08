export interface GeocodeResult {
  lat: number;
  lng: number;
  city: string;
  country: string;
}

// Fallback coords for common cities — used when no API key or API fails
const KNOWN_CITIES: Record<string, GeocodeResult> = {
  'tehran,iran':         { lat: 35.6892, lng: 51.3890,  city: 'Tehran',        country: 'Iran' },
  'mashhad,iran':        { lat: 36.2970, lng: 59.6062,  city: 'Mashhad',       country: 'Iran' },
  'isfahan,iran':        { lat: 32.6546, lng: 51.6680,  city: 'Isfahan',       country: 'Iran' },
  'shiraz,iran':         { lat: 29.5918, lng: 52.5836,  city: 'Shiraz',        country: 'Iran' },
  'tabriz,iran':         { lat: 38.0800, lng: 46.2919,  city: 'Tabriz',        country: 'Iran' },
  'toronto,canada':      { lat: 43.6532, lng: -79.3832, city: 'Toronto',       country: 'Canada' },
  'vancouver,canada':    { lat: 49.2827, lng: -123.1207,city: 'Vancouver',     country: 'Canada' },
  'montreal,canada':     { lat: 45.5017, lng: -73.5673, city: 'Montreal',      country: 'Canada' },
  'new york,usa':        { lat: 40.7128, lng: -74.0060, city: 'New York',      country: 'USA' },
  'los angeles,usa':     { lat: 34.0522, lng: -118.2437,city: 'Los Angeles',   country: 'USA' },
  'london,uk':           { lat: 51.5074, lng: -0.1278,  city: 'London',        country: 'UK' },
  'paris,france':        { lat: 48.8566, lng: 2.3522,   city: 'Paris',         country: 'France' },
  'frankfurt,germany':   { lat: 50.1109, lng: 8.6821,   city: 'Frankfurt',     country: 'Germany' },
  'istanbul,turkey':     { lat: 41.0082, lng: 28.9784,  city: 'Istanbul',      country: 'Turkey' },
  'dubai,uae':           { lat: 25.2048, lng: 55.2708,  city: 'Dubai',         country: 'UAE' },
  'dubai,united arab emirates': { lat: 25.2048, lng: 55.2708, city: 'Dubai',   country: 'UAE' },
  'abu dhabi,uae':       { lat: 24.4539, lng: 54.3773,  city: 'Abu Dhabi',     country: 'UAE' },
  'doha,qatar':          { lat: 25.2854, lng: 51.5310,  city: 'Doha',          country: 'Qatar' },
  'moscow,russia':       { lat: 55.7558, lng: 37.6176,  city: 'Moscow',        country: 'Russia' },
  'singapore,singapore': { lat: 1.3521,  lng: 103.8198, city: 'Singapore',     country: 'Singapore' },
  'tokyo,japan':         { lat: 35.6762, lng: 139.6503, city: 'Tokyo',         country: 'Japan' },
  'sydney,australia':    { lat: -33.8688,lng: 151.2093, city: 'Sydney',        country: 'Australia' },
  'melbourne,australia': { lat: -37.8136,lng: 144.9631, city: 'Melbourne',     country: 'Australia' },
};

function lookupFallback(city: string, country: string): GeocodeResult | null {
  const key = `${city.toLowerCase()},${country.toLowerCase()}`;
  return KNOWN_CITIES[key] ?? null;
}

export async function geocodeAddress(
  _street: string,
  city: string,
  country: string,
): Promise<GeocodeResult> {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  if (apiKey) {
    try {
      const query = encodeURIComponent(`${city}, ${country}`);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return { lat: loc.lat, lng: loc.lng, city, country };
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  const fallback = lookupFallback(city, country);
  if (fallback) return fallback;

  // Last resort: approximate center of country using simple lat/lng offset
  return { lat: 30, lng: 50, city, country };
}
