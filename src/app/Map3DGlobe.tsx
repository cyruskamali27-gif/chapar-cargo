/**
 * Map3DGlobe v3 — aviation-style premium route visualization
 *
 * v3 changes:
 *  - Custom SVG dot markers (slot="anchor") — no Google red pins, no labels
 *  - Thin dotted base lines (2px segmented) + wide glow shadow
 *  - 3 moving particles per route (replaces thick single comet)
 *  - Package position marker (in_transit) tracks lead particle
 *  - Selected route: others fade to 12%, selected → 85%
 *  - Pulse rings tuned to 70km max; blue=origin, cyan=destination
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  pending:       '#eab308',
  escrow_locked: '#a855f7',
  assigned:      '#22d3ee',
  in_transit:    '#3b82f6',
  delivered:     '#22c55e',
  disputed:      '#ef4444',
};
const STATUS_LABEL: Record<GlobeRoute['status'], string> = {
  pending: 'Pending', escrow_locked: 'Escrow Locked', assigned: 'Assigned',
  in_transit: 'In Transit', delivered: 'Delivered', disputed: 'Disputed',
};

/* ── Geometry helpers ─────────────────────────────────────────────────────── */
function gcPoints(la1: number, lo1: number, la2: number, lo2: number, N = 64): LLA[] {
  const D = Math.PI / 180;
  const xyz = (la: number, lo: number): [number, number, number] => {
    const r = la * D, g = lo * D;
    return [Math.cos(r) * Math.cos(g), Math.cos(r) * Math.sin(g), Math.sin(r)];
  };
  const p1 = xyz(la1, lo1), p2 = xyz(la2, lo2);
  const dot = Math.min(1, Math.max(-1, p1[0]*p2[0] + p1[1]*p2[1] + p1[2]*p2[2]));
  const omega = Math.acos(dot);
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    if (omega < 1e-10) return { lat: la1, lng: lo1, altitude: 0 };
    const sinO = Math.sin(omega);
    const s0 = Math.sin((1 - t) * omega) / sinO, s1 = Math.sin(t * omega) / sinO;
    const x = s0*p1[0] + s1*p2[0], y = s0*p1[1] + s1*p2[1], z = s0*p1[2] + s1*p2[2];
    return { lat: Math.atan2(z, Math.sqrt(x*x + y*y)) / D, lng: Math.atan2(y, x) / D, altitude: 0 };
  });
}

function circleCoords(lat0: number, lng0: number, radiusKm: number, N = 28): LLA[] {
  const D = Math.PI / 180;
  const r = Math.max(0.5, radiusKm);
  const dLat = (r / 6371) / D;
  const dLng = dLat / (Math.cos(lat0 * D) || 0.001);
  return Array.from({ length: N + 1 }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return { lat: lat0 + dLat * Math.sin(a), lng: lng0 + dLng * Math.cos(a), altitude: 0 };
  });
}

function withAlpha(hex6: string, alpha: number): string {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex6 + a.toString(16).padStart(2, '0');
}

/* ── Dotted-line segment splitter ─────────────────────────────────────────── */
const DASH_LEN = 5;
const GAP_LEN  = 4;
function dashSegments(pts: LLA[]): LLA[][] {
  const segs: LLA[][] = [];
  const period = DASH_LEN + GAP_LEN;
  for (let i = 0; i < pts.length; i += period) {
    const end = Math.min(i + DASH_LEN + 1, pts.length);
    if (end - i >= 2) segs.push(pts.slice(i, end));
  }
  return segs;
}

/* ── SVG glowing dot → data URL (replaces Google red pin) ────────────────── */
function createDotSVG(color: string, size = 8): string {
  const r = size / 2;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<defs><filter id="g"><feGaussianBlur stdDeviation="1.5" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs>` +
    `<circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="${color}" filter="url(#g)"/>` +
    `</svg>`
  )}`;
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
  clickTarget: any;          // transparent interactive polyline — hit detection only
  glow:        any;          // wide very-low-alpha line = soft halo
  dashes:      any[];        // thin dotted visual segments
  particles:   any[];        // 3 small moving particles
  pkgDot:      any | null;   // Polyline3DElement circle tracking lead particle (in_transit)
  pts:         LLA[];
  progs:       number[];     // per-particle progress (float index into pts)
  speed:       number;
  status:      GlobeRoute['status'];
  trackingCode: string;
}
interface CityRingState {
  ring1:     any;
  ring2:     any;
  lat:       number;
  lng:       number;
  hex:       string;
  t1:        number;
  t2:        number;
  routeKeys: string[];
}

const PARTICLE_W = 2;
const PARTICLE_N = 3;
const RING_MAXKM = 70;
const FRAME_MS   = 1000 / 20;   // ~20 fps

/* ── Component ────────────────────────────────────────────────────────────── */
export default function Map3DGlobe({ className }: { className?: string }) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const routeStates     = useRef<Map<string, RouteState>>(new Map());
  const cityRings       = useRef<CityRingState[]>([]);
  const markerEls       = useRef<any[]>([]);
  const rafRef          = useRef(0);
  const lastFrameRef    = useRef(0);
  const deadRef         = useRef(false);
  const selectedCodeRef = useRef<string | null>(null);
  const selDirtyRef     = useRef(false);

  const [routes,     setRoutes]     = useState<GlobeRoute[]>([]);
  const [selected,   setSelected]   = useState<GlobeRoute | null>(null);
  const [mapReady,   setMapReady]   = useState(false);
  const [trackInput, setTrackInput] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showArrow,  setShowArrow]  = useState(true);

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
        map.gestureHandling = 'COOPERATIVE';
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

    routeStates.current.forEach(st => {
      st.clickTarget?.parentNode?.removeChild(st.clickTarget);
      st.glow?.parentNode?.removeChild(st.glow);
      st.dashes.forEach((d: any) => d.parentNode?.removeChild(d));
      st.particles.forEach((p: any) => p.parentNode?.removeChild(p));
      st.pkgDot?.parentNode?.removeChild(st.pkgDot);
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
        AltitudeMode,
      } = await (window as any).google.maps.importLibrary('maps3d');
      if (deadRef.current) return;

      // Build city map; destination color (cyan) overrides origin (blue)
      const cityData = new Map<string, {
        lat: number; lng: number; hex: string; routeKeys: string[];
      }>();
      for (const route of routes) {
        const ok = `${route.origin.lat},${route.origin.lng}`;
        const dk = `${route.destination.lat},${route.destination.lng}`;
        if (!cityData.has(ok)) {
          cityData.set(ok, { lat: route.origin.lat, lng: route.origin.lng, hex: '#3b82f6', routeKeys: [] });
        }
        cityData.get(ok)!.routeKeys.push(route.trackingCode);
        if (!cityData.has(dk)) {
          cityData.set(dk, { lat: route.destination.lat, lng: route.destination.lng, hex: '#22d3ee', routeKeys: [] });
        } else {
          cityData.get(dk)!.hex = '#22d3ee';
        }
        cityData.get(dk)!.routeKeys.push(route.trackingCode);
      }

      for (const route of routes) {
        const hex = STATUS_HEX[route.status] ?? '#3b82f6';
        const pts = gcPoints(route.origin.lat, route.origin.lng, route.destination.lat, route.destination.lng, 64);
        const spd = route.status === 'in_transit' ? 0.38
                  : route.status === 'assigned'   ? 0.22
                  :                                 0.13;

        // Invisible wide line — intercepts clicks
        const clickTarget = new Polyline3DInteractiveElement();
        clickTarget.strokeColor  = withAlpha(hex, 0);
        clickTarget.strokeWidth  = 14;
        clickTarget.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        clickTarget.geodesic     = true;
        clickTarget.coordinates  = pts;
        const captured = route;
        clickTarget.addEventListener('gmp-click', () => _flyTo(map, captured));

        // Wide, very-low-alpha full line = soft glow halo
        const glow = new Polyline3DElement();
        glow.strokeColor  = withAlpha(hex, 0.12);
        glow.strokeWidth  = 8;
        glow.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        glow.geodesic     = true;
        glow.coordinates  = pts;

        // Thin dotted segments (2px)
        const segs   = dashSegments(pts);
        const dashes = segs.map(seg => {
          const d = new Polyline3DElement();
          d.strokeColor  = withAlpha(hex, 0.35);
          d.strokeWidth  = 2;
          d.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
          d.geodesic     = true;
          d.coordinates  = seg;
          return d;
        });

        // 3 particles evenly spaced along route
        const L     = pts.length;
        const progs = Array.from({ length: PARTICLE_N }, (_, i) => (i / PARTICLE_N) * L);
        const particles = progs.map(() => {
          const p = new Polyline3DElement();
          p.strokeColor  = withAlpha('#e0f7fa', 0.85);
          p.strokeWidth  = 2;
          p.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
          p.geodesic     = true;
          p.coordinates  = pts.slice(0, PARTICLE_W);
          return p;
        });

        // Package position dot — Polyline3DElement small circle (no Marker3DElement / no red pin)
        let pkgDot: any = null;
        if (route.status === 'in_transit') {
          pkgDot = new Polyline3DElement();
          pkgDot.strokeColor  = withAlpha('#e0f7fa', 0.35);
          pkgDot.strokeWidth  = 6;
          pkgDot.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
          pkgDot.geodesic     = false;
          pkgDot.coordinates  = circleCoords(pts[0].lat, pts[0].lng, 1, 8);
        }

        map.appendChild(clickTarget);
        map.appendChild(glow);
        dashes.forEach((d: any) => map.appendChild(d));
        particles.forEach((p: any) => map.appendChild(p));
        if (pkgDot) map.appendChild(pkgDot);

        routeStates.current.set(route.trackingCode, {
          clickTarget, glow, dashes, particles,
          pkgDot,
          pts, progs, speed: spd,
          status:       route.status,
          trackingCode: route.trackingCode,
        });
      }

      // Pulsing rings + custom dot markers per city
      for (const [, c] of cityData) {
        const makeRing = (): any => {
          const r = new Polyline3DElement();
          r.strokeWidth  = 2;
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
          routeKeys: c.routeKeys,
        });

        // City dot — Polyline3DInteractiveElement circle (1km radius, 8px stroke)
        // A 1km radius circle drawn with 8px strokeWidth renders as a solid ~8px dot.
        // No Marker3DInteractiveElement = no Google red pin.
        const dot = new Polyline3DInteractiveElement();
        dot.strokeColor  = withAlpha(c.hex, 0.95);
        dot.strokeWidth  = 8;
        dot.altitudeMode = AltitudeMode.CLAMP_TO_GROUND;
        dot.geodesic     = false;
        dot.coordinates  = circleCoords(c.lat, c.lng, 1, 8);
        const cc = c;
        dot.addEventListener('gmp-click', () => {
          const match = routes.find(r =>
            (r.destination.lat === cc.lat && r.destination.lng === cc.lng) ||
            (r.origin.lat      === cc.lat && r.origin.lng      === cc.lng)
          );
          if (match) _flyTo(map, match);
        });
        map.appendChild(dot);
        markerEls.current.push(dot);
      }

      // ~20 fps animation loop
      const tick = (now: number) => {
        if (deadRef.current) return;
        rafRef.current = requestAnimationFrame(tick);
        if (now - lastFrameRef.current < FRAME_MS) return;
        lastFrameRef.current = now;

        // Apply selection-based opacity when dirty
        if (selDirtyRef.current) {
          selDirtyRef.current = false;
          const selCode = selectedCodeRef.current;
          routeStates.current.forEach((st, code) => {
            const isSel  = !selCode || code === selCode;
            const dAlpha = isSel ? 0.85 : 0.12;
            const gAlpha = isSel ? 0.20 : 0.04;
            const pAlpha = isSel ? 0.95 : 0.30;
            const pWidth = isSel ? 3    : 1;
            st.glow.strokeColor = withAlpha(STATUS_HEX[st.status], gAlpha);
            st.dashes.forEach((d: any) => {
              d.strokeColor = withAlpha(STATUS_HEX[st.status], dAlpha);
            });
            st.particles.forEach((p: any) => {
              p.strokeColor = withAlpha('#e0f7fa', pAlpha);
              p.strokeWidth = pWidth;
            });
            if (st.pkgDot) st.pkgDot.strokeColor = withAlpha('#e0f7fa', isSel ? 0.95 : 0.15);
          });
        }

        // Advance particles
        routeStates.current.forEach(st => {
          if (st.status === 'delivered' || st.status === 'disputed') return;
          const L = st.pts.length;
          for (let i = 0; i < PARTICLE_N; i++) {
            st.progs[i] = (st.progs[i] + st.speed) % L;
            const s = Math.floor(st.progs[i]);
            st.particles[i].coordinates = Array.from({ length: PARTICLE_W }, (_, j) =>
              st.pts[(s + j) % L]
            );
          }
          // Update pkgDot circle position to track lead particle
          if (st.status === 'in_transit' && st.pkgDot) {
            const s  = Math.floor(st.progs[0]);
            const pt = st.pts[s % L];
            st.pkgDot.coordinates = circleCoords(pt.lat, pt.lng, 1, 8);
          }
        });

        // Expand/fade rings; selected-route rings pulse tighter and brighter
        const selCode = selectedCodeRef.current;
        cityRings.current.forEach(cr => {
          cr.t1 = (cr.t1 + 0.008) % 1;
          cr.t2 = (cr.t2 + 0.008) % 1;
          const isActive  = !selCode || cr.routeKeys.includes(selCode);
          const maxAlpha  = isActive ? 0.72 : 0.18;
          const maxRadius = isActive ? (selCode ? RING_MAXKM * 0.65 : RING_MAXKM) : RING_MAXKM;
          cr.ring1.strokeColor = withAlpha(cr.hex, (1 - cr.t1) * maxAlpha);
          cr.ring1.coordinates = circleCoords(cr.lat, cr.lng, cr.t1 * maxRadius, 28);
          cr.ring2.strokeColor = withAlpha(cr.hex, (1 - cr.t2) * maxAlpha);
          cr.ring2.coordinates = circleCoords(cr.lat, cr.lng, cr.t2 * maxRadius, 28);
        });
      };
      rafRef.current = requestAnimationFrame(tick);
    })().catch(e => console.error('[Map3DGlobe] routes render:', e));
  }, [routes, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fly-to (shared by click + tracking search) ──────────────────────────── */
  const _flyTo = (map: any, route: GlobeRoute) => {
    setSelected(route);
    selectedCodeRef.current = route.trackingCode;
    selDirtyRef.current     = true;
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

  const clearSelection = () => {
    setSelected(null);
    selectedCodeRef.current = null;
    selDirtyRef.current     = true;
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
      clearSelection();
      setTrackError('کدی پیدا نشد');
    }
  };

  /* ── Hide arrow once user scrolls past hero ─────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setShowArrow(window.scrollY < window.innerHeight * 0.75);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Inject chevron keyframe once ────────────────────────────────────────── */
  useEffect(() => {
    if (document.getElementById('map3d-chevron-style')) return;
    const s = document.createElement('style');
    s.id = 'map3d-chevron-style';
    s.textContent = `
      @keyframes chevronDrop {
        0%,100% { transform:translateY(0);   opacity:.40; }
        50%     { transform:translateY(8px); opacity:.90; }
      }
      .chevron-a { animation: chevronDrop 1.8s ease-in-out infinite; }
      .chevron-b { animation: chevronDrop 1.8s ease-in-out infinite 0.3s; }
    `;
    document.head.appendChild(s);
  }, []);

  /* ── Scroll to next section ──────────────────────────────────────────────── */
  const scrollDown = () => {
    const hero = containerRef.current?.closest('section') as HTMLElement | null;
    const next = hero?.nextElementSibling as HTMLElement | null;
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

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
              onKeyDown={e => e.key === 'Escape' && (clearSelection(), setTrackInput(''), setTrackError(null))}
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

      {/* ── Detail card — bottom-left ────────────────────────────────────── */}
      {selected && (
        <div
          className="absolute bottom-8 left-4 z-30 rounded-2xl border border-white/15 p-5 shadow-2xl pointer-events-auto"
          style={{ background: 'rgba(1,4,9,.90)', backdropFilter: 'blur(24px)', width: '17rem' }}
        >
          <button
            onClick={clearSelection}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 text-xs transition-all"
          >✕</button>

          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: STATUS_HEX[selected.status] }} />
            <span className="font-mono text-[11px] text-gray-400">{selected.trackingCode}</span>
          </div>

          <div className="flex items-start gap-2.5 mb-3">
            <div className="flex flex-col items-center pt-1 gap-1 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <div className="w-px h-4 bg-white/15" />
              <div className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400" />
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

      {/* ── Scroll-down arrow — portal so z-index escapes globe stacking ─── */}
      {showArrow && createPortal(
        <button
          onClick={scrollDown}
          onTouchEnd={(e) => { e.preventDefault(); scrollDown(); }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[25] flex flex-col items-center gap-0.5 pointer-events-auto group cursor-pointer"
          aria-label="Scroll to next section"
          style={{ touchAction: 'none' }}
        >
          <span className="text-[9px] uppercase tracking-widest text-white/25 group-hover:text-white/55 transition-colors font-semibold select-none">
            scroll
          </span>
          <svg
            className="w-5 h-8 text-white/40 group-hover:text-white/80 transition-colors drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
            fill="none" stroke="currentColor" viewBox="0 0 24 20"
          >
            <path className="chevron-a" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 3l8 7 8-7" />
            <path className="chevron-b" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 11l8 7 8-7" />
          </svg>
        </button>,
        document.body
      )}
    </div>
  );
}
