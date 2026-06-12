import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Home, CheckCircle } from 'lucide-react';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { IdentityVerification, CargoVerification } from './VerificationModules';
import { useSession } from '../lib/SessionContext';
import { Store, genId, getLiveRate } from '../lib/store';
import SecuritySelector from './ProtectionSelector';
import { defaultSecurityLevel, type SecurityLevel } from './shipmentTypes';

// ── Constants (exact from cargo.html) ─────────────────────────────────────────

const PILL_LABELS = ['مسیر', 'کالا', 'ویدیو', 'بررسی', 'ارزش', 'گیرنده', 'سند', 'پرداخت'];

const CURRENCIES = [
  { code: 'USD',  flag: '🇺🇸', label: 'دلار آمریکا',     rate: 1       },
  { code: 'EUR',  flag: '🇪🇺', label: 'یورو',             rate: 1.09    },
  { code: 'CAD',  flag: '🇨🇦', label: 'دلار کانادا',      rate: 0.74    },
  { code: 'GBP',  flag: '🇬🇧', label: 'پوند انگلیس',      rate: 1.27    },
  { code: 'AED',  flag: '🇦🇪', label: 'درهم امارات',      rate: 0.272   },
  { code: 'TRY',  flag: '🇹🇷', label: 'لیر ترکیه',        rate: 0.031   },
  { code: 'SAR',  flag: '🇸🇦', label: 'ریال عربستان',     rate: 0.267   },
  { code: 'QAR',  flag: '🇶🇦', label: 'ریال قطر',         rate: 0.274   },
  { code: 'IQD',  flag: '🇮🇶', label: 'دینار عراق',       rate: 0.00076 },
  { code: 'CNY',  flag: '🇨🇳', label: 'یوان چین',         rate: 0.138   },
  { code: 'INR',  flag: '🇮🇳', label: 'روپیه هند',        rate: 0.012   },
  { code: 'AMD',  flag: '🇦🇲', label: 'درام ارمنستان',    rate: 0.0026  },
  { code: 'AZN',  flag: '🇦🇿', label: 'منات آذربایجان',   rate: 0.588   },
  { code: 'USDT', flag: '💵', label: 'تتر (برابر دلار)',  rate: 1       },
  { code: 'USDC', flag: '🔵', label: 'یو‌اس‌دی کوین',    rate: 1       },
  { code: 'IRR',  flag: '🇮🇷', label: 'ریال ایران',       rate: null    },
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

const CARGO_ITEMS = [
  { cat: 'الکترونیک',      items: ['گوشی موبایل','لپ‌تاپ','تبلت','هدفون','اسپیکر','کامپیوتر','ساعت هوشمند','دوربین','قطعات الکترونیکی','شارژر و کابل','کنسول بازی','هارد اکسترنال'] },
  { cat: 'پوشاک و کیف',    items: ['لباس','کت و شلوار','کفش','کیف','عینک','کمربند','شال و روسری','لباس ورزشی','جواهرات'] },
  { cat: 'دارو و بهداشت',  items: ['دارو و مکمل','لوازم آرایشی و بهداشتی','عطر و ادکلن','ویتامین و مکمل غذایی','لوازم پزشکی'] },
  { cat: 'مدارک و کتاب',   items: ['کتاب و مجله','مدارک و اسناد','اوراق رسمی','پاسپورت و ویزا','آلبوم عکس'] },
  { cat: 'خوراکی',          items: ['مواد غذایی خشک','شیرینی و شکلات','چای و قهوه','آجیل و خشکبار','ادویه و چاشنی'] },
  { cat: 'هدیه و متفرقه',  items: ['هدیه و سوغاتی','اسباب‌بازی','لوازم خانه','لوازم ورزشی','محصولات دیجیتال'] },
];

const DOC_TYPES = [
  { key: 'passport', icon: '🛂', name: 'پاسپورت',   req: 'جلو + سلفی',        needBack: false },
  { key: 'driver',   icon: '🪪', name: 'گواهینامه', req: 'جلو + پشت + سلفی', needBack: true  },
  { key: 'national', icon: '🆔', name: 'کارت ملی',  req: 'جلو + پشت + سلفی', needBack: true  },
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
  return (
    <div className="ds-page-header px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-10 flex-wrap">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>بازگشت</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>صفحه اصلی</span>
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

// ── Draft shape (mirrors cargo.html saveDraft) ────────────────────────────────
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
  const pageTitle = cargoType === 'chapar' ? 'خرید توسط چاپار' : 'ثبت سفارش کالا';
  const pageDesc  = cargoType === 'chapar' ? 'خرید و ارسال کالا از طریق چاپار' : 'ارسال کالا از طریق مسافر تأیید‌شده';

  const { session } = useSession();

  // Step
  const [step, setStep] = useState(1);

  // Step 1
  const [origin, setOrigin] = useState<AirportOption | null>(null);
  const [dest,   setDest]   = useState<AirportOption | null>(null);
  const [date,   setDate]   = useState('');
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Step 2 — photos
  const [photos, setPhotos]           = useState<string[]>([]);
  const [shots, setShots]             = useState({ jolo: false, posht: false, chap: false, rast: false });
  const jRef  = useRef<HTMLInputElement>(null);
  const pRef  = useRef<HTMLInputElement>(null);
  const cRef  = useRef<HTMLInputElement>(null);
  const rRef  = useRef<HTMLInputElement>(null);
  const exRef = useRef<HTMLInputElement>(null);

  // Step 3 — video
  const [videoReady, setVideoReady] = useState(false);
  const [videoDur,   setVideoDur]   = useState(0);
  const videoRef = useRef<HTMLInputElement>(null);

  // Step 4 — inspection
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

  // Step 5 — value
  const [selectedCurr,   setSelectedCurr]   = useState<CurrencyCode>('USD');
  const [valueAmount,    setValueAmount]    = useState('');
  const [showCurrModal,  setShowCurrModal]  = useState(false);

  // Step 6 — receiver
  const [recFirst,      setRecFirst]      = useState('');
  const [recLast,       setRecLast]       = useState('');
  const [recPhone,      setRecPhone]      = useState('');
  const [recAddress,    setRecAddress]    = useState('');
  const [recDocCapture, setRecDocCapture] = useState(false);

  // Step 7 — identity
  const [docType,       setDocType]       = useState<string|null>(null);
  const [docCaptures,   setDocCaptures]   = useState({ front: false, back: false, selfie: false });
  const [idEnabled,     setIdEnabled]     = useState(true);
  const [idVerifying,   setIdVerifying]   = useState(false);
  const [idVerifyItems, setIdVerifyItems] = useState<string[]>([]);
  const [docVerified,   setDocVerified]   = useState(false);

  // Step 8 — payment
  const [selectedPay,    setSelectedPay]    = useState<string|null>(null);
  const [payAccountName, setPayAccountName] = useState('');
  const [payVerifying,   setPayVerifying]   = useState(false);
  const [payVerified,    setPayVerified]    = useState(false);
  const [payVerifyItems, setPayVerifyItems] = useState<string[]>([]);

  // Security settings (step 5)
  const [securityLevel,       setSecurityLevel]       = useState<SecurityLevel>('GUARANTEED');
  const [identityVerReq,      setIdentityVerReq]      = useState(false);
  const [cargoVerReq,         setCargoVerReq]         = useState(false);
  const [otpDeliveryReq,      setOtpDeliveryReq]      = useState(false);
  const [deliveryPhotoReq,    setDeliveryPhotoReq]    = useState(false);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [trackId,    setTrackId]    = useState<string|null>(null);

  // Errors
  const [err, setErr] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── Write cargo_type to store on mount ────────────────────────────────────
  useEffect(() => {
    Store.set('cargo_type', cargoType);
  }, [cargoType]);

  // ── Pre-fill from session ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const full = [session.firstName, session.lastName].filter(Boolean).join(' ').trim();
    if (full) setPayAccountName(full);
  }, [session?.userId]);

  // ── Restore draft ─────────────────────────────────────────────────────────
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

  // ── Save draft ────────────────────────────────────────────────────────────
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

  // Apply smart security default when detected category changes
  useEffect(() => {
    if (detectedCat) setSecurityLevel(defaultSecurityLevel(detectedCat));
  }, [detectedCat]);

  // ── Smart match box (reads cp_trips) ─────────────────────────────────────
  const matchData = useMemo(() => {
    if (!origin || !dest) return null;
    const trips = Store.get<Array<{origin:string;destination?:string;dest?:string;date?:string;status:string}>>('trips') ?? [];
    const all = trips.filter(t =>
      t.origin === origin.iata &&
      (t.destination === dest.iata || t.dest === dest.iata) &&
      t.status !== 'cancelled'
    );
    const forDate = date ? all.filter(t => !t.date || t.date === date) : all;
    return { all: all.length, forDate: forDate.length };
  }, [origin, dest, date]);

  // ── Value in USD ─────────────────────────────────────────────────────────
  const getValueUSD = useCallback(() => {
    const amt = parseFloat(valueAmount) || 0;
    const curr = CURRENCIES.find(c => c.code === selectedCurr);
    if (!curr) return amt;
    if (curr.code === 'IRR') return amt / getLiveRate();
    return amt * (curr.rate ?? 1);
  }, [valueAmount, selectedCurr]);

  const highValue = getValueUSD() > 500;

  // ── Validations (mirrors cargo.html validateStep) ────────────────────────
  function validate(n: number): string | null {
    switch (n) {
      case 1:
        if (!origin) return 'برای ادامه باید مبدا را انتخاب کنید.';
        if (!dest)   return 'برای ادامه باید مقصد را انتخاب کنید.';
        if (!date)   return 'برای ادامه باید تاریخ ارسال را انتخاب کنید.';
        return null;
      case 2:
        if (photos.length < 4) return 'برای ادامه باید حداقل ۴ عکس از کالا بگیرید.';
        return null;
      case 3:
        if (!videoReady) return 'برای ادامه باید ویدیوی کالا را ضبط کنید (حداقل ۱۰ ثانیه).';
        return null;
      case 4:
        if (!nameConfirmed) return 'برای ادامه باید نام کالا را تأیید یا اصلاح کنید.';
        if (!dimsConfirmed) return 'برای ادامه باید ابعاد کالا را تأیید یا اصلاح کنید.';
        return null;
      case 5: {
        const v = parseFloat(valueAmount);
        if (!v || v <= 0) return 'برای ادامه باید ارزش کالا را وارد کنید.';
        return null;
      }
      case 6:
        if (!recFirst.trim())   return 'برای ادامه باید نام گیرنده را وارد کنید.';
        if (!recLast.trim())    return 'برای ادامه باید نام خانوادگی گیرنده را وارد کنید.';
        if (!recPhone.trim())   return 'برای ادامه باید تلفن گیرنده را وارد کنید.';
        if (!recAddress.trim()) return 'برای ادامه باید شهر/منطقه تحویل را وارد کنید.';
        if (highValue && !recDocCapture) return 'به دلیل ارزش بالای کالا، تصویر مدرک هویتی گیرنده لازم است.';
        return null;
      case 7:
        if (!docVerified) return 'برای ادامه باید احراز هویت را کامل کنید.';
        return null;
      case 8:
        if (!payVerified) return 'برای ادامه باید تأیید حساب را کامل کنید.';
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

  // ── Step 2 — photo helpers ────────────────────────────────────────────────
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

  // ── Step 3 — video ────────────────────────────────────────────────────────
  function onVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const dur = vid.duration;
      if (dur < 10) { setErr('ویدیو باید حداقل ۱۰ ثانیه باشد'); return; }
      setVideoReady(true);
      setVideoDur(Math.round(dur));
    };
    vid.src = url;
    if (e.target) e.target.value = '';
  }

  // ── Step 4 — inspection (mirrors cargo.html runInspection) ───────────────
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

      const confLabels = { high: 'سطح اطمینان: بالا', medium: 'سطح اطمینان: متوسط', low: 'سطح اطمینان: پایین' };
      const riskLabels = { low: 'کم‌ریسک', review: 'نیازمند بررسی', high: 'پرریسک' };
      const checkTexts = [
        'تطابق کالا با محتوای رسانه: ✅ تأیید شد',
        'ریسک تقلب: ' + riskLabels[risk] + (risk === 'low' ? ' ✅' : ' ⚠️'),
        'سطح اطمینان: ' + confLabels[conf].replace('سطح اطمینان: ', ''),
      ];
      checkTexts.forEach((txt, i) => {
        setTimeout(() => setInspChecks(prev => [...prev, txt]), i * 200 + 80);
      });

      // HR-12/13: safety check
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
    // re-check safety
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
    if (!l || !w || !h || l <= 0 || w <= 0 || h <= 0) { setErr('طول، عرض و ارتفاع را به درستی وارد کنید'); return; }
    setDims({ l, w, h });
    setDimsConfirmed(true);
    setDimManual(false);
    checkInspDone(nameConfirmed, true);
  }

  // ── Step 7 — doc verification ─────────────────────────────────────────────
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
    const checks = ['تطابق چهره با مدرک: ✅','اعتبار سند: ✅','تطابق نوع سند: ✅','تطابق کشور/زبان: ✅','ریسک جعلی بودن: پایین ✅'];
    setTimeout(() => {
      setIdVerifying(false);
      checks.forEach((c, i) => {
        setTimeout(() => setIdVerifyItems(prev => [...prev, c]), i * 180 + 60);
      });
      setTimeout(() => setDocVerified(true), checks.length * 180 + 200);
    }, 2000);
  }

  // ── Step 8 — payment ──────────────────────────────────────────────────────
  function confirmPayment() {
    if (!payAccountName.trim()) { setErr('نام صاحب حساب را وارد کنید.'); return; }
    setErr('');
    setPayVerifying(true);
    const items = ['نام با هویت تأیید‌شده تطابق دارد: ✅', 'روش پرداخت تأیید شد: ✅'];
    setTimeout(() => {
      setPayVerifying(false);
      items.forEach((txt, i) => {
        setTimeout(() => setPayVerifyItems(prev => [...prev, txt]), i * 200 + 60);
      });
      setTimeout(() => setPayVerified(true), items.length * 200 + 200);
    }, 1500);
  }

  // ── Publish (mirrors cargo.html publishOrder) ─────────────────────────────
  async function publishOrder() {
    if (!session) { setErr('برای ثبت سفارش ابتدا باید ورود کنید.'); return; }
    if (illegalBlocked) { setErr('🚫 انتشار آگهی به دلیل شناسایی کالای ممنوعه مسدود است.'); return; }
    if (!docVerified || !payVerified) { setErr('🔐 برای انتشار ابتدا باید احراز هویت و تأیید حساب را کامل کنید.'); return; }
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

    // Write to cp_history (mirrors cargo.html publishOrder)
    const hist = Store.get<typeof order[]>('history') ?? [];
    hist.unshift(order);
    Store.set('history', hist);

    // ── POST /api/approvals/create — listing goes PENDING until admin approves
    try {
      await fetch('/api/approvals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cargo_listing', refId: order.trackId, payload: order }),
      });
    } catch { /* non-fatal */ }

    // Mark KYC in users + session
    const users = Store.get<Array<Record<string,unknown>>>('users') ?? [];
    const idx = users.findIndex(u => u.userId === session.userId);
    if (idx !== -1) { users[idx].kycVerified = true; Store.set('users', users); }

    // Clear draft
    Store.del('cargo_draft');
    Store.del('cargo_trip');
    Store.del('cargo_type');

    setTrackId(order.trackId);
    setPublishing(false);
    setStep(9);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">ورود لازم است</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">برای ثبت سفارش باید ابتدا ثبت‌نام یا ورود انجام دهید.</p>
          <button onClick={onHome} className="ds-btn-primary w-full py-3">ورود / ثبت‌نام</button>
          <button onClick={onHome} className="mt-3 text-sm text-gray-400 hover:text-gray-600 underline block w-full">
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  // ── Step 9 — Success ──────────────────────────────────────────────────────
  if (step === 9 && trackId) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">سفارش ثبت شد!</h2>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl px-4 py-2 mb-4">
              <span>⏳</span><span>در انتظار تأیید ادمین</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              سفارش شما ثبت شد و پس از بررسی و تأیید توسط تیم چاپار در مارکت‌پلیس نمایش داده می‌شود.
            </p>
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-6">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">کد پیگیری</div>
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{trackId}</div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                 className="ds-btn-primary py-3 w-full"
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
                مشاهده مسافران مناسب این مسیر ✈️
              </button>
              <a href={`/track?id=${trackId}`}
                 className="ds-btn-secondary py-2.5 no-underline"
                 style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                پیگیری سفارش
              </a>
              <button onClick={onHome} className="ds-btn-secondary py-2.5">بازگشت به خانه</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  const currObj = CURRENCIES.find(c => c.code === selectedCurr) ?? CURRENCIES[0];
  const valueUSD = getValueUSD();

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <PageHeader onHome={onHome} title={pageTitle} desc={pageDesc} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ════════════ STEP 1 — مسیر ════════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۱ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">مسیر ارسال</h2>
            <p className="text-sm text-gray-400 mb-6">مبدا، مقصد و تاریخ ارسال را انتخاب کنید</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <AirportCityAutocomplete label="مبدا" value={origin} onChange={v => { setOrigin(v); setErr(''); }} placeholder="تهران، استانبول..." />
              <AirportCityAutocomplete label="مقصد" value={dest}   onChange={v => { setDest(v);   setErr(''); }} placeholder="تورنتو، لندن..." />
            </div>
            <div className="mb-5">
              <label className="ds-label">تاریخ ارسال</label>
              <input type="date" className="ds-input" min={today} value={date}
                onChange={e => { setDate(e.target.value); setErr(''); setShowAllTrips(false); }} />
            </div>

            {/* Smart match box (reads cp_trips) */}
            {matchData !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                {(showAllTrips ? matchData.all : matchData.forDate) > 0 ? (
                  <>
                    <div className="text-sm font-bold text-blue-700 mb-1">
                      ✈️ <strong>{showAllTrips ? matchData.all : matchData.forDate} مسافر</strong> برای این مسیر آماده حمل هستند
                    </div>
                    <p className="text-xs text-blue-500 mb-3">مسافران تأیید‌شده که آمادگی حمل کالا دارند</p>
                    <button onClick={() => onNavigate ? onNavigate('marketplace') : window.location.href = '/'}
                       className="text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0">
                      مشاهده مسافران مناسب این مسیر →
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">هنوز مسافری برای این مسیر ثبت نشده. پس از ثبت سفارش اطلاع داده می‌شود.</p>
                )}
                {date && (
                  <button onClick={() => setShowAllTrips(m => !m)}
                    className="mt-2 text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0 block">
                    {showAllTrips ? 'نمایش فقط تاریخ انتخابی' : `نمایش همه تاریخ‌ها (${matchData.all})`}
                  </button>
                )}
              </div>
            )}

            <Err msg={err} />
            <button onClick={() => goStep(2)} className="ds-btn-primary w-full mt-4 py-3">ادامه ←</button>
          </motion.div>
        )}

        {/* ════════════ STEP 2 — عکاسی ════════════ */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۲ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">عکاسی از کالا</h2>
            <p className="text-sm text-gray-400 mb-4">حداقل ۴ عکس از زوایای مختلف بگیرید</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex gap-2">
              <span>📋</span>
              <span>از جلو، پشت، چپ، راست و زاویه بالا عکس بگیرید</span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">{photos.length} از ۴ عکس گرفته شده</span>
              <span className="bg-gray-100 rounded-full px-3 py-1 text-xs font-bold text-cyan-600">{photos.length} عکس</span>
            </div>

            {/* 4 main shot buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {([
                { key: 'jolo'  as const, label: 'جلو',  ref: jRef },
                { key: 'posht' as const, label: 'پشت',  ref: pRef },
                { key: 'chap'  as const, label: 'چپ',   ref: cRef },
                { key: 'rast'  as const, label: 'راست', ref: rRef },
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

            {/* Extra photo */}
            <button type="button" onClick={() => exRef.current?.click()}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500
                border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
              ➕ عکس اضافه
              <input ref={exRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = ''; }} />
            </button>

            {/* Photo thumbnails */}
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
              <button onClick={() => goStep(1)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(3)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 3 — ویدیو ════════════ */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۳ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">ویدیو کالا</h2>
            <p className="text-sm text-gray-400 mb-4">حداقل ۱۰ ثانیه ویدیو از کالا ضبط کنید</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 flex gap-2">
              <span>🎥</span>
              <span>از همه اطراف کالا فیلم بگیرید — حداقل ۱۰ ثانیه</span>
            </div>

            {!videoReady ? (
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-3 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all">
                <span className="text-4xl">🎥</span>
                <span className="text-sm font-bold text-gray-600">ضبط ویدیو</span>
                <span className="text-xs text-gray-400">برای ضبط کلیک کنید</span>
                <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden"
                  onChange={onVideoFile} />
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-green-100 border border-green-300 rounded-full px-3 py-1 text-xs font-bold text-green-700">
                    ✅ {videoDur} ثانیه ضبط شد
                  </span>
                  <button onClick={() => { setVideoReady(false); setVideoDur(0); }}
                    className="text-xs text-cyan-600 font-bold underline bg-transparent border-none cursor-pointer">
                    ضبط مجدد
                  </button>
                </div>
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(2)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(4)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 4 — بررسی کالا ════════════ */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۴ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">بررسی کالا</h2>
            <p className="text-sm text-gray-400 mb-5">سیستم کالای شما را بررسی می‌کند</p>

            {/* CargoVerification reused for status display */}
            <div className="mb-5">
              <CargoVerification enabled={cargoEnabled} onToggle={setCargoEnabled}
                status={inspDone ? 'VERIFIED' : inspecting ? 'PENDING' : 'PENDING'} />
            </div>

            {inspecting && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin" />
                <span className="text-sm font-bold text-gray-500">در حال بررسی کالا...</span>
              </div>
            )}

            {!inspecting && detectedItem && (
              <div className="space-y-4">
                {/* Detected item card */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">کالای تشخیص‌داده‌شده</div>
                  <div className="text-lg font-extrabold text-gray-900 mb-2">{detectedItem}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                        confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      🔍 سطح اطمینان: {confidence === 'high' ? 'بالا' : confidence === 'medium' ? 'متوسط' : 'پایین'}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                      ${riskLevel === 'low' ? 'bg-green-50 text-green-700 border-green-200' :
                        riskLevel === 'review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'}`}>
                      🛡️ {riskLevel === 'low' ? 'کم‌ریسک' : riskLevel === 'review' ? 'نیازمند بررسی' : 'پرریسک'}
                    </span>
                  </div>
                </div>

                {/* HR-12 illegal item alert */}
                {illegalBlocked && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700 font-bold">
                    🚫 <strong>کالای ممنوعه شناسایی شد</strong> — این نوع کالا قابل ارسال نیست.
                  </div>
                )}
                {cashFlagged && !illegalBlocked && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-700 font-bold">
                    ⚠️ <strong>حمل پول نقد</strong> — نیاز به تأیید ادمین دارد.
                  </div>
                )}

                {/* Check items */}
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

                {/* Name confirm/correct */}
                {!nameConfirmed ? (
                  <div className="flex gap-3">
                    <button onClick={confirmName}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors">
                      ✅ تایید نام کالا
                    </button>
                    <button onClick={() => setShowItemModal(true)}
                      className="flex-1 py-2.5 bg-amber-50 border border-amber-300 text-amber-700 text-sm font-bold rounded-xl hover:bg-amber-100 transition-colors">
                      ✏️ اصلاح نام کالا
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                    ✅ نام کالا تأیید شد
                  </div>
                )}

                {/* Dimensions */}
                {dims && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2">📐 ابعاد تخمینی (cm):</div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[['طول', dims.l],['عرض', dims.w],['ارتفاع', dims.h]].map(([lbl, val]) => (
                        <div key={lbl as string} className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
                          <div className="text-base font-extrabold text-cyan-600">{val}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{lbl} (cm)</div>
                        </div>
                      ))}
                    </div>

                    {!dimsConfirmed && !dimManual && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="text-sm font-bold text-gray-700 mb-3">آیا ابعاد تشخیص‌داده‌شده درست است؟</div>
                        <div className="flex gap-3">
                          <button onClick={confirmDims}
                            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl transition-colors">
                            ✅ تایید ابعاد
                          </button>
                          <button onClick={() => setDimManual(true)}
                            className="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors">
                            ✏️ اصلاح دستی
                          </button>
                        </div>
                      </div>
                    )}

                    {dimManual && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-500 mb-1">ابعاد دقیق کالا (سانتی‌متر):</div>
                        <div className="grid grid-cols-3 gap-3">
                          {([['طول', dimL, setDimL],['عرض', dimW, setDimW],['ارتفاع', dimH, setDimH]] as [string,string,(v:string)=>void][]).map(([l,v,s]) => (
                            <div key={l}>
                              <label className="ds-label text-[11px]">{l}</label>
                              <input type="number" className="ds-input text-sm" placeholder="cm" min="1" max="300"
                                value={v} onChange={e => s(e.target.value)} style={{ direction: 'ltr' }} />
                            </div>
                          ))}
                        </div>
                        <button onClick={saveDims} className="ds-btn-primary w-full py-2.5">✅ تأیید ابعاد</button>
                      </div>
                    )}

                    {dimsConfirmed && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm font-bold text-green-700">
                        ✅ ابعاد تأیید شد
                      </div>
                    )}
                  </div>
                )}

                {inspDone && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="text-sm font-extrabold text-green-700">بررسی کالا تکمیل شد</div>
                    <div className="text-xs text-gray-500 mt-1">کالا بررسی شد و آماده ادامه ثبت سفارش است</div>
                  </div>
                )}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(3)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(5)} disabled={!inspDone || illegalBlocked}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 5 — ارزش کالا ════════════ */}
        {step === 5 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۵ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">ارزش کالا</h2>
            <p className="text-sm text-gray-400 mb-5">ارزش تقریبی کالا را وارد کنید</p>

            <div className="mb-4">
              <label className="ds-label">ارز</label>
              <button type="button" onClick={() => setShowCurrModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-cyan-400 transition-colors bg-white">
                <span className="text-xl">{currObj.flag}</span>
                <span className="text-base font-extrabold text-cyan-600">{currObj.code}</span>
                <span className="text-sm text-gray-500 flex-1 text-right">{currObj.label}</span>
                <span className="text-gray-400 text-sm">▼</span>
              </button>
              {selectedCurr === 'IRR' && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-semibold">
                  ⚠️ نرخ لحظه‌ای در دسترس نیست — از نرخ تقریبی استفاده می‌شود
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="ds-label">مبلغ</label>
              <input type="number" className="ds-input" placeholder="مبلغ را وارد کنید" min="0" step="0.01"
                value={valueAmount} onChange={e => { setValueAmount(e.target.value); setErr(''); }}
                style={{ direction: 'ltr' }} />
              {parseFloat(valueAmount) > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  معادل تقریبی: <strong className="text-cyan-600">${valueUSD.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Security settings */}
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
              <button onClick={() => goStep(4)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(6)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 6 — اطلاعات گیرنده ════════════ */}
        {step === 6 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۶ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">اطلاعات گیرنده</h2>
            <p className="text-sm text-gray-400 mb-5">اطلاعات شخصی که کالا را دریافت می‌کند</p>

            {highValue && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <div className="text-xl mb-1">🔒</div>
                <div className="text-sm font-extrabold text-amber-700 mb-1">تأیید هویت گیرنده لازم است</div>
                <div className="text-xs text-amber-600">به دلیل ارزش بالای کالا، تصویر مدرک هویتی گیرنده لازم است.</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="ds-label">نام گیرنده</label>
                <input type="text" className="ds-input" placeholder="نام" value={recFirst}
                  onChange={e => { setRecFirst(e.target.value); setErr(''); }} />
              </div>
              <div>
                <label className="ds-label">نام خانوادگی گیرنده</label>
                <input type="text" className="ds-input" placeholder="نام خانوادگی" value={recLast}
                  onChange={e => { setRecLast(e.target.value); setErr(''); }} />
              </div>
            </div>
            <div className="mb-4">
              <label className="ds-label">تلفن گیرنده</label>
              <input type="tel" className="ds-input" placeholder="+1 416..." value={recPhone}
                onChange={e => { setRecPhone(e.target.value); setErr(''); }} style={{ direction: 'ltr' }} />
            </div>
            <div className="mb-4">
              <label className="ds-label">شهر/منطقه تحویل</label>
              <input type="text" className="ds-input" placeholder="مثال: تورنتو، انتاریو" value={recAddress}
                onChange={e => { setRecAddress(e.target.value); setErr(''); }} />
            </div>

            {/* High-value receiver ID capture */}
            {highValue && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">مدرک هویتی گیرنده</div>
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${recDocCapture ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50 hover:border-cyan-400'}`}>
                  <span className="text-2xl">{recDocCapture ? '✅' : '🪪'}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-700">عکس مدرک هویتی گیرنده</div>
                    <div className="text-xs text-gray-400">پاسپورت، گواهینامه یا کارت ملی</div>
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setRecDocCapture(true); }} />
                </label>
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => goStep(5)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(7)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 7 — بررسی اسناد ════════════ */}
        {step === 7 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۷ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">بررسی اسناد هویتی</h2>
            <p className="text-sm text-gray-400 mb-5">نوع سند هویتی را انتخاب و عکس‌ها را ارسال کنید</p>

            {/* Doc type picker */}
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">نوع سند</div>
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

            {/* Reuse IdentityVerification for doc upload + status */}
            {docType && (
              <div className="mb-5">
                <IdentityVerification enabled={idEnabled} onToggle={setIdEnabled}
                  status={docVerified ? 'VERIFIED' : 'PENDING'} />
              </div>
            )}

            {/* Simulated captures (triggers verification) */}
            {docType && !docVerified && !idVerifying && (
              <div className="space-y-3 mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex gap-2">
                  <span>💡</span><span>لبه‌های مدرک در قاب باشند — نور کافی داشته باشید</span>
                </div>
                {[
                  { key: 'front' as const, icon: '📄', label: 'عکس جلو مدرک', capture: 'environment' as const },
                  ...(DOC_TYPES.find(d => d.key === docType)?.needBack
                    ? [{ key: 'back' as const, icon: '📄', label: 'عکس پشت مدرک', capture: 'environment' as const }]
                    : []),
                  { key: 'selfie' as const, icon: '🤳', label: 'سلفی', capture: 'user' as const },
                ].map(slot => (
                  <label key={slot.key}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${docCaptures[slot.key] ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-cyan-400'}`}>
                    <span className="text-2xl">{docCaptures[slot.key] ? '✅' : slot.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-700">{slot.label}</div>
                      <div className="text-xs text-gray-400">{slot.key === 'selfie' ? 'صورت واضح در نور کافی' : 'لبه‌های مدرک در قاب باشند'}</div>
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
                در حال بررسی اسناد...
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
                بررسی اسناد تکمیل شد ✅
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(6)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={() => goStep(8)} disabled={!docVerified}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ════════════ STEP 8 — تأیید روش پرداخت ════════════ */}
        {step === 8 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۸ از ۸</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">تأیید روش پرداخت</h2>
            <p className="text-sm text-gray-400 mb-5">روش پرداخت خود را انتخاب کنید</p>

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
                  <label className="ds-label">نام صاحب حساب</label>
                  <input type="text" className="ds-input" placeholder="نام و نام خانوادگی"
                    value={payAccountName} onChange={e => { setPayAccountName(e.target.value); setErr(''); }} />
                </div>
                <button onClick={confirmPayment} disabled={payVerifying}
                  className="ds-btn-primary w-full py-3 mb-4 disabled:opacity-60">
                  {payVerifying
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>در حال تأیید...</span>
                    : 'تأیید حساب'}
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
                  حساب تأیید شد ✅
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
                  💳 پرداخت فقط پس از تأیید پیشنهاد مسافر انجام می‌شود
                </div>
              </>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(7)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← قبل</button>
              <button onClick={publishOrder} disabled={publishing || !payVerified}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-40">
                {publishing
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>در حال ثبت...</span>
                  : 'ثبت سفارش ✈️'}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Currency modal ─────────────────────────────────────────────────────── */}
      {showCurrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowCurrModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[72vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <span className="text-base font-extrabold text-gray-900">انتخاب ارز</span>
              <button onClick={() => setShowCurrModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="pb-6">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurr(c.code as CurrencyCode); setShowCurrModal(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors
                    ${selectedCurr === c.code ? 'bg-cyan-50' : ''}`}>
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-sm font-extrabold text-cyan-600 w-14 text-left">{c.code}</span>
                  <span className="flex-1 text-sm font-bold text-gray-700 text-right">{c.label}</span>
                  {selectedCurr === c.code && <CheckCircle className="w-4 h-4 text-cyan-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Item correction modal ──────────────────────────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowItemModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[78vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-extrabold text-gray-900">اصلاح نام کالا</span>
                <button onClick={() => setShowItemModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
              </div>
              <input type="search" className="ds-input text-sm" placeholder="جستجو در کالاها..."
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
