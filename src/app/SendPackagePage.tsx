import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Home, CheckCircle } from 'lucide-react';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { IdentityVerification, CargoVerification } from './VerificationModules';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { Store, genId, getLiveRate } from '../lib/store';
import SecuritySelector from './ProtectionSelector';
import { defaultSecurityLevel, type SecurityLevel } from './shipmentTypes';

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
  { code: 'USDT', flag: '💵',  rate: 1       },
  { code: 'USDC', flag: '🔵',  rate: 1       },
  { code: 'IRR',  flag: '🇮🇷', rate: null    },
] as const;
type CurrencyCode = typeof CURRENCIES[number]['code'];

const PAY_METHODS = [
  { id: 'debit',  icon: '💳',  label: 'Debit Card'     },
  { id: 'credit', icon: '💳',  label: 'Credit Card'    },
  { id: 'paypal', icon: '🅿️', label: 'PayPal'         },
  { id: 'wallet', icon: '📱',  label: 'Digital Wallet' },
  { id: 'usdt',   icon: '₮',   label: 'USDT'           },
  { id: 'usdc',   icon: '🔵',  label: 'USDC'           },
];

const CARGO_ITEMS_BASE = [
  { catKey: 'spCatElectronics', items: ['گوشی موبایل','لپ‌تاپ','تبلت','هدفون','اسپیکر','کامپیوتر','ساعت هوشمند','دوربین','قطعات الکترونیکی','شارژر و کابل','کنسول بازی','هارد اکسترنال'] },
  { catKey: 'spCatClothing',    items: ['لباس','کت و شلوار','کفش','کیف','عینک','کمربند','شال و روسری','لباس ورزشی','جواهرات'] },
  { catKey: 'spCatHealth',      items: ['دارو و مکمل','لوازم آرایشی و بهداشتی','عطر و ادکلن','ویتامین و مکمل غذایی','لوازم پزشکی'] },
  { catKey: 'spCatDocuments',   items: ['کتاب و مجله','مدارک و اسناد','اوراق رسمی','پاسپورت و ویزا','آلبوم عکس'] },
  { catKey: 'spCatFood',        items: ['مواد غذایی خشک','شیرینی و شکلات','چای و قهوه','آجیل و خشکبار','ادویه و چاشنی'] },
  { catKey: 'spCatGifts',       items: ['هدیه و سوغاتی','اسباب‌بازی','لوازم خانه','لوازم ورزشی','محصولات دیجیتال'] },
];

const PROHIBITED_KEYWORDS = [
  'مواد مخدر','هروئین','کوکائین','ماری‌جوانا','اپیوم','متامفتامین',
  'اسلحه','سلاح','گلوله','بمب','انفجار','مهمات',
  'heroin','cocaine','marijuana','weapon','gun','bomb','explosive','ammunition','drug',
];

const CASH_KEYWORDS = [
  'پول نقد','اسکناس','دلار نقدی','یورو نقد','cash','dollar bills','currency notes',
  'banknote','نقدی','ارز نقدی',
];

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
                ${done   ? 'bg-cyan-500 text-white'
                : active ? 'bg-cyan-600 text-white ring-4 ring-cyan-100'
                :          'bg-gray-100 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap hidden sm:block
                ${active ? 'text-cyan-600' : done ? 'text-cyan-500' : 'text-gray-400'}`}>
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
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; cargoType?: 'personal' | 'chapar'; onNavigate?: (page: string) => void; }

export default function SendPackagePage({ onHome, cargoType = 'personal', onNavigate }: Props) {
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
    { key: 'passport', icon: '🛂', name: t.docPassportName, req: t.docFrontSelfieReq,     needBack: false },
    { key: 'driver',   icon: '🪪', name: t.docDriverName,   req: t.docFrontBackSelfieReq, needBack: true  },
    { key: 'national', icon: '🆔', name: t.docNationalName, req: t.docFrontBackSelfieReq, needBack: true  },
  ];

  const { session } = useSession();

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
  const [recAddress,    setRecAddress]    = useState('');
  const [recDocCapture, setRecDocCapture] = useState(false);

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

  const [err, setErr] = useState('');

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
        if (photos.length < 4) return t.spErrNeedPhotos;
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
        if (!recPhone.trim())   return t.spErrNeedRecPhone;
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

  function runInspection() {
    setInspecting(true);
    setInspDone(false);
    setNameConfirmed(false);
    setDimsConfirmed(false);
    setInspChecks([]);
    setIllegalBlocked(false);
    setCashFlagged(false);
    setDimManual(false);

    const allItems = CARGO_ITEMS.flatMap(c => c.items);
    const item = allItems[Math.floor(Math.random() * allItems.length)];
    const confOpts: Array<'high'|'medium'|'low'> = ['high','high','medium','medium','low'];
    const riskOpts: Array<'low'|'review'|'high'>  = ['low','low','low','review','high'];
    const conf = confOpts[Math.floor(Math.random() * confOpts.length)];
    const risk = riskOpts[Math.floor(Math.random() * riskOpts.length)];
    const l = rnd(20, 50), w = rnd(15, 40), h = rnd(10, 30);

    setTimeout(() => {
      setInspecting(false);
      setDetectedItem(item);
      setDetectedCat(item);
      setConfidence(conf);
      setRiskLevel(risk);
      setDims({ l, w, h });

      const confLabels = { high: `${t.spConfLabel} ${t.spConfHigh}`, medium: `${t.spConfLabel} ${t.spConfMedium}`, low: `${t.spConfLabel} ${t.spConfLow}` };
      const riskLabels = { low: t.spRiskLow, review: t.spRiskReview, high: t.spRiskHigh };
      const checkTexts = [
        t.spCheckMediaMatch,
        `${t.spFraudRiskLabel} ${riskLabels[risk]}${risk === 'low' ? ' ✅' : ' ⚠️'}`,
        confLabels[conf],
      ];
      checkTexts.forEach((txt, i) => {
        setTimeout(() => setInspChecks(prev => [...prev, txt]), i * 200 + 80);
      });

      const lower = item.toLowerCase();
      const isProhibited = PROHIBITED_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
      const isCash = CASH_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
      if (isProhibited) setIllegalBlocked(true);
      if (isCash && !isProhibited) setCashFlagged(true);
    }, 2500);
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
    setIllegalBlocked(PROHIBITED_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())));
    setCashFlagged(CASH_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())));
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
      recAddress:           recAddress.trim(),
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

  // ── Step 9 — Success ──────────────────────────────────────────────────────
  if (step === 9 && trackId) {
    return (
      <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
        <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{t.spSuccessTitle}</h2>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl px-4 py-2 mb-4">
              <span>⏳</span><span>{t.spSuccessPending}</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{t.spSuccessDesc}</p>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-6">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">{t.spTrackingCode}</div>
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{trackId}</div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                 className="ds-btn-primary py-3 w-full"
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
      <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ════════════ STEP 1 ════════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '1').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spPill1}</h2>
            <p className="text-sm text-gray-400 mb-6">{t.spOrigin}, {t.spDest}</p>

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
                      ✈️ {t.spMatchReady.replace('{n}', String(showAllTrips ? matchData.all : matchData.forDate))}
                    </div>
                    <p className="text-xs text-blue-500 mb-3">{t.spMatchTravelersReady}</p>
                    <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                       className="text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0">
                      {t.spMatchViewTravelers}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">{t.spMatchNoTravelers}</p>
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '2').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep2Title}</h2>
            <p className="text-sm text-gray-400 mb-4">{t.spStep2Desc}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex gap-2">
              <span>📋</span>
              <span>{t.spPhotoHint}</span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">{t.spPhotoProgress.replace('{n}', String(photos.length))}</span>
              <span className="bg-gray-100 rounded-full px-3 py-1 text-xs font-bold text-cyan-600">{t.spPhotoCount.replace('{n}', String(photos.length))}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {([
                { key: 'jolo'  as const, label: t.spShotFront, ref: jRef },
                { key: 'posht' as const, label: t.spShotBack,  ref: pRef },
                { key: 'chap'  as const, label: t.spShotLeft,  ref: cRef },
                { key: 'rast'  as const, label: t.spShotRight, ref: rRef },
              ]).map(btn => (
                <button key={btn.key} type="button"
                  onClick={() => btn.ref.current?.click()}
                  className={`relative flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-sm font-bold transition-all
                    ${shots[btn.key]
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                  <span className="text-xl">{shots[btn.key] ? '✅' : '📷'}</span>
                  <span>{btn.label}</span>
                  <input ref={btn.ref} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) addPhoto(f, btn.key); e.target.value = ''; }} />
                </button>
              ))}
            </div>

            <button type="button" onClick={() => exRef.current?.click()}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500
                border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
              {t.spPhotoAdd}
              <input ref={exRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = ''; }} />
            </button>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {photos.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

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
              <span>🎥</span>
              <span>{t.spVideoHint}</span>
            </div>

            {!videoReady ? (
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-3 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all">
                <span className="text-4xl">🎥</span>
                <span className="text-sm font-bold text-gray-600">{t.spVideoRecord}</span>
                <span className="text-xs text-gray-400">{t.spVideoClickToRecord}</span>
                <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden"
                  onChange={onVideoFile} />
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-green-100 border border-green-300 rounded-full px-3 py-1 text-xs font-bold text-green-700">
                    ✅ {videoDur} {t.spVideoSecs}
                  </span>
                  <button onClick={() => { setVideoReady(false); setVideoDur(0); }}
                    className="text-xs text-cyan-600 font-bold underline bg-transparent border-none cursor-pointer">
                    {t.spVideoReRecord}
                  </button>
                </div>
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

            {!inspecting && detectedItem && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t.spDetectedItem}</div>
                  <div className="text-lg font-extrabold text-gray-900 mb-2">{detectedItem}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                        confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      🔍 {t.spConfLabel} {confidence === 'high' ? t.spConfHigh : confidence === 'medium' ? t.spConfMedium : t.spConfLow}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${riskLevel === 'low' ? 'bg-green-50 text-green-700 border-green-200' :
                        riskLevel === 'review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      🛡️ {riskLevel === 'low' ? t.spRiskLow : riskLevel === 'review' ? t.spRiskReview : t.spRiskHigh}
                    </span>
                  </div>
                </div>

                {illegalBlocked && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700 font-bold">
                    🚫 <strong>{t.spIllegalAlert}</strong>
                  </div>
                )}
                {cashFlagged && !illegalBlocked && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-700 font-bold">
                    ⚠️ <strong>{t.spCashAlert}</strong>
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
                  <div className="flex gap-3">
                    <button onClick={confirmName}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors">
                      {t.spConfirmItemName}
                    </button>
                    <button onClick={() => setShowItemModal(true)}
                      className="flex-1 py-2.5 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-bold rounded-xl hover:bg-amber-100 transition-colors">
                      {t.spCorrectItemName}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                    {t.spItemNameConfirmed}
                  </div>
                )}

                {dims && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2">{t.spDimsEstimated}</div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {([[t.spDimLength, dims.l],[t.spDimWidth, dims.w],[t.spDimHeight, dims.h]] as [string, number][]).map(([lbl, val]) => (
                        <div key={lbl} className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
                          <div className="text-base font-extrabold text-cyan-600">{val}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{lbl} (cm)</div>
                        </div>
                      ))}
                    </div>

                    {!dimsConfirmed && !dimManual && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="text-sm font-bold text-gray-700 mb-3">{t.spDimsCorrect}</div>
                        <div className="flex gap-3">
                          <button onClick={confirmDims}
                            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl transition-colors">
                            {t.spConfirmDims}
                          </button>
                          <button onClick={() => setDimManual(true)}
                            className="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors">
                            {t.spManualDims}
                          </button>
                        </div>
                      </div>
                    )}

                    {dimManual && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-500 mb-1">{t.spManualDimsTitle}</div>
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
                    )}

                    {dimsConfirmed && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                        {t.spDimsConfirmed}
                      </div>
                    )}
                  </div>
                )}

                {inspDone && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                    <div className="text-2xl mb-2">✅</div>
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '5').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep5Title}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.spStep5Desc}</p>

            <div className="mb-4">
              <label className="ds-label">{t.spCurrency}</label>
              <button type="button" onClick={() => setShowCurrModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-cyan-400 transition-colors bg-white">
                <span className="text-xl">{currObj.flag}</span>
                <span className="text-base font-extrabold text-cyan-600">{currObj.code}</span>
                <span className="text-sm text-gray-500 flex-1 text-right">{CURR_LABELS[currObj.code] ?? currObj.code}</span>
                <span className="text-gray-400 text-sm">▼</span>
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
                <div className="text-xs text-gray-400 mt-1">
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '6').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep6Title}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.spStep6Desc}</p>

            {highValue && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <div className="text-xl mb-1">🔒</div>
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
              <input type="tel" className="ds-input" placeholder="+1 416..." value={recPhone}
                onChange={e => { setRecPhone(e.target.value); setErr(''); }} style={{ direction: 'ltr' }} />
            </div>
            <div className="mb-4">
              <label className="ds-label">{t.spRecAddress}</label>
              <input type="text" className="ds-input" placeholder={t.spRecAddressPlaceholder} value={recAddress}
                onChange={e => { setRecAddress(e.target.value); setErr(''); }} />
            </div>

            {highValue && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t.spRecDocTitle}</div>
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${recDocCapture ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50 hover:border-cyan-400'}`}>
                  <span className="text-2xl">{recDocCapture ? '✅' : '🪪'}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-700">{t.spRecDocCapture}</div>
                    <div className="text-xs text-gray-400">{t.spRecDocSubtitle}</div>
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setRecDocCapture(true); }} />
                </label>
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '7').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep7Title}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.spStep7Desc}</p>

            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.spDocTypeLabel}</div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DOC_TYPES.map(d => (
                <button key={d.key} onClick={() => selectDocType(d.key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all
                    ${docType === d.key ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-2xl">{d.icon}</span>
                  <span className="text-sm font-bold text-gray-900">{d.name}</span>
                  <span className="text-[10px] text-gray-400">{d.req}</span>
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
                  <span>💡</span><span>{t.spDocEdgeHint}</span>
                </div>
                {[
                  { key: 'front' as const, icon: '📄', label: t.spDocFrontLabel, hint: t.spDocFrontHint, capture: 'environment' as const },
                  ...(DOC_TYPES.find(d => d.key === docType)?.needBack
                    ? [{ key: 'back' as const, icon: '📄', label: t.spDocBackLabel, hint: t.spDocFrontHint, capture: 'environment' as const }]
                    : []),
                  { key: 'selfie' as const, icon: '🤳', label: t.spDocSelfieLabel, hint: t.spDocSelfieHint, capture: 'user' as const },
                ].map(slot => (
                  <label key={slot.key}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${docCaptures[slot.key] ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-cyan-400'}`}>
                    <span className="text-2xl">{docCaptures[slot.key] ? '✅' : slot.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-700">{slot.label}</div>
                      <div className="text-xs text-gray-400">{slot.hint}</div>
                    </div>
                    <input type="file" accept="image/*" capture={slot.capture} className="hidden"
                      onChange={e => { if (e.target.files?.[0]) onDocCapture(slot.key); }} />
                  </label>
                ))}
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '8').replace('{m}', '8')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{t.spStep8Title}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.spStep8Desc}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {PAY_METHODS.map(m => (
                <button key={m.id} onClick={() => { setSelectedPay(m.id); setPayVerified(false); setPayVerifyItems([]); setErr(''); }}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 text-center transition-all
                    ${selectedPay === m.id ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-2xl">{m.icon}</span>
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

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(7)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.wizardPrev}</button>
              <button onClick={publishOrder} disabled={publishing || !payVerified}
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
              <button onClick={() => setShowCurrModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="pb-6">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurr(c.code as CurrencyCode); setShowCurrModal(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors
                    ${selectedCurr === c.code ? 'bg-cyan-50' : ''}`}>
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-sm font-extrabold text-cyan-600 w-14 text-left">{c.code}</span>
                  <span className="flex-1 text-sm font-bold text-gray-700 text-right">{CURR_LABELS[c.code] ?? c.code}</span>
                  {selectedCurr === c.code && <CheckCircle className="w-4 h-4 text-cyan-500 flex-shrink-0" />}
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
                <button onClick={() => setShowItemModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
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
                    <div className="px-5 pt-4 pb-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{cat.cat}</div>
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
