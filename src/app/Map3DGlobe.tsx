/**
 * Map3DGlobe v2 — Google Photorealistic 3D Maps (alpha)
 *
 * v2 additions over v1:
 *  1. Comet     – bright 8-point moving window (Polyline3DElement) per active route
 *  2. Pulsing rings – 2 × expanding/fading ring circles per city (radar effect)
 *  3. Tracking panel – top-left search: fly-to + detail card on match
 *  4. gestureHandling COOPERATIVE + scroll-down arrow (bottom-center)
 *
 * Globe  : gmp-map-3d, HYBRID mode, gestureHandling COOPERATIVE
 * Routes : Polyline3DInteractiveElement CLAMP_TO_GROUND + geodesic (clings to globe)
 * Key    : import.meta.env.VITE_GOOGLE_MAPS_API_KEY
 * Data   : /api/routes polled every 30 s
 */
import { useEffect, useRef, useState } from 'react';

/* ── Global type stubs ─────────────────────────────────────────────────────── */
declare global {
  interface Window { google: any }
  interface HTMLElementTagNameMap {
    'gmp-map-3d':                   HTMLElement;
    'gmp-polyline-3d':              HTMLElement;
    'gmp-polyline-3d-interactive':  HTMLElement;
    'gmp-marker-3d-interactive':    HTMLElement;
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

/* ── Geometry helpers ─────────────────────────────────────────────────────── */

// Great-circle slerp — N segments, altitude 0 (used with CLAMP_TO_GROUND)
function gcPoints(la1: number, lo1: number, la2: number, lo2: number, N = 64): LLA[] {
  const D = Math.PI / 180;
  const xyz = (la: number, lo: number): [number,number,number] => {
    const r=la*D, g=lo*D;
    return [Math.cos(r)*Math.cos(g), Math.cos(r)*Math.sin(g), Math.sin(r)];
  };
  const p1 = xyz(la1,lo1), p2 = xyz(la2,lo2);
  const dot = Math.min(1, Math.max(-1, p1[0]*p2[0]+p1[1]*p2[1]+p1[2]*p2[2]));
  const omega = Math.acos(dot);
  return Array.from({length:N+1}, (_,i) => {
    const t=i/N;
    if (omega<1e-10) return {lat:la1, lng:lo1, altitude:0};
    const sinO = Math.sin(omega);
    const s0=Math.sin((1-t)*omega)/sinO, s1=Math.sin(t*omega)/sinO;
    const x=s0*p1[0]+s1*p2[0], y=s0*p1[1]+s1*p2[1], z=s0*p1[2]+s1*p2[2];
    return {lat:Math.atan2(z,Math.sqrt(x*x+y*y))/D, lng:Math.atan2(y,x)/D, altitude:0};
  });
}

// Approximate circle of radiusKm around (lat0,lng0) — for pulsing rings
function circleCoords(lat0: number, lng0: number, radiusKm: number, N = 28): LLA[] {
  const D = Math.PI / 180;
  const r = Math.max(0.5, radiusKm);
  const dLat = (r / 6371) / D;
  const dLng = dLat / (Math.cos(lat0 * D) || 0.001);
  return Array.from({length: N+1}, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return { lat: lat0 + dLat*Math.sin(a), lng: lng0 + dLng*Math.cos(a), altitude: 0 };
  });
}

// Append 2-digit hex alpha to a #rrggbb string  →  #rrggbbaa
function withAlpha(hex6: string, alpha: number): string {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex6 + a.toString(16).padStart(2, '0');
}

/* ── Google Maps JS API bootstrap (v=alpha, module singleton) ─────────────── */
let _bootstrapped = false;
function bootstrapGoogleMaps(apiKey: string): void {
  if (_bootstrapped || (window as any).google?.maps?.importLibrary) {
    _bootstrapped = true; return;
  }
  _bootstrapped = true;
  const w = window as any;
  w.google = w.google || {};
  w.google.maps = w.google.maps || {};
  const m = w.google.maps;
  if (m.importLibrary) return;

  let h: Promise<void> | null = null;
  const libs   = new Set<string>();
  const params = new URLSearchParams({ key: apiKey, v: 'alpha' });

  const doLoad = (): Promise<void> => h || (h = new Promise<void>((ok, fail) => {
    params.set('libraries', [...libs].join(','));
    params.set('callback', 'google.maps.__ib__');
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?' + params;
    m['__ib__'] = ok;
    s.onerror = () => { h = null; fail(new Error('Google Maps JS failed to load')); };
    document.head.appendChild(s);
  }));

  m.importLibrary = (lib: string, ...rest: any[]) => {
    libs.add(lib);
    return doLoad().then(() => m.importLibrary(lib, ...rest));
  };
}

/* ── Animation state types ────────────────────────────────────────────────── */
interface RouteState {
  base:   any;        // Polyline3DInteractiveElement — dim static full route
  comet:  any;        // Polyline3DElement — bright 8-pt moving window
  pts:    LLA[];      // 65 great-circle points
  prog:   number;     // float index (advances each frame)
  speed:  number;     // pts / frame at ~15 fps
  status: GlobeRoute['status'];
}
interface CityRingState {
  ring1: any;         // Polyline3DElement — pulse ring A
  ring2: any;         // Polyline3DElement — pulse ring B (staggered)
  lat:   number;
  lng:   number;
  hex:   string;
  t1:    number;      // phase 0–1
  t2:    number;
}

const COMET_W    = 8;           // comet head length in route-points
const RING_MAXKM = 280;         // max pulse-ring radius (km)
const FRAME_MS   = 1000 / 15;  // ~15 fps cap

/* ── Component ────────────────────────────────────────────────────────────── */
export default function Map3DGlobe({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const routeStates  = useRef<Map<string, RouteState>>(new Map());
  const cityRings    = useRef<CityRingState[]>([]);
  const markerEls    = useRef<any[]>([]);
  const rafRef       = useRef(0);
  const lastFrameRef = useRef(0);
  const deadRef      = useRef(false);

  const [routes,     setRoutes]     = useState<GlobeRoute[]>([]);
  const [selected,   setSelected]   = useState<GlobeRoute | null>(null);
  const [mapReady,   setMapReady]   = useState(false);
  const [trackInput, setTrackInput] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);

  /* ── Poll /api/routes every 30 s ─────────────────────────────────────────── */
  useEffect(() => {
    const load = () =>
      fetch('/api/routes').then(r => r.ok ? r.json() : [])
        .then(d => setRoutes(Array.isArray(d) ? d : []))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  /* ── Initialise Map3DElement (once) ──────────────────────────────────────── */
  useEffect(() => {
    deadRef.current = false;
    const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
    if (!key || !containerRef.current) {
      if (!key) console.warn('[Map3DGlobe] VITE_GOOGLE_MAPS_API_KEY not set');
      return;
    }
    bootstrapGoogleMaps(key);
    (async () => {
      try {
        const { Map3DElement, MapMode } = await (window as any).google.maps.importLibrary('maps3d');
        if (deadRef.current || !containerRef.current) return;

        const map = new Map3DElement() as any;
        map.center          = { lat: 32, lng: 51, altitude: 0 };
        map.range           = 12_000_000;
        map.tilt            = 0;
        map.heading         = 0;
        map.mode            = MapMode.HYBRID;
        map.gestureHandling = 'COOPERATIVE'; // normal scroll passes through; pinch/ctrl+scroll = zoom globe
        map.style.cssText   = 'width:100%;height:100%;display:block;';

        containerRef.current.appendChild(map);
        mapRef.current = map;
        setMapReady(true);
      } catch (e) { console.error('[Map3DGlobe] init:', e); }
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

  /* ── Re-render routes when data or map changes ───────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    cancelAnimationFrame(rafRef.current);
    routeStates.current.forEach(({ base, comet }) => {
      base.parentNode?.removeChild(base);
      comet.parentNode?.removeChild(comet);
    });
    routeStates.current.clear();
    cityRings.current.forEach(({ ring1, ring2 }) => {
      ring1.parentNode?.removeChild(ring1);
      ring2.parentNode?.removeChild(ring2);
    });
    cityRings.current = [];
    markerEls.current.forEach(m => m.parentNode?.removeChild(m));
    markerEls.current = [];

    if (!routes.length) return;

    (async () => {
      const {
        Polyline3DInteractiveElement,
        Polyline3DElement,
        Marker3DInteractiveElement,
        AltitudeMode,
      } = await (window as any).google.maps.importLibrary('maps3d');
      if (deadRef.current) return;

      const cities = new Map<string, { city:string; country:string; lat:number; lng:number; hex:string }>();

      for (const route of routes) {
        const hex  = STATUS_HEX[route.status] ?? '#3b82f6';
        const pts  = gcPoints(route.origin.lat, route.origin.lng, route.destination.lat, route.destination.lng, 64);
        const spd  = route.status === 'in_transit' ? 0.38
                   : route.status === 'assigned'   ? 0.22
                   :                                 0.13;

        // Dim static base line — interactive so gmp-click works
        const base = new Polyline3DInteractiveElement();
        base.strokeColor  = withAlpha(hex, 0.40);
        base.strokeWidth  = 5;
        base.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        base.geodesic     = true;
        base.coordinates  = pts;

        // Bright comet window that races along the route
        const comet = new Polyline3DElement();
        comet.strokeColor  = withAlpha(hex, 0.95);
        comet.strokeWidth  = 12;
        comet.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        comet.geodesic     = true;
        comet.coordinates  = pts.slice(0, COMET_W);

        const captured = route;
        base.addEventListener('gmp-click', () => _flyTo(map, captured));

        map.appendChild(base);
        map.appendChild(comet);
        routeStates.current.set(route.trackingCode, {
          base, comet, pts,
          prog:   Math.random() * pts.length,
          speed:  spd,
          status: route.status,
        });

        const ok = `${route.origin.lat},${route.origin.lng}`;
        const dk = `${route.destination.lat},${route.destination.lng}`;
        if (!cities.has(ok)) cities.set(ok, { ...route.origin, hex });
        if (!cities.has(dk)) cities.set(dk, { ...route.destination, hex });
      }

      // Pulsing rings + markers per city
      for (const [, c] of cities) {
        const makeRing = (): any => {
          const r = new Polyline3DElement();
          r.strokeWidth  = 3;
          r.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
          r.geodesic     = false;
          r.strokeColor  = withAlpha(c.hex, 0);
          r.coordinates  = circleCoords(c.lat, c.lng, 1, 28);
          return r;
        };
        const ring1 = makeRing(), ring2 = makeRing();
        map.appendChild(ring1);
        map.appendChild(ring2);
        cityRings.current.push({
          ring1, ring2,
          lat: c.lat, lng: c.lng, hex: c.hex,
          t1: Math.random(),
          t2: (Math.random() + 0.5) % 1,
        });

        const marker = new Marker3DInteractiveElement();
        marker.position     = { lat: c.lat, lng: c.lng, altitude: 0 };
        marker.label        = c.city;
        marker.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        const cc = c;
        marker.addEventListener('gmp-click', () => {
          const match = routes.find(r =>
            (r.destination.lat === cc.lat && r.destination.lng === cc.lng) ||
            (r.origin.lat      === cc.lat && r.origin.lng      === cc.lng)
          );
          if (match) _flyTo(map, match);
        });
        map.appendChild(marker);
        markerEls.current.push(marker);
      }

      // ~15 fps animation loop
      const tick = (now: number) => {
        if (deadRef.current) return;
        rafRef.current = requestAnimationFrame(tick);
        if (now - lastFrameRef.current < FRAME_MS) return;
        lastFrameRef.current = now;

        // Advance comet window
        routeStates.current.forEach(st => {
          if (st.status === 'delivered' || st.status === 'disputed') return;
          st.prog = (st.prog + st.speed) % st.pts.length;
          const s = Math.floor(st.prog);
          st.comet.coordinates = Array.from({ length: COMET_W }, (_, i) =>
            st.pts[(s + i) % st.pts.length]
          );
        });

        // Expand + fade rings
        cityRings.current.forEach(cr => {
          cr.t1 = (cr.t1 + 0.007) % 1;
          cr.t2 = (cr.t2 + 0.007) % 1;
          cr.ring1.strokeColor = withAlpha(cr.hex, (1 - cr.t1) * 0.65);
          cr.ring1.coordinates = circleCoords(cr.lat, cr.lng, cr.t1 * RING_MAXKM, 28);
          cr.ring2.strokeColor = withAlpha(cr.hex, (1 - cr.t2) * 0.65);
          cr.ring2.coordinates = circleCoords(cr.lat, cr.lng, cr.t2 * RING_MAXKM, 28);
        });
      };
      rafRef.current = requestAnimationFrame(tick);
    })().catch(e => console.error('[Map3DGlobe] routes render:', e));
  }, [routes, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fly-to (shared by click + tracking search) ──────────────────────────── */
  const _flyTo = (map: any, route: GlobeRoute) => {
    setSelected(route);
    setTrackError(null);
    map?.flyCameraTo({
      endCamera: {
        center:  { lat: route.destination.lat, lng: route.destination.lng, altitude: 0 },
        range:   1600,
        tilt:    67,
        heading: 0,
      },
      durationMillis: 3500,
    });
  };

  /* ── Tracking search handler ─────────────────────────────────────────────── */
  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackInput.trim().toUpperCase();
    if (!code) return;
    if (!routes.length) { setTrackError('در حال بارگذاری...'); return; }
    const found = routes.find(r => r.trackingCode.toUpperCase() === code);
    if (found) {
      _flyTo(mapRef.current, found);
    } else {
      setSelected(null);
      setTrackError('کدی پیدا نشد');
    }
  };

  /* ── Scroll to next section ──────────────────────────────────────────────── */
  const scrollDown = () => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div
      className={className}
      style={{ position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      {/* gmp-map-3d is appended here imperatively */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'pan-y' }} />

      {/* ── Tracking panel — top-left ────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-30 pointer-events-auto">
        <form
          onSubmit={handleTrack}
          className="flex flex-col gap-1.5 bg-black/65 backdrop-blur-2xl rounded-2xl border border-white/12 px-3 py-2.5 shadow-2xl"
          style={{ width: '13rem' }}
        >
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path d="m21 21-4.35-4.35" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">رهگیری</span>
          </div>
          <div className="flex gap-1.5">
            <input
              value={trackInput}
              onChange={e => { setTrackInput(e.target.value.toUpperCase()); setTrackError(null); }}
              onKeyDown={e => e.key === 'Escape' && (setSelected(null), setTrackInput(''), setTrackError(null))}
              placeholder="کد رهگیری..."
              dir="ltr" spellCheck={false} autoComplete="off"
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-white/8 border border-white/12 rounded-xl text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/40 transition-colors"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/25 rounded-xl text-xs text-cyan-300 font-bold transition-all flex-shrink-0"
            >→</button>
          </div>
          {trackError && (
            <p className="text-[11px] text-red-400/90 leading-none">{trackError}</p>
          )}
        </form>
      </div>

      {/* ── Detail card — bottom-left, shown after click / tracking ─────── */}
      {selected && (
        <div
          className="absolute bottom-8 left-4 z-30 rounded-2xl border border-white/15 p-5 shadow-2xl pointer-events-auto"
          style={{ background: 'rgba(1,4,9,.90)', backdropFilter: 'blur(24px)', width: '17rem' }}
        >
          <button
            onClick={() => setSelected(null)}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 text-xs transition-all"
          >✕</button>

          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: STATUS_HEX[selected.status] }} />
            <span className="font-mono text-[11px] text-gray-400">{selected.trackingCode}</span>
          </div>

          <div className="flex items-start gap-2.5 mb-3">
            <div className="flex flex-col items-center pt-1 gap-1 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-px h-4 bg-white/15" />
              <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: STATUS_HEX[selected.status] }} />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="text-sm font-semibold text-white">{selected.origin.city}</div>
                <div className="text-[11px] text-gray-500">{selected.origin.country}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{selected.destination.city}</div>
                <div className="text-[11px] text-gray-500">{selected.destination.country}</div>
              </div>
            </div>
          </div>

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

          <div className="mt-4 pt-3 border-t border-white/8">
            <a href={`/track/${selected.trackingCode}`} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              View full tracking →
            </a>
          </div>
        </div>
      )}

      {/* ── Scroll-down arrow — bottom-centre ───────────────────────────── */}
      <button
        onClick={scrollDown}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 pointer-events-auto group"
        aria-label="Scroll to next section"
      >
        <span className="text-[9px] uppercase tracking-widest text-white/25 group-hover:text-white/55 transition-colors font-semibold">
          scroll
        </span>
        <svg
          className="w-5 h-5 text-white/35 group-hover:text-white/75 animate-bounce transition-colors"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
