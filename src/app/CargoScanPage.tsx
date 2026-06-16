import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Home, CheckCircle, AlertCircle, RefreshCw, Shield, Camera, Info } from 'lucide-react';
import { useLang } from '../lib/LangContext';
import type { Translations } from './i18n';

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'consent' | 'starting' | 'capturing' | 'uploading' | 'analyzing' | 'result' | 'cam-denied' | 'error';

export interface AngleEntry {
  kind: 'video' | 'frame';
  angle?: string;
  description?: string;
}

interface Props {
  listingId?: string;
  agreementId?: string;
  initialJobId?: string;        // M4: pre-created job (skip creation)
  initialAnglePlan?: AngleEntry[]; // M4: pre-set angle plan
  overrideToken?: string;       // M4: scoped session token for handoff
  onBack: () => void;
  onHome: () => void;
}

// ── Angle label helper ─────────────────────────────────────────────────────────

const ANGLE_MAP: Record<string, keyof Translations> = {
  'front':                        'scanAngleFront',
  'back':                         'scanAngleBack',
  'left':                         'scanAngleLeft',
  'right':                        'scanAngleRight',
  'powered-on':                   'scanAnglePoweredOn',
  'overall':                      'scanAngleOverall',
  'seal close-up':                'scanAngleSeal',
  'flat-front':                   'scanAngleFlatFront',
  'flat-back':                    'scanAngleFlatBack',
  'corner close-up':              'scanAngleCorner',
  'full spread':                  'scanAngleSpread',
  'quantity shot':                'scanAngleQuantity',
  'part-number close-up':         'scanAnglePartNum',
  'hallmark/serial close-up':     'scanAngleHallmark',
};

function angleLabel(angle: string, t: Translations): string {
  if (ANGLE_MAP[angle]) return t[ANGLE_MAP[angle]] as string;
  const lo = angle.toLowerCase();
  if (lo.includes('serial') || lo.includes('imei') || lo.includes('model label')) return t.scanAngleCloseup;
  if (lo.includes('hallmark')) return t.scanAngleHallmark;
  if (lo.includes('close-up') || lo.includes('closeup')) return t.scanAngleCloseup;
  if (lo.includes('seal')) return t.scanAngleSeal;
  if (lo.includes('flat-front')) return t.scanAngleFlatFront;
  if (lo.includes('flat-back')) return t.scanAngleFlatBack;
  if (lo.includes('quantity')) return t.scanAngleQuantity;
  if (lo.includes('part-number') || lo.includes('part number')) return t.scanAnglePartNum;
  return angle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── On-device quality gate ─────────────────────────────────────────────────────

function checkQuality(video: HTMLVideoElement, canvas: HTMLCanvasElement): 'ok' | 'blur' | 'dark' {
  try {
    const W = 160, H = 120;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) return 'ok';
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    // Brightness check
    let bright = 0;
    const n = W * H;
    for (let i = 0; i < data.length; i += 4) {
      bright += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    if (bright / n < 38) return 'dark';

    // Laplacian variance (blur detection)
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    let sumLap = 0, cnt = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W];
        sumLap += lap * lap;
        cnt++;
      }
    }
    if (cnt > 0 && sumLap / cnt < 22) return 'blur';
    return 'ok';
  } catch {
    return 'ok';
  }
}

// ── Best-effort edge bounding-box detection ────────────────────────────────────
// Always has a robust fallback (target frame). Never blocks capture.

function detectEdgeBox(
  video: HTMLVideoElement,
  scratch: HTMLCanvasElement,
): { x: number; y: number; w: number; h: number } | null {
  try {
    const W = 80, H = 60;
    scratch.width = W; scratch.height = H;
    const ctx = scratch.getContext('2d');
    if (!ctx || video.readyState < 2) return null;
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    let maxE = 0;
    const edges = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = -gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1]
                  + gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1];
        const gy = -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1]
                  + gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
        edges[i] = Math.sqrt(gx * gx + gy * gy);
        if (edges[i] > maxE) maxE = edges[i];
      }
    }
    if (maxE < 25) return null;
    const thr = maxE * 0.28;
    let minX = W, minY = H, maxX = 0, maxY = 0, cnt = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (edges[y * W + x] > thr) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          cnt++;
        }
      }
    }
    if (cnt < 40) return null;
    const bboxArea = (maxX - minX) * (maxY - minY) / (W * H);
    if (bboxArea < 0.04 || bboxArea > 0.92) return null;
    return { x: minX / W, y: minY / H, w: (maxX - minX) / W, h: (maxY - minY) / H };
  } catch {
    return null;
  }
}

// ── Angle ring (Face-ID style arcs) ───────────────────────────────────────────

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const s = toRad(startDeg), e = toRad(endDeg);
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function AngleRing({
  total,
  captured,
  active,
  size = 120,
}: {
  total: number;
  captured: number;
  active: number;
  size?: number;
}) {
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  const gapDeg = total <= 3 ? 10 : total <= 6 ? 7 : 5;
  const segDeg = (360 - total * gapDeg) / total;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: total }, (_, i) => {
        const start = i * (segDeg + gapDeg);
        const end = start + segDeg;
        const done = i < captured;
        const current = i === captured && i < total;
        return (
          <path
            key={i}
            d={arcPath(cx, cy, r, start, end)}
            stroke={done ? '#06b6d4' : current ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)'}
            strokeWidth={done ? 6 : current ? 5 : 4}
            fill="none"
            strokeLinecap="round"
            style={current ? { animation: 'pulse 1.4s ease-in-out infinite' } : undefined}
          />
        );
      })}
      <style>{`@keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>
    </svg>
  );
}

// ── Canvas overlay (target frame + detected edge box) ─────────────────────────

function drawOverlayFrame(
  canvas: HTMLCanvasElement,
  quality: 'ok' | 'blur' | 'dark' | null,
  edgeBox: { x: number; y: number; w: number; h: number } | null,
) {
  const cw = canvas.width, ch = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);

  const frameW = Math.min(cw, ch) * 0.74;
  const frameH = frameW * 0.78;
  const fx = (cw - frameW) / 2;
  const fy = (ch - frameH) / 2;
  const cornerLen = frameW * 0.11;
  const borderR = 18;

  const strokeColor =
    quality === 'ok'
      ? 'rgba(6,182,212,0.95)'
      : quality === 'blur' || quality === 'dark'
      ? 'rgba(239,68,68,0.88)'
      : 'rgba(255,255,255,0.55)';

  // If edge box detected with reasonable confidence, draw it instead
  if (edgeBox) {
    const bx = fx + edgeBox.x * frameW;
    const by = fy + edgeBox.y * frameH;
    const bw = edgeBox.w * frameW;
    const bh = edgeBox.h * frameH;
    ctx.strokeStyle = quality === 'ok' ? 'rgba(6,182,212,0.8)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
  }

  // Always draw target frame corners (fallback + primary guide)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  const corners = [
    // TL
    [fx, fy + cornerLen, fx, fy + borderR, fx + borderR, fy, fx + cornerLen, fy],
    // TR
    [fx + frameW - cornerLen, fy, fx + frameW - borderR, fy, fx + frameW, fy + borderR, fx + frameW, fy + cornerLen],
    // BR
    [fx + frameW, fy + frameH - cornerLen, fx + frameW, fy + frameH - borderR, fx + frameW - borderR, fy + frameH, fx + frameW - cornerLen, fy + frameH],
    // BL
    [fx + cornerLen, fy + frameH, fx + borderR, fy + frameH, fx, fy + frameH - borderR, fx, fy + frameH - cornerLen],
  ] as const;

  for (const [x1, y1, cpx, cpy, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cpx, cpy);
    ctx.arcTo(cpx, cpy, x2, y2, borderR);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CargoScanPage({ listingId, agreementId, initialJobId, initialAnglePlan, overrideToken, onBack, onHome }: Props) {
  const { t, isRTL } = useLang();

  const [phase, setPhase] = useState<Phase>('consent');
  const [jobId, setJobId] = useState<string | null>(null);
  const [anglePlan, setAnglePlan] = useState<AngleEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [frames, setFrames] = useState<{ blob: Blob; angle: string }[]>([]);
  const [quality, setQuality] = useState<'ok' | 'blur' | 'dark' | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [jobStatus, setJobStatus] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [edgeBox, setEdgeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const qCanvasRef = useRef<HTMLCanvasElement>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const qualityRafRef = useRef<number | null>(null);
  const edgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const edgeBoxRef = useRef<typeof edgeBox>(null);
  const qualityRef = useRef<typeof quality>(null);
  const overlayRafRef = useRef<number | null>(null);

  // Keep refs in sync for overlay RAF
  edgeBoxRef.current = edgeBox;
  qualityRef.current = quality;

  const frameAngles = anglePlan.filter(a => a.kind === 'frame');
  const totalFrames = frameAngles.length;
  const capturedCount = frames.length;

  const getToken = () => overrideToken || localStorage.getItem('cp_token') || '';

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (pollRef.current) clearInterval(pollRef.current);
      if (edgeTimerRef.current) clearInterval(edgeTimerRef.current);
      if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);
    };
  }, []);

  // ── Overlay RAF loop ─────────────────────────────────────────────────────────
  const startOverlayLoop = useCallback(() => {
    const loop = () => {
      const canvas = overlayRef.current;
      if (canvas) {
        const parent = canvas.parentElement;
        if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        }
        drawOverlayFrame(canvas, qualityRef.current, edgeBoxRef.current);
      }
      overlayRafRef.current = requestAnimationFrame(loop);
    };
    overlayRafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopOverlayLoop = () => {
    if (overlayRafRef.current) {
      cancelAnimationFrame(overlayRafRef.current);
      overlayRafRef.current = null;
    }
  };

  // ── Quality poll ─────────────────────────────────────────────────────────────
  const startQualityPoll = useCallback(() => {
    const poll = () => {
      const video = videoRef.current;
      const canvas = qCanvasRef.current;
      if (video && canvas) setQuality(checkQuality(video, canvas));
      qualityRafRef.current = requestAnimationFrame(poll);
    };
    qualityRafRef.current = requestAnimationFrame(poll);
  }, []);

  const stopQualityPoll = () => {
    if (qualityRafRef.current) { cancelAnimationFrame(qualityRafRef.current); qualityRafRef.current = null; }
  };

  // ── Edge detection poll (1/s) ────────────────────────────────────────────────
  const startEdgePoll = useCallback(() => {
    edgeTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = edgeCanvasRef.current;
      if (video && canvas) setEdgeBox(detectEdgeBox(video, canvas));
    }, 1000);
  }, []);

  // ── Camera lifecycle ─────────────────────────────────────────────────────────
  function stopCamera() {
    stopQualityPoll();
    stopOverlayLoop();
    if (edgeTimerRef.current) { clearInterval(edgeTimerRef.current); edgeTimerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start MediaRecorder (best-effort)
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=h264')
        ? 'video/mp4;codecs=h264'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      try {
        const recorder = new MediaRecorder(stream, { mimeType });
        chunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(500);
        recorderRef.current = recorder;
        setIsRecording(true);
      } catch {
        // MediaRecorder not available / unsupported — skip video recording
        setIsRecording(false);
      }

      startQualityPoll();
      startEdgePoll();
      startOverlayLoop();
      setPhase('capturing');
    } catch (err: unknown) {
      stopCamera();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setPhase('cam-denied');
      } else {
        setErrMsg(t.scanErrNetwork);
        setPhase('error');
      }
    }
  }

  // ── Consent accepted → create job (or use pre-set) → start camera ───────────
  async function handleConsent() {
    setPhase('starting');
    try {
      if (initialJobId && initialAnglePlan) {
        // M4 handoff: job already created, skip creation
        setJobId(initialJobId);
        setAnglePlan(initialAnglePlan);
        await startCamera();
        return;
      }

      const body: Record<string, string> = {};
      if (agreementId) body.agreementId = agreementId;
      else if (listingId) body.listingId = listingId;

      const res = await fetch('/api/scan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { jobId: string; anglePlan: AngleEntry[] };
      setJobId(data.jobId);
      setAnglePlan(data.anglePlan);
      await startCamera();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : t.scanErrCreate);
      setPhase('error');
    }
  }

  // ── Capture current angle ────────────────────────────────────────────────────
  async function handleCapture() {
    if (capturing) return;
    const video = videoRef.current;
    const qCanvas = qCanvasRef.current;
    if (!video || !qCanvas) return;

    // Final quality check
    const q = checkQuality(video, qCanvas);
    setQuality(q);
    if (q !== 'ok') return; // don't advance — re-prompt

    setCapturing(true);
    try {
      // Grab JPEG frame from video
      const fc = document.createElement('canvas');
      fc.width = video.videoWidth || 1280;
      fc.height = video.videoHeight || 720;
      const fctx = fc.getContext('2d');
      if (!fctx) return;
      fctx.drawImage(video, 0, 0, fc.width, fc.height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        fc.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92)
      );

      const currentAngle = frameAngles[currentIdx]?.angle ?? `frame-${currentIdx}`;
      const newFrames = [...frames, { blob, angle: currentAngle }];
      setFrames(newFrames);

      const nextIdx = currentIdx + 1;
      if (nextIdx >= totalFrames) {
        // All angles done — stop recording and upload
        setCurrentIdx(nextIdx);
        await finishCapture(newFrames);
      } else {
        setCurrentIdx(nextIdx);
        setQuality(null);
      }
    } finally {
      setCapturing(false);
    }
  }

  // ── Finish capture → upload ──────────────────────────────────────────────────
  async function finishCapture(capturedFrames: { blob: Blob; angle: string }[]) {
    // Stop recording
    let vBlob: Blob | null = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      vBlob = await new Promise<Blob>(resolve => {
        const recorder = recorderRef.current!;
        recorder.onstop = () => {
          const b = new Blob(chunksRef.current, { type: recorder.mimeType });
          resolve(b);
        };
        recorder.stop();
      });
      setVideoBlob(vBlob);
      setIsRecording(false);
    }
    stopCamera();
    setPhase('uploading');

    try {
      if (!jobId) throw new Error('No jobId');

      // Build files list
      const files: { kind: string; angle?: string }[] = [];
      if (vBlob) files.push({ kind: 'video' });
      for (const f of capturedFrames) files.push({ kind: 'frame', angle: f.angle });

      setUploadProgress({ done: 0, total: files.length });

      // Get presigned URLs
      const urlRes = await fetch(`/api/scan/${jobId}/upload-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ files }),
      });
      if (!urlRes.ok) throw new Error(`upload-urls HTTP ${urlRes.status}`);
      const { urls } = await urlRes.json() as { urls: { key: string; uploadUrl: string; kind: string; angle?: string }[] };

      // PUT each file to Spaces
      const mediaKeys: string[] = [];
      let done = 0;

      for (const entry of urls) {
        let blob: Blob | undefined;
        if (entry.kind === 'video') {
          blob = vBlob ?? undefined;
        } else {
          blob = capturedFrames.find(f => f.angle === entry.angle)?.blob;
        }
        if (!blob) continue;

        const contentType = entry.kind === 'video' ? 'video/mp4' : 'image/jpeg';
        const putRes = await fetch(entry.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        });
        if (!putRes.ok) throw new Error(`PUT ${entry.key} → HTTP ${putRes.status}`);
        mediaKeys.push(entry.key);
        done++;
        setUploadProgress({ done, total: files.length });
      }

      // Finalize
      const finRes = await fetch(`/api/scan/${jobId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mediaKeys }),
      });
      if (!finRes.ok) throw new Error(`finalize HTTP ${finRes.status}`);

      // Start polling
      setPhase('analyzing');
      startPolling();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : t.scanErrNetwork);
      setPhase('error');
    }
  }

  // ── Poll for result ──────────────────────────────────────────────────────────
  function startPolling() {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/${jobId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json() as { job: { status: string } };
        const st = data.job.status;
        setJobStatus(st);
        if (st === 'verified' || st === 'flagged' || st === 'rejected' || st === 'analysis_failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPhase('result');
        }
      } catch {}
    }, 2000);
  }

  // ── Retry analysis (analysis_failed) ────────────────────────────────────────
  async function handleRetryAnalysis() {
    if (!jobId) return;
    setPhase('analyzing');
    try {
      await fetch(`/api/scan/${jobId}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      startPolling();
    } catch {
      setPhase('result');
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────
  const qualityHint =
    quality === 'blur' ? t.scanQualityBlur :
    quality === 'dark' ? t.scanQualityDark :
    quality === 'ok'   ? t.scanQualityOk   : '';

  const qualityColor =
    quality === 'ok'  ? 'text-cyan-400' :
    quality === 'blur' || quality === 'dark' ? 'text-red-400' :
    'text-gray-400';

  // ── CONSENT SCREEN ───────────────────────────────────────────────────────────
  if (phase === 'consent') {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between px-4 pt-6 pb-4">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={onHome} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
            <Home className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>

            <h1 className="text-2xl font-extrabold text-white text-center mb-2">{t.scanConsentTitle}</h1>
            <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">{t.scanConsentBody}</p>

            <div className="space-y-3 mb-8">
              {([t.scanConsentItem1, t.scanConsentItem2, t.scanConsentItem3] as const).map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleConsent}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-2xl text-base shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all mb-3"
            >
              {t.scanConsentAccept}
            </motion.button>
            <button
              onClick={onBack}
              className="w-full py-3 text-gray-500 text-sm font-medium hover:text-gray-300 transition-colors"
            >
              {t.scanConsentDecline}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── STARTING (creating job) ──────────────────────────────────────────────────
  if (phase === 'starting') {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">{t.scanErrCreate.includes('Failed') ? 'Preparing…' : '…'}</p>
        </div>
      </div>
    );
  }

  // ── CAMERA DENIED ───────────────────────────────────────────────────────────
  if (phase === 'cam-denied') {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center mb-6">
          <Camera className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">{t.scanCamDeniedTitle}</h2>
        <p className="text-gray-400 text-sm text-center mb-4 leading-relaxed">{t.scanCamDeniedDesc}</p>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-8 text-sm text-gray-400 text-center">
          {t.scanCamDeniedHow}
        </div>
        <button onClick={onBack} className="ds-btn-secondary">{t.navBack}</button>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-bold text-white text-center mb-2">{t.scanResultFailed}</h2>
        <p className="text-gray-400 text-sm text-center mb-6">{errMsg}</p>
        <button onClick={onBack} className="ds-btn-secondary">{t.navBack}</button>
      </div>
    );
  }

  // ── UPLOADING ───────────────────────────────────────────────────────────────
  if (phase === 'uploading') {
    const pct = uploadProgress.total > 0 ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-xs text-center">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white font-semibold mb-4">{t.scanUploading}</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
          <p className="text-gray-500 text-xs mt-2">{pct}%</p>
        </div>
      </div>
    );
  }

  // ── ANALYZING (polling) ──────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <p className="text-white font-semibold text-center mb-2">{t.scanAnalyzing}</p>
        <p className="text-gray-500 text-xs text-center">Job: {jobId}</p>
      </div>
    );
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const isVerified = jobStatus === 'verified';
    const isFailed = jobStatus === 'analysis_failed';
    // flagged / rejected → neutral "under review" — never show flag details

    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          {isVerified ? (
            <>
              <div className="w-20 h-20 bg-green-500/15 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-3">{t.scanResultVerified}</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">{t.scanResultVerifiedDesc}</p>
            </>
          ) : isFailed ? (
            <>
              <div className="w-20 h-20 bg-red-500/15 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">{t.scanResultFailed}</h2>
              <p className="text-gray-400 text-sm mb-6">{t.scanErrNetwork}</p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleRetryAnalysis}
                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl mb-3"
              >
                <RefreshCw className="w-4 h-4" />
                {t.scanRetryAnalysis}
              </motion.button>
            </>
          ) : (
            // flagged or rejected → neutral "under review"
            <>
              <div className="w-20 h-20 bg-amber-500/15 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Info className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">{t.scanResultUnderReview}</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">{t.scanResultUnderReviewDesc}</p>
            </>
          )}

          <button onClick={onHome} className="w-full py-3 border border-white/15 text-gray-400 rounded-xl hover:bg-white/5 transition-colors text-sm">
            {t.navHome}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── CAPTURING (main camera view) ─────────────────────────────────────────────
  const currentAngle = frameAngles[currentIdx];
  const currentLabel = currentAngle ? angleLabel(currentAngle.angle ?? '', t) : '';
  const allDone = capturedCount >= totalFrames && totalFrames > 0;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" dir={isRTL ? 'rtl' : 'ltr'} style={{ zIndex: 9999 }}>

      {/* Hidden canvases for quality + edge detection */}
      <canvas ref={qCanvasRef} className="hidden" />
      <canvas ref={edgeCanvasRef} className="hidden" />

      {/* Top HUD */}
      <div
        className="relative z-20 flex items-center justify-between px-4 pt-8 pb-4"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
      >
        <button
          onClick={() => { stopCamera(); onBack(); }}
          className="w-9 h-9 bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Angle counter */}
        <div className="text-white text-sm font-semibold bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/15">
          {t.scanAngleLabel} {Math.min(capturedCount + 1, totalFrames)} {t.scanAngleOf} {totalFrames}
        </div>

        {/* REC indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/40">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs font-bold">{t.scanVideoRecording}</span>
          </div>
        )}
        {!isRecording && <div className="w-9" />}
      </div>

      {/* Angle ring overlay (centered above camera) */}
      <div className="relative z-20 flex flex-col items-center -mt-2 mb-1 pointer-events-none">
        <AngleRing total={totalFrames} captured={capturedCount} active={currentIdx} size={100} />
        <div className="text-center mt-1 px-4">
          {allDone ? (
            <span className="text-cyan-400 text-sm font-bold">{t.scanAllCaptured}</span>
          ) : (
            <span className="text-white text-sm font-semibold">{currentLabel}</span>
          )}
        </div>
      </div>

      {/* Camera viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {/* Canvas overlay for target frame + edge box */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {/* Quality badge */}
        {quality && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm border ${
              quality === 'ok'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
              {qualityHint}
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="relative z-20 flex flex-col items-center px-6 pt-4 pb-10 gap-4"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
      >
        {/* Angle prompt */}
        {!allDone && currentLabel && (
          <p className="text-gray-300 text-sm text-center font-medium">
            {t.scanCaptureTap} — <span className="text-white font-bold">{currentLabel}</span>
          </p>
        )}

        {/* Fallback hint */}
        {!edgeBox && (
          <p className="text-gray-500 text-xs text-center">{t.scanOutlineFallback}</p>
        )}

        {/* Capture button */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleCapture}
          disabled={capturing || allDone}
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all shadow-xl ${
            allDone
              ? 'border-green-400 bg-green-500/20 cursor-not-allowed'
              : quality === 'ok' || quality === null
              ? 'border-white bg-white/20 hover:bg-white/30 active:scale-90 cursor-pointer'
              : 'border-red-400 bg-red-500/20 cursor-not-allowed'
          }`}
        >
          {allDone ? (
            <CheckCircle className="w-8 h-8 text-green-400" />
          ) : capturing ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className={`w-14 h-14 rounded-full ${
              quality === 'ok' || quality === null ? 'bg-white' : 'bg-red-400'
            }`} />
          )}
        </motion.button>

        {quality && quality !== 'ok' && (
          <p className={`text-xs font-medium text-center ${qualityColor}`}>{qualityHint}</p>
        )}
      </div>
    </div>
  );
}
