import Globe from 'react-globe.gl';
import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CityType = 'iran-hub' | 'global-hub';
export type RouteType = 'shipment' | 'traveler' | 'buy-for-me';
export type RouteStatus = 'active' | 'pending' | 'completed';

export interface ChaparCity {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  type: CityType;
}

export interface ChaparRoute {
  id: string;
  origin: ChaparCity;
  destination: ChaparCity;
  type: RouteType;
  status: RouteStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY REGISTRY  — replace / extend with API data
// ─────────────────────────────────────────────────────────────────────────────

const C: Record<string, ChaparCity> = {
  // Iran hubs
  tehran:       { id: 'tehran',        city: 'Tehran',        country: 'Iran',         lat: 35.69, lng: 51.39,  type: 'iran-hub' },
  mashhad:      { id: 'mashhad',       city: 'Mashhad',       country: 'Iran',         lat: 36.30, lng: 59.60,  type: 'iran-hub' },
  isfahan:      { id: 'isfahan',       city: 'Isfahan',       country: 'Iran',         lat: 32.66, lng: 51.68,  type: 'iran-hub' },
  shiraz:       { id: 'shiraz',        city: 'Shiraz',        country: 'Iran',         lat: 29.59, lng: 52.58,  type: 'iran-hub' },
  tabriz:       { id: 'tabriz',        city: 'Tabriz',        country: 'Iran',         lat: 38.08, lng: 46.29,  type: 'iran-hub' },
  ahvaz:        { id: 'ahvaz',         city: 'Ahvaz',         country: 'Iran',         lat: 31.32, lng: 48.67,  type: 'iran-hub' },
  bandarabbas:  { id: 'bandarabbas',   city: 'Bandar Abbas',  country: 'Iran',         lat: 27.19, lng: 56.27,  type: 'iran-hub' },
  kish:         { id: 'kish',          city: 'Kish',          country: 'Iran',         lat: 26.55, lng: 53.98,  type: 'iran-hub' },
  // North America
  toronto:      { id: 'toronto',       city: 'Toronto',       country: 'Canada',       lat: 43.65, lng: -79.38, type: 'global-hub' },
  vancouver:    { id: 'vancouver',     city: 'Vancouver',     country: 'Canada',       lat: 49.28, lng: -123.12,type: 'global-hub' },
  montreal:     { id: 'montreal',      city: 'Montreal',      country: 'Canada',       lat: 45.50, lng: -73.57, type: 'global-hub' },
  newyork:      { id: 'newyork',       city: 'New York',      country: 'USA',          lat: 40.71, lng: -74.01, type: 'global-hub' },
  losangeles:   { id: 'losangeles',    city: 'Los Angeles',   country: 'USA',          lat: 34.05, lng: -118.24,type: 'global-hub' },
  chicago:      { id: 'chicago',       city: 'Chicago',       country: 'USA',          lat: 41.88, lng: -87.63, type: 'global-hub' },
  // Europe
  london:       { id: 'london',        city: 'London',        country: 'UK',           lat: 51.51, lng: -0.13,  type: 'global-hub' },
  paris:        { id: 'paris',         city: 'Paris',         country: 'France',       lat: 48.86, lng: 2.35,   type: 'global-hub' },
  frankfurt:    { id: 'frankfurt',     city: 'Frankfurt',     country: 'Germany',      lat: 50.11, lng: 8.68,   type: 'global-hub' },
  amsterdam:    { id: 'amsterdam',     city: 'Amsterdam',     country: 'Netherlands',  lat: 52.37, lng: 4.90,   type: 'global-hub' },
  madrid:       { id: 'madrid',        city: 'Madrid',        country: 'Spain',        lat: 40.42, lng: -3.70,  type: 'global-hub' },
  rome:         { id: 'rome',          city: 'Rome',          country: 'Italy',        lat: 41.90, lng: 12.50,  type: 'global-hub' },
  stockholm:    { id: 'stockholm',     city: 'Stockholm',     country: 'Sweden',       lat: 59.33, lng: 18.07,  type: 'global-hub' },
  // Middle East & Turkey
  istanbul:     { id: 'istanbul',      city: 'Istanbul',      country: 'Turkey',       lat: 41.01, lng: 28.95,  type: 'global-hub' },
  dubai:        { id: 'dubai',         city: 'Dubai',         country: 'UAE',          lat: 25.20, lng: 55.27,  type: 'global-hub' },
  abudhabi:     { id: 'abudhabi',      city: 'Abu Dhabi',     country: 'UAE',          lat: 24.45, lng: 54.38,  type: 'global-hub' },
  doha:         { id: 'doha',          city: 'Doha',          country: 'Qatar',        lat: 25.29, lng: 51.53,  type: 'global-hub' },
  // Russia & CIS
  moscow:       { id: 'moscow',        city: 'Moscow',        country: 'Russia',       lat: 55.75, lng: 37.62,  type: 'global-hub' },
  // East & SE Asia
  singapore:    { id: 'singapore',     city: 'Singapore',     country: 'Singapore',    lat: 1.35,  lng: 103.82, type: 'global-hub' },
  tokyo:        { id: 'tokyo',         city: 'Tokyo',         country: 'Japan',        lat: 35.68, lng: 139.69, type: 'global-hub' },
  seoul:        { id: 'seoul',         city: 'Seoul',         country: 'South Korea',  lat: 37.57, lng: 126.98, type: 'global-hub' },
  hongkong:     { id: 'hongkong',      city: 'Hong Kong',     country: 'China',        lat: 22.30, lng: 114.18, type: 'global-hub' },
  shanghai:     { id: 'shanghai',      city: 'Shanghai',      country: 'China',        lat: 31.23, lng: 121.47, type: 'global-hub' },
  beijing:      { id: 'beijing',       city: 'Beijing',       country: 'China',        lat: 39.91, lng: 116.39, type: 'global-hub' },
  bangkok:      { id: 'bangkok',       city: 'Bangkok',       country: 'Thailand',     lat: 13.75, lng: 100.52, type: 'global-hub' },
  kualalumpur:  { id: 'kualalumpur',   city: 'Kuala Lumpur',  country: 'Malaysia',     lat: 3.14,  lng: 101.69, type: 'global-hub' },
  // South Asia
  mumbai:       { id: 'mumbai',        city: 'Mumbai',        country: 'India',        lat: 19.08, lng: 72.88,  type: 'global-hub' },
  delhi:        { id: 'delhi',         city: 'Delhi',         country: 'India',        lat: 28.61, lng: 77.23,  type: 'global-hub' },
  // Oceania
  sydney:       { id: 'sydney',        city: 'Sydney',        country: 'Australia',    lat: -33.87,lng: 151.21, type: 'global-hub' },
  melbourne:    { id: 'melbourne',     city: 'Melbourne',     country: 'Australia',    lat: -37.81,lng: 144.96, type: 'global-hub' },
  auckland:     { id: 'auckland',      city: 'Auckland',      country: 'New Zealand',  lat: -36.86,lng: 174.77, type: 'global-hub' },
  // Africa
  johannesburg: { id: 'johannesburg',  city: 'Johannesburg',  country: 'South Africa', lat: -26.20,lng: 28.04,  type: 'global-hub' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Routes are now stored in the backend (routes.json) and served via /api/routes.
// The globe reads live data — no hardcoded routes here.
// ─────────────────────────────────────────────────────────────────────────────

// Route visualization data is now derived from live API data in CesiumGlobe.tsx.

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

class GlobeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn('Globe WebGL error:', e.message); }
  render() {
    if (this.state.hasError) return <div style={{ width: '100%', height: '100%', background: '#04070f' }} />;
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBE INNER
// ─────────────────────────────────────────────────────────────────────────────

function GlobeInner({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const autoRotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleGlobeReady = (globe: any) => {
    const controls = globe.controls();

    // Initial camera — Iran-centric, slight zoom-out to show full region
    globe.pointOfView({ lat: 30, lng: 48, altitude: 1.75 }, 0);

    // Auto-rotation (slow, cinematic)
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;

    // Full Google Earth-like controls
    controls.enableZoom = true;
    controls.zoomSpeed = 0.7;
    controls.minDistance = 108;   // just above surface
    controls.maxDistance = 450;   // wide-angle full globe

    // Smooth inertia / damping — essential for Google Earth feel
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.6;

    // Pause auto-rotate while user is interacting; resume after 2.5 s idle
    const pause = () => {
      controls.autoRotate = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      autoRotateTimer.current = setTimeout(() => { controls.autoRotate = true; }, 2500);
    };
    controls.addEventListener('start', pause);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      // Prevent browser from taking over touch gestures (scroll / pinch)
      // so OrbitControls can handle them natively
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {dims.w > 0 && (
        <Globe
          width={dims.w}
          height={dims.h}

          // Transparent WebGL background (hero CSS handles the dark bg)
          backgroundColor="rgba(0,0,0,0)"

          // Atmosphere — thin realistic blue haze
          atmosphereColor="#5aadff"
          atmosphereAltitude={0.18}

          // ── Textures ─────────────────────────────────────────────────────
          // Blue Marble 4096×2048 — highest quality realistic Earth
          globeImageUrl="/assets/earth-blue-marble.jpg"
          // Terrain bump for realistic mountain depth
          bumpImageUrl="/assets/earth-topology.png"
          // Star field background
          backgroundImageUrl="/assets/night-sky.png"

          // ── Full pointer & touch interaction ─────────────────────────────
          enablePointerInteraction={true}

          onGlobeReady={handleGlobeReady}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function EarthGlobe({ className }: { className?: string }) {
  return (
    <GlobeErrorBoundary>
      <GlobeInner className={className} />
    </GlobeErrorBoundary>
  );
}
