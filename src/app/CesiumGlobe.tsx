/**
 * CesiumGlobe — live globe fed from /api/routes.
 * No hardcoded routes. Polls every 30 s. Auto-renders new shipments instantly.
 *
 * Imagery:  Google Map Tiles API satellite (session-based) → Esri fallback
 * Engine:   CesiumJS 1.114 from CDN
 */

import { useEffect, useRef, useState } from 'react';
import { getGoogleSatTileUrl } from '../lib/googleMapTiles';

declare global { interface Window { Cesium: any } }

/* ── Types ────────────────────────────────────────────────────────────────── */
interface GlobeRoute {
  trackingCode: string;
  origin:      { city: string; country: string; lat: number; lng: number };
  destination: { city: string; country: string; lat: number; lng: number };
  status:      'pending' | 'escrow_locked' | 'assigned' | 'in_transit' | 'delivered' | 'disputed';
  routeType:   'shipment' | 'traveler' | 'buy-for-me';
}

/* ── CDN loader (singleton promise) ─────────────────────────────────────── */
const CESIUM_VER = '1.114';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VER}/Build/Cesium`;

let _cesiumLoad: Promise<boolean> | null = null;
function loadCesium(): Promise<boolean> {
  if (_cesiumLoad) return _cesiumLoad;
  _cesiumLoad = new Promise<boolean>((resolve) => {
    if (window.Cesium) { resolve(true); return; }
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      .cesium-viewer-animationContainer,.cesium-viewer-timelineContainer,
      .cesium-viewer-toolbar,.cesium-viewer-bottom,.cesium-navigation-help,
      .cesium-performanceDisplay-defaultContainer { display:none!important }
      .cesium-widget { background:transparent!important }
    `;
    document.head.appendChild(style);
    const s = document.createElement('script');
    s.src    = `${CESIUM_CDN}/Cesium.js`;
    s.onload  = () => resolve(true);
    s.onerror = () => { _cesiumLoad = null; resolve(false); };
    document.head.appendChild(s);
  });
  return _cesiumLoad;
}

/* ── Color by status ─────────────────────────────────────────────────────── */
const STATUS_HEX: Record<GlobeRoute['status'], string> = {
  pending:      '#eab308',
  escrow_locked:'#a855f7',
  assigned:     '#22d3ee',
  in_transit:   '#3b82f6',
  delivered:    '#22c55e',
  disputed:     '#ef4444',
};

/* ── Great-circle arc with parabolic altitude ───────────────────────────── */
function buildArc(Cesium: any, oLat: number, oLng: number, dLat: number, dLng: number, N = 80): any[] {
  const D   = Math.PI / 180;
  const oLaR = oLat*D, oLoR = oLng*D, dLaR = dLat*D, dLoR = dLng*D;
  const dLa  = dLaR - oLaR, dLo = dLoR - oLoR;
  const h    = Math.sin(dLa/2)**2 + Math.cos(oLaR)*Math.cos(dLaR)*Math.sin(dLo/2)**2;
  const ang  = 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  const maxAlt = Math.max(300_000, Math.min(3_500_000, ang * 3_200_000));

  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    let lat: number, lng: number;
    if (ang < 1e-6) { lat = oLat; lng = oLng; }
    else {
      const A = Math.sin((1-t)*ang)/Math.sin(ang), B = Math.sin(t*ang)/Math.sin(ang);
      const x = A*Math.cos(oLaR)*Math.cos(oLoR) + B*Math.cos(dLaR)*Math.cos(dLoR);
      const y = A*Math.cos(oLaR)*Math.sin(oLoR) + B*Math.cos(dLaR)*Math.sin(dLoR);
      const z = A*Math.sin(oLaR) + B*Math.sin(dLaR);
      lat = Math.atan2(z, Math.sqrt(x*x+y*y)) * (180/Math.PI);
      lng = Math.atan2(y, x) * (180/Math.PI);
    }
    return Cesium.Cartesian3.fromDegrees(lng, lat, maxAlt * 4*t*(1-t));
  });
}

/* ── Animation state ─────────────────────────────────────────────────────── */
interface PtState  { primitive: any; arcPts: any[]; progress: number; speed: number }
interface RingState { t: number; speed: number; maxR: number; colorHex: string; alpha: number }

/* ─────────────────────────────────────────────────────────────────────────── */
export default function CesiumGlobe({ className }: { className?: string }) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const viewerRef        = useRef<any>(null);
  const renderRef        = useRef<((routes: GlobeRoute[]) => void) | null>(null);
  const particleStatesRef = useRef<PtState[]>([]);
  const ringStatesRef    = useRef<RingState[]>([]);
  const particleColRef   = useRef<any>(null);
  const cityColRef       = useRef<any>(null);
  const routeEntityIds   = useRef<any[]>([]);

  const [routes, setRoutes] = useState<GlobeRoute[]>([]);

  /* ── Fetch routes from API (+ poll every 30 s) ────────────────────────── */
  useEffect(() => {
    const load = () => {
      fetch('/api/routes')
        .then(r => r.ok ? r.json() : [])
        .then(data => setRoutes(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  /* ── Initialize Cesium viewer once ───────────────────────────────────────*/
  useEffect(() => {
    let cancelled = false;
    let rafId     = 0;
    let isInteracting  = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    loadCesium().then(async (ok) => {
      if (!ok || cancelled || !containerRef.current || viewerRef.current) return;
      const Cesium = window.Cesium;
      try { Cesium.Ion.defaultAccessToken = ''; } catch (_) {}

      const creditDiv = document.createElement('div');
      creditDiv.style.cssText = 'position:absolute;bottom:2px;right:5px;font-size:8px;color:rgba(255,255,255,.2);pointer-events:none;z-index:1;';
      containerRef.current.appendChild(creditDiv);

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation:false, baseLayerPicker:false, fullscreenButton:false,
        vrButton:false, geocoder:false, homeButton:false, infoBox:false,
        sceneModePicker:false, selectionIndicator:false, timeline:false,
        navigationHelpButton:false, navigationInstructionsInitiallyVisible:false,
        scene3DOnly:true, creditContainer:creditDiv,
      });

      // Try Google Map Tiles satellite first; fall back to ESRI
      const gTileUrl = await getGoogleSatTileUrl();
      viewer.imageryLayers.removeAll();

      if (gTileUrl && !cancelled) {
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: gTileUrl,
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            maximumLevel: 20,
            credit: 'Map data ©2026 Google',
          })
        );
      } else {
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel:19,
            credit:'Esri, Maxar, Earthstar Geographics',
          })
        );
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel:15,
          })
        );
      }

      viewer.scene.globe.enableLighting       = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show         = true;
      viewer.scene.skyBox.show                = true;
      viewer.scene.fog.enabled               = false;

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(48.0, 28.0, 13_500_000),
        orientation: { heading:Cesium.Math.toRadians(0), pitch:Cesium.Math.toRadians(-90), roll:0 },
      });

      /* ── Define the render-routes function ─────────────────────────────── */
      renderRef.current = (newRoutes: GlobeRoute[]) => {
        if (!viewer || viewer.isDestroyed()) return;

        /* Remove old route entities */
        routeEntityIds.current.forEach(id => {
          const e = viewer.entities.getById(id);
          if (e) viewer.entities.remove(e);
        });
        routeEntityIds.current = [];

        /* Remove old particle / city collections */
        if (particleColRef.current && !particleColRef.current.isDestroyed()) {
          viewer.scene.primitives.remove(particleColRef.current);
        }
        if (cityColRef.current && !cityColRef.current.isDestroyed()) {
          viewer.scene.primitives.remove(cityColRef.current);
        }

        /* Reset animation state */
        particleStatesRef.current = [];
        ringStatesRef.current     = [];

        if (newRoutes.length === 0) return;

        /* New primitive collections */
        const particleCol = viewer.scene.primitives.add(
          new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT })
        );
        const cityCol = viewer.scene.primitives.add(
          new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT })
        );
        particleColRef.current = particleCol;
        cityColRef.current     = cityCol;

        const seenCities   = new Map<string, GlobeRoute['origin']>();
        const seenRingKeys = new Set<string>();

        newRoutes.forEach((route, ri) => {
          const hex   = STATUS_HEX[route.status] ?? '#3b82f6';
          const color = Cesium.Color.fromCssColorString(hex);
          const arcPts = buildArc(
            Cesium,
            route.origin.lat, route.origin.lng,
            route.destination.lat, route.destination.lng,
          );

          const arcAlpha = route.status === 'delivered' ? 0.20 : 0.65;

          /* Arc */
          const arcEntity = viewer.entities.add({
            id: `arc-${route.trackingCode}-${ri}`,
            polyline: {
              positions: arcPts,
              width: 2.2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.42,
                color: color.withAlpha(arcAlpha),
              }),
              arcType: Cesium.ArcType.NONE,
            },
          });
          routeEntityIds.current.push(arcEntity.id);

          /* Destination pulse ring (one per dest+status) */
          const ringKey = `${route.destination.lat},${route.destination.lng},${route.status}`;
          if (!seenRingKeys.has(ringKey) && route.status !== 'delivered') {
            seenRingKeys.add(ringKey);
            const ringState: RingState = {
              t:         Math.random(),
              speed:     0.004 + Math.random() * 0.002,
              maxR:      220_000,
              colorHex:  hex,
              alpha:     0.60,
            };
            ringStatesRef.current.push(ringState);

            const ringEntity = viewer.entities.add({
              id: `ring-${route.trackingCode}-${ri}`,
              position: Cesium.Cartesian3.fromDegrees(route.destination.lng, route.destination.lat, 200),
              ellipse: {
                semiMajorAxis: new Cesium.CallbackProperty(() => ringState.t * ringState.maxR, false),
                semiMinorAxis: new Cesium.CallbackProperty(() => ringState.t * ringState.maxR, false),
                material: new Cesium.ColorMaterialProperty(
                  new Cesium.CallbackProperty(
                    () => Cesium.Color.fromCssColorString(ringState.colorHex).withAlpha((1 - ringState.t) * ringState.alpha),
                    false,
                  )
                ),
                height: 200,
              },
            });
            routeEntityIds.current.push(ringEntity.id);
          }

          /* Moving particle (skip for delivered/disputed) */
          if (route.status !== 'delivered' && route.status !== 'disputed') {
            const speed    = route.status === 'in_transit' ? 0.0030 :
                             route.status === 'assigned'   ? 0.0018 : 0.0010;
            const numPts   = route.status === 'in_transit' ? 2 : 1;
            for (let p = 0; p < numPts; p++) {
              const initProgress = (Math.random() + p / numPts) % 1;
              const primitive = particleCol.add({
                position: arcPts[0],
                pixelSize: 6,
                color: color.withAlpha(0.92),
                outlineColor: Cesium.Color.WHITE.withAlpha(0.22),
                outlineWidth: 1,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                id: `particle-${route.trackingCode}-${p}`,
              });
              particleStatesRef.current.push({ primitive, arcPts, progress: initProgress, speed });
            }
          }

          /* City dots (deduplicate) */
          const originKey = `${route.origin.lat},${route.origin.lng}`;
          const destKey   = `${route.destination.lat},${route.destination.lng}`;
          seenCities.set(originKey,      route.origin);
          seenCities.set(destKey, { ...route.destination, _dest: true } as any);
        });

        seenCities.forEach((city: any) => {
          cityCol.add({
            position: Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 200),
            pixelSize: city._dest ? 9 : 6,
            color: Cesium.Color.fromCssColorString(city._dest ? '#fbbf24' : '#7dd3fc'),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.28),
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          });
        });
      };

      /* ── Animation loop ─────────────────────────────────────────────────── */
      const tick = () => {
        if (!cancelled && !viewer.isDestroyed()) {
          if (!isInteracting) viewer.camera.rotateRight(-0.00015);

          for (const p of particleStatesRef.current) {
            p.progress = (p.progress + p.speed) % 1;
            const N   = p.arcPts.length;
            const idx = Math.min(Math.floor(p.progress * N), N - 1);
            p.primitive.position = p.arcPts[idx];
          }
          for (const r of ringStatesRef.current) {
            r.t = (r.t + r.speed) % 1;
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      /* ── Interaction: pause auto-spin ──────────────────────────────────── */
      const pauseSpin  = () => {
        isInteracting = true;
        if (resumeTimer) clearTimeout(resumeTimer);
      };
      const resumeSpin = () => {
        resumeTimer = setTimeout(() => { isInteracting = false; }, 2500);
      };
      const evh = viewer.screenSpaceEventHandler;
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.LEFT_DOWN);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.LEFT_UP);
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.MIDDLE_UP);
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.PINCH_START);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.PINCH_END);

      viewerRef.current = viewer;

      /* Render routes that may have arrived before viewer was ready */
      setRoutes(prev => { renderRef.current?.(prev); return prev; });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (resumeTimer) clearTimeout(resumeTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-render routes whenever API data updates ──────────────────────── */
  useEffect(() => {
    if (viewerRef.current && renderRef.current) {
      renderRef.current(routes);
    }
  }, [routes]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction:'none', userSelect:'none', WebkitUserSelect:'none' }}
    />
  );
}
