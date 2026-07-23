import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Home, CheckCircle, CheckCircle2, Smartphone, RefreshCw, Clock,
         Plane, X, Coins, Ban, ImagePlus, Package } from 'lucide-react';
import QRCode from 'react-qr-code';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { PROHIBITED_KEYWORDS } from '../lib/prohibited';   // CMD-24: shared, deterministic rules source
import { Store, getLiveRate } from '../lib/store';
import PreferredChannelStep from './PreferredChannelStep';
import SendAssistant, { type SendApplyField, type SendApplyValue } from './SendAssistant';

// ── Send («ثبت کالا») flow — 5-step light skeleton, structural parity with the buy flow ──────────
//
// describe item → route/destination → details → preferred channel → publish
//
// This is a full rewrite of the previous 8-step wizard. The 4-angle photo capture, the inline video
// cargo-scan, the sender-KYC step and the payment-method step were all REMOVED from the publish flow
// (escrow/payment/scan is post-match, not part of publishing a listing). The video cargo-scan now
// lives entirely in the post-publish CargoScanPage, reached via the `onVerifyCargo` hook on the
// success screen. Publish posts to /api/marketplace/publish (NOT the old /api/approvals/create),
// matching ChaparConcierge.doPublish.

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'USD',  flag: '🇺🇸', rate: 1       },
  { code: 'EUR',  flag: '🇪🇺', rate: 1.09    },
  { code: 'CAD',  flag: '🇨🇦', rate: 0.74    },
  { code: 'GBP',  flag: '🇬🇧', rate: 1.27    },
  { code: 'AED',  flag: '🇦🇪', rate: 0.272   },
  { code: 'TRY',  flag: '🇹🇷', rate: 0.031   },
  { code: 'SAR',  flag: '🇸🇦', rate: 0.267   },
  { code: 'QAR',  flag: '🇶🇦', rate: 0.274   },
  { code: 'IQD',  flag: '🇮🇶', rate: 0.00076 },
  { code: 'CNY',  flag: '🇨🇳', rate: 0.138   },
  { code: 'INR',  flag: '🇮🇳', rate: 0.012   },
  { code: 'AMD',  flag: '🇦🇲', rate: 0.0026  },
  { code: 'AZN',  flag: '🇦🇿', rate: 0.588   },
  { code: 'USDT', flag: '',    rate: 1       },
  { code: 'USDC', flag: '',    rate: 1       },
  { code: 'IRR',  flag: '🇮🇷', rate: null    },
] as const;
type CurrencyCode = typeof CURRENCIES[number]['code'];

// Airport `country` is a full name (e.g. 'Iran', 'Turkey', 'UAE'); the marketplace wants a 2-letter
// code. This map covers every country present in airports.ts. Unknown → null (never fabricated).
const COUNTRY_ISO2: Record<string, string> = {
  Afghanistan: 'AF', Armenia: 'AM', Australia: 'AU', Austria: 'AT', Azerbaijan: 'AZ',
  Bahrain: 'BH', Belgium: 'BE', Canada: 'CA', China: 'CN', Czechia: 'CZ', Denmark: 'DK',
  Finland: 'FI', France: 'FR', Georgia: 'GE', Germany: 'DE', Greece: 'GR', Hungary: 'HU',
  India: 'IN', Iran: 'IR', Iraq: 'IQ', Italy: 'IT', Japan: 'JP', Kuwait: 'KW',
  Malaysia: 'MY', Netherlands: 'NL', Norway: 'NO', Oman: 'OM', Pakistan: 'PK', Poland: 'PL',
  Portugal: 'PT', Qatar: 'QA', 'Saudi Arabia': 'SA', Singapore: 'SG', 'South Korea': 'KR',
  Spain: 'ES', Sweden: 'SE', Switzerland: 'CH', Turkey: 'TR', UAE: 'AE', USA: 'US',
  'United Kingdom': 'GB',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
      {msg}
    </div>
  );
}

// 5-step progress rail (describe → route → details → channel → publish).
function StepPills({ step }: { step: number }) {
  const { t } = useLang();
  const LABELS = [t.spPill2, t.spPill1, t.spPill4, t.travPill4, t.travPill5]; // کالا · مسیر · بررسی · حساب/کانال · انتشار
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
      {LABELS.map((label, i) => {
        const n = i + 1;
        const done   = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center flex-shrink-0">
            {n > 1 && (
              <div className={`h-0.5 w-3 sm:w-5 transition-colors ${done ? 'bg-cyan-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                ${done   ? 'bg-cyan-700 text-white'
                : active ? 'bg-cyan-600 text-white ring-4 ring-cyan-100'
                :          'bg-gray-100 text-gray-500'}`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> : n}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap hidden sm:block
                ${active ? 'text-cyan-700' : done ? 'text-emerald-700' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PageHeader({ onHome, title, desc }: { onHome: () => void; title: string; desc: string }) {
  const { t } = useLang();
  return (
    <div className="ds-page-header px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-10 flex-wrap">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t.navBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.navHome}</span>
          </button>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-extrabold text-gray-900 mb-4">{title}</motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-lg text-gray-500 max-w-2xl">{desc}</motion.p>
      </div>
    </div>
  );
}

// ── Draft shape (smaller field set) ─────────────────────────────────────────────
interface SendDraft {
  step: number;
  title: string;
  origin: string | null;
  dest: string | null;
  date: string;
  weight: string;
  dimL: string; dimW: string; dimH: string;
  selectedCurr: string;
  valueAmount: string;
  shipMode: string;
  notes: string;
}

// ── Main component ─────────────────────────────────────────────────────────────
// Props signature preserved so App.tsx wiring stays UNTOUCHED.
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; cargoType?: 'personal' | 'chapar'; onNavigate?: (page: string) => void; onVerifyCargo?: (listingId: string) => void; }

export default function SendPackagePage({ onHome, cargoType = 'personal', onNavigate, onVerifyCargo }: Props) {
  const { t, isRTL } = useLang();
  const { session } = useSession();

  const pageTitle = cargoType === 'chapar' ? t.spTitleChapar : t.spTitlePersonal;
  const pageDesc  = cargoType === 'chapar' ? t.spDescChapar  : t.spDescPersonal;

  const CURR_LABELS: Record<string, string> = {
    USD: t.spCurrUSD, EUR: t.spCurrEUR, CAD: t.spCurrCAD, GBP: t.spCurrGBP,
    AED: t.spCurrAED, TRY: t.spCurrTRY, SAR: t.spCurrSAR, QAR: t.spCurrQAR,
    IQD: t.spCurrIQD, CNY: t.spCurrCNY, INR: t.spCurrINR, AMD: t.spCurrAMD,
    AZN: t.spCurrAZN, USDT: t.spCurrUSDT, USDC: t.spCurrUSDC, IRR: t.spCurrIRR,
  };

  const [step, setStep] = useState(1);

  // Step 1 — describe item
  const [title, setTitle]           = useState('');
  const [photo, setPhoto]           = useState<string | null>(null);   // optional single photo (data URL)
  const [illegalBlocked, setIllegalBlocked] = useState(false);
  const [aiUnavailable, setAiUnavailable]   = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // Step 2 — route/destination
  const [origin, setOrigin] = useState<AirportOption | null>(null);
  const [dest,   setDest]   = useState<AirportOption | null>(null);
  const [date,   setDate]   = useState('');
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Step 3 — details (user-declared)
  const [weight,       setWeight]       = useState('');
  const [dimL, setDimL]                 = useState('');
  const [dimW, setDimW]                 = useState('');
  const [dimH, setDimH]                 = useState('');
  const [selectedCurr, setSelectedCurr] = useState<CurrencyCode>('USD');
  const [valueAmount,  setValueAmount]  = useState('');
  const [showCurrModal, setShowCurrModal] = useState(false);
  const [shipMode, setShipMode]         = useState('');
  const [notes, setNotes]               = useState('');

  // Step 5 — publish
  const [publishing, setPublishing] = useState(false);
  const [orderId,    setOrderId]    = useState<string | null>(null);

  // Post-publish QR handoff (video scan lives in CargoScanPage now)
  const [qrUrl,        setQrUrl]        = useState<string | null>(null);
  const [qrStatus,     setQrStatus]     = useState<'idle' | 'creating' | 'waiting' | 'done' | 'error'>('idle');
  const [qrErrMsg,     setQrErrMsg]     = useState('');
  const [qrScanResult, setQrScanResult] = useState<string>('');
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [err, setErr] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => () => { if (qrPollRef.current) clearInterval(qrPollRef.current); }, []);

  useEffect(() => { Store.set('cargo_type', cargoType); }, [cargoType]);

  // ── Draft restore (smaller field set) ──────────────────────────────────────
  useEffect(() => {
    const d = Store.get<SendDraft>('send_draft');
    if (!d) return;
    if (d.title)        setTitle(d.title);
    if (d.origin)       { const ap = getAirportByIata(d.origin); if (ap) setOrigin(ap); }
    if (d.dest)         { const ap = getAirportByIata(d.dest);   if (ap) setDest(ap);   }
    if (d.date)         setDate(d.date);
    if (d.weight)       setWeight(d.weight);
    if (d.dimL)         setDimL(d.dimL);
    if (d.dimW)         setDimW(d.dimW);
    if (d.dimH)         setDimH(d.dimH);
    if (d.selectedCurr) setSelectedCurr(d.selectedCurr as CurrencyCode);
    if (d.valueAmount)  setValueAmount(d.valueAmount);
    if (d.shipMode)     setShipMode(d.shipMode);
    if (d.notes)        setNotes(d.notes);
    if (d.step && d.step >= 1 && d.step <= 5) setStep(d.step);
  }, []);

  const draftRef = useRef(false);
  useEffect(() => {
    if (!draftRef.current) { draftRef.current = true; return; }
    const draft: SendDraft = {
      step, title, origin: origin?.iata ?? null, dest: dest?.iata ?? null, date,
      weight, dimL, dimW, dimH, selectedCurr, valueAmount, shipMode, notes,
    };
    Store.set('send_draft', draft);
  }, [step, title, origin, dest, date, weight, dimL, dimW, dimH, selectedCurr, valueAmount, shipMode, notes]);

  // ── Prohibited-goods HARD-STOP ─────────────────────────────────────────────
  // Deterministic keyword match against the declared item title (the shared list — NEVER an AI
  // judgment). Contact info that a sender might embed in the title/description is sanitized
  // SERVER-SIDE, so there is no client-side contact filter here.
  useEffect(() => {
    const hay = title.toLowerCase();
    setIllegalBlocked(!!title.trim() && PROHIBITED_KEYWORDS.some(kw => hay.includes(kw.toLowerCase())));
  }, [title]);

  // ── Trip match hint (reused, route step) ───────────────────────────────────
  const matchData = useMemo(() => {
    if (!origin || !dest) return null;
    const trips = Store.get<Array<{origin:string;destination?:string;dest?:string;date?:string;status:string}>>('trips') ?? [];
    const all = trips.filter(tr =>
      tr.origin === origin.iata &&
      (tr.destination === dest.iata || tr.dest === dest.iata) &&
      tr.status !== 'cancelled'
    );
    const forDate = date ? all.filter(tr => !tr.date || tr.date === date) : all;
    return { all: all.length, forDate: forDate.length };
  }, [origin, dest, date]);

  const getValueUSD = useCallback(() => {
    const amt = parseFloat(valueAmount) || 0;
    const curr = CURRENCIES.find(c => c.code === selectedCurr);
    if (!curr) return amt;
    if (curr.code === 'IRR') return amt / getLiveRate();
    return amt * (curr.rate ?? 1);
  }, [valueAmount, selectedCurr]);

  // ── SendAssistant apply — the ONLY way the AI can affect form state (parent-owned whitelist) ──
  const applyFromAssistant = useCallback((field: SendApplyField, value: SendApplyValue) => {
    setErr('');
    if (field === 'title') { setTitle(String(value)); }
    else if (field === 'weight') { setWeight(String(value)); }
    else if (field === 'value') {
      if (value && typeof value === 'object') {
        setValueAmount(String(value.amount));
        if (CURRENCIES.some(c => c.code === value.currency)) setSelectedCurr(value.currency as CurrencyCode);
      }
    }
    else if (field === 'shipMode') { setShipMode(String(value)); }
    else if (field === 'notes') { setNotes(String(value)); }
  }, []);

  function validate(n: number): string | null {
    switch (n) {
      case 1:
        if (!title.trim())   return t.spErrNeedItemName;
        if (illegalBlocked)  return t.spErrIllegal;
        return null;
      case 2:
        if (!origin) return t.spErrNoOrigin;
        if (!dest)   return t.spErrNoDest;
        if (!date)   return t.spErrNoDate;
        return null;
      case 3: {
        const w = parseFloat(weight);
        // No dedicated i18n key for declared-weight; hardcoded fa literal (fa-primary convention).
        if (!w || w <= 0) return 'برای ادامه باید وزن تقریبی کالا را وارد کنید.';
        return null;
      }
      case 4: return null;   // preferred channel is additive — never a gate
      default: return null;
    }
  }

  function goStep(n: number) {
    setErr('');
    if (n > step) {
      const e = validate(step);
      if (e) { setErr(e); return; }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f);
  }

  const canPublish = !!(session && title.trim() && origin && dest && parseFloat(weight) > 0 && !illegalBlocked);

  // ── Publish — adapted from ChaparConcierge.doPublish (no retail price/compare) ──────────────
  async function doPublish() {
    if (!session) { setErr(t.spErrNeedLogin); return; }
    if (illegalBlocked) { setErr(t.spErrIllegal); return; }
    if (!canPublish || !origin || !dest) return;

    setPublishing(true);
    setErr('');

    const originCode = COUNTRY_ISO2[origin.country] ?? null;
    const destCode   = COUNTRY_ISO2[dest.country]   ?? null;
    const dimsObj    = (dimL && dimW && dimH) ? { l: +dimL, w: +dimW, h: +dimH } : undefined;
    const usd        = getValueUSD();
    const valueUSD   = usd > 0 ? +usd.toFixed(2) : undefined;
    const declared   = parseFloat(weight) || 0;
    // shipMode is folded into the free-text note (the marketplace payload has no dedicated field).
    const specialRequest = [notes.trim(), shipMode ? `روش ارسال: ${shipMode}` : '']
      .filter(Boolean).join(' — ');

    const product: { title: string; category?: string; dimensions?: { l: number; w: number; h: number }; valueUSD?: number } = {
      title: title.trim(),
      ...(dimsObj  ? { dimensions: dimsObj } : {}),
      ...(valueUSD != null ? { valueUSD } : {}),
    };

    try {
      const r = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send',
          product,
          country: originCode,
          destCountry: destCode,
          estWeightKg: declared,
          specialRequest,
          priceQuote: null,
          userId: session.userId,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok || !d.orderId) { setErr('انتشار آگهی ناموفق بود. لطفاً دوباره تلاش کنید.'); setPublishing(false); return; }

      // Best-effort local history so the listing appears in «سفارش‌های من» immediately (additive).
      try {
        const rec = {
          trackId: d.orderId, type: 'send', origin: origin.iata, dest: dest.iata,
          originLabel: origin.city + ' ' + origin.iata, destLabel: dest.city + ' ' + dest.iata,
          originCity: origin.city, destCity: dest.city, date,
          detectedItem: title.trim(), title: title.trim(),
          valueUSD: valueUSD ?? null, valueCurrency: selectedCurr, valueAmount: parseFloat(valueAmount) || 0,
          weight: declared, dimensions: dimsObj ?? null, shipMode: shipMode || null,
          firstName: session.firstName, lastName: session.lastName, userId: session.userId,
          status: 'pending', createdAt: Date.now(),
        };
        const hist = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        hist.unshift(rec);
        Store.set('history', hist);
      } catch { /* non-fatal */ }

      Store.del('send_draft');
      Store.del('cargo_type');

      setOrderId(d.orderId);
      setPublishing(false);
      setStep(6);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErr('انتشار آگهی ناموفق بود. لطفاً دوباره تلاش کنید.');
      setPublishing(false);
    }
  }

  if (!session) return null;

  // ── Post-publish QR handoff (video scan handoff to a phone; CargoScanPage does the scan) ──────
  function stopQrPoll() {
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
  }

  async function handleScanWithPhone(listingId: string) {
    setQrStatus('creating');
    setQrErrMsg('');
    setQrUrl(null);
    stopQrPoll();
    try {
      const token = localStorage.getItem('cp_token') || '';
      const hdr   = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const createRes = await fetch('/api/scan/create', {
        method: 'POST', headers: hdr, body: JSON.stringify({ listingId }),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `HTTP ${createRes.status}`);
      }
      const { jobId } = await createRes.json() as { jobId: string };

      const hoRes = await fetch(`/api/scan/${jobId}/handoff`, { method: 'POST', headers: hdr });
      if (!hoRes.ok) {
        const d = await hoRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `HTTP ${hoRes.status}`);
      }
      const { url } = await hoRes.json() as { url: string };

      setQrUrl(url);
      setQrStatus('waiting');

      qrPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/scan/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) return;
          const d = await r.json() as { job: { status: string } };
          const st = d.job.status;
          if (st === 'verified' || st === 'flagged' || st === 'rejected' || st === 'analysis_failed') {
            stopQrPoll();
            setQrScanResult(st);
            setQrStatus('done');
          }
        } catch { /* keep polling */ }
      }, 2500);
    } catch (e) {
      setQrErrMsg(e instanceof Error ? e.message : t.scanHandoffErrFailed);
      setQrStatus('error');
    }
  }

  // ── Success screen (step 6) — keeps the CargoScanPage QR handoff hook ──────────────────────
  if (step === 6 && orderId) {
    return (
      <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
        <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4 bg-amber-50 border border-amber-200">
              <Clock className="w-8 h-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{t.spSuccessTitle}</h2>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl px-4 py-2 mb-4">
              <Clock className="w-4 h-4" aria-hidden /><span>{t.spSuccessPending}</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{t.spSuccessDesc}</p>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-4">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">{t.spTrackingCode}</div>
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{orderId}</div>
            </div>
            <div className="flex flex-col gap-3">
              {/* Post-publish video cargo-scan handoff (same-device + phone QR) */}
              {onVerifyCargo && orderId && (
                <>
                  <button
                    onClick={() => onVerifyCargo(orderId)}
                    className="ds-btn-primary py-3 w-full"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t.scanVerifyCargo}
                  </button>

                  {qrStatus === 'idle' || qrStatus === 'error' ? (
                    <button
                      onClick={() => handleScanWithPhone(orderId)}
                      className="w-full py-3 flex items-center justify-center gap-2 border-2 border-cyan-500/40 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 font-semibold rounded-xl transition-colors text-sm"
                      style={{ height: 48 }}
                    >
                      <Smartphone className="w-4 h-4" />
                      {t.scanHandoffBtn}
                    </button>
                  ) : qrStatus === 'creating' ? (
                    <div className="w-full py-3 flex items-center justify-center gap-2 border border-gray-200 rounded-xl text-gray-500 text-sm">
                      <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      {t.scanHandoffBtn}
                    </div>
                  ) : qrStatus === 'waiting' && qrUrl ? (
                    <div className="border border-cyan-200 rounded-2xl p-5 bg-cyan-50/60 text-center">
                      <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wider mb-3">{t.scanHandoffDesc}</p>
                      <div className="inline-flex p-3 bg-white rounded-xl shadow-sm border border-cyan-100 mb-3">
                        <QRCode value={qrUrl} size={160} />
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>{t.scanHandoffWaiting}</span>
                        <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      </div>
                      <button
                        onClick={() => { stopQrPoll(); setQrStatus('idle'); setQrUrl(null); }}
                        className="mt-3 text-xs text-gray-500 hover:text-gray-600 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <RefreshCw className="w-3 h-3" /> {t.scanRetryAnalysis}
                      </button>
                    </div>
                  ) : qrStatus === 'done' ? (
                    <div className={`border rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
                      qrScanResult === 'verified'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      {qrScanResult === 'verified' ? t.scanResultVerified : t.scanResultUnderReview}
                    </div>
                  ) : null}

                  {qrStatus === 'error' && qrErrMsg && (
                    <p className="text-xs text-red-500 text-center">{qrErrMsg}</p>
                  )}
                </>
              )}

              <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                 className={onVerifyCargo ? 'ds-btn-secondary py-3 w-full' : 'ds-btn-primary py-3 w-full'}
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
                {t.spViewTravelers}
              </button>
              <a href={`/track?id=${orderId}`}
                 className="ds-btn-secondary py-2.5 no-underline"
                 style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.spTrackOrder}
              </a>
              <button onClick={onHome} className="ds-btn-secondary py-2.5">{t.navBack}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currObj  = CURRENCIES.find(c => c.code === selectedCurr) ?? CURRENCIES[0];
  const valueUSD = getValueUSD();

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ════════════ STEP 1 — DESCRIBE ITEM ════════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '1').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spPill2}</h2>
            <p className="text-sm text-gray-500 mb-6">{t.spDetectedItem}</p>

            {/* Embedded AI assistant (additive, never blocks) */}
            <SendAssistant onApply={applyFromAssistant} onUnavailable={() => setAiUnavailable(true)} />

            <div className="mb-4">
              <label className="ds-label">{t.spConfirmItemName}</label>
              <input type="text" className="ds-input" placeholder={t.spItemSearch}
                value={title} onChange={e => { setTitle(e.target.value); setErr(''); }} />
              {/* NOTE: contact info a sender might put in the title/description is sanitized SERVER-SIDE. */}
            </div>

            {/* Optional single photo */}
            <div className="mb-4">
              <label className="ds-label">{t.spPhotoAdd}</label>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              {photo ? (
                <div className="relative inline-block">
                  <img src={photo} alt="" className="w-28 h-28 rounded-xl object-cover border border-gray-200" />
                  <button type="button" onClick={() => { setPhoto(null); if (photoRef.current) photoRef.current.value = ''; }}
                    className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500"
                    aria-label="حذف عکس"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-cyan-400 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400">
                  <ImagePlus className="w-6 h-6" aria-hidden />
                  <span className="text-[11px] font-semibold">{t.spPhotoAdd}</span>
                </button>
              )}
            </div>

            {/* Prohibited-goods HARD-STOP */}
            {illegalBlocked && (
              <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <Ban className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm text-red-700 font-semibold">{t.spIllegalAlert}</span>
              </div>
            )}

            <Err msg={err} />
            <button onClick={() => goStep(2)} disabled={illegalBlocked}
              className="ds-btn-primary w-full mt-4 py-3 disabled:opacity-50">{t.wizardContinue}</button>
          </motion.div>
        )}

        {/* ════════════ STEP 2 — ROUTE / DESTINATION ════════════ */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '2').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spPill1}</h2>
            <p className="text-sm text-gray-500 mb-6">{t.spOrigin}, {t.spDest}</p>

            <div className="ds-route-card grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <AirportCityAutocomplete label={t.spOrigin} value={origin} onChange={v => { setOrigin(v); setErr(''); }} placeholder={t.spOriginPlaceholder} />
              <AirportCityAutocomplete label={t.spDest}   value={dest}   onChange={v => { setDest(v);   setErr(''); }} placeholder={t.spDestPlaceholder} />
            </div>
            <div className="mb-5">
              <label className="ds-label">{t.spShipDate}</label>
              <input type="date" className="ds-input" min={today} value={date}
                onChange={e => { setDate(e.target.value); setErr(''); setShowAllTrips(false); }} />
            </div>

            {matchData !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                {(showAllTrips ? matchData.all : matchData.forDate) > 0 ? (
                  <>
                    <div className="text-sm font-bold text-blue-700 mb-1">
                      <Plane className="w-4 h-4 inline-block align-middle me-1" aria-hidden />{t.spMatchReady.replace('{n}', String(showAllTrips ? matchData.all : matchData.forDate))}
                    </div>
                    <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                       className="text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0">
                      {t.spMatchViewTravelers}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 italic">{t.spMatchNoTravelers}</p>
                )}
                {date && (
                  <button onClick={() => setShowAllTrips(m => !m)}
                    className="mt-2 text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0 block">
                    {showAllTrips ? t.spMatchShowDate : t.spMatchShowAllDates.replace('{n}', String(matchData.all))}
                  </button>
                )}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => goStep(1)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(3)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 3 — DETAILS (user-declared) ════════════ */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '3').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spPill4}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.spStep5Desc}</p>

            {aiUnavailable && (
              <div className="mb-4 text-[12px] text-gray-500">{/* AI unavailable — inline fields below remain fully usable */}</div>
            )}

            {/* Weight (required, user-declared) */}
            <div className="mb-4">
              <label className="ds-label">{t.spWeightLabel}</label>
              <input type="number" className="ds-input" min="0" step="0.1" placeholder="0.0"
                value={weight} onChange={e => { setWeight(e.target.value); setErr(''); }}
                style={{ direction: 'ltr' }} />
            </div>

            {/* Dimensions (optional) */}
            <div className="mb-4">
              <label className="ds-label">{t.spDimsEstimated}</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" className="ds-input" min="0" placeholder={t.spDimLength}
                  value={dimL} onChange={e => setDimL(e.target.value)} style={{ direction: 'ltr' }} />
                <input type="number" className="ds-input" min="0" placeholder={t.spDimWidth}
                  value={dimW} onChange={e => setDimW(e.target.value)} style={{ direction: 'ltr' }} />
                <input type="number" className="ds-input" min="0" placeholder={t.spDimHeight}
                  value={dimH} onChange={e => setDimH(e.target.value)} style={{ direction: 'ltr' }} />
              </div>
            </div>

            {/* Value + currency (reuse currency modal) */}
            <div className="mb-4">
              <label className="ds-label">{t.spCurrency}</label>
              <button type="button" onClick={() => setShowCurrModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-cyan-400 transition-colors bg-white">
                {currObj.flag ? <span className="text-xl">{currObj.flag}</span> : <Coins className="w-5 h-5 text-gray-500" aria-hidden />}
                <span className="text-base font-extrabold text-cyan-600">{currObj.code}</span>
                <span className="text-sm text-gray-500 flex-1 text-right">{CURR_LABELS[currObj.code] ?? currObj.code}</span>
                <span className="text-gray-500 text-sm">▼</span>
              </button>
              {selectedCurr === 'IRR' && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-semibold">
                  {t.spIrrWarning}
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="ds-label">{t.spAmount}</label>
              <input type="number" className="ds-input" placeholder={t.spAmountPlaceholder} min="0" step="0.01"
                value={valueAmount} onChange={e => { setValueAmount(e.target.value); setErr(''); }}
                style={{ direction: 'ltr' }} />
              {parseFloat(valueAmount) > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {t.spUsdEquiv} <strong className="text-cyan-600">${valueUSD.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Notes (optional). No dedicated i18n key exists for a free-text note, so the label is a
                hardcoded fa literal — matching the SendAssistant/TravelerAssistant fa-primary convention. */}
            <div className="mb-2">
              <label className="ds-label">توضیحات (اختیاری)</label>
              <textarea className="ds-input" rows={2} placeholder="توضیح کوتاه دربارهٔ کالا…"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <Err msg={err} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => goStep(2)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(4)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 4 — PREFERRED CHANNEL ════════════ */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '4').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-4">{t.travPill4}</h2>

            <PreferredChannelStep />

            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(3)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(5)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 5 — PUBLISH ════════════ */}
        {step === 5 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '5').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-4">{t.travPill5}</h2>

            {/* Review summary */}
            <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 mb-5">
              <div className="flex items-center gap-3 px-4 py-3">
                <Package className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden />
                <span className="text-sm text-gray-500 flex-shrink-0">{t.spDetectedItem}</span>
                <span className="text-sm font-bold text-gray-900 flex-1 text-end truncate">{title.trim() || '—'}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Plane className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden />
                <span className="text-sm text-gray-500 flex-shrink-0">{t.spOrigin} → {t.spDest}</span>
                <span className="text-sm font-bold text-gray-900 flex-1 text-end truncate">
                  {origin ? `${origin.city} (${origin.iata})` : '—'} → {dest ? `${dest.city} (${dest.iata})` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm text-gray-500 flex-1">{t.spWeightLabel}</span>
                <span className="text-sm font-bold text-gray-900">{parseFloat(weight) > 0 ? `${weight} kg` : '—'}</span>
              </div>
              {parseFloat(valueAmount) > 0 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm text-gray-500 flex-1">{t.spStep5Title}</span>
                  <span className="text-sm font-bold text-gray-900">{valueAmount} {selectedCurr} · ${valueUSD.toFixed(2)}</span>
                </div>
              )}
            </div>

            {illegalBlocked && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <Ban className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm text-red-700 font-semibold">{t.spErrIllegal}</span>
              </div>
            )}

            <p className="text-xs text-gray-500 leading-relaxed mb-4">{t.spSuccessDesc}</p>

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(4)} className="ds-btn-secondary flex-shrink-0 px-5 py-3" disabled={publishing}>{t.wizardPrev}</button>
              <button onClick={doPublish} disabled={!canPublish || publishing}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-50">
                {publishing ? t.spPublishing : t.spPublish}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Currency modal (reused) ─────────────────────────────────────────────── */}
      {showCurrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowCurrModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[72vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <span className="text-base font-extrabold text-gray-900">{t.spCurrencyModal}</span>
              <button onClick={() => setShowCurrModal(false)} className="text-gray-500 leading-none" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <div className="pb-6">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurr(c.code as CurrencyCode); setShowCurrModal(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors
                    ${selectedCurr === c.code ? 'bg-cyan-50' : ''}`}>
                  {c.flag ? <span className="text-xl">{c.flag}</span> : <Coins className="w-5 h-5 text-gray-500" aria-hidden />}
                  <span className="text-sm font-extrabold text-cyan-600 w-14 text-left">{c.code}</span>
                  <span className="flex-1 text-sm font-bold text-gray-700 text-right">{CURR_LABELS[c.code] ?? c.code}</span>
                  {selectedCurr === c.code && <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
