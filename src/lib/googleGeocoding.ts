export interface GeocodeResult {
  lat: number;
  lng: number;
  city: string;
  country: string;
  formattedAddress: string;
}

const FALLBACK: Record<string, GeocodeResult> = {
  'tehran,iran':         { lat: 35.6892, lng: 51.3890,   city: 'Tehran',       country: 'Iran',        formattedAddress: 'Tehran, Iran' },
  'mashhad,iran':        { lat: 36.2970, lng: 59.6062,   city: 'Mashhad',      country: 'Iran',        formattedAddress: 'Mashhad, Iran' },
  'isfahan,iran':        { lat: 32.6546, lng: 51.6680,   city: 'Isfahan',      country: 'Iran',        formattedAddress: 'Isfahan, Iran' },
  'shiraz,iran':         { lat: 29.5918, lng: 52.5836,   city: 'Shiraz',       country: 'Iran',        formattedAddress: 'Shiraz, Iran' },
  'tabriz,iran':         { lat: 38.0800, lng: 46.2919,   city: 'Tabriz',       country: 'Iran',        formattedAddress: 'Tabriz, Iran' },
  'tehran,islamic republic of iran': { lat: 35.6892, lng: 51.3890, city: 'Tehran', country: 'Iran', formattedAddress: 'Tehran, Iran' },
  'toronto,canada':      { lat: 43.6532, lng: -79.3832,  city: 'Toronto',      country: 'Canada',      formattedAddress: 'Toronto, ON, Canada' },
  'vancouver,canada':    { lat: 49.2827, lng: -123.1207, city: 'Vancouver',    country: 'Canada',      formattedAddress: 'Vancouver, BC, Canada' },
  'montreal,canada':     { lat: 45.5017, lng: -73.5673,  city: 'Montreal',     country: 'Canada',      formattedAddress: 'Montreal, QC, Canada' },
  'new york,usa':        { lat: 40.7128, lng: -74.0060,  city: 'New York',     country: 'USA',         formattedAddress: 'New York, NY, USA' },
  'new york,united states': { lat: 40.7128, lng: -74.0060, city: 'New York',  country: 'USA',         formattedAddress: 'New York, NY, USA' },
  'los angeles,usa':     { lat: 34.0522, lng: -118.2437, city: 'Los Angeles',  country: 'USA',         formattedAddress: 'Los Angeles, CA, USA' },
  'london,uk':           { lat: 51.5074, lng: -0.1278,   city: 'London',       country: 'UK',          formattedAddress: 'London, UK' },
  'london,united kingdom': { lat: 51.5074, lng: -0.1278, city: 'London',      country: 'UK',          formattedAddress: 'London, UK' },
  'paris,france':        { lat: 48.8566, lng: 2.3522,    city: 'Paris',        country: 'France',      formattedAddress: 'Paris, France' },
  'frankfurt,germany':   { lat: 50.1109, lng: 8.6821,    city: 'Frankfurt',    country: 'Germany',     formattedAddress: 'Frankfurt, Germany' },
  'berlin,germany':      { lat: 52.5200, lng: 13.4050,   city: 'Berlin',       country: 'Germany',     formattedAddress: 'Berlin, Germany' },
  'istanbul,turkey':     { lat: 41.0082, lng: 28.9784,   city: 'Istanbul',     country: 'Turkey',      formattedAddress: 'Istanbul, Turkey' },
  'dubai,uae':           { lat: 25.2048, lng: 55.2708,   city: 'Dubai',        country: 'UAE',         formattedAddress: 'Dubai, UAE' },
  'dubai,united arab emirates': { lat: 25.2048, lng: 55.2708, city: 'Dubai',  country: 'UAE',         formattedAddress: 'Dubai, UAE' },
  'abu dhabi,uae':       { lat: 24.4539, lng: 54.3773,   city: 'Abu Dhabi',    country: 'UAE',         formattedAddress: 'Abu Dhabi, UAE' },
  'doha,qatar':          { lat: 25.2854, lng: 51.5310,   city: 'Doha',         country: 'Qatar',       formattedAddress: 'Doha, Qatar' },
  'moscow,russia':       { lat: 55.7558, lng: 37.6176,   city: 'Moscow',       country: 'Russia',      formattedAddress: 'Moscow, Russia' },
  'singapore,singapore': { lat: 1.3521,  lng: 103.8198,  city: 'Singapore',    country: 'Singapore',   formattedAddress: 'Singapore' },
  'tokyo,japan':         { lat: 35.6762, lng: 139.6503,  city: 'Tokyo',        country: 'Japan',       formattedAddress: 'Tokyo, Japan' },
  'sydney,australia':    { lat: -33.8688,lng: 151.2093,  city: 'Sydney',       country: 'Australia',   formattedAddress: 'Sydney, NSW, Australia' },
  'stockholm,sweden':    { lat: 59.3293, lng: 18.0686,   city: 'Stockholm',    country: 'Sweden',      formattedAddress: 'Stockholm, Sweden' },
  'amsterdam,netherlands': { lat: 52.3676, lng: 4.9041,  city: 'Amsterdam',   country: 'Netherlands', formattedAddress: 'Amsterdam, Netherlands' },
  'madrid,spain':        { lat: 40.4168, lng: -3.7038,   city: 'Madrid',       country: 'Spain',       formattedAddress: 'Madrid, Spain' },
  'rome,italy':          { lat: 41.9028, lng: 12.4964,   city: 'Rome',         country: 'Italy',       formattedAddress: 'Rome, Italy' },
};

function fallbackLookup(city: string, country: string): GeocodeResult | null {
  const key = `${city.trim().toLowerCase()},${country.trim().toLowerCase()}`;
  return FALLBACK[key] ?? null;
}

export async function geocodeAddress(
  street: string,
  city: string,
  country: string,
  postalCode?: string,
): Promise<GeocodeResult> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  if (apiKey) {
    try {
      const parts = [street, city, postalCode, country].filter(Boolean).join(', ');
      const query = encodeURIComponent(parts);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          const formatted = data.results[0].formatted_address as string;
          const cityComp = data.results[0].address_components?.find(
            (c: any) => c.types.includes('locality') || c.types.includes('administrative_area_level_1'),
          );
          const countryComp = data.results[0].address_components?.find(
            (c: any) => c.types.includes('country'),
          );
          return {
            lat: loc.lat,
            lng: loc.lng,
            city: cityComp?.long_name ?? city,
            country: countryComp?.long_name ?? country,
            formattedAddress: formatted,
          };
        }
        if (data.status !== 'OK') {
          throw new Error(`Geocoding API: ${data.status}`);
        }
      }
    } catch (err: any) {
      const fallback = fallbackLookup(city, country);
      if (fallback) return fallback;
      throw new Error(`Geocoding failed: ${err.message}`);
    }
  }

  const fallback = fallbackLookup(city, country);
  if (fallback) return fallback;

  throw new Error(
    apiKey
      ? `Could not geocode "${city}, ${country}". Check the address and try again.`
      : `No API key configured. Please enter a known city.`,
  );
}
