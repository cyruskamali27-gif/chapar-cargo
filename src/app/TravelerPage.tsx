import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, ArrowLeft, Home } from 'lucide-react';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { IdentityVerification } from './VerificationModules';
import { useSession } from '../lib/SessionContext';
import { Store, genId } from '../lib/store';
import SecuritySelector from './ProtectionSelector';
import { type SecurityLevel } from './shipmentTypes';

// ── Constants (exact from travel.html) ───────────────────────────────────────

const CARGO_OPTIONS = [
  { key: 'personal',    icon: '📦', name: 'کالای شخصی',    sub: 'بسته‌های کوچک و متوسط',         needCapacity: true  },
  { key: 'medicine',    icon: '💊', name: 'دارو و مکمل',   sub: 'داروهای تجویزی و مکمل',          needCapacity: true  },
  { key: 'documents',   icon: '📄', name: 'مدارک و اسناد', sub: 'پاکت‌ها و پوشه‌های مدارک',       needCapacity: false },
  { key: 'clothing',    icon: '👗', name: 'لباس و پارچه',  sub: 'پوشاک و منسوجات',                needCapacity: true  },
  { key: 'electronics', icon: '💻', name: 'الکترونیک',     sub: 'گوشی، لپ‌تاپ، لوازم جانبی',     needCapacity: true  },
  { key: 'gift',        icon: '🎁', name: 'هدیه',           sub: 'کادو و بسته‌های هدیه',            needCapacity: true  },
];

const WEIGHT_OPTIONS = ['1', '2', '5', '10', '20', 'سفارشی'];

const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'AED', 'IRR'];

const DOC_TYPES = [
  { key: 'passport', icon: '🛂', name: 'پاسپورت',   req: 'جلو + سلفی',        needBack: false },
  { key: 'driving',  icon: '🪪', name: 'گواهینامه', req: 'جلو + پشت + سلفی', needBack: true  },
  { key: 'national', icon: '🪪', name: 'کارت ملی',  req: 'جلو + پشت + سلفی', needBack: true  },
];

const PAYOUT_METHODS = [
  { key: 'bank',   icon: '🏦',  label: 'حساب بانکی' },
  { key: 'debit',  icon: '💳',  label: 'کارت دبیت'  },
  { key: 'credit', icon: '💳',  label: 'کارت اعتباری' },
  { key: 'paypal', icon: '🅿️', label: 'پی‌پال'      },
  { key: 'wallet', icon: '📱',  label: 'کیف دیجیتال' },
  { key: 'usdt',   icon: '₮',   label: 'USDT'        },
  { key: 'usdc',   icon: '🔵',  label: 'USDC'        },
];

const PILL_LABELS = ['مسیر', 'گزینه‌ها', 'اسناد', 'حساب', 'انتشار'];

// ── Country → flag (for cp_trips compatibility with travel.html) ─────────────
function countryFlag(country: string): string {
  const f: Record<string, string> = {
    'Iran': '🇮🇷', 'Turkey': '🇹🇷', 'UAE': '🇦🇪', 'Canada': '🇨🇦',
    'United Kingdom': '🇬🇧', 'United States': '🇺🇸', 'Germany': '🇩🇪',
    'France': '🇫🇷', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪',
    'Qatar': '🇶🇦', 'Russia': '🇷🇺', 'Australia': '🇦🇺',
    'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'India': '🇮🇳',
    'Singapore': '🇸🇬', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
    'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
    'Greece': '🇬🇷', 'Portugal': '🇵🇹', 'Norway': '🇳🇴',
    'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Poland': '🇵🇱',
    'China': '🇨🇳', 'Hong Kong': '🇭🇰', 'UK': '🇬🇧',
  };
  return f[country] ?? '🌍';
}

// ── Inline error ──────────────────────────────────────────────────────────────
function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
      {msg}
    </div>
  );
}

// ── Step pills ────────────────────────────────────────────────────────────────
function StepPills({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {PILL_LABELS.map((label, i) => {
        const n = i + 1;
        const done   = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center flex-shrink-0">
            {n > 1 && (
              <div className={`h-0.5 w-6 sm:w-10 transition-colors ${done ? 'bg-cyan-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done   ? 'bg-cyan-500 text-white'
                : active ? 'bg-cyan-600 text-white ring-4 ring-cyan-100'
                :          'bg-gray-100 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block
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

// ── Page header (matching App.tsx PageHeader style) ───────────────────────────
function PageHeader({ onHome }: { onHome: () => void }) {
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
          className="text-4xl font-extrabold text-gray-900 mb-4">ثبت مسیر مسافر</motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-lg text-gray-500 max-w-2xl">ظرفیت خود را برای حمل کالا اعلام کنید</motion.p>
      </div>
    </div>
  );
}

// ── Main TravelerPage ─────────────────────────────────────────────────────────
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onNavigate: (page: string) => void; }

export default function TravelerPage({ onHome, onNavigate }: Props) {
  const { session } = useSession();

  // ── Step 1 state
  const [step,   setStep]   = useState(1);
  const [origin, setOrigin] = useState<AirportOption | null>(null);
  const [dest,   setDest]   = useState<AirportOption | null>(null);
  const [date,   setDate]   = useState('');
  const [phone,  setPhone]  = useState('');

  // ── Step 2 state
  const [cargoOptions,    setCargoOptions]    = useState<string[]>([]);
  const [selectedWeight,  setSelectedWeight]  = useState<string | null>(null);
  const [customKg,        setCustomKg]        = useState('');
  const [priceCurrency,   setPriceCurrency]   = useState('USD');
  const [priceAmount,     setPriceAmount]     = useState('');

  // ── Step 3 state
  const [docType,     setDocTypeState] = useState<string | null>(null);
  const [idEnabled,   setIdEnabled]   = useState(true);
  const [verifying,   setVerifying]   = useState(false);
  const [verifyDone,  setVerifyDone]  = useState(false);
  const [verifyItems, setVerifyItems] = useState<string[]>([]);

  // ── Step 4 state
  const [payoutMethod,    setPayoutMethod]    = useState<string | null>(null);
  const [accountName,     setAccountName]     = useState('');
  const [acctVerifying,   setAcctVerifying]   = useState(false);
  const [accountDone,     setAccountDone]     = useState(false);

  // ── Security settings (step 2)
  const [securityLevel,       setSecurityLevel]       = useState<SecurityLevel>('GUARANTEED');
  const [identityVerReq,      setIdentityVerReq]      = useState(false);
  const [cargoVerReq,         setCargoVerReq]         = useState(false);
  const [otpDeliveryReq,      setOtpDeliveryReq]      = useState(false);
  const [deliveryPhotoReq,    setDeliveryPhotoReq]    = useState(false);

  // ── Step 5 / publish
  const [publishing, setPublishing] = useState(false);
  const [tripId,     setTripId]     = useState<string | null>(null);
  const [apiRoute,   setApiRoute]   = useState<{ trackingCode: string } | null>(null);

  // ── Match box (mirrors travel.html updateMatchBox)
  const [matchAllDates, setMatchAllDates] = useState(false);

  // ── Error per step
  const [err, setErr] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // mirrors travel.html updateMatchBox — reads cp_history for matching open orders
  const matchBoxData = useMemo(() => {
    if (!origin || !dest || !date) return null;
    const history = Store.get<Array<{ origin: string; dest: string; date?: string; status: string }>>('history') ?? [];
    const excluded = ['cancelled', 'matched', 'delivered'];
    const all = history.filter(o =>
      o.origin === origin.iata && o.dest === dest.iata && !excluded.includes(o.status)
    );
    const forDate = all.filter(o => !o.date || o.date === date);
    return { all: all.length, forDate: forDate.length };
  }, [origin, dest, date]);

  // ── Pre-fill from session
  useEffect(() => {
    if (!session) return;
    if (session.phone) setPhone(session.phone);
    const full = [session.firstName, session.lastName].filter(Boolean).join(' ');
    if (full) setAccountName(full);
  }, [session?.userId]);

  // ── Restore draft from cp_travel_draft
  useEffect(() => {
    const d = Store.get<TravelDraft>('travel_draft');
    if (!d) return;
    if (d.originIata) { const ap = getAirportByIata(d.originIata); if (ap) setOrigin(ap); }
    if (d.destIata)   { const ap = getAirportByIata(d.destIata);   if (ap) setDest(ap);   }
    if (d.date)           setDate(d.date);
    if (d.phone)          setPhone(d.phone);
    if (d.cargoOptions)   setCargoOptions(d.cargoOptions);
    if (d.selectedWeight) setSelectedWeight(d.selectedWeight);
    if (d.customKg)       setCustomKg(String(d.customKg));
    if (d.priceCurrency)  setPriceCurrency(d.priceCurrency);
    if (d.priceAmount)    setPriceAmount(String(d.priceAmount));
    if (d.docType)        setDocTypeState(d.docType);
    if (d.verifyDone)     setVerifyDone(true);
    if (d.payoutMethod)   setPayoutMethod(d.payoutMethod);
    if (d.accountName)    setAccountName(d.accountName);
    if (d.accountDone)    setAccountDone(true);
    if (d.step && d.step >= 1 && d.step <= 5) setStep(d.step);
  }, []);

  // ── Save draft on state changes (mirrors saveDraft() in travel.html)
  const draftRef = useRef(false);
  useEffect(() => {
    if (!draftRef.current) { draftRef.current = true; return; }
    const draft: TravelDraft = {
      step, originIata: origin?.iata ?? null, destIata: dest?.iata ?? null,
      date, phone, cargoOptions, selectedWeight, customKg: customKg ? parseFloat(customKg) : null,
      priceCurrency, priceAmount: priceAmount ? parseFloat(priceAmount) : null,
      docType, verifyDone, payoutMethod, accountName, accountDone,
    };
    Store.set('travel_draft', draft);
  }, [step, origin, dest, date, phone, cargoOptions, selectedWeight, customKg,
      priceCurrency, priceAmount, docType, verifyDone, payoutMethod, accountName, accountDone]);

  // ── Helpers
  const needsCapacity = () =>
    cargoOptions.length > 0 &&
    cargoOptions.some(k => CARGO_OPTIONS.find(o => o.key === k)?.needCapacity);

  const toggleCargo = (key: string) => {
    setErr('');
    setCargoOptions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // ── Validations (mirrors travel.html validateStep*) ──────────────────────
  function validateStep1(): boolean {
    if (!origin)   { setErr('برای ادامه باید مبدا را انتخاب کنید.');                    return false; }
    if (!dest)     { setErr('برای ادامه باید مقصد را انتخاب کنید.');                    return false; }
    if (!date)     { setErr('برای ادامه باید تاریخ سفر را انتخاب کنید.');               return false; }
    if (!phone || phone.replace(/\D/g, '').length < 10)
                   { setErr('برای ادامه باید شماره موبایل را وارد کنید.');              return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (cargoOptions.length === 0)
      { setErr('برای ادامه باید حداقل یک گزینه حمل انتخاب کنید.');                     return false; }
    if (needsCapacity()) {
      if (!selectedWeight) { setErr('برای ادامه باید ظرفیت قابل حمل را مشخص کنید.');  return false; }
      if (selectedWeight === 'سفارشی' && (!customKg || parseFloat(customKg) <= 0))
        { setErr('برای ادامه باید ظرفیت قابل حمل را مشخص کنید.');                      return false; }
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!verifyDone) { setErr('برای ادامه باید احراز هویت را کامل کنید.');              return false; }
    return true;
  }

  function validateStep4(): boolean {
    if (!accountDone) { setErr('برای ادامه باید تأیید حساب را کامل کنید.');             return false; }
    return true;
  }

  function goStep(n: number) {
    setErr('');
    if (n > step) {
      if (step === 1 && !validateStep1()) return;
      if (step === 2 && !validateStep2()) return;
      if (step === 3 && !validateStep3()) return;
      if (step === 4 && !validateStep4()) return;
      if (step === 4 && n === 5) { publishTrip(); return; }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Doc-type selection (mirrors selectDocType in travel.html) ─────────────
  function selectDocType(key: string) {
    setDocTypeState(key);
    setVerifyDone(false);
    setVerifyItems([]);
    setVerifying(false);
  }

  // ── Simulated verification (mirrors startVerification in travel.html) ─────
  function startVerification() {
    if (!docType) { setErr('لطفاً نوع سند را انتخاب کنید.'); return; }
    setErr('');
    setVerifying(true);
    setVerifyItems([]);
    const checks = [
      'تطابق چهره با مدرک',
      'اعتبار و اصالت سند',
      'تطابق نوع سند با انتخاب کاربر',
      'تطابق کشور/زبان سند',
      'ریسک جعلی بودن: پایین ✓',
    ];
    setTimeout(() => {
      setVerifying(false);
      checks.forEach((c, i) => {
        setTimeout(() => setVerifyItems(prev => [...prev, c]), i * 200);
      });
      setTimeout(() => setVerifyDone(true), checks.length * 200 + 100);
    }, 1800);
  }

  // ── Account verification (mirrors startAccountVerification) ──────────────
  function startAccountVerification() {
    if (!payoutMethod) { setErr('برای ادامه باید روش دریافت وجه را انتخاب کنید.'); return; }
    if (!accountName.trim()) { setErr('نام صاحب حساب را وارد کنید.'); return; }
    setErr('');
    setAcctVerifying(true);
    setTimeout(() => {
      setAcctVerifying(false);
      setAccountDone(true);
    }, 1200);
  }

  // ── Publish (mirrors publishTrip in travel.html) ─────────────────────────
  async function publishTrip() {
    if (!session) { setErr('برای ثبت مسیر ابتدا باید ورود کنید.'); return; }
    if (!verifyDone) { setErr('🔐 برای انتشار مسیر باید احراز هویت (KYC) را کامل کنید.'); return; }
    if (!origin || !dest) return;

    setPublishing(true);

    const capacity = needsCapacity() && selectedWeight
      ? (selectedWeight === 'سفارشی' ? (parseFloat(customKg) || null) : parseFloat(selectedWeight))
      : null;

    const tripId = genId('T');

    // ── Write to cp_trips (exact shape from travel.html publishTrip) ──
    const trip = {
      id:            tripId,
      origin:        origin.iata,
      originCity:    origin.city,
      originFlag:    countryFlag(origin.country),
      destination:   dest.iata,
      destCity:      dest.city,
      destFlag:      countryFlag(dest.country),
      date,
      capacity,
      cargoOptions,
      minPricePerKg: priceAmount ? parseFloat(priceAmount) : null,
      priceCurrency,
      phone,
      payoutMethod,
      description:   '',
      createdAt:     Date.now(),
      status:        'pending',
      userId:        session.userId,
      userName:      [session.firstName, session.lastName].filter(Boolean).join(' ').trim(),
      securityLevel,
      identityVerificationRequired: identityVerReq,
      cargoVerificationRequired:    cargoVerReq,
      otpDeliveryRequired:          otpDeliveryReq,
      deliveryPhotoRequired:        deliveryPhotoReq,
    };

    const trips: typeof trip[] = Store.get<typeof trip[]>('trips') ?? [];
    trips.unshift(trip);
    Store.set('trips', trips.slice(0, 200));
    Store.del('travel_draft');

    // ── POST /api/approvals/create — listing goes PENDING until admin approves
    try {
      await fetch('/api/approvals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'traveler_listing', refId: tripId, payload: trip }),
      });
    } catch { /* non-fatal — approval queued locally */ }

    // ── POST /api/routes (routeType: 'traveler') ──────────────────────
    let routeResult = null;
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCity:        origin.city,
          originCountry:     origin.country,
          destinationCity:   dest.city,
          destinationCountry: dest.country,
          routeType:         'traveler',
        }),
      });
      if (res.ok) routeResult = await res.json();
    } catch { /* non-fatal — trip is already in cp_trips */ }

    setTripId(tripId);
    setApiRoute(routeResult);
    setPublishing(false);
    setStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Auth guard ───────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">ورود لازم است</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">برای ثبت مسیر باید ابتدا ثبت‌نام یا ورود انجام دهید.</p>
          <button onClick={() => onHome()} className="ds-btn-primary w-full py-3">
            ورود / ثبت‌نام
          </button>
          <button onClick={onHome} className="mt-3 text-sm text-gray-400 hover:text-gray-600 underline block w-full">
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  // ── Step 5 — Success ─────────────────────────────────────────────────────
  if (step === 5 && tripId) {
    return (
      <div className="min-h-screen bg-white" dir="rtl">
        <PageHeader onHome={onHome} />
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">مسیر ثبت شد!</h2>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl px-4 py-2 mb-4">
              <span>⏳</span><span>در انتظار تأیید ادمین</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">مسیر شما ثبت شد و پس از تأیید توسط تیم چاپار در مارکت‌پلیس نمایش داده می‌شود.</p>

            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-6 text-center">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">کد پیگیری مسیر</div>
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{tripId}</div>
              {apiRoute && (
                <div className="text-xs text-gray-400 mt-1 font-mono">{apiRoute.trackingCode}</div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-right">
              <div className="flex items-center justify-center gap-3 text-lg font-extrabold text-gray-900 mb-3">
                <span>{countryFlag(origin?.country ?? '')} {origin?.city}</span>
                <span className="text-gray-400 text-sm">←</span>
                <span>{countryFlag(dest?.country ?? '')} {dest?.city}</span>
              </div>
              {date && <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold uppercase text-xs">تاریخ</span><span className="font-bold">{date}</span></div>}
              {origin && dest && <div className="flex justify-between text-sm mt-2"><span className="text-gray-500 font-bold uppercase text-xs">مسیر</span><span className="font-bold font-mono">{origin.iata} → {dest.iata}</span></div>}
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => onNavigate('marketplace')}
                 className="ds-btn-primary py-3 w-full"
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52 }}>
                مشاهده کالاهای مناسب این مسیر ✈️
              </button>
              <button onClick={() => onNavigate('traveler-dashboard')}
                 className="ds-btn-secondary py-3 w-full"
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                داشبورد مسافر
              </button>
              <button onClick={() => { setStep(1); setTripId(null); setOrigin(null); setDest(null); setDate(''); setCargoOptions([]); setSelectedWeight(null); setCustomKg(''); setPriceAmount(''); setDocTypeState(null); setVerifyDone(false); setPayoutMethod(null); setAccountDone(false); }}
                className="ds-btn-secondary py-3 w-full">ثبت مسیر جدید</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <PageHeader onHome={onHome} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ══════════ STEP 1 — مسیر ══════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۱ از ۵</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">انتخاب مسیر و تاریخ</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <AirportCityAutocomplete label="مبدا" value={origin} onChange={v => { setOrigin(v); setErr(''); }} placeholder="تهران، استانبول..." />
              <AirportCityAutocomplete label="مقصد" value={dest}   onChange={v => { setDest(v);   setErr(''); }} placeholder="تورنتو، لندن..." />
            </div>

            <div className="mb-4">
              <label className="ds-label">تاریخ سفر</label>
              <input type="date" className="ds-input" min={today} value={date}
                onChange={e => { setDate(e.target.value); setErr(''); }} />
            </div>

            <div className="mb-4">
              <label className="ds-label">شماره موبایل</label>
              <input type="tel" className="ds-input" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={phone}
                onChange={e => { setPhone(e.target.value.trim()); setErr(''); }} />
            </div>

            {/* Smart match box — mirrors travel.html matchBox */}
            {matchBoxData !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                {(matchAllDates ? matchBoxData.all : matchBoxData.forDate) > 0 ? (
                  <>
                    <div className="text-sm font-bold text-blue-700 mb-2">
                      ✈️ <strong>{matchAllDates ? matchBoxData.all : matchBoxData.forDate} سفارش کالا</strong> برای این مسیر در انتظار مسافر هستند
                    </div>
                    <button onClick={() => onNavigate('marketplace')}
                       className="ds-btn-primary block text-center py-2 text-sm w-full mb-2"
                       style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40 }}>
                      مشاهده کالاهای مناسب این مسیر →
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-gray-500 leading-relaxed mb-2">
                    هنوز سفارشی برای این مسیر ثبت نشده. مسیر خود را ثبت کنید تا اطلاع داده شود.
                  </div>
                )}
                <button onClick={() => setMatchAllDates(m => !m)}
                  className="text-xs text-cyan-600 font-bold hover:underline bg-transparent border-none cursor-pointer p-0">
                  {matchAllDates ? 'نمایش فقط تاریخ انتخابی' : `نمایش همه تاریخ‌ها (${matchBoxData.all})`}
                </button>
              </div>
            )}

            <Err msg={err} />
            <button onClick={() => goStep(2)} className="ds-btn-primary w-full mt-4 py-3">ادامه ←</button>
          </motion.div>
        )}

        {/* ══════════ STEP 2 — گزینه‌ها ══════════ */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۲ از ۵</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">گزینه‌های حمل</h2>

            <label className="ds-label">چه نوع کالایی حمل می‌کنید؟</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {CARGO_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => toggleCargo(opt.key)}
                  className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 text-right transition-all
                    ${cargoOptions.includes(opt.key)
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="text-sm font-bold text-gray-900">{opt.name}</span>
                  <span className="text-[11px] text-gray-500 leading-snug">{opt.sub}</span>
                </button>
              ))}
            </div>

            {cargoOptions.length > 0 && needsCapacity() && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">ظرفیت قابل حمل</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {WEIGHT_OPTIONS.map(w => (
                    <button key={w} onClick={() => { setSelectedWeight(w); setErr(''); }}
                      className={`py-2 px-1 rounded-xl border-2 text-sm font-bold text-center transition-all
                        ${selectedWeight === w
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}>
                      {w === 'سفارشی' ? w : `${w} kg`}
                    </button>
                  ))}
                </div>
                {selectedWeight === 'سفارشی' && (
                  <div className="mb-4">
                    <label className="ds-label">ظرفیت سفارشی (کیلوگرم)</label>
                    <input type="number" className="ds-input" placeholder="مثال: ۱۵" min="0.5" step="0.5"
                      value={customKg} onChange={e => { setCustomKg(e.target.value); setErr(''); }} />
                  </div>
                )}

                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">قیمت پایه (اختیاری)</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {CURRENCIES.map(c => (
                    <button key={c} onClick={() => setPriceCurrency(c)}
                      className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all
                        ${priceCurrency === c
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <input type="number" className="ds-input" placeholder="مثال: 50" min="0" step="any" style={{ direction: 'ltr' }}
                  value={priceAmount} onChange={e => setPriceAmount(e.target.value)} />
                <p className="text-xs text-gray-400 mt-2">ℹ️ قیمت پایه پیشنهادی است. سفارش‌دهندگان می‌توانند پیشنهاد دیگری بدهند.</p>
              </div>
            )}

            {/* Security settings */}
            {cargoOptions.length > 0 && (
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
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => goStep(1)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← مرحله قبل</button>
              <button onClick={() => goStep(3)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ══════════ STEP 3 — اسناد ══════════ */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۳ از ۵</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">بررسی اسناد هویتی</h2>

            {/* Doc type picker */}
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">نوع سند</div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DOC_TYPES.map(d => (
                <button key={d.key} onClick={() => selectDocType(d.key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all
                    ${docType === d.key
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-2xl">{d.icon}</span>
                  <span className="text-sm font-bold text-gray-900">{d.name}</span>
                  <span className="text-[10px] text-gray-400">{d.req}</span>
                </button>
              ))}
            </div>

            {/* Reuse IdentityVerification for doc upload area */}
            {docType && (
              <div className="mb-5">
                <IdentityVerification enabled={idEnabled} onToggle={setIdEnabled} status={verifyDone ? 'VERIFIED' : 'PENDING'} />
              </div>
            )}

            {/* Verification trigger / result */}
            {docType && !verifyDone && !verifying && (
              <button onClick={startVerification}
                className="ds-btn-primary w-full py-3 mb-4">
                🔍 شروع تأیید هویت
              </button>
            )}

            {verifying && (
              <div className="flex items-center justify-center gap-3 py-4 text-gray-500 text-sm">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                در حال بررسی اسناد...
              </div>
            )}

            {verifyItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {verifyItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            )}

            {verifyDone && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-4">
                احراز هویت تکمیل شد ✅
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(2)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← مرحله قبل</button>
              <button onClick={() => goStep(4)} className="ds-btn-primary flex-1 py-3">ادامه ←</button>
            </div>
          </motion.div>
        )}

        {/* ══════════ STEP 4 — حساب ══════════ */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">مرحله ۴ از ۵</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">تأیید روش دریافت وجه</h2>

            <label className="ds-label">روش دریافت وجه را انتخاب کنید</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {PAYOUT_METHODS.map(m => (
                <button key={m.key} onClick={() => { setPayoutMethod(m.key); setAccountDone(false); setAcctVerifying(false); setErr(''); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all
                    ${payoutMethod === m.key
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-xs font-bold text-gray-700">{m.label}</span>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="ds-label">نام صاحب حساب</label>
              <input type="text" className="ds-input" placeholder="نام و نام‌خانوادگی"
                value={accountName} onChange={e => { setAccountName(e.target.value); setAccountDone(false); setErr(''); }} />
            </div>

            {!accountDone && (
              <button onClick={startAccountVerification} disabled={acctVerifying}
                className="ds-btn-primary w-full py-3 mb-4 disabled:opacity-60">
                {acctVerifying
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />در حال تأیید...</span>
                  : 'تأیید حساب'}
              </button>
            )}

            {accountDone && (
              <div className="space-y-2 mb-4">
                {['نام با هویت تأیید‌شده تطابق دارد', 'روش دریافت تأیید شد'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mt-2">
                  حساب دریافت تأیید شد ✅
                </div>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 mb-4">
              🔒 وجه فقط پس از تأیید تحویل توسط گیرنده آزاد می‌شود
            </div>

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(3)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">← مرحله قبل</button>
              <button onClick={() => goStep(5)} disabled={publishing}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-60">
                {publishing
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />در حال ثبت...</span>
                  : 'انتشار مسیر ✈️'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Draft shape (mirrors travel.html saveDraft) ───────────────────────────────
interface TravelDraft {
  step: number;
  originIata: string | null;
  destIata: string | null;
  date: string;
  phone: string;
  cargoOptions: string[];
  selectedWeight: string | null;
  customKg: number | null;
  priceCurrency: string;
  priceAmount: number | null;
  docType: string | null;
  verifyDone: boolean;
  payoutMethod: string | null;
  accountName: string;
  accountDone: boolean;
}
