/**
 * ShipmentGlobe — full-screen CesiumJS 3D Earth with live Chapar shipment routes.
 *
 * Imagery : ESRI World Satellite + Reference Labels (no API key needed)
 * Terrain : EllipsoidTerrainProvider (smooth globe, no Ion token required)
 * Engine  : CesiumJS 1.114 from CDN
 */
import { useEffect, useRef } from 'react';
import type { ShipmentRoute, RouteStatus } from '../types/tracking';

declare global { interface Window { Cesium: any } }

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
      .cesium-widget,.cesium-widget canvas { background:transparent!important }
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, D = Math.PI / 180;
  const dLat = (lat2 - lat1) * D, dLng = (lng2 - lng1) * D;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function buildArc(Cesium: any, oLat: number, oLng: number, dLat: number, dLng: number, N = 120): any[] {
  const D   = Math.PI / 180;
  const oLaR = oLat * D, oLoR = oLng * D, dLaR = dLat * D, dLoR = dLng * D;
  const dLa  = dLaR - oLaR, dLo = dLoR - oLoR;
  const h    = Math.sin(dLa / 2) ** 2 + Math.cos(oLaR) * Math.cos(dLaR) * Math.sin(dLo / 2) ** 2;
  const ang  = 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  const maxAlt = Math.max(300_000, Math.min(4_200_000, ang * 3_000_000));

  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    let lat: number, lng: number;
    if (ang < 1e-6) { lat = oLat; lng = oLng; }
    else {
      const A = Math.sin((1 - t) * ang) / Math.sin(ang);
      const B = Math.sin(t * ang) / Math.sin(ang);
      const x = A * Math.cos(oLaR) * Math.cos(oLoR) + B * Math.cos(dLaR) * Math.cos(dLoR);
      const y = A * Math.cos(oLaR) * Math.sin(oLoR) + B * Math.cos(dLaR) * Math.sin(dLoR);
      const z = A * Math.sin(oLaR) + B * Math.sin(dLaR);
      lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * (180 / Math.PI);
      lng = Math.atan2(y, x) * (180 / Math.PI);
    }
    return Cesium.Cartesian3.fromDegrees(lng, lat, maxAlt * 4 * t * (1 - t));
  });
}

// Geographic midpoint (not arc midpoint — stays on surface for fly-to)
function geoMidpoint(lat1: number, lng1: number, lat2: number, lng2: number) {
  const D = Math.PI / 180;
  const lat1R = lat1 * D, lng1R = lng1 * D, lat2R = lat2 * D, lng2R = lng2 * D;
  const Bx = Math.cos(lat2R) * Math.cos(lng2R - lng1R);
  const By = Math.cos(lat2R) * Math.sin(lng2R - lng1R);
  const midLat = Math.atan2(Math.sin(lat1R) + Math.sin(lat2R), Math.sqrt((Math.cos(lat1R) + Bx) ** 2 + By ** 2));
  const midLng = lng1R + Math.atan2(By, Math.cos(lat1R) + Bx);
  return { lat: midLat * (180 / Math.PI), lng: midLng * (180 / Math.PI) };
}

interface ParticleState { primitive: any; arcPts: any[]; progress: number; dir: number; base: number }
interface RingState     { t: number }

export interface ShipmentGlobeProps {
  routes: ShipmentRoute[];
  selectedCode?: string | null;
  onLoad?: () => void;
  className?: string;
}

export default function ShipmentGlobe({ routes, selectedCode, onLoad, className = '' }: ShipmentGlobeProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const viewerRef       = useRef<any>(null);
  const arcsByCode      = useRef<Map<string, any[]>>(new Map());
  const particleStates  = useRef<ParticleState[]>([]);
  const ringStates      = useRef<RingState[]>([]);
  const autoRotateRef   = useRef(true);
  const isInteracting   = useRef(false);
  const lastInteract    = useRef(Date.now());

  // ── Init globe ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    loadCesium().then((ok) => {
      if (!ok || cancelled || !containerRef.current || viewerRef.current) return;
      const Cesium = window.Cesium;
      try { Cesium.Ion.defaultAccessToken = ''; } catch (_) {}

      const creditDiv = document.createElement('div');
      creditDiv.style.cssText =
        'position:absolute;bottom:2px;right:5px;font-size:7px;color:rgba(255,255,255,.18);pointer-events:none;z-index:1';
      containerRef.current!.appendChild(creditDiv);

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false, baseLayerPicker: false, fullscreenButton: false,
        vrButton: false, geocoder: false, homeButton: false, infoBox: false,
        sceneModePicker: false, selectionIndicator: false, timeline: false,
        navigationHelpButton: false, navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true, creditContainer: creditDiv,
        requestRenderMode: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });
      viewerRef.current = viewer;

      // ── Imagery: ESRI satellite + reference labels ──────────────────────
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          maximumLevel: 19,
          credit: 'Esri, Maxar, Earthstar Geographics',
        }),
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          maximumLevel: 15,
        }),
      );

      // ── Scene atmosphere (Google Earth feel) ───────────────────────────
      viewer.scene.globe.enableLighting       = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show         = true;
      viewer.scene.skyAtmosphere.atmosphereLightIntensity = 10.0;
      viewer.scene.skyBox.show                = true;
      viewer.scene.fog.enabled                = true;
      viewer.scene.fog.density                = 0.00015;
      viewer.scene.globe.atmosphereMieAnisotropy = 0.97;

      // ── Initial camera: looking down at Earth center ───────────────────
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(25, 35, 20_000_000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch:   Cesium.Math.toRadians(-90),
          roll:    0,
        },
      });

      // ── Primitive collections ──────────────────────────────────────────
      const pointCol = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      );
      const pkgCol = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      );
      const labelCol = viewer.scene.primitives.add(new Cesium.LabelCollection());

      // ── Render all routes ──────────────────────────────────────────────
      routes.forEach((route) => {
        const hex   = STATUS_COLOR[route.status] ?? '#3b82f6';
        const base  = STATUS_PROGRESS[route.status] ?? 0.5;
        const color = Cesium.Color.fromCssColorString(hex);
        const arcPts = buildArc(Cesium, route.originLat, route.originLng, route.destinationLat, route.destinationLng);
        arcsByCode.current.set(route.trackingCode, arcPts);

        const isDelivered = route.status === 'delivered';

        // Arc polyline
        viewer.entities.add({
          polyline: {
            positions: arcPts,
            width: isDelivered ? 1.5 : 2.8,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: isDelivered ? 0.15 : 0.45,
              color: color.withAlpha(isDelivered ? 0.25 : 0.78),
            }),
            arcType: Cesium.ArcType.NONE,
          },
        });

        // Origin dot (amber)
        pointCol.add({
          position: Cesium.Cartesian3.fromDegrees(route.originLng, route.originLat, 500),
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#fbbf24'),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        // Destination dot (status color)
        pointCol.add({
          position: Cesium.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 500),
          pixelSize: 10,
          color,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        // Pulsing ring at destination
        if (!isDelivered) {
          const ringState: RingState = { t: Math.random() };
          ringStates.current.push(ringState);
          const maxR = 200_000;
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 200),
            ellipse: {
              semiMajorAxis: new Cesium.CallbackProperty(() => ringState.t * maxR, false),
              semiMinorAxis: new Cesium.CallbackProperty(() => ringState.t * maxR, false),
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => color.withAlpha((1 - ringState.t) * 0.55), false),
              ),
              height: 200,
            },
          });
        }

        // Pulsing ring at origin (smaller)
        const originRingState: RingState = { t: Math.random() * 0.5 };
        ringStates.current.push(originRingState);
        const originMaxR = 120_000;
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(route.originLng, route.originLat, 200),
          ellipse: {
            semiMajorAxis: new Cesium.CallbackProperty(() => originRingState.t * originMaxR, false),
            semiMinorAxis: new Cesium.CallbackProperty(() => originRingState.t * originMaxR, false),
            material: new Cesium.ColorMaterialProperty(
              new Cesium.CallbackProperty(
                () => Cesium.Color.fromCssColorString('#fbbf24').withAlpha((1 - originRingState.t) * 0.40),
                false,
              ),
            ),
            height: 200,
          },
        });

        // Moving package indicator
        const initIdx = Math.min(Math.floor(base * arcPts.length), arcPts.length - 1);
        const pkg = pkgCol.add({
          position: arcPts[initIdx],
          pixelSize: isDelivered ? 0 : 7,
          color: color.withAlpha(isDelivered ? 0 : 0.95),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.35),
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        particleStates.current.push({
          primitive: pkg,
          arcPts,
          progress: base + (Math.random() - 0.5) * 0.03,
          dir: Math.random() > 0.5 ? 1 : -1,
          base,
        });

        // Tracking code label (visible from far out, fade on close zoom)
        const midIdx = Math.floor(arcPts.length / 2);
        labelCol.add({
          position: arcPts[midIdx],
          text: route.trackingCode,
          font: '9px monospace',
          fillColor: color.withAlpha(0.82),
          outlineColor: Cesium.Color.BLACK.withAlpha(0.7),
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(1_500_000, 1.4, 14_000_000, 0.0),
        });

        // Origin city label
        labelCol.add({
          position: Cesium.Cartesian3.fromDegrees(route.originLng, route.originLat, 80_000),
          text: route.publicOriginCity,
          font: 'bold 12px system-ui,sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#fde68a').withAlpha(0.92),
          outlineColor: Cesium.Color.BLACK.withAlpha(0.75),
          outlineWidth: 2.5,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(300_000, 1.6, 7_000_000, 0.0),
        });

        // Destination city label
        labelCol.add({
          position: Cesium.Cartesian3.fromDegrees(route.destinationLng, route.destinationLat, 80_000),
          text: route.publicDestinationCity,
          font: 'bold 12px system-ui,sans-serif',
          fillColor: color.withAlpha(0.92),
          outlineColor: Cesium.Color.BLACK.withAlpha(0.75),
          outlineWidth: 2.5,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(300_000, 1.6, 7_000_000, 0.0),
        });
      });

      // ── Interaction: pause auto-spin ───────────────────────────────────
      const pauseSpin  = () => {
        isInteracting.current = true;
        lastInteract.current  = Date.now();
        if (resumeTimer) clearTimeout(resumeTimer);
      };
      const resumeSpin = () => {
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => { isInteracting.current = false; }, 3500);
      };
      const evh = viewer.screenSpaceEventHandler;
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.LEFT_DOWN);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.LEFT_UP);
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.RIGHT_DOWN);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.RIGHT_UP);
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.MIDDLE_UP);
      evh.setInputAction(pauseSpin,  Cesium.ScreenSpaceEventType.PINCH_START);
      evh.setInputAction(resumeSpin, Cesium.ScreenSpaceEventType.PINCH_END);
      evh.setInputAction(() => { isInteracting.current = true; lastInteract.current = Date.now(); },
        Cesium.ScreenSpaceEventType.WHEEL);

      // ── Animation loop ─────────────────────────────────────────────────
      const DRIFT = 0.018;

      const tick = () => {
        if (cancelled) return;

        // Auto-rotate
        if (!isInteracting.current && autoRotateRef.current) {
          viewer.camera.rotateRight(-0.00014);
        }

        // Animate packages
        for (const ps of particleStates.current) {
          if (ps.base < 0.98) {
            ps.progress += 0.00016 * ps.dir;
            if (ps.progress > ps.base + DRIFT) ps.dir = -1;
            if (ps.progress < ps.base - DRIFT) ps.dir = 1;
            const idx = Math.max(0, Math.min(ps.arcPts.length - 1, Math.floor(ps.progress * ps.arcPts.length)));
            ps.primitive.position = ps.arcPts[idx];
          }
        }

        // Animate rings
        for (const rs of ringStates.current) {
          rs.t = (rs.t + 0.0055) % 1;
        }

        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      onLoad?.();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (resumeTimer) clearTimeout(resumeTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      arcsByCode.current.clear();
      particleStates.current = [];
      ringStates.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to selected route ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCode) return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const Cesium = window.Cesium;

    const route = routes.find(r => r.trackingCode === selectedCode);
    if (!route) return;

    const distKm = haversineKm(route.originLat, route.originLng, route.destinationLat, route.destinationLng);
    const altitude = Math.max(1_200_000, Math.min(11_000_000, distKm * 620));
    const mid = geoMidpoint(route.originLat, route.originLng, route.destinationLat, route.destinationLng);

    // Pause rotation during flight
    isInteracting.current = true;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(mid.lng, mid.lat, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-42),
        roll:    0,
      },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      complete: () => {
        // Resume auto-rotate after 6 seconds
        setTimeout(() => { isInteracting.current = false; }, 6000);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    />
  );
}
