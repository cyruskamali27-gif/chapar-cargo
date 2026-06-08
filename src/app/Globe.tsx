import { useEffect, useRef } from 'react';

interface GlobeCanvasProps {
  className?: string;
}

// Iran hubs (gold=true) + global hubs (gold=false)
const CITIES = [
  // ── Iran ──────────────────────────────────────────────────────────────────
  { name: 'Tehran',       lat: 35.7,  lon:  51.4,  gold: true,  size: 1.0 },
  { name: 'Mashhad',      lat: 36.3,  lon:  59.6,  gold: true,  size: 0.75 },
  { name: 'Isfahan',      lat: 32.7,  lon:  51.7,  gold: true,  size: 0.65 },
  { name: 'Shiraz',       lat: 29.6,  lon:  52.5,  gold: true,  size: 0.60 },
  { name: 'Tabriz',       lat: 38.1,  lon:  46.3,  gold: true,  size: 0.58 },
  { name: 'Ahvaz',        lat: 31.3,  lon:  48.7,  gold: true,  size: 0.52 },
  { name: 'Kish',         lat: 26.5,  lon:  54.0,  gold: true,  size: 0.48 },
  // ── Americas ──────────────────────────────────────────────────────────────
  { name: 'Toronto',      lat: 43.7,  lon: -79.4,  gold: false, size: 0.60 },
  { name: 'Vancouver',    lat: 49.2,  lon:-123.1,  gold: false, size: 0.52 },
  { name: 'New York',     lat: 40.7,  lon: -74.0,  gold: false, size: 0.65 },
  { name: 'Los Angeles',  lat: 34.0,  lon:-118.2,  gold: false, size: 0.58 },
  // ── Europe ────────────────────────────────────────────────────────────────
  { name: 'London',       lat: 51.5,  lon:  -0.1,  gold: false, size: 0.65 },
  { name: 'Paris',        lat: 48.9,  lon:   2.3,  gold: false, size: 0.60 },
  { name: 'Frankfurt',    lat: 50.1,  lon:   8.7,  gold: false, size: 0.55 },
  { name: 'Amsterdam',    lat: 52.4,  lon:   4.9,  gold: false, size: 0.50 },
  { name: 'Stockholm',    lat: 59.3,  lon:  18.1,  gold: false, size: 0.46 },
  // ── Middle East ───────────────────────────────────────────────────────────
  { name: 'Istanbul',     lat: 41.0,  lon:  28.9,  gold: false, size: 0.62 },
  { name: 'Dubai',        lat: 25.2,  lon:  55.3,  gold: false, size: 0.68 },
  { name: 'Abu Dhabi',    lat: 24.5,  lon:  54.4,  gold: false, size: 0.48 },
  { name: 'Doha',         lat: 25.3,  lon:  51.5,  gold: false, size: 0.46 },
  // ── Russia & CIS ──────────────────────────────────────────────────────────
  { name: 'Moscow',       lat: 55.8,  lon:  37.6,  gold: false, size: 0.58 },
  // ── Asia Pacific ──────────────────────────────────────────────────────────
  { name: 'Singapore',    lat:  1.3,  lon: 103.8,  gold: false, size: 0.60 },
  { name: 'Tokyo',        lat: 35.7,  lon: 139.7,  gold: false, size: 0.62 },
  { name: 'Seoul',        lat: 37.6,  lon: 127.0,  gold: false, size: 0.55 },
  { name: 'Sydney',       lat:-33.9,  lon: 151.2,  gold: false, size: 0.58 },
  { name: 'Melbourne',    lat:-37.8,  lon: 145.0,  gold: false, size: 0.48 },
  // ── South Asia ────────────────────────────────────────────────────────────
  { name: 'Mumbai',       lat: 19.1,  lon:  72.9,  gold: false, size: 0.55 },
  { name: 'Delhi',        lat: 28.6,  lon:  77.2,  gold: false, size: 0.52 },
  // ── Southeast Asia ────────────────────────────────────────────────────────
  { name: 'Bangkok',      lat: 13.8,  lon: 100.5,  gold: false, size: 0.50 },
  { name: 'Kuala Lumpur', lat:  3.1,  lon: 101.7,  gold: false, size: 0.48 },
];

// Routes — pairs of city indices
const ROUTES = [
  // ── Canada ↔ Iran ──────────────────────────────────────────────────────────
  { a:  7, b:  0, color: [0, 200, 255],   speed: 0.0026 }, // Toronto → Tehran
  { a:  0, b:  7, color: [0, 150, 210],   speed: 0.0024 }, // Tehran → Toronto
  { a:  8, b:  0, color: [236, 72, 153],  speed: 0.0028 }, // Vancouver → Tehran
  { a:  7, b:  1, color: [59, 130, 246],  speed: 0.0022 }, // Toronto → Mashhad
  // ── USA ↔ Iran ─────────────────────────────────────────────────────────────
  { a:  9, b:  0, color: [34, 197, 94],   speed: 0.0030 }, // New York → Tehran
  { a:  0, b:  9, color: [22, 163, 74],   speed: 0.0028 }, // Tehran → New York
  { a: 10, b:  0, color: [249, 115, 22],  speed: 0.0025 }, // LA → Tehran
  // ── Europe ↔ Iran ──────────────────────────────────────────────────────────
  { a: 11, b:  0, color: [0, 200, 255],   speed: 0.0028 }, // London → Tehran
  { a:  0, b: 11, color: [0, 140, 180],   speed: 0.0026 }, // Tehran → London
  { a: 11, b:  1, color: [168, 85, 247],  speed: 0.0024 }, // London → Mashhad
  { a: 12, b:  0, color: [245, 158, 11],  speed: 0.0030 }, // Paris → Tehran
  { a: 13, b:  0, color: [34, 197, 94],   speed: 0.0027 }, // Frankfurt → Tehran
  { a: 13, b:  2, color: [99, 102, 241],  speed: 0.0025 }, // Frankfurt → Isfahan
  { a: 14, b:  0, color: [59, 130, 246],  speed: 0.0029 }, // Amsterdam → Tehran
  { a: 15, b:  1, color: [244, 63, 94],   speed: 0.0023 }, // Stockholm → Mashhad
  // ── Middle East ↔ Iran ─────────────────────────────────────────────────────
  { a: 16, b:  0, color: [168, 85, 247],  speed: 0.0031 }, // Istanbul → Tehran
  { a:  0, b: 16, color: [126, 34, 206],  speed: 0.0029 }, // Tehran → Istanbul
  { a: 16, b:  4, color: [249, 115, 22],  speed: 0.0027 }, // Istanbul → Tabriz
  { a: 17, b:  0, color: [34, 197, 94],   speed: 0.0034 }, // Dubai → Tehran
  { a:  0, b: 17, color: [21, 128, 61],   speed: 0.0032 }, // Tehran → Dubai
  { a: 17, b:  3, color: [20, 184, 166],  speed: 0.0030 }, // Dubai → Shiraz
  { a: 18, b:  0, color: [245, 158, 11],  speed: 0.0028 }, // Abu Dhabi → Tehran
  { a: 19, b:  0, color: [249, 115, 22],  speed: 0.0026 }, // Doha → Tehran
  // ── Russia ↔ Iran ──────────────────────────────────────────────────────────
  { a: 20, b:  0, color: [132, 204, 22],  speed: 0.0025 }, // Moscow → Tehran
  { a:  0, b: 20, color: [101, 163, 13],  speed: 0.0023 }, // Tehran → Moscow
  // ── Asia ↔ Iran ────────────────────────────────────────────────────────────
  { a: 21, b:  0, color: [34, 197, 94],   speed: 0.0024 }, // Singapore → Tehran
  { a:  0, b: 21, color: [21, 128, 61],   speed: 0.0022 }, // Tehran → Singapore
  { a: 21, b:  1, color: [132, 204, 22],  speed: 0.0026 }, // Singapore → Mashhad
  { a: 22, b:  0, color: [245, 158, 11],  speed: 0.0022 }, // Tokyo → Tehran
  { a: 23, b:  0, color: [59, 130, 246],  speed: 0.0023 }, // Seoul → Tehran
  { a: 24, b:  0, color: [59, 130, 246],  speed: 0.0021 }, // Sydney → Tehran
  { a: 24, b:  1, color: [245, 158, 11],  speed: 0.0024 }, // Sydney → Mashhad
  { a: 26, b:  0, color: [168, 85, 247],  speed: 0.0027 }, // Mumbai → Tehran
  { a: 27, b:  0, color: [0, 200, 255],   speed: 0.0026 }, // Delhi → Tehran
];

function toRad(deg: number) { return deg * Math.PI / 180; }

function latLonToVec(lat: number, lon: number): [number, number, number] {
  const latr = toRad(lat);
  const lonr = toRad(lon);
  return [
    Math.cos(latr) * Math.cos(lonr),
    Math.sin(latr),
    Math.cos(latr) * Math.sin(lonr),
  ];
}

function slerp(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  const dot = Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2]));
  const theta = Math.acos(dot);
  if (Math.abs(theta) < 1e-6) return a;
  const sinT = Math.sin(theta);
  const f0 = Math.sin((1 - t) * theta) / sinT;
  const f1 = Math.sin(t * theta) / sinT;
  return [f0*a[0] + f1*b[0], f0*a[1] + f1*b[1], f0*a[2] + f1*b[2]];
}

export default function GlobeCanvas({ className }: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0.6);
  const rafRef = useRef<number>(0);
  const progRef = useRef<number[]>(ROUTES.map((_, i) => i / ROUTES.length));
  const scaleRef = useRef(1.0);
  const isDragRef = useRef(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const onMouseDown = (e: MouseEvent) => { isDragRef.current = true; lastXRef.current = e.clientX; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragRef.current) return;
      phiRef.current += (e.clientX - lastXRef.current) * 0.005;
      lastXRef.current = e.clientX;
    };
    const onMouseUp = () => { isDragRef.current = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scaleRef.current = Math.max(0.6, Math.min(2.2, scaleRef.current - e.deltaY * 0.001));
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) { isDragRef.current = true; lastXRef.current = e.touches[0].clientX; }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragRef.current || e.touches.length !== 1) return;
      phiRef.current += (e.touches[0].clientX - lastXRef.current) * 0.005;
      lastXRef.current = e.touches[0].clientX;
    };
    const onTouchEnd = () => { isDragRef.current = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove as EventListener, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Static star field
    const stars: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.52 + Math.random() * 0.55;
      stars.push({
        x: dist * Math.cos(angle),
        y: dist * Math.sin(angle),
        r: 0.3 + Math.random() * 1.6,
        a: 0.25 + Math.random() * 0.7,
      });
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      // On desktop offset globe toward the right; on narrow screens center it
      const isNarrow = w < 900;
      const cx = isNarrow ? w / 2 : w * 0.62;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42 * scaleRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── Outer atmosphere ──────────────────────────────────────────────────
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.55);
      atmo.addColorStop(0,   'rgba(0,80,255,0.00)');
      atmo.addColorStop(0.4, 'rgba(0,60,200,0.10)');
      atmo.addColorStop(0.8, 'rgba(0,40,160,0.18)');
      atmo.addColorStop(1,   'rgba(0,20,100,0.00)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      // ── Stars ─────────────────────────────────────────────────────────────
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(cx + s.x * R, cy + s.y * R, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,220,255,${s.a})`;
        ctx.fill();
      });

      const phi = phiRef.current;
      const rotY = (v: [number,number,number]): [number,number,number] => [
        v[0] * Math.cos(phi) - v[2] * Math.sin(phi),
        v[1],
        v[0] * Math.sin(phi) + v[2] * Math.cos(phi),
      ];
      const project = (v: [number,number,number]): [number,number] => [
        cx + v[0] * R,
        cy - v[1] * R,
      ];

      // ── Globe body ────────────────────────────────────────────────────────
      const globeGrad = ctx.createRadialGradient(
        cx - R * 0.30, cy - R * 0.25, R * 0.05,
        cx + R * 0.10, cy + R * 0.05, R
      );
      globeGrad.addColorStop(0,    '#2a5fc4');
      globeGrad.addColorStop(0.25, '#1a3f8c');
      globeGrad.addColorStop(0.55, '#0f2560');
      globeGrad.addColorStop(0.80, '#071840');
      globeGrad.addColorStop(1,    '#020d28');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = globeGrad;
      ctx.fill();

      // ── Edge rim glow ─────────────────────────────────────────────────────
      const rim = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
      rim.addColorStop(0,   'rgba(0,120,255,0.00)');
      rim.addColorStop(0.6, 'rgba(0,100,255,0.12)');
      rim.addColorStop(1,   'rgba(0,80,220,0.35)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      // ── Clip sphere for grid lines ────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Latitude parallels
      [-60, -30, 0, 30, 60].forEach(lat => {
        const latr = toRad(lat);
        const circR = Math.cos(latr) * R;
        const yPos  = cy - Math.sin(latr) * R;
        ctx.beginPath();
        ctx.ellipse(cx, yPos, circR, circR * 0.27, 0, 0, Math.PI * 2);
        ctx.strokeStyle = lat === 0 ? 'rgba(0,160,255,0.22)' : 'rgba(80,140,255,0.10)';
        ctx.lineWidth = lat === 0 ? 1.1 : 0.7;
        ctx.stroke();
      });

      // Longitude meridians
      for (let i = 0; i < 12; i++) {
        const lonr = toRad(i * 30) + phi;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(lonr);
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 0.12, R, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(60,120,255,0.07)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // ── Arc routes ────────────────────────────────────────────────────────
      const prog = progRef.current;
      ROUTES.forEach((route, ri) => {
        const vA = latLonToVec(CITIES[route.a].lat, CITIES[route.a].lon);
        const vB = latLonToVec(CITIES[route.b].lat, CITIES[route.b].lon);
        const [r, g, b] = route.color;
        const SEGS = 90;
        const ALT  = 0.32;

        // Dim base arc
        ctx.beginPath();
        let first = true;
        for (let i = 0; i <= SEGS; i++) {
          const t = i / SEGS;
          const base = slerp(vA, vB, t);
          const lift = 1 + ALT * Math.sin(Math.PI * t);
          const v: [number,number,number] = [base[0]*lift, base[1]*lift, base[2]*lift];
          const rv = rotY(v);
          if (rv[2] < -0.04) { first = true; continue; }
          const [px, py] = project(rv);
          first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          first = false;
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},0.14)`;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Animated bright trail
        const head = prog[ri];
        const TRAIL = 0.20;
        const trailStart = Math.max(0, head - TRAIL);

        ctx.beginPath();
        first = true;
        for (let i = 0; i <= SEGS; i++) {
          const t = i / SEGS;
          if (t < trailStart || t > head) { first = true; continue; }
          const base = slerp(vA, vB, t);
          const lift = 1 + ALT * Math.sin(Math.PI * t);
          const v: [number,number,number] = [base[0]*lift, base[1]*lift, base[2]*lift];
          const rv = rotY(v);
          if (rv[2] < -0.04) { first = true; continue; }
          const [px, py] = project(rv);
          first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          first = false;
        }
        const fade = Math.min(1, (head - trailStart) / TRAIL);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.88 * fade})`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur = 7;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Head dot
        const headBase = slerp(vA, vB, head);
        const headLift = 1 + ALT * Math.sin(Math.PI * head);
        const headV: [number,number,number] = [headBase[0]*headLift, headBase[1]*headLift, headBase[2]*headLift];
        const headRV = rotY(headV);
        if (headRV[2] >= -0.04) {
          const [hx, hy] = project(headRV);
          const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 13);
          halo.addColorStop(0,   `rgba(${r},${g},${b},0.80)`);
          halo.addColorStop(0.4, `rgba(${r},${g},${b},0.30)`);
          halo.addColorStop(1,   `rgba(${r},${g},${b},0.00)`);
          ctx.beginPath();
          ctx.arc(hx, hy, 13, 0, Math.PI * 2);
          ctx.fillStyle = halo;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.shadowColor = `rgba(${r},${g},${b},1)`;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        prog[ri] = (prog[ri] + route.speed) % 1;
      });

      // ── City markers ──────────────────────────────────────────────────────
      const now = Date.now();
      CITIES.forEach((city, ci) => {
        const v = latLonToVec(city.lat, city.lon);
        const rv = rotY(v);
        if (rv[2] < 0) return;
        const [px, py] = project(rv);
        const pulse = 0.5 + 0.5 * Math.sin(now / 700 + ci * 0.7);
        const s = city.size;

        if (city.gold) {
          // Iran hub — gold with pulsing ring
          const ringR = (11 + 8 * pulse) * s;
          const ringG = ctx.createRadialGradient(px, py, 0, px, py, ringR);
          ringG.addColorStop(0, 'rgba(255,200,0,0.55)');
          ringG.addColorStop(1, 'rgba(255,200,0,0)');
          ctx.beginPath();
          ctx.arc(px, py, ringR, 0, Math.PI * 2);
          ctx.fillStyle = ringG;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, 7 * s, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd700';
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(px, py, 3 * s, 0, Math.PI * 2);
          ctx.fillStyle = '#fff8dc';
          ctx.fill();
        } else {
          // Global hub — cyan with pulsing ring
          const ringR = (8 + 5 * pulse) * s;
          const ringG = ctx.createRadialGradient(px, py, 0, px, py, ringR);
          ringG.addColorStop(0, 'rgba(0,210,255,0.40)');
          ringG.addColorStop(1, 'rgba(0,210,255,0)');
          ctx.beginPath();
          ctx.arc(px, py, ringR, 0, Math.PI * 2);
          ctx.fillStyle = ringG;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, 4.5 * s, 0, Math.PI * 2);
          ctx.fillStyle = '#38d4ff';
          ctx.shadowColor = '#38d4ff';
          ctx.shadowBlur = 9;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(px, py, 2 * s, 0, Math.PI * 2);
          ctx.fillStyle = '#e8f8ff';
          ctx.fill();
        }
      });

      // ── Top specular highlight ────────────────────────────────────────────
      const spec = ctx.createRadialGradient(
        cx - R * 0.32, cy - R * 0.38, 0,
        cx - R * 0.08, cy - R * 0.08, R * 0.78
      );
      spec.addColorStop(0,   'rgba(160,200,255,0.13)');
      spec.addColorStop(0.5, 'rgba(100,160,255,0.04)');
      spec.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      // ── Globe border ──────────────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,100,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (!isDragRef.current) phiRef.current += 0.0022;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
    />
  );
}
