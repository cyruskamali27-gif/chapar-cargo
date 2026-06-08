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
    link.rel = 'stylesheet';
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
    s.src = `${CESIUM_CDN}/Cesium.js`;
    s.onload  = () => resolve(true);
    s.onerror = () => { _cesiumLoad = null; resolve(false); };
    document.head.appendChild(s);
  });
  return _cesiumLoad;
}

const STATUS_COLORS: Record<RouteStatus, string> = {
  pending:      '#eab308',
  escrow_locked:'#a855f7',
  assigned:     '#22d3ee',
  in_transit:   '#3b82f6',
  delivered:    '#22c55e',
  disputed:     '#ef4444',
};

function buildArc(Cesium: any, oLat: number, oLng: number, dLat: number, dLng: number, N = 100): any[] {
  const D = Math.PI / 180;
  const oLaR = oLat * D, oLoR = oLng * D, dLaR = dLat * D, dLoR = dLng * D;
  const dLa = dLaR - oLaR, dLo = dLoR - oLoR;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(oLaR) * Math.cos(dLaR) * Math.sin(dLo / 2) ** 2;
  const ang = 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  const maxAlt = Math.max(400_000, Math.min(4_000_000, ang * 3_500_000));

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

function midpoint(oLat: number, oLng: number, dLat: number, dLng: number) {
  return { lat: (oLat + dLat) / 2, lng: (oLng + dLng) / 2 };
}

interface TrackingMapProps {
  route: ShipmentRoute;
  className?: string;
}

export default function TrackingMap({ route, className }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<any>(null);
  const routeRef     = useRef(route);
  routeRef.current   = route;

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let progress = 0;
    let particlePrimitive: any = null;
    let ringT = 0;

    loadCesium().then((ok) => {
      if (!ok || cancelled || !containerRef.current || viewerRef.current) return;
      const Cesium = window.Cesium;
      try { Cesium.Ion.defaultAccessToken = ''; } catch (_) {}

      const creditDiv = document.createElement('div');
      creditDiv.style.cssText = 'position:absolute;bottom:2px;right:5px;font-size:8px;color:rgba(255,255,255,.2);pointer-events:none;z-index:1;';
      containerRef.current.appendChild(creditDiv);

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false, baseLayerPicker: false, fullscreenButton: false,
        vrButton: false, geocoder: false, homeButton: false, infoBox: false,
        sceneModePicker: false, selectionIndicator: false, timeline: false,
        navigationHelpButton: false, navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true, creditContainer: creditDiv,
      });

      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel: 19,
          credit: 'Esri, Maxar, Earthstar Geographics',
        })
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel: 15,
        })
      );

      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyBox.show = true;
      viewer.scene.fog.enabled = false;

      const r = routeRef.current;
      const hex = STATUS_COLORS[r.status];
      const color = Cesium.Color.fromCssColorString(hex);
      const arcPts = buildArc(Cesium, r.origin.lat, r.origin.lng, r.destination.lat, r.destination.lng);

      // Arc
      viewer.entities.add({
        polyline: {
          positions: arcPts,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.5,
            color: color.withAlpha(0.85),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      });

      // Origin dot
      const cityCol = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT })
      );
      cityCol.add({
        position: Cesium.Cartesian3.fromDegrees(r.origin.lng, r.origin.lat, 200),
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#fbbf24'),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.4),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      // Destination dot
      cityCol.add({
        position: Cesium.Cartesian3.fromDegrees(r.destination.lng, r.destination.lat, 200),
        pixelSize: 12,
        color: color,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      // Destination pulse ring
      const ringState = { t: 0 };
      const maxR = 250_000;
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(r.destination.lng, r.destination.lat, 200),
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => ringState.t * maxR, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => ringState.t * maxR, false),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => color.withAlpha((1 - ringState.t) * 0.65), false)
          ),
          height: 200,
        },
      });

      // Moving particle on the arc
      const particleCol = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT })
      );
      particlePrimitive = particleCol.add({
        position: arcPts[0],
        pixelSize: 8,
        color: color.withAlpha(0.95),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      // Camera: fly to mid-point of route
      const mid = midpoint(r.origin.lat, r.origin.lng, r.destination.lat, r.destination.lng);
      const D = Math.PI / 180;
      const oLaR = r.origin.lat * D, oLoR = r.origin.lng * D;
      const dLaR = r.destination.lat * D, dLoR = r.destination.lng * D;
      const dLa = dLaR - oLaR, dLo = dLoR - oLoR;
      const h = Math.sin(dLa / 2) ** 2 + Math.cos(oLaR) * Math.cos(dLaR) * Math.sin(dLo / 2) ** 2;
      const angRad = 2 * Math.asin(Math.sqrt(Math.min(1, h)));
      const camAlt = Math.max(3_000_000, Math.min(14_000_000, angRad * 8_000_000));

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(mid.lng, mid.lat, camAlt),
        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-90), roll: 0 },
      });

      const SPEED = r.status === 'delivered' ? 0 : 0.0025;
      const tick = () => {
        if (!cancelled && !viewer.isDestroyed()) {
          if (SPEED > 0) {
            progress = (progress + SPEED) % 1;
            const idx = Math.min(Math.floor(progress * arcPts.length), arcPts.length - 1);
            if (particlePrimitive) particlePrimitive.position = arcPts[idx];
          } else if (particlePrimitive) {
            particlePrimitive.position = arcPts[arcPts.length - 1];
          }
          ringState.t = (ringState.t + 0.004) % 1;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      viewerRef.current = viewer;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.trackingCode]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    />
  );
}
