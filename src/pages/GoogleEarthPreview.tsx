/**
 * /google-earth-preview  –  Google Earth + FlightRadar24 + Package Tracking
 *
 * Globe  : CesiumJS 1.114  (round 3D, rotatable, zoomable, touch+mouse)
 * Imagery: Google Map Tiles API satellite  →  ESRI satellite fallback
 * Data   : demo routes (production: geocode origin/dest, compute route, store position)
 *
 * UI     : minimal – globe is the focus.
 *          Left sidebar removed.
 *          Compact floating tracking card appears only after a code is searched.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { DEMO_ROUTES, findDemoRoute } from '../data/demoTrackingRoutes';
import type { RouteStatus } from '../types/tracking';
import { getGoogleSatTileUrl } from '../lib/googleMapTiles';

// ── Cesium CDN loader (singleton) ─────────────────────────────────────────────
declare global { interface Window { Cesium: any } }
const CESIUM_VER = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VER}/Build/Cesium`;
let _cesiumLoad: Promise<boolean> | null = null;
function loadCesium(): Promise<boolean> {
  if (_cesiumLoad) return _cesiumLoad;
  _cesiumLoad = new Promise<boolean>((resolve) => {
    if (window.Cesium) { resolve(true); return; }
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = `${CESIUM_CDN}/Widgets/widgets.css`; document.head.appendChild(link);
    const st = document.createElement('style');
    st.textContent = `.cesium-viewer-animationContainer,.cesium-viewer-timelineContainer,
      .cesium-viewer-toolbar,.cesium-viewer-bottom,.cesium-navigation-help,
      .cesium-performanceDisplay-defaultContainer{display:none!important}
      .cesium-widget,.cesium-widget canvas{background:transparent!important}`;
    document.head.appendChild(st);
    const s = document.createElement('script');
    s.src = `${CESIUM_CDN}/Cesium.js`;
    s.onload = () => resolve(true);
    s.onerror = () => { _cesiumLoad = null; resolve(false); };
    document.head.appendChild(s);
  });
  return _cesiumLoad;
}

// ── Status data ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<RouteStatus, string> = {
  pending:          '#eab308', escrow_locked:    '#a855f7',
  assigned:         '#22d3ee', picked_up:        '#60a5fa',
  in_transit:       '#3b82f6', customs:          '#f97316',
  out_for_delivery: '#22c55e', delivered:        '#22c55e',
  disputed:         '#ef4444',
};
const STATUS_PROGRESS: Record<RouteStatus, number> = {
  pending: 0, escrow_locked: 0.02, assigned: 0.06, picked_up: 0.14,
  in_transit: 0.52, customs: 0.72, out_for_delivery: 0.88, delivered: 1, disputed: 0.52,
};
const STATUS_EN: Record<RouteStatus, string> = {
  pending: 'Pending', escrow_locked: 'Escrow Locked', assigned: 'Assigned',
  picked_up: 'Picked Up', in_transit: 'In Transit', customs: 'At Customs',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', disputed: 'Disputed',
};
const STATUS_BADGE: Record<RouteStatus, string> = {
  pending:          'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  escrow_locked:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  assigned:         'bg-cyan-500/15   text-cyan-300   border-cyan-500/25',
  picked_up:        'bg-blue-400/15   text-blue-300   border-blue-400/25',
  in_transit:       'bg-blue-500/15   text-blue-300   border-blue-500/25',
  customs:          'bg-orange-500/15 text-orange-300 border-orange-500/25',
  out_for_delivery: 'bg-green-400/15  text-green-300  border-green-400/25',
  delivered:        'bg-green-500/15  text-green-300  border-green-500/25',
  disputed:         'bg-red-500/15    text-red-300    border-red-500/25',
};
const STATUS_DOT: Record<RouteStatus, string> = {
  pending:'bg-yellow-400', escrow_locked:'bg-purple-400', assigned:'bg-cyan-400',
  picked_up:'bg-blue-400', in_transit:'bg-blue-500', customs:'bg-orange-400',
  out_for_delivery:'bg-green-400', delivered:'bg-green-500', disputed:'bg-red-400',
};

// Carrier / last-update demo data (production: fetched from API with shipment record)
const DEMO_EXTRA: Record<string, { carrier: string; lastUpdated: string }> = {
  'CHP-20260607-TOR-TEH': { carrier: 'Ali Rezaei',      lastUpdated: '2 hours ago'  },
  'CHP-20260607-DXB-SYZ': { carrier: 'Sara Hosseini',   lastUpdated: '45 min ago'   },
  'CHP-20260607-LON-MHD': { carrier: 'Pending',         lastUpdated: '1 day ago'    },
  'CHP-20260607-IST-TBZ': { carrier: 'Mehdi Karimi',    lastUpdated: '3 hours ago'  },
  'CHP-20260607-YVR-IFN': { carrier: 'Narges Ahmadi',   lastUpdated: '6 hours ago'  },
};

// ── Arc geometry ──────────────────────────────────────────────────────────────
function buildArc(C: any, oLat: number, oLng: number, dLat: number, dLng: number, N = 120): any[] {
  const D = Math.PI / 180;
  const [oLaR, oLoR, dLaR, dLoR] = [oLat*D, oLng*D, dLat*D, dLng*D];
  const h = Math.sin((dLaR-oLaR)/2)**2 + Math.cos(oLaR)*Math.cos(dLaR)*Math.sin((dLoR-oLoR)/2)**2;
  const ang = 2*Math.asin(Math.sqrt(Math.min(1,h)));
  const maxAlt = Math.max(300_000, Math.min(4_200_000, ang*3_000_000));
  return Array.from({length:N+1}, (_,i) => {
    const t = i/N;
    let lat=oLat, lng=oLng;
    if (ang >= 1e-6) {
      const A=Math.sin((1-t)*ang)/Math.sin(ang), B=Math.sin(t*ang)/Math.sin(ang);
      const x=A*Math.cos(oLaR)*Math.cos(oLoR)+B*Math.cos(dLaR)*Math.cos(dLoR);
      const y=A*Math.cos(oLaR)*Math.sin(oLoR)+B*Math.cos(dLaR)*Math.sin(dLoR);
      const z=A*Math.sin(oLaR)+B*Math.sin(dLaR);
      lat=Math.atan2(z,Math.sqrt(x*x+y*y))*(180/Math.PI);
      lng=Math.atan2(y,x)*(180/Math.PI);
    }
    return C.Cartesian3.fromDegrees(lng, lat, maxAlt*4*t*(1-t));
  });
}
function haversineKm(la1:number,lo1:number,la2:number,lo2:number):number {
  const D=Math.PI/180,dLa=(la2-la1)*D,dLo=(lo2-lo1)*D;
  const a=Math.sin(dLa/2)**2+Math.cos(la1*D)*Math.cos(la2*D)*Math.sin(dLo/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
}
function midpoint(la1:number,lo1:number,la2:number,lo2:number) {
  const D=Math.PI/180, la1r=la1*D,lo1r=lo1*D,la2r=la2*D,lo2r=lo2*D;
  const Bx=Math.cos(la2r)*Math.cos(lo2r-lo1r), By=Math.cos(la2r)*Math.sin(lo2r-lo1r);
  return {
    lat: Math.atan2(Math.sin(la1r)+Math.sin(la2r),Math.sqrt((Math.cos(la1r)+Bx)**2+By**2))*(180/Math.PI),
    lng: (lo1r+Math.atan2(By,Math.cos(la1r)+Bx))*(180/Math.PI),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GoogleEarthPreview() {
  const [searchInput,    setSearchInput]    = useState('');
  const [searchError,    setSearchError]    = useState<string|null>(null);
  const [selectedCode,   setSelectedCode]   = useState<string|null>(null);
  const [globeReady,     setGlobeReady]     = useState(false);
  const [imagerySource,  setImagerySource]  = useState<'google'|'esri'|'loading'>('loading');
  const [cardVisible,    setCardVisible]    = useState(false);   // for CSS enter transition

  const containerRef    = useRef<HTMLDivElement>(null);
  const viewerRef       = useRef<any>(null);
  const selectedCodeRef = useRef<string|null>(null);             // Cesium reads this ref each frame
  const arcsByCode      = useRef<Map<string,any[]>>(new Map());

  // Particle animation state per route
  type PState = { prim:any; arcPts:any[]; progress:number; base:number; hex:string; code:string };
  type RState = { t:number };
  const particles = useRef<PState[]>([]);
  const rings     = useRef<RState[]>([]);

  // City/destination point refs so we can update alpha on selection change
  type PtRef = { prim:any; hex:string; code:string; isOrigin:boolean };
  const cityPoints = useRef<PtRef[]>([]);

  const isInteracting   = useRef(false);
  const cancelledRef    = useRef(false);

  // ── Keep selectedCodeRef in sync with state ───────────────────────────────
  useEffect(() => {
    selectedCodeRef.current = selectedCode;
  }, [selectedCode]);

  // ── Init Cesium ───────────────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    loadCesium().then(async (ok) => {
      if (!ok || cancelledRef.current || !containerRef.current || viewerRef.current) return;
      const C = window.Cesium;
      try { C.Ion.defaultAccessToken = ''; } catch (_) {}

      const creditDiv = document.createElement('div');
      creditDiv.style.cssText = 'position:absolute;bottom:2px;right:5px;font-size:8px;color:rgba(255,255,255,.2);pointer-events:none;z-index:1';
      containerRef.current!.appendChild(creditDiv);

      const viewer = new C.Viewer(containerRef.current, {
        animation:false, baseLayerPicker:false, fullscreenButton:false, vrButton:false,
        geocoder:false, homeButton:false, infoBox:false, sceneModePicker:false,
        selectionIndicator:false, timeline:false, navigationHelpButton:false,
        navigationInstructionsInitiallyVisible:false, scene3DOnly:true,
        creditContainer:creditDiv, requestRenderMode:false,
        terrainProvider: new C.EllipsoidTerrainProvider(),
      });
      viewerRef.current = viewer;

      // ── Imagery: Google tiles → ESRI fallback ─────────────────────────
      const gUrl = await getGoogleSatTileUrl();
      viewer.imageryLayers.removeAll();
      if (gUrl && !cancelledRef.current) {
        viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
          url: gUrl, tilingScheme: new C.WebMercatorTilingScheme(),
          maximumLevel:20, credit:'Map data ©2026 Google',
        }));
        setImagerySource('google');
      } else {
        viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
          url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          tilingScheme:new C.WebMercatorTilingScheme(), maximumLevel:19,
          credit:'Esri, Maxar, Earthstar Geographics',
        }));
        viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
          url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          tilingScheme:new C.WebMercatorTilingScheme(), maximumLevel:15,
        }));
        setImagerySource('esri');
      }
      if (cancelledRef.current) { viewer.destroy(); viewerRef.current=null; return; }

      // ── Globe atmosphere ──────────────────────────────────────────────
      viewer.scene.globe.enableLighting       = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show         = true;
      viewer.scene.skyAtmosphere.atmosphereLightIntensity = 10.0;
      viewer.scene.skyBox.show  = true;
      viewer.scene.fog.enabled  = true;
      viewer.scene.fog.density  = 0.00015;

      // ── Initial camera ────────────────────────────────────────────────
      viewer.camera.setView({
        destination: C.Cartesian3.fromDegrees(25, 35, 18_000_000),
        orientation: { heading:C.Math.toRadians(0), pitch:C.Math.toRadians(-90), roll:0 },
      });

      // ── Primitive collections ─────────────────────────────────────────
      const ptCol  = viewer.scene.primitives.add(new C.PointPrimitiveCollection({ blendOption: C.BlendOption.TRANSLUCENT }));
      const pkgCol = viewer.scene.primitives.add(new C.PointPrimitiveCollection({ blendOption: C.BlendOption.TRANSLUCENT }));
      const lblCol = viewer.scene.primitives.add(new C.LabelCollection());

      // ── Draw all routes with dynamic opacity via CallbackProperty ─────
      DEMO_ROUTES.forEach((route) => {
        const hex  = STATUS_COLOR[route.status] ?? '#3b82f6';
        const base = STATUS_PROGRESS[route.status] ?? 0.5;
        const color = C.Color.fromCssColorString(hex);
        const code  = route.trackingCode;
        const arcPts = buildArc(C, route.originLat, route.originLng, route.destinationLat, route.destinationLng);
        arcsByCode.current.set(code, arcPts);
        const isDelivered = route.status === 'delivered';

        // Dynamic arc opacity: full when selected or no selection, dim otherwise
        const dynArcColor = new C.CallbackProperty(() => {
          const sel = selectedCodeRef.current;
          const alpha = isDelivered ? 0.18 : (sel === null || sel === code) ? 0.85 : 0.20;
          return color.withAlpha(alpha);
        }, false);

        // Thin dashed arc — FlightRadar24 style (no thick glow)
        viewer.entities.add({
          polyline: {
            positions: arcPts,
            width: isDelivered ? 1 : 1.5,
            material: new C.PolylineDashMaterialProperty({
              color: dynArcColor,
              gapColor: C.Color.TRANSPARENT,
              dashLength: 16.0,
              dashPattern: 255,
            }),
            arcType: C.ArcType.NONE,
          },
        });

        // Destination pulse ring
        if (!isDelivered) {
          const rs: RState = { t: Math.random() };
          rings.current.push(rs);
          const maxR = 200_000;
          viewer.entities.add({
            position: C.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 200),
            ellipse: {
              semiMajorAxis: new C.CallbackProperty(() => rs.t * maxR, false),
              semiMinorAxis: new C.CallbackProperty(() => rs.t * maxR, false),
              material: new C.ColorMaterialProperty(
                new C.CallbackProperty(() => {
                  const sel = selectedCodeRef.current;
                  const visible = sel === null || sel === code;
                  return color.withAlpha(visible ? (1-rs.t)*0.55 : 0);
                }, false)
              ),
              height: 200,
            },
          });
        }

        // Origin point
        const oPt = ptCol.add({
          position: C.Cartesian3.fromDegrees(route.originLng, route.originLat, 500),
          pixelSize:8, color:C.Color.fromCssColorString('#fbbf24'),
          outlineColor:C.Color.WHITE.withAlpha(0.5), outlineWidth:2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        cityPoints.current.push({ prim:oPt, hex:'#fbbf24', code, isOrigin:true });

        // Destination point
        const dPt = ptCol.add({
          position: C.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 500),
          pixelSize:10, color, outlineColor:C.Color.WHITE.withAlpha(0.5), outlineWidth:2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        cityPoints.current.push({ prim:dPt, hex, code, isOrigin:false });

        // Moving package
        const initIdx = Math.min(Math.floor(base * arcPts.length), arcPts.length-1);
        const pkg = pkgCol.add({
          position: arcPts[initIdx], pixelSize: isDelivered ? 0 : 7,
          color: color.withAlpha(isDelivered ? 0 : 0.95),
          outlineColor:C.Color.WHITE.withAlpha(0.35), outlineWidth:1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        particles.current.push({ prim:pkg, arcPts, progress:Math.random(), base, hex, code });

        // City labels (scale by distance)
        const labelScale = new C.NearFarScalar(300_000, 1.6, 7_000_000, 0.0);
        lblCol.add({
          position: C.Cartesian3.fromDegrees(route.originLng, route.originLat, 80_000),
          text: route.publicOriginCity, font:'bold 12px system-ui,sans-serif',
          fillColor: C.Color.fromCssColorString('#fde68a').withAlpha(0.92),
          outlineColor:C.Color.BLACK.withAlpha(0.75), outlineWidth:2.5,
          style:C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset:new C.Cartesian2(0,-22), disableDepthTestDistance:Number.POSITIVE_INFINITY,
          horizontalOrigin:C.HorizontalOrigin.CENTER, verticalOrigin:C.VerticalOrigin.BOTTOM,
          scaleByDistance: labelScale,
        });
        lblCol.add({
          position: C.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 80_000),
          text: route.publicDestinationCity, font:'bold 12px system-ui,sans-serif',
          fillColor: color.withAlpha(0.92),
          outlineColor:C.Color.BLACK.withAlpha(0.75), outlineWidth:2.5,
          style:C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset:new C.Cartesian2(0,-22), disableDepthTestDistance:Number.POSITIVE_INFINITY,
          horizontalOrigin:C.HorizontalOrigin.CENTER, verticalOrigin:C.VerticalOrigin.BOTTOM,
          scaleByDistance: labelScale,
        });
      });

      // ── Interaction: pause auto-spin ──────────────────────────────────
      let resumeTimer: ReturnType<typeof setTimeout>|null = null;
      const pauseSpin  = () => { isInteracting.current=true; if(resumeTimer) clearTimeout(resumeTimer); };
      const resumeSpin = () => { if(resumeTimer) clearTimeout(resumeTimer); resumeTimer=setTimeout(()=>{isInteracting.current=false;},3500); };
      const evh = viewer.screenSpaceEventHandler;
      evh.setInputAction(pauseSpin,  C.ScreenSpaceEventType.LEFT_DOWN);
      evh.setInputAction(resumeSpin, C.ScreenSpaceEventType.LEFT_UP);
      evh.setInputAction(pauseSpin,  C.ScreenSpaceEventType.RIGHT_DOWN);
      evh.setInputAction(resumeSpin, C.ScreenSpaceEventType.RIGHT_UP);
      evh.setInputAction(pauseSpin,  C.ScreenSpaceEventType.PINCH_START);
      evh.setInputAction(resumeSpin, C.ScreenSpaceEventType.PINCH_END);
      evh.setInputAction(()=>{ isInteracting.current=true; if(resumeTimer) clearTimeout(resumeTimer); resumeTimer=setTimeout(()=>{isInteracting.current=false;},3500); }, C.ScreenSpaceEventType.WHEEL);

      // ── Animation loop ─────────────────────────────────────────────────
      const TRAVEL_SPEED = 0.00028;
      let prevSel: string|null = null;
      let rafId: number;

      const tick = () => {
        if (cancelledRef.current) return;
        if (!isInteracting.current) viewer.camera.rotateRight(-0.00014);

        // Particle travels continuously from origin to destination, looping
        for (const ps of particles.current) {
          ps.progress = (ps.progress + TRAVEL_SPEED) % 1.0;
          const idx = Math.max(0, Math.min(ps.arcPts.length - 1, Math.floor(ps.progress * ps.arcPts.length)));
          ps.prim.position = ps.arcPts[idx];
        }

        // Ring expand animation
        for (const rs of rings.current) rs.t = (rs.t + 0.0055) % 1;

        // City point opacity — only update when selection changes
        const curSel = selectedCodeRef.current;
        if (curSel !== prevSel) {
          for (const cp of cityPoints.current) {
            const visible = curSel === null || curSel === cp.code;
            const alpha = visible ? 0.95 : 0.18;
            cp.prim.color = C.Color.fromCssColorString(cp.hex).withAlpha(alpha);
          }
          // Package point opacity
          for (const ps of particles.current) {
            const visible = curSel === null || curSel === ps.code;
            const route = DEMO_ROUTES.find(r => r.trackingCode === ps.code);
            const isDelivered = route?.status === 'delivered';
            if (!isDelivered) {
              ps.prim.color = C.Color.fromCssColorString(ps.hex).withAlpha(visible ? 0.95 : 0.18);
            }
          }
          prevSel = curSel;
        }

        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      (viewerRef as any)._rafId = rafId;
      setGlobeReady(true);
    });

    return () => {
      cancelledRef.current = true;
      const rafId = (viewerRef as any)._rafId;
      if (rafId) cancelAnimationFrame(rafId);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      arcsByCode.current.clear();
      particles.current = [];
      rings.current = [];
      cityPoints.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to route when selected ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCode) return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !window.Cesium) return;
    const C = window.Cesium;

    const route = DEMO_ROUTES.find(r => r.trackingCode === selectedCode);
    if (!route) return;

    isInteracting.current = true;
    const distKm = haversineKm(route.originLat, route.originLng, route.destinationLat, route.destinationLng);
    const altitude = Math.max(1_200_000, Math.min(11_000_000, distKm * 600));
    const mid = midpoint(route.originLat, route.originLng, route.destinationLat, route.destinationLng);

    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(mid.lng, mid.lat, altitude),
      orientation: { heading:C.Math.toRadians(0), pitch:C.Math.toRadians(-38), roll:0 },
      duration: 2.4,
      easingFunction: C.EasingFunction.CUBIC_IN_OUT,
      complete: () => setTimeout(() => { isInteracting.current = false; }, 5000),
    });
  }, [selectedCode]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const code = searchInput.trim().toUpperCase();
    if (!code) return;
    const found = findDemoRoute(code);
    if (found) {
      setSelectedCode(code);
      setSearchError(null);
      // Slight delay before showing card so fly animation can start
      setTimeout(() => setCardVisible(true), 200);
    } else {
      setSearchError('Tracking code not found');
      setSelectedCode(null);
      setCardVisible(false);
    }
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setCardVisible(false);
    setTimeout(() => {
      setSelectedCode(null);
      setSearchInput('');
      setSearchError(null);
    }, 250);
  }, []);

  const selectedRoute = selectedCode ? findDemoRoute(selectedCode) : null;
  const extra         = selectedCode ? DEMO_EXTRA[selectedCode] : null;
  const progress      = selectedRoute ? STATUS_PROGRESS[selectedRoute.status] : 0;
  const statusColor   = selectedRoute ? STATUS_COLOR[selectedRoute.status] : '#3b82f6';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-[#04070f] relative overflow-hidden select-none">

      {/* ── Globe (full-screen) ─────────────────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full"
        style={{ touchAction:'none', userSelect:'none', WebkitUserSelect:'none' }} />

      {/* ── Loading shimmer ─────────────────────────────────────────────── */}
      {!globeReady && (
        <div className="absolute inset-0 z-30 bg-[#04070f] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-cyan-500/50 animate-spin" style={{ animationDuration:'2s' }} />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20" />
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Loading Earth...</div>
          </div>
        </div>
      )}

      {/* ── Top gradient vignette ────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#04070f]/75 to-transparent pointer-events-none z-10" />

      {/* ── Header: logo + search + nav ─────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-4 sm:px-6 py-4">

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-4 h-4 text-white -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <span className="text-sm font-black text-white hidden sm:block">Chapar</span>
        </a>

        {/* Search — centered, expands on focus */}
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            {/* Search icon */}
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={2}/><path d="m21 21-4.35-4.35" strokeWidth={2} strokeLinecap="round"/>
            </svg>
            <input
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value.toUpperCase()); setSearchError(null); }}
              onKeyDown={e => e.key === 'Escape' && clearSearch()}
              placeholder="Enter tracking code — CHP-20260607-TOR-TEH"
              dir="ltr" spellCheck={false} autoComplete="off"
              className="w-full pl-9 pr-4 py-2.5 bg-black/60 backdrop-blur-2xl border border-white/12 rounded-2xl text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-500/40 shadow-xl transition-all"
            />
            {searchError && (
              <div className="absolute top-full left-0 mt-1.5 text-xs text-red-400 bg-black/90 backdrop-blur-xl rounded-xl px-3 py-2 whitespace-nowrap border border-red-500/20 shadow-xl z-50">
                {searchError}
              </div>
            )}
          </div>
          <button type="submit"
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 flex-shrink-0">
            Track
          </button>
          {selectedCode && (
            <button type="button" onClick={clearSearch}
              className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0 text-xs">
              ✕
            </button>
          )}
        </form>

        {/* Nav */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <a href="/track" className="text-xs text-gray-500 hover:text-white transition-colors">Track</a>
          <a href="/" className="text-xs text-gray-600 hover:text-white transition-colors">← Home</a>
        </div>
      </header>

      {/* ── Floating tracking card (appears after search) ────────────────── */}
      <div
        className={`absolute bottom-16 sm:bottom-8 left-4 sm:left-6 z-20 w-[calc(100vw-2rem)] sm:w-80 transition-all duration-300 ease-out ${
          cardVisible && selectedRoute
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        {selectedRoute && (
          <div className="bg-[#010409]/90 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2 w-2">
                  {selectedRoute.status !== 'delivered' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }} />}
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }} />
                </div>
                <span className="font-mono text-xs font-semibold text-white">{selectedCode}</span>
              </div>
              <button onClick={clearSearch}
                className="w-6 h-6 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center text-xs">
                ✕
              </button>
            </div>

            {/* Status badge + progress */}
            <div className="px-4 py-3 border-b border-white/6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[selectedRoute.status]}`}>
                  {STATUS_EN[selectedRoute.status]}
                </span>
                <span className="text-xs font-semibold text-white">{Math.round(progress * 100)}%</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(2, progress * 100)}%`, backgroundColor: statusColor }}
                />
              </div>
            </div>

            {/* Route: origin → destination */}
            <div className="px-4 py-3 border-b border-white/6">
              <div className="flex items-start gap-3">
                {/* Left: dots + line */}
                <div className="flex flex-col items-center pt-1 gap-1 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/25" />
                  <div className="w-px flex-1 min-h-[18px] bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full ring-2" style={{ backgroundColor: statusColor, boxShadow: `0 0 0 4px ${statusColor}22` }} />
                </div>
                {/* Right: city names */}
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{selectedRoute.publicOriginCity}</div>
                    <div className="text-xs text-gray-500">{selectedRoute.publicOriginCountry}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{selectedRoute.publicDestinationCity}</div>
                    <div className="text-xs text-gray-500">{selectedRoute.publicDestinationCountry}</div>
                  </div>
                </div>
                {/* Right: distance */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold text-white">{selectedRoute.distanceText ?? '—'}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{selectedRoute.durationText ?? '—'}</div>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="px-4 py-3 space-y-2">
              {[
                ['Carrier',       extra?.carrier      ?? '—'],
                ['Last update',   extra?.lastUpdated  ?? '—'],
                ['ETA',           selectedRoute.eta   ?? '—'],
                ['Escrow',        selectedRoute.escrowStatus === 'locked' ? '🔒 Secured' : selectedRoute.escrowStatus === 'released' ? '✅ Released' : selectedRoute.escrowStatus],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Full tracking link */}
            <div className="px-4 pb-3">
              <a href={`/track/${selectedRoute.trackingCode}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-white/6 hover:border-white/12 transition-all">
                View full tracking page
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state hint (when globe loaded, nothing searched) ──────── */}
      {globeReady && !selectedCode && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
          <div className="bg-black/45 backdrop-blur-xl rounded-2xl border border-white/8 px-5 py-3 shadow-xl">
            <p className="text-xs text-gray-500 mb-2">Enter a tracking code above to locate your shipment</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-gray-700">Try:</span>
              {DEMO_ROUTES.map(r => (
                <button key={r.trackingCode} pointer-events-auto=""
                  onClick={() => {
                    setSearchInput(r.trackingCode);
                    setSelectedCode(r.trackingCode);
                    setSearchError(null);
                    setTimeout(() => setCardVisible(true), 200);
                  }}
                  className="text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors pointer-events-auto cursor-pointer">
                  {r.trackingCode.replace('CHP-20260607-', '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom gradient ──────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#04070f]/40 to-transparent pointer-events-none z-10" />

      {/* ── Attribution ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-1.5 right-3 z-20 pointer-events-none">
        <span className="text-[10px] text-gray-700">
          {imagerySource === 'google' ? '© Google' : '© Esri'} · CesiumJS · Chapar 2026
        </span>
      </div>
    </div>
  );
}
