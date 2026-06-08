/**
 * Map3DGlobe — Google Photorealistic 3D Maps (alpha)
 * Drop-in replacement for CesiumGlobe on the homepage hero.
 *
 * Globe  : gmp-map-3d (Map3DElement), mode HYBRID
 *          HYBRID = photorealistic satellite + Google labels (country/city/street)
 *          Zooms to street level. gestureHandling GREEDY.
 * Routes : Polyline3DInteractiveElement — great-circle slerp (64 pts)
 *          altitudeMode CLAMP_TO_GROUND + geodesic — lines cling to globe, no pop-out
 * Anim   : Polyline3DElement moving window (~16 fps via rAF throttle)
 * Markers: Marker3DInteractiveElement + city label
 * Click  : detail panel + map.flyCameraTo(destination, range 1600 m, tilt 67°)
 * Key    : import.meta.env.VITE_GOOGLE_MAPS_API_KEY  (never hardcoded)
 * Data   : polls /api/routes every 30 s (identical to CesiumGlobe)
 */
import { useEffect, useRef, useState } from 'react';

/* ── Type augmentation ─────────────────────────────────────────────────────── */
declare global {
  interface Window { google: any }
  interface HTMLElementTagNameMap {
    'gmp-map-3d':                    HTMLElement;
    'gmp-polyline-3d':               HTMLElement;
    'gmp-polyline-3d-interactive':   HTMLElement;
    'gmp-marker-3d-interactive':     HTMLElement;
  }
}

/* ── Data types ────────────────────────────────────────────────────────────── */
interface GlobeRoute {
  trackingCode: string;
  origin:      { city: string; country: string; lat: number; lng: number };
  destination: { city: string; country: string; lat: number; lng: number };
  status:      'pending' | 'escrow_locked' | 'assigned' | 'in_transit' | 'delivered' | 'disputed';
  routeType:   'shipment' | 'traveler' | 'buy-for-me';
}
type LLA = { lat: number; lng: number; altitude: number };

/* ── Status colours / labels ──────────────────────────────────────────────── */
const STATUS_HEX: Record<GlobeRoute['status'], string> = {
  pending:      '#eab308',
  escrow_locked:'#a855f7',
  assigned:     '#22d3ee',
  in_transit:   '#3b82f6',
  delivered:    '#22c55e',
  disputed:     '#ef4444',
};
const STATUS_LABEL: Record<GlobeRoute['status'], string> = {
  pending:'Pending', escrow_locked:'Escrow Locked', assigned:'Assigned',
  in_transit:'In Transit', delivered:'Delivered', disputed:'Disputed',
};

/* ── Spherical linear interpolation — great circle (64 points, alt=0) ─────── */
function gcPoints(la1: number, lo1: number, la2: number, lo2: number, N = 64): LLA[] {
  const D = Math.PI / 180;
  const xyz = (la: number, lo: number): [number,number,number] => {
    const r = la*D, g = lo*D;
    return [Math.cos(r)*Math.cos(g), Math.cos(r)*Math.sin(g), Math.sin(r)];
  };
  const p1 = xyz(la1, lo1), p2 = xyz(la2, lo2);
  const dot = Math.min(1, Math.max(-1, p1[0]*p2[0] + p1[1]*p2[1] + p1[2]*p2[2]));
  const omega = Math.acos(dot);
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    if (omega < 1e-10) return { lat: la1, lng: lo1, altitude: 0 };
    const sinO = Math.sin(omega);
    const s0 = Math.sin((1-t)*omega) / sinO;
    const s1 = Math.sin(t*omega)     / sinO;
    const x = s0*p1[0]+s1*p2[0], y = s0*p1[1]+s1*p2[1], z = s0*p1[2]+s1*p2[2];
    return { lat: Math.atan2(z, Math.sqrt(x*x+y*y))/D, lng: Math.atan2(y,x)/D, altitude: 0 };
  });
}

/* ── Google Maps JS API — bootstrap loader (module singleton) ─────────────── */
// Injects the lazy importLibrary shim (identical logic to Google's own snippet).
// importLibrary('maps3d') triggers the actual script fetch & returns the namespace.
let _bootstrapped = false;

function bootstrapGoogleMaps(apiKey: string): void {
  if (_bootstrapped) return;
  _bootstrapped = true;
  const w = window as any;
  if (w.google?.maps?.importLibrary) return;

  w.google        = w.google        || {};
  w.google.maps   = w.google.maps   || {};
  const m         = w.google.maps;
  if (m.importLibrary) return;

  let h: Promise<void> | null = null;
  const libs   = new Set<string>();
  const params = new URLSearchParams({ key: apiKey, v: 'alpha' });

  const triggerLoad = (): Promise<void> =>
    h || (h = new Promise<void>((ok, fail) => {
      params.set('libraries', [...libs].join(','));
      params.set('callback', 'google.maps.__ib__');
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?' + params;
      m['__ib__'] = ok;
      s.onerror = () => { h = null; fail(new Error('Google Maps JS failed to load')); };
      document.head.appendChild(s);
    }));

  // Lazy proxy — after script loads, maps.importLibrary is replaced by the real one
  m.importLibrary = (lib: string, ...rest: any[]) => {
    libs.add(lib);
    return triggerLoad().then(() => m.importLibrary(lib, ...rest));
  };
}

/* ── Per-route animation state ────────────────────────────────────────────── */
interface RouteState {
  base:   any;            // Polyline3DInteractiveElement
  anim:   any;            // Polyline3DElement (moving bright window)
  pts:    LLA[];          // 65 great-circle points
  prog:   number;         // fractional index into pts (float)
  speed:  number;         // pts per frame (~16 fps)
  status: GlobeRoute['status'];
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function Map3DGlobe({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const statesRef    = useRef<Map<string, RouteState>>(new Map());
  const markersRef   = useRef<any[]>([]);
  const rafRef       = useRef(0);
  const lastFrameRef = useRef(0);
  const deadRef      = useRef(false);

  const [routes,   setRoutes]   = useState<GlobeRoute[]>([]);
  const [selected, setSelected] = useState<GlobeRoute | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /* ── Poll /api/routes every 30 s ─────────────────────────────────────────── */
  useEffect(() => {
    const load = () =>
      fetch('/api/routes')
        .then(r => r.ok ? r.json() : [])
        .then(d => setRoutes(Array.isArray(d) ? d : []))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  /* ── Initialise Map3DElement once ────────────────────────────────────────── */
  useEffect(() => {
    deadRef.current = false;
    const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
    if (!key || !containerRef.current) {
      if (!key) console.warn('[Map3DGlobe] VITE_GOOGLE_MAPS_API_KEY is not set');
      return;
    }

    bootstrapGoogleMaps(key);

    (async () => {
      try {
        const { Map3DElement, MapMode } =
          await (window as any).google.maps.importLibrary('maps3d');
        if (deadRef.current || !containerRef.current) return;

        const map = new Map3DElement() as any;
        map.center          = { lat: 32, lng: 51, altitude: 0 };
        map.range           = 12_000_000;
        map.tilt            = 0;
        map.heading         = 0;
        map.mode            = MapMode.HYBRID;
        map.gestureHandling = 'GREEDY';
        map.style.cssText   = 'width:100%;height:100%;display:block;';

        containerRef.current.appendChild(map);
        mapRef.current = map;
        setMapReady(true);
      } catch (e) {
        console.error('[Map3DGlobe] init error:', e);
      }
    })();

    return () => {
      deadRef.current = true;
      cancelAnimationFrame(rafRef.current);
      if (mapRef.current && containerRef.current?.contains(mapRef.current)) {
        containerRef.current.removeChild(mapRef.current);
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-render routes whenever data or map changes ───────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    // Clear previous route elements
    cancelAnimationFrame(rafRef.current);
    statesRef.current.forEach(({ base, anim }) => {
      base.parentNode?.removeChild(base);
      anim.parentNode?.removeChild(anim);
    });
    statesRef.current.clear();
    markersRef.current.forEach(m => m.parentNode?.removeChild(m));
    markersRef.current = [];

    if (!routes.length) return;

    (async () => {
      const {
        Polyline3DInteractiveElement,
        Polyline3DElement,
        Marker3DInteractiveElement,
        AltitudeMode,
      } = await (window as any).google.maps.importLibrary('maps3d');

      if (deadRef.current) return;

      const cities = new Map<string, { city:string; country:string; lat:number; lng:number }>();

      for (const route of routes) {
        const hex = STATUS_HEX[route.status] ?? '#3b82f6';
        const pts = gcPoints(
          route.origin.lat, route.origin.lng,
          route.destination.lat, route.destination.lng,
          64,
        );
        const speed = route.status === 'in_transit' ? 0.30
                    : route.status === 'assigned'   ? 0.18
                    :                                 0.10;

        // ── Static base route (interactive — handles gmp-click) ─────────────
        const base = new Polyline3DInteractiveElement();
        base.strokeColor  = hex + '99';   // semi-transparent base
        base.strokeWidth  = 6;
        base.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        base.geodesic     = true;
        base.coordinates  = pts;

        // ── Animated bright window ───────────────────────────────────────────
        const anim = new Polyline3DElement();
        anim.strokeColor  = hex + 'ee';   // bright moving glow
        anim.strokeWidth  = 9;
        anim.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        anim.geodesic     = true;
        anim.coordinates  = pts.slice(0, 12);

        // ── Click handler ────────────────────────────────────────────────────
        const captured = route;
        base.addEventListener('gmp-click', () => {
          setSelected(captured);
          (map as any).flyCameraTo({
            endCamera: {
              center:  { lat: captured.destination.lat, lng: captured.destination.lng, altitude: 0 },
              range:   1600,
              tilt:    67,
              heading: 0,
            },
            durationMillis: 3500,
          });
        });

        map.appendChild(base);
        map.appendChild(anim);

        statesRef.current.set(route.trackingCode, {
          base, anim, pts,
          prog:   Math.random() * pts.length,
          speed,
          status: route.status,
        });

        // City deduplication for markers
        const ok = `${route.origin.lat},${route.origin.lng}`;
        const dk = `${route.destination.lat},${route.destination.lng}`;
        if (!cities.has(ok)) cities.set(ok, route.origin);
        if (!cities.has(dk)) cities.set(dk, route.destination);
      }

      /* ── City markers ──────────────────────────────────────────────────── */
      for (const [, city] of cities) {
        const m = new Marker3DInteractiveElement();
        m.position    = { lat: city.lat, lng: city.lng, altitude: 0 };
        m.label       = city.city;
        m.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;

        const cc = city;
        m.addEventListener('gmp-click', () => {
          const match = routes.find(r =>
            (r.destination.lat === cc.lat && r.destination.lng === cc.lng) ||
            (r.origin.lat      === cc.lat && r.origin.lng      === cc.lng)
          );
          if (!match) return;
          setSelected(match);
          (map as any).flyCameraTo({
            endCamera: { center: { lat: cc.lat, lng: cc.lng, altitude: 0 }, range: 1600, tilt: 67, heading: 0 },
            durationMillis: 3500,
          });
        });

        map.appendChild(m);
        markersRef.current.push(m);
      }

      /* ── ~16 fps animation loop ─────────────────────────────────────────── */
      const WINDOW  = 12;
      const FRAME_MS = 1000 / 16;

      const tick = (now: number) => {
        if (deadRef.current) return;
        rafRef.current = requestAnimationFrame(tick);
        if (now - lastFrameRef.current < FRAME_MS) return;
        lastFrameRef.current = now;

        statesRef.current.forEach(st => {
          if (st.status === 'delivered' || st.status === 'disputed') return;
          st.prog = (st.prog + st.speed) % st.pts.length;
          const s = Math.floor(st.prog);
          st.anim.coordinates = Array.from({ length: WINDOW }, (_, i) =>
            st.pts[(s + i) % st.pts.length]
          );
        });
      };
      rafRef.current = requestAnimationFrame(tick);
    })().catch(err => console.error('[Map3DGlobe] routes render error:', err));
  }, [routes, mapReady]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div
      className={className}
      style={{ position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      {/* Map fills the wrapper — gmp-map-3d is appended here imperatively */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />

      {/* Detail panel — appears on route/marker click */}
      {selected && (
        <div
          className="absolute bottom-8 left-6 z-30 w-72 rounded-2xl border border-white/15 p-5 shadow-2xl pointer-events-auto"
          style={{ background: 'rgba(1,4,9,.90)', backdropFilter: 'blur(24px)' }}
        >
          {/* Close */}
          <button
            onClick={() => setSelected(null)}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 text-xs transition-all"
          >✕</button>

          {/* Tracking code */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: STATUS_HEX[selected.status] }} />
            <span className="font-mono text-[11px] text-gray-400">{selected.trackingCode}</span>
          </div>

          {/* Route */}
          <div className="text-base font-bold text-white mb-0.5">
            {selected.origin.city} → {selected.destination.city}
          </div>
          <div className="text-xs text-gray-500 mb-3">
            {selected.origin.country} → {selected.destination.country}
          </div>

          {/* Status badge */}
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: STATUS_HEX[selected.status] + '22',
              color:           STATUS_HEX[selected.status],
              borderColor:     STATUS_HEX[selected.status] + '40',
            }}
          >
            {STATUS_LABEL[selected.status]}
          </span>

          {/* Link */}
          <div className="mt-4 pt-3 border-t border-white/8">
            <a
              href={`/track/${selected.trackingCode}`}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View full tracking →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
