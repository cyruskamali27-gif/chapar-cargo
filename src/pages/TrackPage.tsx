import { useState, useEffect, useRef, useCallback } from 'react';
import GoogleTrackingMap from '../components/GoogleTrackingMap';
import { findDemoRoute, DEMO_ROUTES } from '../data/demoTrackingRoutes';
import type { ShipmentRoute, RouteStatus } from '../types/tracking';
import { Store } from '../lib/store';
import { useLang } from '../lib/LangContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type TrackRole = 'owner' | 'traveler' | 'receiver';

interface Order {
  trackId: string;
  type?: string;
  origin?: string; dest?: string;
  originLabel?: string; destLabel?: string;
  cargoType?: string; weight?: number;
  valueUSD?: string; valueToman?: number;
  dimensions?: { l: number; w: number; h: number };
  firstName?: string; lastName?: string;
  recFirstName?: string; recvFirstName?: string;
  recLastName?: string; recvLastName?: string;
  recPhone?: string; recvPhone?: string;
  recAddress?: string; recvAddress?: string;
  paidAt?: number; sendDate?: string; date?: string;
  description?: string; detectedItem?: string;
  confirmationCode?: string | number;
  adminStatus?: string; status?: string;
}

interface Trip {
  id: string; userName?: string; phone?: string;
  originCity?: string; origin?: string;
  destCity?: string; destination?: string;
}

// ── Constants (exact from track.html) ─────────────────────────────────────────
// TYPE_LABELS, CARGO_LABELS, STATUS_META, STEPS_DEF computed inside component (i18n)
// 5-step state matrix per admin status (from track.html makeSteps)
const STEP_MATRIX: Record<string, string[]> = {
  pending:    ['done', 'done', 'active',  'pending', 'pending'],
  matched:    ['done', 'done', 'done',    'active',  'pending'],
  in_transit: ['done', 'done', 'done',    'active',  'pending'],
  delivered:  ['done', 'done', 'done',    'done',    'done'   ],
  cancelled:  ['done', 'done', 'pending', 'pending', 'pending'],
};
// OTP-eligible statuses (from confirm-delivery.html)
const OTP_ELIGIBLE = new Set(['matched', 'linked_secure_hold_ready', 'handover_completed', 'picked_up', 'in_transit']);
// Handover-eligible statuses (from track-traveler.html: linked_secure_hold_ready)
const HANDOVER_ELIGIBLE = new Set(['matched', 'linked_secure_hold_ready']);

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtToman(n: number) { return n.toLocaleString('fa-IR') + ' تومان'; }

function fmtTs(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function calcETA(status: string): string | null {
  if (status === 'delivered' || status === 'cancelled') return null;
  const days = status === 'pending' ? 10 : status === 'matched' ? 6 : status === 'in_transit' ? 3 : 7;
  const eta = new Date(Date.now() + days * 86_400_000);
  return eta.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
}

function recvName(o: Order) {
  return ((o.recFirstName || o.recvFirstName || '') + ' ' + (o.recLastName || o.recvLastName || '')).trim();
}

function computeRoutePct(status: string): number {
  const steps = STEP_MATRIX[status] ?? STEP_MATRIX['pending'];
  if (status === 'delivered') return 100;
  if (status === 'cancelled') return 15;
  const activeIdx = steps.indexOf('active');
  if (activeIdx >= 0) return Math.round((activeIdx / (steps.length - 1)) * 100);
  return 30;
}

// ── Demo-map status labels (keep existing) ────────────────────────────────────
const DEMO_STATUS_LABEL: Record<RouteStatus, { fa: string; en: string; color: string; dot: string }> = {
  pending:          { fa: 'در انتظار',       en: 'Pending',          color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-400' },
  escrow_locked:    { fa: 'امانت قفل‌شده',   en: 'Escrow Locked',    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' },
  assigned:         { fa: 'تخصیص‌یافته',      en: 'Assigned',         color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',       dot: 'bg-cyan-400'   },
  picked_up:        { fa: 'تحویل گرفته‌شد',  en: 'Picked Up',        color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',       dot: 'bg-blue-400'   },
  in_transit:       { fa: 'در حال انتقال',   en: 'In Transit',       color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',       dot: 'bg-blue-400'   },
  customs:          { fa: 'در گمرک',          en: 'Customs',          color: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400' },
  out_for_delivery: { fa: 'در حال تحویل',    en: 'Out for Delivery', color: 'bg-green-500/15 text-green-300 border-green-500/30',    dot: 'bg-green-400'  },
  delivered:        { fa: 'تحویل داده‌شد',   en: 'Delivered',        color: 'bg-green-500/15 text-green-300 border-green-500/30',    dot: 'bg-green-400'  },
  disputed:         { fa: 'در اختلاف',        en: 'Disputed',         color: 'bg-red-500/15 text-red-300 border-red-500/30',          dot: 'bg-red-400'    },
};
const DEMO_STEPS: RouteStatus[] = ['pending','escrow_locked','assigned','picked_up','in_transit','customs','out_for_delivery','delivered'];
const ESCROW_FA: Record<string, string> = { none:'بدون امانت', locked:'امانت قفل‌شده', released:'امانت آزادشده', refunded:'بازپرداخت‌شده' };

function DemoRouteTimeline({ status }: { status: RouteStatus }) {
  const cur = DEMO_STEPS.indexOf(status);
  return (
    <div className="space-y-1">
      {DEMO_STEPS.map((s, i) => {
        const info = DEMO_STATUS_LABEL[s];
        const done = i < cur; const active = i === cur;
        return (
          <div key={s} className={`flex items-center gap-3 py-1 px-2 rounded-lg ${active ? 'bg-white/5' : ''}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : active ? info.dot : 'bg-white/15'}`} />
            <span className={`text-xs font-medium ${done ? 'text-green-400/80' : active ? 'text-white' : 'text-gray-600'}`}>{info.fa}</span>
            {done && <span className="ml-auto text-green-400 text-xs">✓</span>}
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Badge colour map ──────────────────────────────────────────────────────────
const BADGE_CLS: Record<string, string> = {
  blue:  'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  red:   'bg-red-50 text-red-700 border-red-200',
};

// ── Main component ────────────────────────────────────────────────────────────
interface TrackPageProps { initialCode?: string; }

export default function TrackPage({ initialCode = '' }: TrackPageProps) {
  const { t, isRTL } = useLang();

  const TYPE_LABELS: Record<string, string> = {
    personal: t.trkTypePersonal, store: t.trkTypeStore, chapar: t.trkTypeChapar,
  };
  const CARGO_LABELS: Record<string, string> = {
    clothing: t.trkCargoClothing, electronics: t.trkCargoElectronics,
    documents: t.trkCargoDocuments, medicine: t.trkCargoMedicine,
    food: t.trkCargoFood, other: t.trkCargoOther,
  };
  const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending:    { label: t.trkStatusPending,   cls: 'blue'  },
    matched:    { label: t.trkStatusMatched,   cls: 'blue'  },
    in_transit: { label: t.trkStatusInTransit, cls: 'blue'  },
    delivered:  { label: t.trkStatusDelivered, cls: 'green' },
    cancelled:  { label: t.trkStatusCancelled, cls: 'red'   },
  };
  const STEPS_DEF = [
    { icon: '📋', label: t.trkStep1Label, note: t.trkStep1Note },
    { icon: '💳', label: t.trkStep2Label, note: t.trkStep2Note },
    { icon: '✈️', label: t.trkStep3Label, note: t.trkStep3Note },
    { icon: '🚚', label: t.trkStep4Label, note: t.trkStep4Note },
    { icon: '✅', label: t.trkStep5Label, note: t.trkStep5Note },
  ];

  // Demo-map state (existing)
  const [demoInput, setDemoInput] = useState(initialCode.toUpperCase());
  const [demoRoute, setDemoRoute] = useState<ShipmentRoute | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Real-tracking state
  const [trackCode, setTrackCode] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [role, setRole] = useState<TrackRole>('owner');
  const [notFound, setNotFound] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [animPct, setAnimPct] = useState(0);

  // Handover (traveler)
  const [handoverModal, setHandoverModal] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverDone, setHandoverDone] = useState(false);

  // OTP (receiver) — exact logic from confirm-delivery.html
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLocked, setOtpLocked] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpConfirmed, setOtpConfirmed] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3];

  // Rating (owner, delivered)
  const [starRating, setStarRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);

  // Toast
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  // ── Demo search (keep existing) ─────────────────────────────────────────
  const searchDemo = useCallback((code: string) => {
    const found = findDemoRoute(code);
    if (found) { setDemoRoute(found); setDemoError(null); }
    else { setDemoRoute(null); setDemoError(t.trkDemoNotFound); }
  }, []);

  useEffect(() => {
    if (initialCode.trim()) searchDemo(initialCode.trim());
  }, [initialCode, searchDemo]);

  // ── Init: read URL params (exact from track.html checkUrl) ──────────────
  useEffect(() => {
    const hist = Store.get<Order[]>('history') ?? [];
    setRecentOrders(hist.slice(0, 4));

    const p = new URLSearchParams(window.location.search);
    const urlId = (p.get('id') || '').toUpperCase();
    const urlRole = (p.get('role') || 'owner') as TrackRole;
    if (urlId) {
      setTrackCode(urlId);
      setRole(urlRole);
      doTrackInternal(urlId, urlRole);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OTP rate-limit init (from confirm-delivery.html _initOtpRateLimit) ──
  useEffect(() => {
    if (!order || role !== 'receiver') return;
    try {
      const raw = sessionStorage.getItem('cp_otp_lock');
      if (!raw) return;
      const lock = JSON.parse(raw);
      if (lock?.until && Date.now() < lock.until) {
        setOtpLocked(true);
        setOtpAttempts(5);
        setOtpError(t.trkErrOtpLocked);
        setTimeout(() => {
          setOtpLocked(false); setOtpError('');
          sessionStorage.removeItem('cp_otp_lock');
        }, lock.until - Date.now());
      }
    } catch { /* ignore */ }
  }, [order, role]);

  // ── Real-tracking lookup (mirrors track.html doTrack) ──────────────────
  function doTrackInternal(code: string, trackRole: TrackRole) {
    const hist     = Store.get<Order[]>('history') ?? [];
    const statuses = Store.get<Record<string, string>>('admin_statuses') ?? {};
    let found = hist.find(o => o.trackId === code);

    if (!found) {
      const cur = Store.get<Order>('order');
      if (cur && cur.trackId === code) found = cur;
    }

    if (found) {
      const adminStatus = statuses[found.trackId] || found.status || 'pending';
      const withStatus = { ...found, adminStatus };
      setOrder(withStatus);
      setNotFound(false);

      // Check if already OTP-confirmed (cp_delivery_states)
      const ds = Store.get<Record<string, { receiverConfirmed?: boolean }>>('delivery_states') ?? {};
      if (ds[code]?.receiverConfirmed || adminStatus === 'delivered' || adminStatus === 'receiver_confirmed') {
        setOtpConfirmed(true);
      }

      // Check existing rating
      const ratings = Store.get<Array<{ trackId: string; score: number }>>('ratings') ?? [];
      const existRating = ratings.find(r => r.trackId === code);
      if (existRating) { setStarRating(existRating.score); setRatingDone(true); }

      // Animate route bar
      const pct = Math.max(8, Math.min(95, computeRoutePct(adminStatus)));
      setAnimPct(0);
      setTimeout(() => setAnimPct(pct), 120);
    } else {
      setOrder(null);
      setNotFound(true);
    }
  }

  function doTrack(code = trackCode, trackRole = role) {
    const c = code.trim().toUpperCase();
    if (!c) { showToast(t.trkToastEnterCode); return; }
    doTrackInternal(c, trackRole);
  }

  function prefill(code: string) {
    setTrackCode(code);
    doTrackInternal(code, role);
  }

  function goBack() {
    setOrder(null); setNotFound(false);
    setOtpDigits(['', '', '', '']); setOtpError(''); setOtpLocked(false);
    setOtpConfirmed(false); setOtpAttempts(0);
    setHandoverDone(false); setHandoverModal(false);
    setStarRating(0); setRatingDone(false);
    const hist = Store.get<Order[]>('history') ?? [];
    setRecentOrders(hist.slice(0, 4));
  }

  // ── OTP handlers (from confirm-delivery.html wireOTP) ──────────────────
  const otpCode = otpDigits.join('');

  function handleOtpInput(idx: number, raw: string) {
    const v = raw.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits]; next[idx] = v; setOtpDigits(next);
    if (v && idx < 3) otpRefs[idx + 1].current?.focus();
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) otpRefs[idx - 1].current?.focus();
    if (e.key === 'Enter' && otpCode.length === 4) submitOTP();
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '');
    setOtpDigits([0, 1, 2, 3].map(i => p[i] || ''));
    const firstEmpty = [0, 1, 2, 3].findIndex(i => !p[i]);
    setTimeout(() => {
      const ref = firstEmpty === -1 ? otpRefs[3] : otpRefs[firstEmpty];
      ref.current?.focus();
    }, 0);
  }

  // ── Submit OTP (exact logic from confirm-delivery.html submitCode) ──────
  async function submitOTP() {
    if (otpCode.length !== 4 || !order || otpLoading) return;
    if (otpLocked) { showToast(t.trkToastLocked); return; }

    const trackId = order.trackId;
    const maxTries = 5;
    setOtpLoading(true); setOtpError('');

    // Block traveler self-confirm (Fix 4 from confirm-delivery.html)
    const sess = Store.get<{ userId: string }>('session');
    const offers = Store.get<Array<{ orderId?: string; cargoId?: string; travelerId?: string; status?: string }>>('offers') ?? [];
    const matched = offers.find(o => (o.orderId === trackId || o.cargoId === trackId) && o.status === 'accepted');
    if (matched && sess?.userId && sess.userId === matched.travelerId) {
      setOtpError(t.trkErrOtpSelf);
      setOtpLoading(false); return;
    }

    // Block if open dispute (Fix 2 from confirm-delivery.html)
    try {
      const disputes = JSON.parse(localStorage.getItem('cp__test_disputes') || '[]') as Array<{ cargoId?: string; id?: string; status?: string }>;
      const open = disputes.find(d => (d.cargoId === trackId || d.id === trackId) && d.status === 'open');
      if (open) {
        setOtpError(t.trkErrOtpDispute);
        setOtpLoading(false); return;
      }
    } catch { /* ignore */ }

    // KYC gate
    const users = Store.get<Array<{ id: string; identityVerified?: boolean }>>('users') ?? [];
    const recvUser = users.find(u => u.id === sess?.userId);
    if (sess?.userId && recvUser && !recvUser.identityVerified) {
      setOtpError(t.trkErrOtpKyc);
      setOtpLoading(false); return;
    }

    // Try localStorage first (cp_history confirmationCode)
    const hist = Store.get<Order[]>('history') ?? [];
    const localOrder = hist.find(o => o.trackId === trackId);
    const correct = localOrder?.confirmationCode ? String(localOrder.confirmationCode) : null;

    const applyLockout = (lockUntil: number) => {
      sessionStorage.setItem('cp_otp_lock', JSON.stringify({ until: lockUntil, txnId: trackId }));
      setOtpLocked(true);
      setOtpError(t.trkErrOtpLockInit);
      setTimeout(() => { setOtpLocked(false); setOtpError(''); sessionStorage.removeItem('cp_otp_lock'); }, lockUntil - Date.now());
    };

    const handleWrongCode = (msg?: string) => {
      const newAtt = otpAttempts + 1; setOtpAttempts(newAtt);
      if (newAtt >= maxTries) {
        applyLockout(Date.now() + 5 * 60 * 1000);
      } else {
        setOtpError(msg ?? t.trkErrOtpWrong.replace('{n}', String(maxTries - newAtt)));
      }
      setOtpDigits(['', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 50);
    };

    if (correct) {
      if (otpCode !== correct) { handleWrongCode(); setOtpLoading(false); return; }
      // Correct — write cp_delivery_states, cp_admin_statuses, cp_escrow_releases
      const ds = JSON.parse(localStorage.getItem('cp_delivery_states') || '{}');
      ds[trackId] = { receiverConfirmed: true, confirmedAt: Date.now(), otp: otpCode };
      localStorage.setItem('cp_delivery_states', JSON.stringify(ds));

      const stat = JSON.parse(localStorage.getItem('cp_admin_statuses') || '{}');
      stat[trackId] = 'receiver_confirmed';
      localStorage.setItem('cp_admin_statuses', JSON.stringify(stat));

      const escrow = JSON.parse(localStorage.getItem('cp_escrow_releases') || '{}');
      escrow[trackId] = { receiverConfirmed: true, senderConfirmed: false, adminApproved: false, releaseStatus: 'pending_sender_admin', requestedAt: Date.now() };
      localStorage.setItem('cp_escrow_releases', JSON.stringify(escrow));

      setOtpConfirmed(true); showToast(t.trkToastOtpOk);
      setOtpLoading(false); return;
    }

    // API fallback (POST /api/receiver/confirm)
    try {
      const res = await fetch('/api/receiver/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: trackId, code: otpCode }),
      });
      if (res.ok) {
        setOtpConfirmed(true); showToast(t.trkToastOtpOk);
      } else {
        let msg = t.trkErrOtpGeneral;
        try {
          const body = await res.json();
          if (res.status === 400) msg = t.trkErrOtpBadCode;
          else if (res.status === 409) { setOtpConfirmed(true); setOtpLoading(false); return; }
          else if (body?.error?.includes('dispute')) msg = t.trkErrOtpDisputeApi;
          else if (body?.error || body?.message) msg = body.error || body.message;
        } catch { /* ignore */ }
        handleWrongCode(msg);
      }
    } catch {
      setOtpError(t.trkErrOtpConn);
    }
    setOtpLoading(false);
  }

  // ── Submit handover (POST /api/traveler/mark-handover, from track-traveler.html)
  async function submitHandover() {
    if (!order || handoverLoading) return;
    setHandoverLoading(true);
    try {
      const res = await fetch('/api/traveler/mark-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: order.trackId, travelerName: 'مسافر', note: 'Traveler marked handover via tracking page' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast((data as Record<string,string>).error || t.trkErrHovrFail); setHandoverLoading(false); return; }
      setHandoverModal(false); setHandoverDone(true);
      showToast(t.trkToastHovrOk);
    } catch {
      showToast(t.trkErrConnFail);
    }
    setHandoverLoading(false);
  }

  // ── Rating (reads/writes cp_ratings, from track.html submitRating) ──────
  function submitRating() {
    if (!starRating || !order || ratingDone) return;
    const ratings = Store.get<Array<{ trackId: string; score: number; createdAt: number }>>('ratings') ?? [];
    if (!ratings.find(r => r.trackId === order.trackId)) {
      ratings.push({ trackId: order.trackId, score: starRating, createdAt: Date.now() });
      Store.set('ratings', ratings);
    }
    setRatingDone(true); showToast(t.trkToastRatingOk);
  }

  // ── Copy link (from track.html copyLink) ─────────────────────────────────
  function copyLink(url: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast(t.trkToastCopied)).catch(() => fallbackCopy(url));
    } else { fallbackCopy(url); }
  }
  function fallbackCopy(url: string) {
    const ta = document.createElement('textarea'); ta.value = url;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); showToast(t.trkToastCopied);
  }

  // ── Render: entry panel ──────────────────────────────────────────────────
  function renderEntry() {
    return (
      <div className="p-5" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-white mb-1">{t.trkTitle}</h2>
          <p className="text-xs text-gray-400">{t.trkSubtitle}</p>
        </div>

        <form onSubmit={e => { e.preventDefault(); doTrack(); }} className="space-y-3">
          <input
            className="w-full bg-white/7 border border-white/12 rounded-2xl px-5 py-4 text-xl font-extrabold text-white text-center tracking-widest uppercase placeholder-white/20 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-all"
            style={{ letterSpacing: '4px', direction: 'ltr', fontFamily: 'inherit' }}
            placeholder="CH-XXXXX"
            maxLength={14}
            spellCheck={false}
            autoComplete="off"
            value={trackCode}
            onChange={e => setTrackCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
          />
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            {t.trkSearchBtn}
          </button>
        </form>

        {/* Recent orders (from cp_history) */}
        {recentOrders.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t.trkRecentOrders}</div>
            <div className="space-y-2">
              {recentOrders.map(o => (
                <button
                  key={o.trackId}
                  onClick={() => prefill(o.trackId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/4 border border-white/7 rounded-xl hover:bg-white/8 hover:border-blue-500/30 transition-all text-right"
                >
                  <div>
                    <div className="text-xs font-bold text-blue-400" style={{ direction: 'ltr', letterSpacing: '1.5px' }}>{o.trackId}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{o.originLabel || o.origin || ''} → {o.destLabel || o.dest || ''}</div>
                  </div>
                  <span className="text-gray-500 text-base">←</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Also show demo codes */}
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="text-xs text-gray-600 uppercase tracking-widest mb-2 font-semibold">{t.trkDemoRoutes}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ROUTES.slice(0, 4).map(demo => (
              <button
                key={demo.trackingCode}
                onClick={() => { setDemoInput(demo.trackingCode); searchDemo(demo.trackingCode); setOrder(null); setNotFound(false); }}
                className="text-right rounded-xl px-3 py-2.5 bg-white/3 border border-white/8 hover:bg-white/6 hover:border-cyan-500/30 transition-all"
              >
                <div className="text-xs font-mono text-cyan-400/80 mb-0.5" style={{ direction: 'ltr' }}>{demo.trackingCode}</div>
                <div className="text-xs text-gray-300">{demo.publicOriginCity} → {demo.publicDestinationCity}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: not-found ────────────────────────────────────────────────────
  function renderNotFound() {
    return (
      <div className="p-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-5xl mb-4">🔍</div>
        <div className="text-lg font-bold text-white mb-2">{t.trkNotFoundTitle}</div>
        <div className="text-sm text-gray-400 leading-relaxed mb-5">
          <strong className="text-white">{trackCode}</strong> {t.trkNotFoundDesc1}<br />
          {t.trkNotFoundDesc2}
        </div>
        <button onClick={goBack} className="px-6 py-2.5 bg-white/8 border border-white/12 rounded-xl text-sm text-gray-300 hover:bg-white/12 transition-all">{t.trkBackBtn}</button>
      </div>
    );
  }

  // ── Render: timeline (from track.html makeSteps + renderStep) ───────────
  function renderTimeline(o: Order) {
    const s = o.adminStatus || 'pending';
    const st = STEP_MATRIX[s] ?? STEP_MATRIX['pending'];
    const paidDate = o.paidAt ? new Date(o.paidAt).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const regTs = o.paidAt ? fmtTs(o.paidAt) : '—';

    const stepTs = [regTs, paidDate,
      s === 'cancelled' ? t.trkStepCancelled : st[2] === 'active' ? t.trkStepActive : st[2] === 'done' ? t.trkStepDone : '—',
      st[3] !== 'pending' ? t.trkStepInTransit : '—',
      s === 'delivered' ? t.trkStepDelivered : '—',
    ];

    return (
      <div className="space-y-0" dir="ltr">
        {STEPS_DEF.map((step, i) => {
          const state = st[i];
          const dotCls = state === 'done'
            ? 'bg-green-500 border-green-500 shadow-[0_0_0_3px_rgba(0,214,143,.18)]'
            : state === 'active'
            ? 'bg-blue-500 border-blue-500 shadow-[0_0_0_4px_rgba(22,131,255,.22)] animate-pulse'
            : 'bg-white/7 border-white/18 opacity-40';
          const labelCls = state === 'done' ? 'text-green-400' : state === 'active' ? 'text-blue-400' : 'text-gray-600';
          return (
            <div key={i} className="flex items-start gap-3.5">
              <div className="flex flex-col items-center flex-shrink-0 w-7">
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs z-10 ${dotCls}`}>
                  {state === 'done' ? '✓' : step.icon}
                </div>
                {i < STEPS_DEF.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-4 mt-1 transition-colors ${state === 'done' ? 'bg-green-500/35' : 'bg-white/10'}`} />
                )}
              </div>
              <div className={`flex-1 pb-5 ${i === STEPS_DEF.length - 1 ? 'pb-0' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
                <div className={`text-xs font-bold mb-0.5 ${labelCls}`}>{step.label}</div>
                <div className="text-xs text-gray-500" style={{ direction: 'ltr', textAlign: 'right' }}>{stepTs[i]}</div>
                {state !== 'pending' && <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">{step.note}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render: order info grid (role-filtered, from track.html) ────────────
  function renderInfoGrid(o: Order, r: TrackRole) {
    const isOwner = r === 'owner'; const isReceiver = r === 'receiver';
    const cargoLabel = CARGO_LABELS[o.cargoType || ''] || o.cargoType || '—';
    const senderName = ((o.firstName || '') + ' ' + (o.lastName || '')).trim() || '—';
    const rn = recvName(o);
    const cells: Array<[string, string]> = [];
    cells.push([t.trkInfoCargo, cargoLabel]);
    if (!isReceiver && o.dimensions) cells.push([t.trkInfoDims, `${o.dimensions.l} × ${o.dimensions.w} × ${o.dimensions.h} cm`]);
    if (!isReceiver) cells.push([t.trkInfoWeight, o.weight ? `${o.weight} kg` : '—']);
    if (isOwner) cells.push([t.trkInfoValue, o.valueUSD ? `$ ${parseFloat(o.valueUSD).toFixed(2)}` : fmtToman(o.valueToman || 0)]);
    cells.push([t.trkInfoSendDate, o.sendDate || o.date || '—']);
    if (isOwner) cells.push([t.trkInfoSender, senderName]);
    if ((isOwner || isReceiver) && rn) cells.push([t.trkInfoRecipient, rn]);
    if ((isOwner || isReceiver) && (o.recPhone || o.recvPhone)) cells.push([t.trkInfoRecPhone, o.recPhone || o.recvPhone || '']);

    return (
      <div className="grid grid-cols-2 gap-1.5">
        {cells.map(([label, val]) => (
          <div key={label} className="bg-white/4 border border-white/7 rounded-lg px-3 py-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5" style={{ fontSize: '9px' }}>{label}</div>
            <div className="text-xs font-bold text-white">{val}</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Render: share links (owner, status != pending) ────────────────────
  function renderShareLinks(o: Order) {
    const s = o.adminStatus || 'pending';
    if (s === 'pending') return null;
    const base = window.location.origin + window.location.pathname + '?id=' + (o.trackId || '');
    const links = [
      { role: 'owner',    label: t.trkShareOwner,    icon: '📦' },
      { role: 'traveler', label: t.trkShareTraveler,  icon: '✈️' },
      { role: 'receiver', label: t.trkShareReceiver,  icon: '🎁' },
    ];
    return (
      <div className="bg-white/4 border border-white/8 rounded-xl p-3.5 mt-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.trkShareTitle}</div>
        {links.map(lnk => {
          const url = base + '&role=' + lnk.role;
          return (
            <button
              key={lnk.role}
              onClick={() => copyLink(url)}
              className="w-full flex items-center gap-2.5 px-3 py-2 bg-white/4 border border-white/7 rounded-lg mb-1.5 last:mb-0 hover:bg-white/8 transition-all text-right"
            >
              <span className="text-xs font-bold text-gray-300 min-w-16">{lnk.icon} {lnk.label}</span>
              <span className="flex-1 text-xs text-gray-600 truncate" style={{ direction: 'ltr', textAlign: 'left' }}>{url}</span>
              <span className="text-xs font-bold text-blue-400 flex-shrink-0">{t.trkShareCopy}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Render: contact card (owner, reads cp_order_trips + cp_trips) ────────
  function renderContactCard(o: Order) {
    const s = o.adminStatus || 'pending';
    if (s === 'cancelled') return null;
    if (s === 'pending') return (
      <div className="flex items-center gap-3.5 bg-white/4 border border-white/9 rounded-xl p-4 mt-3">
        <span className="text-2xl">🔍</span>
        <div>
          <div className="text-sm font-bold text-white mb-0.5">{t.trkWaitingTitle}</div>
          <div className="text-xs text-gray-400">{t.trkWaitingDesc}</div>
        </div>
      </div>
    );

    const orderTrips = Store.get<Record<string, string>>('order_trips') ?? {};
    const trips = Store.get<Trip[]>('trips') ?? [];
    const tripId = orderTrips[o.trackId];
    const trip = tripId ? trips.find(t => t.id === tripId) : null;

    if (!trip) return (
      <div className="flex items-center gap-3.5 bg-blue-500/7 border border-blue-500/18 rounded-xl p-4 mt-3">
        <span className="text-2xl">✅</span>
        <div>
          <div className="text-sm font-bold text-white mb-0.5">{t.trkConfirmedTitle}</div>
          <div className="text-xs text-gray-400">{t.trkConfirmedDesc}</div>
        </div>
      </div>
    );

    return (
      <div className="flex items-center gap-3.5 bg-blue-500/7 border border-blue-500/18 rounded-xl p-4 mt-3">
        <span className="text-2xl">✈️</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-white mb-0.5">{trip.userName || t.trkTravelerDefault}</div>
          <div className="text-xs text-gray-400">{t.trkVerifiedBadge} · {trip.originCity || trip.origin || ''} ← {trip.destCity || trip.destination || ''}</div>
        </div>
        {trip.phone && (
          <a href={`tel:${trip.phone}`} className="flex-shrink-0 text-sm font-bold text-green-400 bg-green-400/10 border border-green-400/25 rounded-lg px-3 py-1.5" style={{ direction: 'ltr' }}>
            {trip.phone}
          </a>
        )}
      </div>
    );
  }

  // ── Render: rating card (owner, delivered, reads/writes cp_ratings) ──────
  function renderRatingCard(o: Order) {
    if ((o.adminStatus || 'pending') !== 'delivered') return null;
    const orderTrips = Store.get<Record<string, string>>('order_trips') ?? {};
    if (!orderTrips[o.trackId]) return null;

    if (ratingDone) {
      return (
        <div className="bg-green-500/6 border border-green-500/20 rounded-xl p-4 mt-3 text-center">
          <div className="text-sm font-bold text-white mb-1">{t.trkRatingDone}</div>
          <div className="text-2xl">{'⭐'.repeat(starRating)}</div>
        </div>
      );
    }
    return (
      <div className="bg-yellow-500/6 border border-yellow-500/20 rounded-xl p-4 mt-3">
        <div className="text-sm font-bold text-white mb-1">{t.trkRatingTitle}</div>
        <div className="text-xs text-gray-400 mb-3">{t.trkRatingQ}</div>
        <div className="flex gap-2 flex-row-reverse justify-start mb-3">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setStarRating(n)} className={`text-2xl transition-all ${n <= starRating ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}>⭐</button>
          ))}
        </div>
        <button
          onClick={submitRating}
          disabled={!starRating}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-all"
        >
          {t.trkRatingSubmit}
        </button>
      </div>
    );
  }

  // ── Render: confirm delivery CTA (owner/receiver, in_transit/matched) ────
  function renderConfirmCTA(o: Order, r: TrackRole) {
    const s = o.adminStatus || 'pending';
    if (s !== 'in_transit' && s !== 'matched') return null;
    if (r !== 'owner' && r !== 'receiver') return null;
    const url = `${window.location.origin}${window.location.pathname}?id=${o.trackId}&role=receiver`;
    return (
      <button
        onClick={() => { setRole('receiver'); window.history.replaceState(null, '', url); }}
        className="w-full mt-3 flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-sm shadow-lg hover:opacity-90 transition-all"
      >
        {t.trkConfirmCTA}
      </button>
    );
  }

  // ── Render: traveler mark-handover section (from track-traveler.html) ────
  function renderHandover(o: Order) {
    const s = o.adminStatus || 'pending';
    if (handoverDone) {
      return (
        <div className="bg-blue-500/6 border border-blue-500/18 rounded-xl p-4 mt-3 text-center">
          <div className="text-sm font-bold text-white">{t.trkHovrDoneTitle}</div>
          <div className="text-xs text-gray-400 mt-1">{t.trkHovrDoneDesc}</div>
        </div>
      );
    }
    if (!HANDOVER_ELIGIBLE.has(s)) {
      return (
        <div className="bg-white/4 border border-white/8 rounded-xl p-4 mt-3">
          <div className="text-sm font-bold text-white mb-1">{t.trkHovrStatusTitle}</div>
          <div className="text-xs text-gray-400">
            {s === 'pending' ? t.trkHovrPendingPay : s === 'delivered' ? t.trkHovrFinalDone : STATUS_META[s]?.label || s}
          </div>
        </div>
      );
    }
    return (
      <div className="bg-green-500/6 border border-green-500/18 rounded-xl p-4 mt-3">
        <div className="text-sm font-bold text-white mb-1">{t.trkHovrReadyTitle}</div>
        <div className="text-xs text-gray-400 leading-relaxed mb-3">
          {t.trkHovrReadyDesc}
        </div>
        <button
          onClick={() => setHandoverModal(true)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-sm hover:opacity-90 transition-all"
        >
          {t.trkHovrBtn}
        </button>
      </div>
    );
  }

  // ── Render: OTP form (from confirm-delivery.html, receiver role) ─────────
  function renderOTP(o: Order) {
    const s = o.adminStatus || 'pending';

    if (otpConfirmed) {
      return (
        <div className="mt-3 space-y-3">
          <div className="bg-green-500/8 border border-green-500/25 rounded-xl p-5 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-base font-bold text-green-400 mb-1">{t.trkOtpOkTitle}</div>
            <div className="text-xs text-gray-400 leading-relaxed">
              {t.trkOtpOkDesc}
            </div>
          </div>
          {/* Rate traveler */}
          {!ratingDone ? (
            <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-center">
              <div className="text-sm font-bold text-white mb-3">{t.trkRateTitle}</div>
              <div className="flex justify-center gap-3 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setStarRating(n)} className={`text-3xl transition-all ${n <= starRating ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}>⭐</button>
                ))}
              </div>
              <button onClick={submitRating} disabled={!starRating} className="w-full py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-sm disabled:opacity-40 hover:bg-blue-500/25 transition-all">{t.trkRateSubmit}</button>
            </div>
          ) : (
            <div className="text-center text-sm text-green-400 font-bold">{'⭐'.repeat(starRating)}<br />{t.trkRateDone}</div>
          )}
        </div>
      );
    }

    if (!OTP_ELIGIBLE.has(s)) {
      return (
        <div className="bg-white/4 border border-white/8 rounded-xl p-4 mt-3 text-center">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-sm text-gray-300">{t.trkOtpWaiting}</div>
          <div className="text-xs text-gray-500 mt-1">{STATUS_META[s]?.label || s}</div>
        </div>
      );
    }

    return (
      <div className="bg-blue-500/5 border border-blue-500/18 rounded-xl p-4 mt-3">
        <div className="text-sm font-bold text-white mb-1">{t.trkOtpTitle}</div>
        <div className="text-xs text-gray-400 leading-relaxed mb-4">
          {t.trkOtpDesc}
        </div>
        {/* 4-digit inputs */}
        <div className="flex gap-2.5 justify-center mb-4" dir="ltr" onPaste={handleOtpPaste}>
          {[0, 1, 2, 3].map(idx => (
            <input
              key={idx}
              ref={otpRefs[idx]}
              id={`otp-d${idx}`}
              type="number"
              min={0} max={9}
              inputMode="numeric"
              autoComplete={idx === 0 ? 'one-time-code' : undefined}
              placeholder="·"
              value={otpDigits[idx]}
              disabled={otpLocked || otpLoading}
              onChange={e => handleOtpInput(idx, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(idx, e)}
              className={`w-14 h-16 rounded-2xl border-2 text-center text-2xl font-extrabold text-white bg-white/7 outline-none transition-all
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                ${otpError && !otpLocked ? 'border-red-500 bg-red-500/10' : otpDigits[idx] ? 'border-blue-500/40' : 'border-white/15'}
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:bg-blue-500/7
                disabled:opacity-40 disabled:cursor-not-allowed`}
            />
          ))}
        </div>
        <button
          onClick={submitOTP}
          disabled={otpCode.length !== 4 || otpLocked || otpLoading}
          className="w-full h-13 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          {otpLoading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          {otpLoading ? t.trkOtpSending : t.trkOtpSubmit}
        </button>
        {otpError && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/8 border border-red-500/22 rounded-xl p-3 text-center leading-relaxed">{otpError}</div>
        )}
      </div>
    );
  }

  // ── Render: full order view ──────────────────────────────────────────────
  function renderOrder(o: Order, r: TrackRole) {
    const s = o.adminStatus || 'pending';
    const sMeta = STATUS_META[s] || STATUS_META['pending'];
    const typeLabel = TYPE_LABELS[o.type || ''] || o.type || t.trkTypeDefault;
    const eta = calcETA(s);
    const isOwner = r === 'owner'; const isTraveler = r === 'traveler'; const isReceiver = r === 'receiver';
    const pct = Math.max(8, Math.min(95, animPct));

    return (
      <div className="p-4 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Back + Role banner */}
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">{t.trkBackBtn}</button>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            isOwner ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
            isTraveler ? 'bg-green-500/10 border-green-500/22 text-green-400' :
            'bg-yellow-500/10 border-yellow-500/22 text-yellow-400'
          }`}>
            {isOwner ? t.trkRoleOwner : isTraveler ? t.trkRoleTraveler : t.trkRoleReceiver}
          </span>
        </div>

        {/* Order summary card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-extrabold text-blue-400 tracking-widest" style={{ direction: 'ltr', letterSpacing: '2px' }}>{o.trackId}</div>
              <div className="text-xs text-gray-500 mt-0.5">{typeLabel}</div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${BADGE_CLS[sMeta.cls] || BADGE_CLS.blue}`}>{sMeta.label}</span>
          </div>

          {/* Route bar */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-extrabold text-white whitespace-nowrap">{o.originLabel || o.origin || '—'}</span>
            <div className="flex-1 relative h-1 bg-white/12 rounded-full overflow-visible">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 text-sm transition-all duration-1000" style={{ left: `${pct}%`, transform: 'translateY(-50%) translateX(-50%)' }}>✈️</div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0 shadow-[0_0_0_3px_rgba(0,214,143,.2),0_0_12px_rgba(0,214,143,.5)]" />
            <span className="text-base font-extrabold text-white whitespace-nowrap">{o.destLabel || o.dest || '—'}</span>
          </div>

          {/* ETA */}
          {eta && (
            <div className="flex items-center gap-3 bg-blue-500/7 border border-blue-500/20 rounded-xl px-3 py-2.5 mb-3">
              <span className="text-lg">⏱️</span>
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wide" style={{ fontSize: '9px' }}>{t.trkEtaLabel}</div>
                <div className="text-sm font-extrabold text-white">{eta}</div>
              </div>
            </div>
          )}

          {/* Detected item (owner/traveler only) */}
          {o.detectedItem && !isReceiver && (
            <div className="flex items-center gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5 mb-3">
              <span className="text-lg">🔍</span>
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-0.5" style={{ fontSize: '9px' }}>{t.trkDetectedLabel}</div>
                <div className="text-sm font-bold text-white">{o.detectedItem}</div>
              </div>
            </div>
          )}

          {/* Info grid */}
          {renderInfoGrid(o, r)}

          {/* Delivery address */}
          {(isOwner || isReceiver) && (o.recAddress || o.recvAddress) && (
            <div className="mt-2 bg-white/4 border border-white/7 rounded-xl px-3 py-2.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ fontSize: '9px' }}>{t.trkDeliveryAddr} </span>
              <span className="text-xs text-gray-400">{o.recAddress || o.recvAddress}</span>
            </div>
          )}

          {/* Description (owner only) */}
          {isOwner && o.description && (
            <div className="mt-2 bg-white/4 border border-white/7 rounded-xl p-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" style={{ fontSize: '9px' }}>{t.trkDescLabel}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{o.description}</div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.trkTimelineTitle}</div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            {renderTimeline(o)}
          </div>
        </div>

        {/* Role-specific sections */}
        {isOwner && renderShareLinks(o)}
        {isOwner && renderContactCard(o)}
        {isOwner && renderRatingCard(o)}
        {(isOwner || isReceiver) && renderConfirmCTA(o, r)}
        {isTraveler && renderHandover(o)}
        {isReceiver && renderOTP(o)}

        {/* Telegram card */}
        <div className="flex items-start gap-3 bg-blue-500/6 border border-blue-500/15 rounded-2xl px-4 py-3.5 mt-2">
          <span className="text-2xl flex-shrink-0">📱</span>
          <div className="text-xs text-gray-400 leading-relaxed">
            {t.trkTelegramCard.replace('{code}', o.trackId)}<br />
            <strong className="text-blue-400">@ChaparTrackBot</strong>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  const showRealOrder = order !== null;
  const showNotFound  = notFound && !showRealOrder;

  return (
    <div className="min-h-screen bg-[#04070f] flex flex-col relative">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        {demoRoute && !showRealOrder && !showNotFound ? (
          <GoogleTrackingMap
            originLat={demoRoute.originLat} originLng={demoRoute.originLng}
            destinationLat={demoRoute.destinationLat} destinationLng={demoRoute.destinationLng}
            routePoints={demoRoute.routePoints} status={demoRoute.status}
            trackingCode={demoRoute.trackingCode} className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#04070f] to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">{t.trkEnterCodeHint}</p>
            </div>
          </div>
        )}
      </div>

      {/* Header overlay */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-[#04070f]/90 to-transparent pointer-events-none">
        <a href="/" className="flex items-center gap-2 pointer-events-auto">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Chapar</span>
        </a>
        {!showRealOrder && (
          <a href="/tracking-preview" className="pointer-events-auto text-xs text-gray-400 hover:text-white transition-colors bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            {t.trkCreateRoute}
          </a>
        )}
      </div>

      {/* Tracking panel */}
      <div className="relative z-20 mt-auto">
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-5 py-1.5 text-xs text-gray-300 hover:bg-white/15 transition-all shadow-xl"
          >
            {panelOpen ? t.trkPanelClose : t.trkPanelOpen}
          </button>
        </div>

        {panelOpen && (
          <div className="mx-3 sm:mx-auto sm:max-w-2xl mb-4 max-h-[80vh] overflow-y-auto">
            <div className="bg-[#04070f]/92 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">

              {showRealOrder && renderOrder(order!, role)}
              {showNotFound  && renderNotFound()}

              {!showRealOrder && !showNotFound && (
                <>
                  {/* Search bar (always visible at top) */}
                  <div className="p-4 border-b border-white/8">
                    <form onSubmit={e => { e.preventDefault(); if (demoInput.trim()) searchDemo(demoInput.trim()); }} className="flex gap-2">
                      <input
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 transition-all font-mono"
                        placeholder="CHP-… demo code"
                        value={demoInput}
                        onChange={e => setDemoInput(e.target.value.toUpperCase())}
                        dir="ltr"
                      />
                      <button type="submit" className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all">
                        {t.trkDemoBtn}
                      </button>
                    </form>
                    {demoError && <p className="mt-2 text-xs text-red-400 text-center">{demoError}</p>}
                  </div>

                  {/* Demo route result */}
                  {demoRoute && (() => {
                    const si = DEMO_STATUS_LABEL[demoRoute.status];
                    return (
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-cyan-400">{demoRoute.trackingCode}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${si.color}`}>{si.fa} · {si.en}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center flex-1">
                            <div className="text-sm font-bold text-white">{demoRoute.publicOriginCity}</div>
                            <div className="text-xs text-gray-500">{demoRoute.publicOriginCountry}</div>
                          </div>
                          <div className="flex items-center gap-1 text-gray-600">
                            <div className="w-8 h-px bg-gradient-to-r from-amber-400/60 to-cyan-400/60" />
                            <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" /></svg>
                            <div className="w-8 h-px bg-gradient-to-r from-cyan-400/60 to-amber-400/60" />
                          </div>
                          <div className="text-center flex-1">
                            <div className="text-sm font-bold text-white">{demoRoute.publicDestinationCity}</div>
                            <div className="text-xs text-gray-500">{demoRoute.publicDestinationCountry}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {demoRoute.distanceText && <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center"><div className="text-xs text-gray-500 mb-0.5">{t.trkDemoDistance}</div><div className="text-xs font-bold text-white">{demoRoute.distanceText}</div></div>}
                          {demoRoute.durationText  && <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center"><div className="text-xs text-gray-500 mb-0.5">{t.trkDemoTime}</div><div className="text-xs font-bold text-white">{demoRoute.durationText}</div></div>}
                          <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center"><div className="text-xs text-gray-500 mb-0.5">{t.trkDemoEscrow}</div><div className="text-xs font-bold text-white">{ESCROW_FA[demoRoute.escrowStatus]}</div></div>
                        </div>
                        {demoRoute.securityLevel && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              demoRoute.securityLevel === 'GUARANTEED'
                                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                              {demoRoute.securityLevel === 'GUARANTEED' ? t.trkDemoGuaranteed : t.trkDemoStandard}
                            </span>
                            {demoRoute.identityVerificationRequired && <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{t.trkDemoIdVerif}</span>}
                            {demoRoute.cargoVerificationRequired && <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{t.trkDemoCargoVerif}</span>}
                            {demoRoute.otpDeliveryRequired && <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">OTP</span>}
                            {demoRoute.deliveryPhotoRequired && <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{t.trkDemoDeliveryPhoto}</span>}
                          </div>
                        )}
                        <div className="rounded-xl bg-white/2 border border-white/5 p-3">
                          <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">{t.trkDemoRouteStatus}</div>
                          <DemoRouteTimeline status={demoRoute.status} />
                        </div>
                        {demoRoute.eta && <div className="text-center text-xs text-gray-500">{t.trkDemoEtaLabel} <span className="text-white font-semibold">{demoRoute.eta}</span></div>}
                      </div>
                    );
                  })()}

                  {/* Real tracking entry */}
                  {renderEntry()}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Handover confirm modal (from track-traveler.html) */}
      {handoverModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) setHandoverModal(false); }}>
          <div className="bg-[#0d1a36] border border-white/10 rounded-t-3xl w-full max-w-md px-6 pb-9 pt-7">
            <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <div className="text-lg font-extrabold mb-2.5" dir={isRTL ? 'rtl' : 'ltr'}>{t.trkHovrModalTitle}</div>
            <div className="text-xs text-gray-400 leading-relaxed mb-6" dir={isRTL ? 'rtl' : 'ltr'}>
              {t.trkHovrModalDesc}<br /><br />
              <strong>{t.trkHovrModalNote}</strong>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={submitHandover}
                disabled={handoverLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white font-extrabold text-sm disabled:opacity-50 hover:opacity-90 transition-all"
              >
                {handoverLoading ? t.trkHovrModalLoading : t.trkHovrModalConfirm}
              </button>
              <button onClick={() => setHandoverModal(false)} className="w-full py-3.5 rounded-2xl bg-transparent border border-white/13 text-gray-400 font-bold text-sm hover:bg-white/6 transition-all">
                {t.trkHovrModalCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-5 py-3 rounded-2xl text-sm font-bold z-50 shadow-2xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
