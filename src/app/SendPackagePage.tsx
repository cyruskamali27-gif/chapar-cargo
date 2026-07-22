import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Home, CheckCircle, CheckCircle2, Smartphone, RefreshCw, Clock, Video,
         SquareSlash, ScanSearch, ShieldAlert, Ban, AlertTriangle, Lock, IdCard, Lightbulb,
         FileText, ScanFace, Mail, MessageSquare, Plane, X, CreditCard, Wallet, Landmark,
         BookUser, Coins, CircleDollarSign } from 'lucide-react';
import QRCode from 'react-qr-code';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { IdentityVerification, CargoVerification } from './VerificationModules';
import GuidedCapture from './GuidedCapture';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { PROHIBITED_KEYWORDS } from '../lib/prohibited';   // CMD-24: shared source (was inline below)
import { useVerifyGate } from '../lib/useVerifyGate';
import { useKycGate } from '../lib/useKycGate';
import { Store, genId, getLiveRate } from '../lib/store';
import SecuritySelector from './ProtectionSelector';
import { defaultSecurityLevel, type SecurityLevel } from './shipmentTypes';
import { PhoneField, isValidPhoneNumber } from '../lib/PhoneField';
import type { Country } from '../lib/PhoneField';

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

// CMD-48: payment methods carry Lucide marks, not emoji — same stroke as every other icon.
const PAY_METHODS = [
  { id: 'debit',  Icon: CreditCard,        label: 'Debit Card'     },
  { id: 'credit', Icon: CreditCard,        label: 'Credit Card'    },
  { id: 'paypal', Icon: Landmark,          label: 'PayPal'         },
  { id: 'wallet', Icon: Wallet,            label: 'Digital Wallet' },
  { id: 'usdt',   Icon: CircleDollarSign,  label: 'USDT'           },
  { id: 'usdc',   Icon: Coins,             label: 'USDC'           },
];

const CARGO_ITEMS_BASE = [
  { catKey: 'spCatElectronics', items: ['گوشی موبایل','لپ‌تاپ','تبلت','هدفون','اسپیکر','کامپیوتر','ساعت هوشمند','دوربین','قطعات الکترونیکی','شارژر و کابل','کنسول بازی','هارد اکسترنال'] },
  { catKey: 'spCatClothing',    items: ['لباس','کت و شلوار','کفش','کیف','عینک','کمربند','شال و روسری','لباس ورزشی','جواهرات'] },
  { catKey: 'spCatHealth',      items: ['دارو و مکمل','لوازم آرایشی و بهداشتی','عطر و ادکلن','ویتامین و مکمل غذایی','لوازم پزشکی'] },
  { catKey: 'spCatDocuments',   items: ['کتاب و مجله','مدارک و اسناد','اوراق رسمی','پاسپورت و ویزا','آلبوم عکس'] },
  { catKey: 'spCatFood',        items: ['مواد غذایی خشک','شیرینی و شکلات','چای و قهوه','آجیل و خشکبار','ادویه و چاشنی'] },
  { catKey: 'spCatGifts',       items: ['هدیه و سوغاتی','اسباب‌بازی','لوازم خانه','لوازم ورزشی','محصولات دیجیتال'] },
];


const CASH_KEYWORDS = [
  'پول نقد','اسکناس','دلار نقدی','یورو نقد','cash','dollar bills','currency notes',
  'banknote','نقدی','ارز نقدی',
];

// Rotating guidance shown over the live camera during the continuous scan.
const SCAN_HINTS = [
  'کالا را آرام بچرخانید…',
  'نمای جلو را نشان دهید…',
  'نمای کنار را نشان دهید…',
  'نمای پشت را نشان دهید…',
];
const SCAN_DURATION_MS = 8200;

// ── Helpers ────────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
      {msg}
    </div>
  );
}

function StepPills({ step }: { step: number }) {
  const { t } = useLang();
  const PILL_LABELS = [t.spPill1, t.spPill2, t.spPill3, t.spPill4, t.spPill5, t.spPill6, t.spPill7, t.spPill8];
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
      {PILL_LABELS.map((label, i) => {
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

// ── Draft shape ────────────────────────────────────────────────────────────────
interface CargoDraft {
  step: number;
  origin: string | null;
  dest: string | null;
  date: string;
  videoReady: boolean;
  detectedItem: string;
  detectedCat: string;
  confidence: string;
  riskLevel: string;
  nameConfirmed: boolean;
  dims: { l: number; w: number; h: number } | null;
  dimsConfirmed: boolean;
  inspDone: boolean;
  selectedCurr: string;
  valueAmount: string;
  recFirst: string;
  recLast: string;
  recPhone: string;
  recAddress: string;
  docType: string | null;
  idVerified: boolean;
  selectedPay: string | null;
  payVerified: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; cargoType?: 'personal' | 'chapar'; onNavigate?: (page: string) => void; onVerifyCargo?: (listingId: string) => void; }

export default function SendPackagePage({ onHome, cargoType = 'personal', onNavigate, onVerifyCargo }: Props) {
  const { t, isRTL } = useLang();

  const pageTitle = cargoType === 'chapar' ? t.spTitleChapar : t.spTitlePersonal;
  const pageDesc  = cargoType === 'chapar' ? t.spDescChapar  : t.spDescPersonal;

  // Currency label lookup (computed from t)
  const CURR_LABELS: Record<string, string> = {
    USD: t.spCurrUSD, EUR: t.spCurrEUR, CAD: t.spCurrCAD, GBP: t.spCurrGBP,
    AED: t.spCurrAED, TRY: t.spCurrTRY, SAR: t.spCurrSAR, QAR: t.spCurrQAR,
    IQD: t.spCurrIQD, CNY: t.spCurrCNY, INR: t.spCurrINR, AMD: t.spCurrAMD,
    AZN: t.spCurrAZN, USDT: t.spCurrUSDT, USDC: t.spCurrUSDC, IRR: t.spCurrIRR,
  };

  // Cargo categories with translated names
  const CARGO_ITEMS = CARGO_ITEMS_BASE.map(c => ({
    cat: (t as Record<string, string>)[c.catKey] ?? c.catKey,
    items: c.items,
  }));

  // Doc types with translated names/reqs
  const DOC_TYPES = [
    { key: 'passport', Icon: BookUser,   name: t.docPassportName, req: t.docFrontSelfieReq,     needBack: false },
    { key: 'driver',   Icon: CreditCard, name: t.docDriverName,   req: t.docFrontBackSelfieReq, needBack: true  },
    { key: 'national', Icon: IdCard,     name: t.docNationalName, req: t.docFrontBackSelfieReq, needBack: true  },
  ];

  const { session } = useSession();
  const { gate, modal } = useVerifyGate();
  const { isVerified: kycVerified, notice: kycNotice } = useKycGate({ onNavigate });

  const [step, setStep] = useState(1);

  const [origin, setOrigin] = useState<AirportOption | null>(null);
  const [dest,   setDest]   = useState<AirportOption | null>(null);
  const [date,   setDate]   = useState('');
  const [showAllTrips, setShowAllTrips] = useState(false);

  const [photos, setPhotos]           = useState<string[]>([]);
  const [shots, setShots]             = useState({ jolo: false, posht: false, chap: false, rast: false });
  const jRef  = useRef<HTMLInputElement>(null);
  const pRef  = useRef<HTMLInputElement>(null);
  const cRef  = useRef<HTMLInputElement>(null);
  const rRef  = useRef<HTMLInputElement>(null);
  const exRef = useRef<HTMLInputElement>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [videoDur,   setVideoDur]   = useState(0);
  const videoRef = useRef<HTMLInputElement>(null);

  // ── Continuous video scan (MediaRecorder) ───────────────────────────────────
  const [scanBlob, setScanBlob]   = useState<Blob | null>(null);
  const [scanUrl,  setScanUrl]    = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [hintIdx,  setHintIdx]    = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanBlocked,  setScanBlocked]  = useState(false);
  const [scanError,    setScanError]    = useState('');
  const mediaRef     = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const framesRef    = useRef<Blob[]>([]);
  const recMimeRef   = useRef<string>('video/webm');
  const recStartRef  = useRef<number>(0);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inspecting,    setInspecting]    = useState(false);
  const [inspDone,      setInspDone]      = useState(false);
  const [detectedItem,  setDetectedItem]  = useState('');
  const [detectedCat,   setDetectedCat]   = useState('');
  const [confidence,    setConfidence]    = useState<'high'|'medium'|'low'>('high');
  const [riskLevel,     setRiskLevel]     = useState<'low'|'review'|'high'>('low');
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [dims,          setDims]          = useState<{l:number;w:number;h:number}|null>(null);
  const [dimsConfirmed, setDimsConfirmed] = useState(false);
  const [dimManual,     setDimManual]     = useState(false);
  const [dimL, setDimL]                   = useState('');
  const [dimW, setDimW]                   = useState('');
  const [dimH, setDimH]                   = useState('');
  const [inspChecks,    setInspChecks]    = useState<string[]>([]);
  const [illegalBlocked,setIllegalBlocked]= useState(false);
  const [cashFlagged,   setCashFlagged]   = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearch,    setItemSearch]    = useState('');
  const [cargoEnabled,  setCargoEnabled]  = useState(true);

  const [selectedCurr,   setSelectedCurr]   = useState<CurrencyCode>('USD');
  const [valueAmount,    setValueAmount]    = useState('');
  const [showCurrModal,  setShowCurrModal]  = useState(false);

  const [recFirst,      setRecFirst]      = useState('');
  const [recLast,       setRecLast]       = useState('');
  const [recPhone,      setRecPhone]      = useState('');
  const [recEmail,      setRecEmail]      = useState('');
  const [recAddress,    setRecAddress]    = useState('');
  const [recDocCapture, setRecDocCapture] = useState(false);
  const [recDocCamOpen, setRecDocCamOpen] = useState(false);
  const [docCamSlot,    setDocCamSlot]    = useState<'front'|'back'|'selfie'|null>(null);
  const [recConfirmSentVia, setRecConfirmSentVia] = useState<string | null>(null);

  const [docType,       setDocType]       = useState<string|null>(null);
  const [docCaptures,   setDocCaptures]   = useState({ front: false, back: false, selfie: false });
  const [idEnabled,     setIdEnabled]     = useState(true);
  const [idVerifying,   setIdVerifying]   = useState(false);
  const [idVerifyItems, setIdVerifyItems] = useState<string[]>([]);
  const [docVerified,   setDocVerified]   = useState(false);

  const [selectedPay,    setSelectedPay]    = useState<string|null>(null);
  const [payAccountName, setPayAccountName] = useState('');
  const [payVerifying,   setPayVerifying]   = useState(false);
  const [payVerified,    setPayVerified]    = useState(false);
  const [payVerifyItems, setPayVerifyItems] = useState<string[]>([]);

  const [securityLevel,       setSecurityLevel]       = useState<SecurityLevel>('GUARANTEED');
  const [identityVerReq,      setIdentityVerReq]      = useState(false);
  const [cargoVerReq,         setCargoVerReq]         = useState(false);
  const [otpDeliveryReq,      setOtpDeliveryReq]      = useState(false);
  const [deliveryPhotoReq,    setDeliveryPhotoReq]    = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [trackId,    setTrackId]    = useState<string|null>(null);

  // M4 — Desktop QR handoff state
  const [qrUrl,        setQrUrl]        = useState<string | null>(null);
  const [qrStatus,     setQrStatus]     = useState<'idle' | 'creating' | 'waiting' | 'done' | 'error'>('idle');
  const [qrErrMsg,     setQrErrMsg]     = useState('');
  const [qrScanResult, setQrScanResult] = useState<string>('');
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [err, setErr] = useState('');

  // Cleanup QR poll + live camera scan on unmount
  useEffect(() => () => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    try { if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop(); } catch { /* noop */ }
    if (streamRef.current) streamRef.current.getTracks().forEach(tk => tk.stop());
    setScanUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Store.set('cargo_type', cargoType);
  }, [cargoType]);

  useEffect(() => {
    if (!session) return;
    const full = [session.firstName, session.lastName].filter(Boolean).join(' ').trim();
    if (full) setPayAccountName(full);
  }, [session?.userId]);

  useEffect(() => {
    const d = Store.get<CargoDraft>('cargo_draft');
    if (!d) return;
    if (d.origin)        { const ap = getAirportByIata(d.origin); if (ap) setOrigin(ap); }
    if (d.dest)          { const ap = getAirportByIata(d.dest);   if (ap) setDest(ap);   }
    if (d.date)          setDate(d.date);
    if (d.videoReady)    setVideoReady(true);
    if (d.detectedItem)  setDetectedItem(d.detectedItem);
    if (d.detectedCat)   setDetectedCat(d.detectedCat);
    if (d.confidence)    setConfidence(d.confidence as 'high'|'medium'|'low');
    if (d.riskLevel)     setRiskLevel(d.riskLevel as 'low'|'review'|'high');
    if (d.nameConfirmed) setNameConfirmed(true);
    if (d.dims)          setDims(d.dims);
    if (d.dimsConfirmed) setDimsConfirmed(true);
    if (d.inspDone)      setInspDone(true);
    if (d.selectedCurr)  setSelectedCurr(d.selectedCurr as CurrencyCode);
    if (d.valueAmount)   setValueAmount(d.valueAmount);
    if (d.recFirst)      setRecFirst(d.recFirst);
    if (d.recLast)       setRecLast(d.recLast);
    if (d.recPhone)      setRecPhone(d.recPhone);
    if (d.recEmail)      setRecEmail(d.recEmail);
    if (d.recAddress)    setRecAddress(d.recAddress);
    if (d.docType)       setDocType(d.docType);
    if (d.idVerified)    setDocVerified(true);
    if (d.selectedPay)   setSelectedPay(d.selectedPay);
    if (d.payVerified)   setPayVerified(true);
    if (d.step && d.step >= 1 && d.step <= 8) setStep(d.step);
  }, []);

  const draftRef = useRef(false);
  useEffect(() => {
    if (!draftRef.current) { draftRef.current = true; return; }
    const draft: CargoDraft = {
      step, origin: origin?.iata ?? null, dest: dest?.iata ?? null,
      date, videoReady, detectedItem, detectedCat, confidence, riskLevel,
      nameConfirmed, dims, dimsConfirmed, inspDone, selectedCurr, valueAmount,
      recFirst, recLast, recPhone, recAddress, docType, idVerified: docVerified,
      selectedPay, payVerified,
    };
    Store.set('cargo_draft', draft);
  }, [step, origin, dest, date, videoReady, detectedItem, detectedCat, confidence, riskLevel,
      nameConfirmed, dims, dimsConfirmed, inspDone, selectedCurr, valueAmount,
      recFirst, recLast, recPhone, recAddress, docType, docVerified, selectedPay, payVerified]);

  useEffect(() => {
    if (detectedCat) setSecurityLevel(defaultSecurityLevel(detectedCat));
  }, [detectedCat]);

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

  const highValue = getValueUSD() > 500;

  function validate(n: number): string | null {
    switch (n) {
      case 1:
        if (!origin) return t.spErrNoOrigin;
        if (!dest)   return t.spErrNoDest;
        if (!date)   return t.spErrNoDate;
        return null;
      case 2:
        if (!videoReady) return t.spErrNeedVideo;
        return null;
      case 3:
        if (!videoReady) return t.spErrNeedVideo;
        return null;
      case 4:
        if (!nameConfirmed) return t.spErrNeedItemName;
        if (!dimsConfirmed) return t.spErrNeedDims;
        return null;
      case 5: {
        const v = parseFloat(valueAmount);
        if (!v || v <= 0) return t.spErrNeedValue;
        return null;
      }
      case 6:
        if (!recFirst.trim())   return t.spErrNeedRecFirst;
        if (!recLast.trim())    return t.spErrNeedRecLast;
        if (!recPhone || !isValidPhoneNumber(recPhone)) return t.spErrNeedRecPhone;
        if (!recAddress.trim()) return t.spErrNeedRecAddress;
        if (highValue && !recDocCapture) return t.spErrNeedRecDoc;
        return null;
      case 7:
        if (!docVerified) return t.spErrNeedDocVerified;
        return null;
      case 8:
        if (!payVerified) return t.spErrNeedPayVerified;
        return null;
      default: return null;
    }
  }

  function goStep(n: number) {
    setErr('');
    if (n > step) {
      const e = validate(step);
      if (e) { setErr(e); return; }
      if (n === 4 && step < 4) { setStep(4); runInspection(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addPhoto(file: File, shotKey?: keyof typeof shots) {
    if (photos.length >= 8) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setPhotos(prev => [...prev, dataUrl]);
      if (shotKey) setShots(prev => ({ ...prev, [shotKey]: true }));
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  function onVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const dur = vid.duration;
      if (dur < 10) { setErr(t.spVideoErrShort); return; }
      setVideoReady(true);
      setVideoDur(Math.round(dur));
    };
    vid.src = url;
    if (e.target) e.target.value = '';
  }

  // ── Continuous video scan capture ──────────────────────────────────────────
  function captureFrame() {
    const v = liveVideoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth || !v.videoHeight) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(b => { if (b) framesRef.current.push(b); }, 'image/jpeg', 0.82);
  }

  function stopScan() {
    if (hintTimerRef.current) { clearInterval(hintTimerRef.current); hintTimerRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    captureFrame(); // grab one final frame before tearing down the stream
    try { if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop(); } catch { /* noop */ }
    if (streamRef.current) { streamRef.current.getTracks().forEach(tk => tk.stop()); streamRef.current = null; }
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setRecording(false);
  }

  async function startScan() {
    setScanError('');
    setScanComplete(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setScanError(t.spVideoErrShort || 'Camera recording is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.muted = true;
        await liveVideoRef.current.play().catch(() => { /* autoplay policies — ignore */ });
      }
      const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const mime = candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
      recMimeRef.current = (mime || 'video/webm').split(';')[0];
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = mr;
      chunksRef.current = [];
      framesRef.current = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recMimeRef.current });
        setScanBlob(blob);
        setScanUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setVideoDur(Math.max(1, Math.round((performance.now() - recStartRef.current) / 1000)));
        setVideoReady(true);
      };
      recStartRef.current = performance.now();
      mr.start();
      setRecording(true);
      setHintIdx(0);
      // Capture an initial frame shortly after the stream warms up, then rotate hints + grab frames.
      setTimeout(captureFrame, 600);
      let i = 0;
      hintTimerRef.current = setInterval(() => {
        i += 1;
        setHintIdx(i % SCAN_HINTS.length);
        captureFrame();
      }, 2000);
      stopTimerRef.current = setTimeout(() => stopScan(), SCAN_DURATION_MS);
    } catch {
      setScanError(t.spErrNeedVideo || 'Camera access was denied. Please allow camera to scan your package.');
      setRecording(false);
    }
  }

  function resetScan() {
    stopScan();
    setScanUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setScanBlob(null);
    framesRef.current = [];
    setVideoReady(false);
    setVideoDur(0);
    setScanComplete(false);
    setScanError('');
  }

  // ── Real scan pipeline: create(draft) → upload-urls → PUT → finalize → analyze → poll ──
  async function runRealScan() {
    if (!scanBlob || framesRef.current.length === 0) throw new Error('NO_SCAN');
    const token = localStorage.getItem('cp_token') || '';
    const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // 1) Create a draft scan job (no listing exists yet — this is the pre-listing wizard scan)
    const cRes = await fetch('/api/scan/create', {
      method: 'POST', headers: H,
      body: JSON.stringify({ draft: true, declaredItem: detectedItem || null, declaredCategory: detectedCat || null }),
    });
    const c = await cRes.json().catch(() => ({}));
    if (!cRes.ok || !c.jobId) throw new Error(c.error || 'create failed');
    const jobId: string = c.jobId;

    // 2) Request upload URLs for the video + every extracted frame
    const frames = framesRef.current;
    const files = [{ kind: 'video', mime: recMimeRef.current }, ...frames.map(() => ({ kind: 'frame' }))];
    const uRes = await fetch(`/api/scan/${jobId}/upload-urls`, {
      method: 'POST', headers: H, body: JSON.stringify({ files }),
    });
    const u = await uRes.json().catch(() => ({}));
    if (!uRes.ok || !Array.isArray(u.urls)) throw new Error(u.error || 'upload-urls failed');

    const videoSlot  = u.urls.find((s: { kind: string }) => s.kind === 'video');
    const frameSlots = u.urls.filter((s: { kind: string }) => s.kind === 'frame');
    if (!videoSlot || frameSlots.length === 0) throw new Error('upload slots missing');

    // 3) PUT bytes straight to Spaces (presigned URLs — Content-Type must match what was signed)
    await fetch(videoSlot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': recMimeRef.current }, body: scanBlob });
    await Promise.all(frameSlots.map((slot: { uploadUrl: string }, idx: number) =>
      fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: frames[idx] })
    ));

    // 4) Finalize (verifies objects exist; triggers analysis)
    const mediaKeys = [videoSlot.key, ...frameSlots.map((s: { key: string }) => s.key)];
    const fRes = await fetch(`/api/scan/${jobId}/finalize`, {
      method: 'POST', headers: H, body: JSON.stringify({ mediaKeys }),
    });
    if (!fRes.ok) { const d = await fRes.json().catch(() => ({})); throw new Error(d.error || 'finalize failed'); }

    // 5) Kick analysis (finalize already triggers it; this is a best-effort nudge / retry hook)
    await fetch(`/api/scan/${jobId}/analyze`, { method: 'POST', headers: H }).catch(() => { /* non-fatal */ });

    // 6) Poll until terminal
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2500));
      const jRes = await fetch(`/api/scan/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!jRes.ok) continue;
      const j = await jRes.json().catch(() => ({}));
      const st = j.job?.status;
      if (['verified', 'flagged', 'rejected', 'analysis_failed'].includes(st)) return j.job;
    }
    throw new Error('timeout');
  }

  async function runInspection() {
    setInspecting(true);
    setInspDone(false);
    setNameConfirmed(false);
    setDimsConfirmed(false);
    setInspChecks([]);
    setIllegalBlocked(false);
    setCashFlagged(false);
    setScanBlocked(false);
    setScanComplete(false);
    setScanError('');
    setDimManual(false);
    setDims(null);

    let job;
    try {
      job = await runRealScan();
    } catch (e) {
      setInspecting(false);
      setScanComplete(false);
      setScanError(
        e instanceof Error && e.message === 'NO_SCAN'
          ? (t.spErrNeedVideo || 'No scan recording found — please go back and record the package scan.')
          : (e instanceof Error && e.message === 'timeout'
              ? (t.scanHandoffErrFailed || 'Scan analysis timed out. Please try again.')
              : (e instanceof Error ? e.message : (t.scanHandoffErrFailed || 'Scan failed. Please try again.')))
      );
      return;
    }

    // Map the REAL Gemini analysis result onto the existing gating vars.
    const r = job.analysisResult || {};
    const matchConf = typeof r.match?.confidence === 'number' ? r.match.confidence : null;
    const conf: 'high'|'medium'|'low' = matchConf == null ? 'medium' : matchConf >= 0.8 ? 'high' : matchConf >= 0.5 ? 'medium' : 'low';
    const prohibited = r.prohibited?.prohibited === 'flagged';
    const mismatch   = r.match?.match === 'mismatch';
    const suspicious = r.valueCheck?.valueCheck === 'suspicious';
    const bad = job.status === 'flagged' || job.status === 'rejected' || prohibited;

    setConfidence(conf);
    setRiskLevel(job.status === 'verified' ? 'low' : (bad ? 'high' : 'review'));
    setScanBlocked(prohibited || job.status === 'rejected');
    setIllegalBlocked(prohibited || job.status === 'rejected');
    const cats = Array.isArray(r.prohibited?.categories) ? r.prohibited.categories.join(' ').toLowerCase() : '';
    setCashFlagged(!prohibited && /cash|currenc|banknote|نقد|اسکناس/.test(cats));

    const riskTxt = job.status === 'verified' ? t.spRiskLow : bad ? t.spRiskHigh : t.spRiskReview;
    const checks: string[] = [];
    checks.push(t.spCheckMediaMatch);
    checks.push(`${t.spFraudRiskLabel} ${riskTxt}`);
    checks.push(`${t.spConfLabel} ${conf === 'high' ? t.spConfHigh : conf === 'medium' ? t.spConfMedium : t.spConfLow}`);
    if (suspicious) checks.push(t.spFraudRiskLabel);
    setInspChecks(checks);

    setScanComplete(true);
    setInspecting(false);
  }

  function checkInspDone(nc: boolean, dc: boolean) {
    if (nc && dc) setInspDone(true);
  }

  function confirmName() {
    setNameConfirmed(true);
    checkInspDone(true, dimsConfirmed);
  }

  function selectItemName(item: string) {
    setDetectedItem(item);
    setDetectedCat(item);
    setNameConfirmed(true);
    setShowItemModal(false);
    checkInspDone(true, dimsConfirmed);
    const lower = item.toLowerCase();
    // OR with the AI verdict so a clean-looking name can never un-block an AI-flagged scan.
    setIllegalBlocked(scanBlocked || PROHIBITED_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())));
    setCashFlagged(prev => prev || CASH_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())));
  }

  function confirmDims() {
    setDimsConfirmed(true);
    setDimManual(false);
    checkInspDone(nameConfirmed, true);
  }

  function saveDims() {
    const l = parseFloat(dimL), w = parseFloat(dimW), h = parseFloat(dimH);
    if (!l || !w || !h || l <= 0 || w <= 0 || h <= 0) { setErr(t.spErrDimsInvalid); return; }
    setDims({ l, w, h });
    setDimsConfirmed(true);
    setDimManual(false);
    checkInspDone(nameConfirmed, true);
  }

  function onDocCapture(which: 'front'|'back'|'selfie') {
    const newCaps = { ...docCaptures, [which]: true };
    setDocCaptures(newCaps);
    if (!docType) return;
    const def = DOC_TYPES.find(d => d.key === docType);
    const needBack = def?.needBack ?? false;
    if (newCaps.front && newCaps.selfie && (!needBack || newCaps.back)) {
      startDocVerify();
    }
  }

  function selectDocType(key: string) {
    setDocType(key);
    setDocCaptures({ front: false, back: false, selfie: false });
    setDocVerified(false);
    setIdVerifyItems([]);
    setIdVerifying(false);
  }

  function startDocVerify() {
    setIdVerifying(true);
    setIdVerifyItems([]);
    const checks = [t.spDocCheckFace, t.spDocCheckValid, t.spDocCheckType, t.spDocCheckCountry, t.spDocCheckFraud];
    setTimeout(() => {
      setIdVerifying(false);
      checks.forEach((c, i) => {
        setTimeout(() => setIdVerifyItems(prev => [...prev, c]), i * 180 + 60);
      });
      setTimeout(() => setDocVerified(true), checks.length * 180 + 200);
    }, 2000);
  }

  function confirmPayment() {
    if (!payAccountName.trim()) { setErr(t.spErrPayAccountName); return; }
    setErr('');
    setPayVerifying(true);
    const items = [t.spPayCheckName, t.spPayCheckMethod];
    setTimeout(() => {
      setPayVerifying(false);
      items.forEach((txt, i) => {
        setTimeout(() => setPayVerifyItems(prev => [...prev, txt]), i * 200 + 60);
      });
      setTimeout(() => setPayVerified(true), items.length * 200 + 200);
    }, 1500);
  }

  async function publishOrder() {
    if (!session) { setErr(t.spErrNeedLogin); return; }
    if (illegalBlocked) { setErr(t.spErrIllegal); return; }
    if (!docVerified || !payVerified) { setErr(t.spErrNeedKyc); return; }
    if (!origin || !dest) return;

    const amt = parseFloat(valueAmount) || 0;
    const curr = CURRENCIES.find(c => c.code === selectedCurr);
    const usdRate = curr ? (curr.code === 'IRR' ? 1 / getLiveRate() : (curr.rate ?? 1)) : 1;
    const usdV = amt * usdRate;

    setPublishing(true);

    const order = {
      trackId:              genId('CH'),
      type:                 cargoType,
      origin:               origin.iata,
      dest:                 dest.iata,
      originLabel:          origin.city + ' ' + origin.iata,
      destLabel:            dest.city   + ' ' + dest.iata,
      originFlag:           '',
      destFlag:             '',
      originCity:           origin.city,
      destCity:             dest.city,
      date,
      cargoType:            detectedCat,
      detectedItem,
      weight:               null,
      valueUSD:             usdV.toFixed(2),
      valueCurrency:        selectedCurr,
      valueAmount:          amt,
      valueToman:           Math.round(usdV * getLiveRate()),
      recFirstName:         recFirst.trim(),
      recLastName:          recLast.trim(),
      recPhone:             recPhone.trim(),
      recEmail:             recEmail.trim() || null,
      recAddress:           recAddress.trim(),
      recipientConfirmation: 'pending',
      dimensions:           dims,
      payMethod:            selectedPay,
      phone:                session.phone,
      firstName:            session.firstName,
      lastName:             session.lastName,
      userId:               session.userId,
      status:               'pending',
      createdAt:            Date.now(),
      preferredTripId:      Store.get<string>('cargo_trip') ?? null,
      requiresAdminApproval: cashFlagged,
      cashTransport:         cashFlagged,
      kycVerified:           true,
      securityLevel,
      identityVerificationRequired: identityVerReq,
      cargoVerificationRequired:    cargoVerReq,
      otpDeliveryRequired:          otpDeliveryReq,
      deliveryPhotoRequired:        deliveryPhotoReq,
    };

    const hist = Store.get<typeof order[]>('history') ?? [];
    hist.unshift(order);
    Store.set('history', hist);

    try {
      await fetch('/api/approvals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cargo_listing', refId: order.trackId, payload: order }),
      });
    } catch { /* non-fatal */ }

    // Fire-and-forget: send recipient confirmation (non-blocking, does not affect shipment creation)
    fetch('/api/auth/confirm/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId:     order.trackId,
        recipientPhone: order.recPhone || null,
        recipientEmail: order.recEmail || null,
        senderName:     [session.firstName, session.lastName].filter(Boolean).join(' ') || session.email || '',
        destCity:       dest.city,
      }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setRecConfirmSentVia(d.sentVia); })
      .catch(() => { /* non-fatal */ });

    const users = Store.get<Array<Record<string,unknown>>>('users') ?? [];
    const idx = users.findIndex(u => u.userId === session.userId);
    if (idx !== -1) { users[idx].kycVerified = true; Store.set('users', users); }

    Store.del('cargo_draft');
    Store.del('cargo_trip');
    Store.del('cargo_type');

    setTrackId(order.trackId);
    setPublishing(false);
    setStep(9);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!session) return null;

  // ── M4: Desktop QR handoff helpers ────────────────────────────────────────
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

      // 1. Create scan job
      const createRes = await fetch('/api/scan/create', {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ listingId }),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `HTTP ${createRes.status}`);
      }
      const { jobId } = await createRes.json() as { jobId: string };

      // 2. Mint handoff token
      const hoRes = await fetch(`/api/scan/${jobId}/handoff`, {
        method: 'POST', headers: hdr,
      });
      if (!hoRes.ok) {
        const d = await hoRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || `HTTP ${hoRes.status}`);
      }
      const { url } = await hoRes.json() as { url: string };

      setQrUrl(url);
      setQrStatus('waiting');

      // 3. Poll for phone completion
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
        } catch {}
      }, 2500);
    } catch (err) {
      setQrErrMsg(err instanceof Error ? err.message : t.scanHandoffErrFailed);
      setQrStatus('error');
    }
  }

  // ── Step 9 — Success ──────────────────────────────────────────────────────
  if (step === 9 && trackId) {
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
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{trackId}</div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm mb-6">
              <span className="text-gray-500 font-semibold">{t.spRecConfirmStatus}:</span>
              {recConfirmSentVia === null ? (
                <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-lg px-3 py-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden />{t.spRecConfirmPending}
                </span>
              ) : recConfirmSentVia === 'email' ? (
                <span className="inline-flex items-center gap-1 bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold rounded-lg px-3 py-1">
                  <Mail className="w-3.5 h-3.5" aria-hidden />{t.spRecConfirmEmailSent}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold rounded-lg px-3 py-1">
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden />{t.spRecConfirmSmsPending}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {/* ── M4: Desktop→Phone QR handoff ── */}
              {onVerifyCargo && trackId && (
                <>
                  {/* Same-device scan (M3) */}
                  <button
                    onClick={() => onVerifyCargo(trackId)}
                    className="ds-btn-primary py-3 w-full"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t.scanVerifyCargo}
                  </button>

                  {/* Phone handoff QR button */}
                  {qrStatus === 'idle' || qrStatus === 'error' ? (
                    <button
                      onClick={() => handleScanWithPhone(trackId)}
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
              <a href={`/track?id=${trackId}`}
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

  const currObj = CURRENCIES.find(c => c.code === selectedCurr) ?? CURRENCIES[0];
  const valueUSD = getValueUSD();

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {modal}
      <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ════════════ STEP 1 ════════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '1').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spPill1}</h2>
            <p className="text-sm text-gray-500 mb-6">{t.spOrigin}, {t.spDest}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
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
                    <p className="text-xs text-blue-500 mb-3">{t.spMatchTravelersReady}</p>
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
            <button onClick={() => goStep(2)} className="ds-btn-primary w-full mt-4 py-3">{t.wizardContinue}</button>
          </motion.div>
        )}

        {/* ════════════ STEP 2 ════════════ */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '2').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep2Title}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.spStep2Desc}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex gap-2">
              <Video className="w-4 h-4 flex-shrink-0" aria-hidden />
              <span>{t.spVideoHint}</span>
            </div>

            {/* Always-mounted live preview (hidden until recording so the ref exists when the stream attaches) */}
            <div className="relative mb-4" style={{ display: recording ? 'block' : 'none' }}>
              <video ref={liveVideoRef} autoPlay playsInline muted
                className="w-full rounded-2xl bg-black object-cover" style={{ aspectRatio: '3 / 4' }} />
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent text-center">
                <span className="text-white text-sm font-extrabold drop-shadow">{SCAN_HINTS[hintIdx]}</span>
              </div>
              <button type="button" onClick={stopScan}
                className="absolute top-3 right-3 bg-white/90 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white transition-colors">
<SquareSlash className="w-3.5 h-3.5 inline-block align-middle me-1" aria-hidden />{t.spVideoReRecord ?? 'Stop'}
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {!recording && !videoReady && (
              <button type="button" onClick={startScan}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-3 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all">
                <Video className="w-9 h-9 text-gray-400" aria-hidden />
                <span className="text-sm font-bold text-gray-600">{t.spVideoRecord}</span>
                <span className="text-xs text-gray-500">{t.spVideoClickToRecord}</span>
              </button>
            )}

            {!recording && videoReady && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-green-100 border border-green-300 rounded-full px-3 py-1 text-xs font-bold text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 inline-block align-middle me-1" aria-hidden />{videoDur} {t.spVideoSecs}
                  </span>
                  <button onClick={() => { resetScan(); startScan(); }}
                    className="text-xs text-cyan-600 font-bold underline bg-transparent border-none cursor-pointer">
                    {t.spVideoReRecord}
                  </button>
                </div>
                {scanUrl && (
                  <video src={scanUrl} controls playsInline
                    className="w-full rounded-xl bg-black" style={{ maxHeight: 320 }} />
                )}
              </div>
            )}

            {scanError && <Err msg={scanError} />}
            <Err msg={err} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => goStep(1)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(3)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 3 ════════════ */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '3').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep3Title}</h2>
            <p className="text-sm text-gray-400 mb-4">{t.spStep3Desc}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex gap-2">
              <Video className="w-4 h-4 flex-shrink-0" aria-hidden />
              <span>{t.spVideoHint}</span>
            </div>

            {!videoReady ? (
              <div className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-3 text-center">
                <Video className="w-9 h-9 text-gray-400" aria-hidden />
                <span className="text-sm font-bold text-gray-600">{t.spVideoRecord}</span>
                <button onClick={() => goStep(2)}
                  className="text-xs text-cyan-600 font-bold underline bg-transparent border-none cursor-pointer">
                  {t.wizardPrev}
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-green-100 border border-green-300 rounded-full px-3 py-1 text-xs font-bold text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 inline-block align-middle me-1" aria-hidden />{videoDur} {t.spVideoSecs}
                  </span>
                  <button onClick={() => { resetScan(); goStep(2); }}
                    className="text-xs text-cyan-600 font-bold underline bg-transparent border-none cursor-pointer">
                    {t.spVideoReRecord}
                  </button>
                </div>
                {scanUrl && (
                  <video src={scanUrl} controls playsInline
                    className="w-full rounded-xl bg-black" style={{ maxHeight: 360 }} />
                )}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(2)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(4)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 4 ════════════ */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '4').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep4Title}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.spStep4Desc}</p>

            <div className="mb-5">
              <CargoVerification enabled={cargoEnabled} onToggle={setCargoEnabled}
                status={inspDone ? 'VERIFIED' : inspecting ? 'PENDING' : 'PENDING'} />
            </div>

            {inspecting && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin" />
                <span className="text-sm font-bold text-gray-500">{t.spInspecting}</span>
              </div>
            )}

            {!inspecting && scanError && (
              <div className="space-y-3 py-4">
                <Err msg={scanError} />
                <button onClick={runInspection}
                  className="ds-btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> {t.scanRetryAnalysis ?? 'Retry'}
                </button>
                <button onClick={() => goStep(2)} className="ds-btn-secondary w-full py-2.5">{t.wizardPrev}</button>
              </div>
            )}

            {!inspecting && !scanError && scanComplete && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t.spDetectedItem}</div>
                  <div className="text-lg font-extrabold text-gray-900 mb-2">
                    {detectedItem || <span className="text-base font-bold text-gray-500">{t.spCorrectItemName}</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                        confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      <ScanSearch className="w-3 h-3 inline-block align-middle me-1" aria-hidden />{t.spConfLabel} {confidence === 'high' ? t.spConfHigh : confidence === 'medium' ? t.spConfMedium : t.spConfLow}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${riskLevel === 'low' ? 'bg-green-50 text-green-700 border-green-200' :
                        riskLevel === 'review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      <ShieldAlert className="w-3 h-3 inline-block align-middle me-1" aria-hidden />{riskLevel === 'low' ? t.spRiskLow : riskLevel === 'review' ? t.spRiskReview : t.spRiskHigh}
                    </span>
                  </div>
                </div>

                {illegalBlocked && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700 font-bold">
                    <Ban className="w-4 h-4 inline-block align-middle me-1" aria-hidden /><strong>{t.spIllegalAlert}</strong>
                  </div>
                )}
                {cashFlagged && !illegalBlocked && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-700 font-bold">
                    <AlertTriangle className="w-4 h-4 inline-block align-middle me-1" aria-hidden /><strong>{t.spCashAlert}</strong>
                  </div>
                )}

                {inspChecks.length > 0 && (
                  <div className="space-y-2">
                    {inspChecks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                )}

                {!nameConfirmed ? (
                  <button onClick={() => setShowItemModal(true)}
                    className="w-full py-2.5 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-bold rounded-xl hover:bg-amber-100 transition-colors">
                    {t.spCorrectItemName}
                  </button>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                    {t.spItemNameConfirmed}
                  </div>
                )}

                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2">{t.spManualDimsTitle}</div>
                  {!dimsConfirmed ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        {([[t.spDimLength, dimL, setDimL],[t.spDimWidth, dimW, setDimW],[t.spDimHeight, dimH, setDimH]] as [string,string,(v:string)=>void][]).map(([l,v,s]) => (
                          <div key={l}>
                            <label className="ds-label text-[11px]">{l}</label>
                            <input type="number" className="ds-input text-sm" placeholder="cm" min="1" max="300"
                              value={v} onChange={e => s(e.target.value)} style={{ direction: 'ltr' }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={saveDims} className="ds-btn-primary w-full py-2.5">{t.spConfirmDims}</button>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                      {t.spDimsConfirmed}
                    </div>
                  )}
                </div>

                {inspDone && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                    <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-green-600" aria-hidden />
                    <div className="text-sm font-extrabold text-green-700">{t.spInspectionDone}</div>
                    <div className="text-xs text-gray-500 mt-1">{t.spInspectionDoneDesc}</div>
                  </div>
                )}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(3)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(5)} disabled={!inspDone || illegalBlocked}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 5 ════════════ */}
        {step === 5 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '5').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep5Title}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.spStep5Desc}</p>

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

            <div className="mt-6 pt-5 border-t border-gray-100">
              <SecuritySelector
                securityLevel={securityLevel}
                onSecurityLevel={setSecurityLevel}
                identityVerificationRequired={identityVerReq}
                cargoVerificationRequired={cargoVerReq}
                otpDeliveryRequired={otpDeliveryReq}
                deliveryPhotoRequired={deliveryPhotoReq}
                onIdentityVerification={setIdentityVerReq}
                onCargoVerification={setCargoVerReq}
                onOtpDelivery={setOtpDeliveryReq}
                onDeliveryPhoto={setDeliveryPhotoReq}
              />
            </div>

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(4)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(6)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 6 ════════════ */}
        {step === 6 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '6').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep6Title}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.spStep6Desc}</p>

            {highValue && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <Lock className="w-5 h-5 mb-1 text-amber-600" aria-hidden />
                <div className="text-sm font-extrabold text-amber-700 mb-1">{t.spHighValueTitle}</div>
                <div className="text-xs text-amber-600">{t.spHighValueDesc}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="ds-label">{t.spRecFirstName}</label>
                <input type="text" className="ds-input" placeholder={t.spRecFirstName} value={recFirst}
                  onChange={e => { setRecFirst(e.target.value); setErr(''); }} />
              </div>
              <div>
                <label className="ds-label">{t.spRecLastName}</label>
                <input type="text" className="ds-input" placeholder={t.spRecLastName} value={recLast}
                  onChange={e => { setRecLast(e.target.value); setErr(''); }} />
              </div>
            </div>
            <div className="mb-4">
              <label className="ds-label">{t.spRecPhone}</label>
              <PhoneField
                value={recPhone}
                onChange={v => { setRecPhone(v); setErr(''); }}
                defaultCountry={(isRTL ? 'IR' : 'CA') as Country}
                placeholder={t.phonePlaceholder}
              />
            </div>
            <div className="mb-4">
              <label className="ds-label">{t.spRecEmail}</label>
              <input
                type="email"
                className="ds-input"
                placeholder={t.spRecEmailPlaceholder}
                value={recEmail}
                onChange={e => { setRecEmail(e.target.value); setErr(''); }}
                style={{ direction: 'ltr' }}
              />
            </div>
            <div className="mb-4">
              <label className="ds-label">{t.spRecAddress}</label>
              <input type="text" className="ds-input" placeholder={t.spRecAddressPlaceholder} value={recAddress}
                onChange={e => { setRecAddress(e.target.value); setErr(''); }} />
            </div>

            {highValue && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t.spRecDocTitle}</div>
                <button
                  type="button"
                  onClick={() => setRecDocCamOpen(true)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-start transition-all
                    ${recDocCapture ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50 hover:border-cyan-400'}`}
                >
                  {recDocCapture
                    ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" aria-hidden />
                    : <IdCard className="w-6 h-6 text-gray-500 flex-shrink-0" aria-hidden />}
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-700">{t.spRecDocCapture}</div>
                    <div className="text-xs text-gray-500">{t.spRecDocSubtitle}</div>
                  </div>
                </button>
                {recDocCamOpen && (
                  <GuidedCapture
                    mode="document"
                    onBack={() => setRecDocCamOpen(false)}
                    onHome={() => setRecDocCamOpen(false)}
                    onComplete={() => { setRecDocCapture(true); setRecDocCamOpen(false); }}
                  />
                )}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => goStep(5)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(7)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 7 ════════════ */}
        {step === 7 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '7').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep7Title}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.spStep7Desc}</p>

            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.spDocTypeLabel}</div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DOC_TYPES.map(d => (
                <button key={d.key} onClick={() => selectDocType(d.key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all
                    ${docType === d.key ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <d.Icon className="w-6 h-6 text-gray-500 flex-shrink-0" aria-hidden />
                  <span className="text-sm font-bold text-gray-900">{d.name}</span>
                  <span className="text-[10px] text-gray-500">{d.req}</span>
                </button>
              ))}
            </div>

            {docType && (
              <div className="mb-5">
                <IdentityVerification enabled={idEnabled} onToggle={setIdEnabled}
                  status={docVerified ? 'VERIFIED' : 'PENDING'} />
              </div>
            )}

            {docType && !docVerified && !idVerifying && (
              <div className="space-y-3 mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex gap-2">
                  <Lightbulb className="w-4 h-4 flex-shrink-0" aria-hidden /><span>{t.spDocEdgeHint}</span>
                </div>
                {[
                  { key: 'front'  as const, Icon: FileText, label: t.spDocFrontLabel,  hint: t.spDocFrontHint,  camMode: 'document' as const },
                  ...(DOC_TYPES.find(d => d.key === docType)?.needBack
                    ? [{ key: 'back' as const, Icon: FileText, label: t.spDocBackLabel, hint: t.spDocFrontHint, camMode: 'document' as const }]
                    : []),
                  { key: 'selfie' as const, Icon: ScanFace, label: t.spDocSelfieLabel, hint: t.spDocSelfieHint, camMode: 'face'     as const },
                ].map(slot => (
                  <button key={slot.key}
                    type="button"
                    onClick={() => setDocCamSlot(slot.key)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-start transition-all
                      ${docCaptures[slot.key] ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-cyan-400'}`}>
                    {docCaptures[slot.key]
                      ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" aria-hidden />
                      : <slot.Icon className="w-6 h-6 text-gray-500 flex-shrink-0" aria-hidden />}
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-700">{slot.label}</div>
                      <div className="text-xs text-gray-500">{slot.hint}</div>
                    </div>
                  </button>
                ))}
                {docCamSlot && (
                  <GuidedCapture
                    mode={docCamSlot === 'selfie' ? 'face' : 'document'}
                    onBack={() => setDocCamSlot(null)}
                    onHome={() => setDocCamSlot(null)}
                    onComplete={() => { onDocCapture(docCamSlot); setDocCamSlot(null); }}
                  />
                )}
              </div>
            )}

            {idVerifying && (
              <div className="flex items-center justify-center gap-3 py-4 text-gray-500 text-sm">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                {t.spDocVerifying}
              </div>
            )}

            {idVerifyItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {idVerifyItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />{item}
                  </div>
                ))}
              </div>
            )}

            {docVerified && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-4">
                {t.spDocVerified}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(6)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => goStep(8)} disabled={!docVerified}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 8 ════════════ */}
        {step === 8 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '8').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep8Title}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.spStep8Desc}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {PAY_METHODS.map(m => (
                <button key={m.id} onClick={() => { setSelectedPay(m.id); setPayVerified(false); setPayVerifyItems([]); setErr(''); }}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 text-center transition-all
                    ${selectedPay === m.id ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <m.Icon className="w-6 h-6 text-gray-500 flex-shrink-0" aria-hidden />
                  <span className="text-xs font-bold text-gray-700">{m.label}</span>
                </button>
              ))}
            </div>

            {selectedPay && !payVerified && (
              <>
                <div className="mb-4">
                  <label className="ds-label">{t.spPayAccountName}</label>
                  <input type="text" className="ds-input" placeholder={t.spPayAccountPlaceholder}
                    value={payAccountName} onChange={e => { setPayAccountName(e.target.value); setErr(''); }} />
                </div>
                <button onClick={confirmPayment} disabled={payVerifying}
                  className="ds-btn-primary w-full py-3 mb-4 disabled:opacity-60">
                  {payVerifying
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{t.spPayVerifying}</span>
                    : t.spPayVerifyBtn}
                </button>
              </>
            )}

            {payVerifyItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {payVerifyItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />{item}
                  </div>
                ))}
              </div>
            )}

            {payVerified && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-2">
                  {t.spPayVerified}
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
                  {t.spPayNote}
                </div>
              </>
            )}

            {kycNotice}
            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(7)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={() => gate(publishOrder)} disabled={publishing || !payVerified || !kycVerified}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">
                {publishing
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{t.spPublishing}</span>
                  : t.spPublish}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Currency modal ──────────────────────────────────────────────────────── */}
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

      {/* ── Item correction modal ─────────────────────────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowItemModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[78vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-extrabold text-gray-900">{t.spCorrectItemModal}</span>
                <button onClick={() => setShowItemModal(false)} className="text-gray-500 leading-none" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
              </div>
              <input type="search" className="ds-input text-sm" placeholder={t.spItemSearch}
                value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
            </div>
            <div className="overflow-y-auto pb-6">
              {CARGO_ITEMS.map(cat => {
                const filtered = itemSearch
                  ? cat.items.filter(it => it.includes(itemSearch))
                  : cat.items;
                if (!filtered.length) return null;
                return (
                  <div key={cat.cat}>
                    <div className="px-5 pt-4 pb-1 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">{cat.cat}</div>
                    {filtered.map(item => (
                      <button key={item} onClick={() => selectItemName(item)}
                        className="w-full text-right px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-cyan-50 hover:text-cyan-700 transition-colors">
                        {item}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
