import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Plane, Bus, TrainFront, Ship, ArrowLeft, ArrowRight, Home, Check, CheckCircle2,
         ShieldCheck, Clock, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { useKycGate } from '../lib/useKycGate';
import { Store, genId } from '../lib/store';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { IdentityVerification } from './VerificationModules';
import TravelerAssistant, { type AssistSuggestion } from './TravelerAssistant';
import { publishTrip, toISO2, COUNTRIES, type TripMode } from '../lib/tripPublish';
import { PROHIBITED_CATEGORIES } from '../lib/prohibited';

// ── ثبت مسافر چندمسیره — P3 shell (CMD-23) ────────────────────────────────────
//
// P1 (CMD-21) shipped step 0 (mode select) + the shell. P2 (CMD-22) shipped the shared
// tripPublish.ts. P3 (this) fills in the REAL step 1 (per-mode origin/dest) and step 2 (date /
// capacity / optionals) and wires publish through that SAME tripPublish.ts — one publish path,
// one ISO2 contract, no divergence from the old page.
//
// Steps 3 (KYC) and 4 (carry / payout) remain P4 placeholders. Publish fires from step 4 for now;
// P4 adds the real gates before it.
//
// NO PHONE FIELD — the traveler's phone is on the session (P1 item 3).
//
// THE ISO2 CONTRACT (the whole reason step 1 is mode-shaped):
//   • air  → airport autocomplete; the corridor comes from the AIRPORT'S COUNTRY, resolved to ISO2.
//   • land/rail/sea → city TEXT (display/detail only) + an explicit COUNTRY PICKER whose value is
//     already ISO2. We ship no fake port/station autocomplete we have no data for.
// Either way `from`/`to` reach the server as two-letter codes. A city string there does not error —
// it silently matches nothing — so tripPublish.toISO2() re-validates and REFUSES a bad corridor.

type ModeId = TripMode;

// ── mode tokens (Rule 20: ≥4.5:1 text / ≥3:1 icons, measured on white — see P1 note) ──
// `mark` (-600) is icons+rails only; `text` (-700) carries any white label. White-on-mark fails
// for air/land/sea, which is exactly why the two are separate keys.
const MODES: { id: ModeId; label: string; hint: string; Icon: typeof Plane;
               text: string; mark: string; soft: string; ring: string }[] = [
  { id: 'air',  label: 'هوایی',  hint: 'پرواز — چمدان مسافری',      Icon: Plane,
    text: '#0369a1', mark: '#0284c7', soft: '#f0f9ff', ring: '#bae6fd' },
  { id: 'land', label: 'زمینی',  hint: 'اتوبوس، ون یا خودرو',        Icon: Bus,
    text: '#b45309', mark: '#d97706', soft: '#fffbeb', ring: '#fde68a' },
  { id: 'rail', label: 'ریلی',   hint: 'قطار بین‌شهری یا بین‌المللی', Icon: TrainFront,
    text: '#4338ca', mark: '#4f46e5', soft: '#eef2ff', ring: '#c7d2fe' },
  { id: 'sea',  label: 'دریایی', hint: 'کشتی — ظرفیت بیشتر، زمان بیشتر', Icon: Ship,
    text: '#0f766e', mark: '#0d9488', soft: '#f0fdfa', ring: '#99f6e4' },
];

const NEUTRAL = { text: '#374151', mark: '#6b7280', soft: '#f9fafb', ring: '#e5e7eb' };

const STEPS = [
  { n: 0, label: 'نوع مسیر' },
  { n: 1, label: 'مبدأ و مقصد' },
  { n: 2, label: 'تاریخ و ظرفیت' },
  { n: 3, label: 'احراز هویت' },
  { n: 4, label: 'حمل و تسویه' },
];

// Per-mode optional carrier reference labels. OPTIONAL, and never rendered as verified — a
// self-declared flight number is not a confirmed booking. Land has a free-text vehicle type only.
const MODE_REF: Record<ModeId, { ref1?: string; ref2?: string; cityLabel: string; placeFrom: string; placeTo: string }> = {
  air:  { ref1: 'شماره پرواز (اختیاری)', ref2: 'ایرلاین (اختیاری)', cityLabel: '', placeFrom: 'فرودگاه یا شهر مبدأ', placeTo: 'فرودگاه یا شهر مقصد' },
  land: { ref1: 'نوع وسیله (اختیاری)',                             cityLabel: 'شهر', placeFrom: 'شهر مبدأ (اختیاری)', placeTo: 'شهر مقصد (اختیاری)' },
  rail: { ref1: 'شماره قطار (اختیاری)', ref2: 'شرکت/اپراتور (اختیاری)', cityLabel: 'شهر/ایستگاه', placeFrom: 'شهر یا ایستگاه مبدأ (اختیاری)', placeTo: 'شهر یا ایستگاه مقصد (اختیاری)' },
  sea:  { ref1: 'نام کشتی/سفر (اختیاری)',                          cityLabel: 'بندر/شهر', placeFrom: 'بندر یا شهر مبدأ (اختیاری)', placeTo: 'بندر یا شهر مقصد (اختیاری)' },
};

// Carry categories + payout methods — shell-local Persian literals, consistent with MODES/STEPS
// (the whole shell is Persian-literal; the i18n migration is a single tracked ticket, not a
// per-phase split). These are UI copy, not a shared data table like COUNTRIES/prohibited.
const CARRY_OPTIONS = [
  { key: 'personal',    label: 'کالای شخصی' },
  { key: 'documents',   label: 'مدارک و اسناد' },
  { key: 'clothing',    label: 'پوشاک' },
  { key: 'electronics', label: 'الکترونیک' },
  { key: 'gift',        label: 'هدیه' },
  { key: 'cosmetics',   label: 'آرایشی و بهداشتی' },
];
const PAYOUT_METHODS = [
  { key: 'bank',   label: 'حساب بانکی' },
  { key: 'card',   label: 'کارت بانکی' },
  { key: 'wallet', label: 'کیف پول دیجیتال' },
  { key: 'usdt',   label: 'USDT' },
  { key: 'usdc',   label: 'USDC' },
];

const today = new Date().toISOString().split('T')[0];

export default function TravelerRegisterShell({
  onBack, onHome,
}: { onBack: () => void; onHome: () => void; onNavigate?: (page: string) => void }) {
  const { session } = useSession();
  const { isRTL }   = useLang();
  const reduce      = useReducedMotion();

  // Real KYC gate — the SAME hook and endpoint the old page uses (/api/kyc/status === 'verified').
  // The shell never fabricates a verdict; it reads the service and re-checks on demand.
  const { isVerified, kycStatus, kycLoading, refetch: refetchKyc } = useKycGate({});

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ModeId | null>(null);
  const [dir, setDir]   = useState(1);   // direction of travel through the wizard, not text dir

  // ── step 1 — origin/dest (per mode) ──
  const [airOrigin, setAirOrigin] = useState<AirportOption | null>(null);
  const [airDest,   setAirDest]   = useState<AirportOption | null>(null);
  const [fromCC, setFromCC] = useState('');   // ISO2, from the country picker (land/rail/sea)
  const [toCC,   setToCC]   = useState('');
  const [fromCity, setFromCity] = useState('');   // display/detail only — NEVER sent as a corridor
  const [toCity,   setToCity]   = useState('');

  // ── step 2 — date/capacity + optionals ──
  const [date, setDate]           = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [capacityKg, setCapacityKg]   = useState('');
  const [minPrice, setMinPrice]       = useState('');
  const [note, setNote]               = useState('');
  const [ref1, setRef1]               = useState('');   // mode-specific carrier ref (optional)
  const [ref2, setRef2]               = useState('');

  // ── step 3 (KYC) — inline capture toggle ──
  const [kycCaptureOpen, setKycCaptureOpen] = useState(true);

  // ── step 4 (carry + payout) ──
  const [carry, setCarry]                 = useState<string[]>([]);
  const [prohibitedAck, setProhibitedAck] = useState(false);
  const [payoutMethod, setPayoutMethod]   = useState<string | null>(null);
  const [accountName, setAccountName]     = useState('');

  // ── publish ──
  const [publishing, setPublishing] = useState(false);
  const [result, setResult]         = useState<{ tripId: string } | null>(null);
  const [serverWriteError, setServerWriteError] = useState('');
  const [validationErr, setValidationErr]       = useState('');

  const theme = useMemo(() => MODES.find(m => m.id === mode) ?? NEUTRAL, [mode]);

  // The corridor countries, resolved to ISO2. Air derives from the airport's country; the other
  // modes already hold ISO2 in fromCC/toCC. toISO2 accepts either, so this is one code path.
  const fromCountry = mode === 'air' ? airOrigin?.country : fromCC;
  const toCountry   = mode === 'air' ? airDest?.country   : toCC;
  const fromISO = toISO2(fromCountry);
  const toISO   = toISO2(toCountry);

  const enterFrom = (isRTL ? -1 : 1) * dir * 28;
  const variants = reduce
    ? { enter: { opacity: 0 },               center: { opacity: 1 },       exit: { opacity: 0 } }
    : { enter: { opacity: 0, x: enterFrom }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -enterFrom } };

  function step1Valid(): boolean {
    return mode === 'air' ? !!(fromISO && toISO) : !!(fromCC && toCC);
  }
  function step2Valid(): boolean {
    return !!date && (parseFloat(capacityKg) > 0);
  }
  // Step 3 is the REAL KYC gate — you cannot leave it unverified. This is the same rule the old
  // page enforces (publish disabled unless kycVerified), moved to the step boundary so an
  // unverified traveler simply cannot reach the carry/payout step, let alone publish.
  function step3Valid(): boolean {
    return isVerified;
  }
  // Step 4: at least one carry category, the prohibited-goods acknowledgment, and a payout method +
  // account holder. KYC is re-asserted here as a defensive belt to the step-3 gate.
  function step4Valid(): boolean {
    return isVerified && carry.length > 0 && prohibitedAck && !!payoutMethod && accountName.trim().length > 0;
  }
  const canAdvance =
    step === 0 ? mode !== null :
    step === 1 ? step1Valid()  :
    step === 2 ? step2Valid()  :
    step === 3 ? step3Valid()  :
    step === 4 ? step4Valid()  :
    true;

  function go(next: number) {
    setValidationErr('');
    if (next > step) {
      if (step === 1 && !step1Valid()) { setValidationErr('مبدأ و مقصد را کامل کنید.'); return; }
      if (step === 2 && !step2Valid()) { setValidationErr('تاریخ حرکت و ظرفیت (کیلوگرم) الزامی است.'); return; }
      if (step === 3 && !step3Valid()) { setValidationErr('برای ادامه باید احراز هویت شما تأیید شده باشد.'); return; }
    }
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  // The ONLY channel through which the AI assistant can affect the form. Whitelisted to the three
  // proposable fields — identity/prohibited/payout/corridor are never AI-writable. Tap-to-apply
  // only; nothing here runs without a user tapping a proposal.
  function applyAssist(field: AssistSuggestion['field'], value: number | string) {
    if (field === 'capacityKg')         setCapacityKg(String(value));
    else if (field === 'minPricePerKg') setMinPrice(String(value));
    else if (field === 'note')          setNote(String(value));
  }

  async function doPublish() {
    if (!session) { setValidationErr('برای ثبت سفر باید وارد شوید.'); return; }
    // KYC is the hard gate — never publish for an unverified traveler, even if the button were
    // somehow reached. Mirrors the old page's server-gated behaviour.
    if (!isVerified) { setValidationErr('برای ثبت سفر باید احراز هویت شما تأیید شده باشد.'); return; }
    if (!step1Valid() || !step2Valid() || !step4Valid()) { setValidationErr('اطلاعات سفر کامل نیست.'); return; }
    setPublishing(true); setServerWriteError('');

    const capacity = parseFloat(capacityKg) || null;

    // Detail that the server has no dedicated column for goes into `note` (a real, persisted field
    // the matcher ignores). City text, arrival date and the optional carrier ref live here — never
    // in from/to. This is why a city string can never reach the corridor.
    const ref = MODE_REF[mode!];
    const bits: string[] = [];
    if (mode !== 'air') {
      if (fromCity) bits.push(`از ${fromCity}`);
      if (toCity)   bits.push(`به ${toCity}`);
    }
    if (arrivalDate)      bits.push(`تاریخ رسیدن: ${arrivalDate}`);
    if (ref1 && ref.ref1) bits.push(`${ref.ref1.replace(' (اختیاری)', '')}: ${ref1}`);
    if (ref2 && ref.ref2) bits.push(`${ref.ref2.replace(' (اختیاری)', '')}: ${ref2}`);
    const composedNote = [note.trim(), bits.join(' · ')].filter(Boolean).join(' — ');

    const travelerName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim() || null;

    const pub = await publishTrip({
      fromCountry, toCountry,
      date,
      capacityKg: capacity,
      minPricePerKg: minPrice ? parseFloat(minPrice) : null,
      note: composedNote,
      mode: mode!,
      userId: session.userId,
      travelerName,
    });

    if (pub.ok && pub.tripId) {
      // Mirror the server record into local Store.trips so "my trips" (which reads local Store)
      // shows it, carrying the REAL serverTripId — same contract the old page honours.
      const localId = genId('T');
      const localTrip = {
        id: localId, serverTripId: pub.tripId, userId: session.userId,
        origin: mode === 'air' ? (airOrigin?.iata ?? fromISO ?? '') : (fromCity || fromISO || ''),
        originCity: mode === 'air' ? (airOrigin?.city ?? '') : (fromCity || (fromISO ?? '')),
        destination: mode === 'air' ? (airDest?.iata ?? toISO ?? '') : (toCity || toISO || ''),
        destCity: mode === 'air' ? (airDest?.city ?? '') : (toCity || (toISO ?? '')),
        date, capacity, minPricePerKg: minPrice ? parseFloat(minPrice) : null,
        mode, status: 'open', userName: travelerName ?? '', createdAt: Date.now(),
        // Carry + payout stay CLIENT-SIDE only (like the old page). Payout is NOT sent to
        // /api/trips/publish and NOT put in the public note — the payment region is untouched;
        // this is collection only, no payment wiring.
        carryOptions: carry, payoutMethod, accountName: accountName.trim(),
      };
      const cur = Store.get<Record<string, unknown>[]>('trips') ?? [];
      cur.unshift(localTrip);
      Store.set('trips', cur.slice(0, 200));
      setResult({ tripId: pub.tripId });
    } else {
      console.error('[shell trip-publish] server write failed:', pub.error);
      setServerWriteError(pub.error ?? 'unknown');
    }
    setPublishing(false);
  }

  // ── success screen ──
  if (result) {
    const m = MODES.find(x => x.id === mode);
    return (
      <div className="min-h-screen bg-gray-50 pt-16 sm:pt-18" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
                 style={{ backgroundColor: (m ?? MODES[0]).soft }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: (m ?? MODES[0]).text }} aria-hidden />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">سفر شما ثبت شد</h2>
            <p className="text-sm text-gray-600 mb-4">سفر شما در بازارگاه دیده می‌شود و با سفارش‌های هم‌مسیر تطبیق داده می‌شود.</p>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4 text-center">
              <div className="text-[11px] font-bold text-gray-500 mb-0.5">شناسه سفر</div>
              <div className="text-base font-extrabold text-gray-900 font-mono tracking-wide">{result.tripId}</div>
            </div>

            <div className="flex items-center justify-center gap-2 text-gray-800 font-bold mb-6">
              <span>{COUNTRIES.find(c => c.iso2 === fromISO)?.flag} {fromISO}</span>
              <span className="text-gray-400 text-sm">←</span>
              <span>{COUNTRIES.find(c => c.iso2 === toISO)?.flag} {toISO}</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-sm text-gray-600">{capacityKg} kg</span>
            </div>

            <button onClick={onHome}
              className="w-full h-12 rounded-xl text-white font-bold"
              style={{ backgroundColor: (m ?? MODES[0]).text }}>
              بازگشت به خانه
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // App chrome is a fixed h-16 sm:h-18 z-50 header — pad + stick beneath it (P1 fix).
    <div className="min-h-screen bg-gray-50 pt-16 sm:pt-18" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="sticky top-16 sm:top-18 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={onBack} aria-label="بازگشت"
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-colors">
            {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <h1 className="text-[15px] font-bold text-gray-900">ثبت مسافر</h1>
          <button onClick={onHome} aria-label="خانه"
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-colors">
            <Home className="w-5 h-5" />
          </button>
        </div>

        {/* progress rail — the one surface that carries the mode accent */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map(s => {
              const done   = s.n < step;
              const active = s.n === step;
              return (
                <div key={s.n} className="flex-1">
                  <motion.div className="h-1 rounded-full"
                    animate={{ backgroundColor: done || active ? theme.mark : '#e5e7eb' }}
                    transition={reduce ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }} />
                  <div className="mt-1.5 text-[10px] font-semibold truncate text-center"
                       style={{ color: active || done ? theme.text : '#6b7280' }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-36">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>

            {step === 0 && <StepMode mode={mode} onPick={setMode} reduce={!!reduce} />}

            {step === 1 && (
              <StepOriginDest
                mode={mode!} theme={theme}
                airOrigin={airOrigin} airDest={airDest} setAirOrigin={setAirOrigin} setAirDest={setAirDest}
                fromCC={fromCC} toCC={toCC} setFromCC={setFromCC} setToCC={setToCC}
                fromCity={fromCity} toCity={toCity} setFromCity={setFromCity} setToCity={setToCity}
                reduce={!!reduce} />
            )}

            {step === 2 && (
              <StepDateCapacity
                mode={mode!} theme={theme}
                date={date} setDate={setDate} arrivalDate={arrivalDate} setArrivalDate={setArrivalDate}
                capacityKg={capacityKg} setCapacityKg={setCapacityKg}
                minPrice={minPrice} setMinPrice={setMinPrice} note={note} setNote={setNote}
                ref1={ref1} setRef1={setRef1} ref2={ref2} setRef2={setRef2}
                onApply={applyAssist} reduce={!!reduce} />
            )}

            {step === 3 && (
              <StepKyc mode={mode!} theme={theme} reduce={!!reduce}
                isVerified={isVerified} kycStatus={kycStatus} kycLoading={kycLoading}
                captureOpen={kycCaptureOpen} setCaptureOpen={setKycCaptureOpen} onRecheck={refetchKyc} />
            )}

            {step === 4 && (
              <StepCarryPayout mode={mode!} theme={theme} reduce={!!reduce}
                carry={carry} setCarry={setCarry}
                prohibitedAck={prohibitedAck} setProhibitedAck={setProhibitedAck}
                payoutMethod={payoutMethod} setPayoutMethod={setPayoutMethod}
                accountName={accountName} setAccountName={setAccountName} />
            )}
          </motion.div>
        </AnimatePresence>

        {validationErr && (
          <div className="mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            {validationErr}
          </div>
        )}
        {serverWriteError && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="text-sm font-bold text-amber-800 mb-1">سفر ثبت شد، اما هنوز در بازارگاه دیده نمی‌شود.</div>
            <div className="text-xs text-amber-700 leading-relaxed">ثبت روی سرور انجام نشد؛ لطفاً دوباره تلاش کنید.</div>
            <div className="text-[10px] text-amber-600 font-mono mt-1">{serverWriteError}</div>
          </div>
        )}
      </main>

      {/* sticky footer nav */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => go(step - 1)} disabled={publishing}
              className="px-5 h-12 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40">
              قبلی
            </button>
          )}
          <button
            onClick={() => { if (step === 4) doPublish(); else go(Math.min(step + 1, 4)); }}
            disabled={!canAdvance || publishing}
            className="flex-1 h-12 rounded-xl text-white font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: mode ? theme.text : '#374151' }}>
            {publishing ? 'در حال ثبت…' : step === 0 ? 'ادامه' : step === 4 ? 'ثبت سفر' : 'بعدی'}
          </button>
        </div>
        {!session && (
          <div className="max-w-2xl mx-auto px-4 pb-3 -mt-1 text-[11px] text-gray-500">
            برای ثبت سفر باید وارد شوید.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 0 — mode select ──────────────────────────────────────────────────────
function StepMode({ mode, onPick, reduce }:
  { mode: ModeId | null; onPick: (id: ModeId) => void; reduce: boolean }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 mb-1">سفر شما از چه راهی است؟</h2>
      <p className="text-sm text-gray-600 mb-5">هر مسیر اطلاعات کمی متفاوت می‌خواهد. با انتخاب نوع مسیر، فقط همان‌ها را می‌پرسیم.</p>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(m => {
          const selected = mode === m.id;
          return (
            <button key={m.id} onClick={() => onPick(m.id)} aria-pressed={selected}
              className="relative text-start rounded-2xl border-2 p-4 bg-white transition-colors focus:outline-none focus-visible:ring-4"
              style={{ borderColor: selected ? m.mark : '#e5e7eb', backgroundColor: selected ? m.soft : '#ffffff' }}>
              <motion.span layoutId={selected ? 'mode-mark' : undefined}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                className="inline-flex w-11 h-11 rounded-xl items-center justify-center mb-3"
                style={{ backgroundColor: m.soft }}>
                <m.Icon className="w-6 h-6" style={{ color: m.mark }} aria-hidden />
              </motion.span>
              <div className="font-bold text-[15px]" style={{ color: selected ? m.text : '#111827' }}>{m.label}</div>
              <div className="text-[11px] leading-snug mt-0.5 text-gray-600">{m.hint}</div>
              {selected && (
                <span className="absolute top-3 end-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: m.text }}>
                  <Check className="w-3 h-3 text-white" aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-gray-500">بعداً هم می‌توانید نوع مسیر را تغییر دهید.</p>
    </div>
  );
}

// ── mode header (icon + label), shared by steps 1/2/placeholder ───────────────
function ModeHeader({ mode, theme, title, reduce }:
  { mode: ModeId; theme: typeof NEUTRAL; title: string; reduce: boolean }) {
  const m = MODES.find(x => x.id === mode)!;
  return (
    <div className="flex items-center gap-3 mb-5">
      <motion.span layoutId="mode-mark"
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
        className="inline-flex w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: m.soft }}>
        <m.Icon className="w-6 h-6" style={{ color: m.mark }} aria-hidden />
      </motion.span>
      <div>
        <div className="text-[11px] font-semibold" style={{ color: theme.text }}>مسیر {m.label}</div>
        <h2 className="text-lg font-extrabold text-gray-900 leading-tight">{title}</h2>
      </div>
    </div>
  );
}

// ── country picker (native select — accessible, RTL-safe, no fake autocomplete) ──
// Reads COUNTRIES from tripPublish.ts — the ONE country source. Its value is ISO2, sent verbatim
// as the corridor. No 8th copy of any country table.
function CountrySelect({ label, value, onChange, accent }:
  { label: string; value: string; onChange: (iso2: string) => void; accent: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-xl border-2 bg-white text-gray-900 text-sm font-medium focus:outline-none"
        style={{ borderColor: value ? accent : '#e5e7eb' }}>
        <option value="">— کشور را انتخاب کنید —</option>
        {COUNTRIES.map(c => (
          <option key={c.iso2} value={c.iso2}>{c.flag} {c.fa} ({c.iso2})</option>
        ))}
      </select>
    </div>
  );
}

// ── Step 1 — origin / destination (per mode) ──────────────────────────────────
function StepOriginDest(p: {
  mode: ModeId; theme: typeof NEUTRAL;
  airOrigin: AirportOption | null; airDest: AirportOption | null;
  setAirOrigin: (v: AirportOption | null) => void; setAirDest: (v: AirportOption | null) => void;
  fromCC: string; toCC: string; setFromCC: (v: string) => void; setToCC: (v: string) => void;
  fromCity: string; toCity: string; setFromCity: (v: string) => void; setToCity: (v: string) => void;
  reduce: boolean;
}) {
  const ref = MODE_REF[p.mode];
  return (
    <div>
      <ModeHeader mode={p.mode} theme={p.theme} title="مبدأ و مقصد" reduce={p.reduce} />

      {p.mode === 'air' ? (
        <div className="space-y-4">
          <AirportCityAutocomplete label="فرودگاه مبدأ"  value={p.airOrigin} onChange={p.setAirOrigin} placeholder={ref.placeFrom} />
          <AirportCityAutocomplete label="فرودگاه مقصد" value={p.airDest}   onChange={p.setAirDest}   placeholder={ref.placeTo} />
          <p className="text-[11px] text-gray-500">کشور مبدأ و مقصد از روی فرودگاه انتخاب‌شده تعیین می‌شود.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Country is the REQUIRED, corridor-bearing field (ISO2). City is optional detail. */}
          <div className="grid grid-cols-1 gap-4">
            <CountrySelect label="کشور مبدأ" value={p.fromCC} onChange={p.setFromCC} accent={p.theme.mark} />
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">{ref.placeFrom}</label>
              <input type="text" value={p.fromCity} onChange={e => p.setFromCity(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none"
                placeholder={ref.cityLabel} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <CountrySelect label="کشور مقصد" value={p.toCC} onChange={p.setToCC} accent={p.theme.mark} />
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">{ref.placeTo}</label>
              <input type="text" value={p.toCity} onChange={e => p.setToCity(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none"
                placeholder={ref.cityLabel} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">کشور برای تطبیق در بازارگاه استفاده می‌شود؛ نام شهر فقط برای نمایش است.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 2 — date / capacity / optionals ──────────────────────────────────────
function StepDateCapacity(p: {
  mode: ModeId; theme: typeof NEUTRAL;
  date: string; setDate: (v: string) => void; arrivalDate: string; setArrivalDate: (v: string) => void;
  capacityKg: string; setCapacityKg: (v: string) => void;
  minPrice: string; setMinPrice: (v: string) => void; note: string; setNote: (v: string) => void;
  ref1: string; setRef1: (v: string) => void; ref2: string; setRef2: (v: string) => void;
  onApply: (field: AssistSuggestion['field'], value: number | string) => void;
  reduce: boolean;
}) {
  const ref = MODE_REF[p.mode];
  const inputCls = 'w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none';
  return (
    <div>
      <ModeHeader mode={p.mode} theme={p.theme} title="تاریخ و ظرفیت" reduce={p.reduce} />

      {/* AI helper — light theme, tap-to-apply, additive. Lives on the capacity step because that
          is what it can genuinely help estimate. Collapsed by default; never blocks the form. */}
      <TravelerAssistant accent={p.theme} onApply={p.onApply} />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">تاریخ حرکت<span className="text-red-500"> *</span></label>
            <input type="date" min={today} value={p.date} onChange={e => p.setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">تاریخ رسیدن (اختیاری)</label>
            <input type="date" min={p.date || today} value={p.arrivalDate} onChange={e => p.setArrivalDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">ظرفیت (کیلوگرم)<span className="text-red-500"> *</span></label>
            <input type="number" min="0" step="0.5" inputMode="decimal" value={p.capacityKg}
              onChange={e => p.setCapacityKg(e.target.value)} className={inputCls} placeholder="مثلاً ۱۰" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">حداقل قیمت هر کیلو ($) (اختیاری)</label>
            <input type="number" min="0" step="1" inputMode="decimal" value={p.minPrice}
              onChange={e => p.setMinPrice(e.target.value)} className={inputCls} placeholder="اختیاری" />
          </div>
        </div>

        {/* Mode-specific OPTIONAL carrier references. Clearly optional; a self-declared ref is a
            note, never a verified booking, and is stored as text only. */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">جزئیات سفر (اختیاری)</div>
          <div className="grid grid-cols-1 gap-3">
            {ref.ref1 && (
              <input type="text" value={p.ref1} onChange={e => p.setRef1(e.target.value)} className={inputCls} placeholder={ref.ref1} />
            )}
            {ref.ref2 && (
              <input type="text" value={p.ref2} onChange={e => p.setRef2(e.target.value)} className={inputCls} placeholder={ref.ref2} />
            )}
            <input type="text" value={p.note} onChange={e => p.setNote(e.target.value)} className={inputCls} placeholder="توضیحات (اختیاری)" />
          </div>
          <p className="mt-2 text-[11px] text-gray-500">این موارد خوداظهاری است و به‌عنوان «تأییدشده» نمایش داده نمی‌شود.</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — KYC (real gate, reuses /api/kyc/status + IdentityVerification) ────
function StepKyc(p: {
  mode: ModeId; theme: typeof NEUTRAL; reduce: boolean;
  isVerified: boolean; kycStatus: string | null; kycLoading: boolean;
  captureOpen: boolean; setCaptureOpen: (v: boolean) => void; onRecheck: () => void;
}) {
  // Neutral status labels only — no internal reasons leaked (matches the service contract).
  const STATUS: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    verified:     { label: 'تأیید شده',       cls: 'bg-green-50 text-green-700 border-green-200', Icon: ShieldCheck },
    under_review: { label: 'در حال بررسی',     cls: 'bg-blue-50 text-blue-700 border-blue-200',    Icon: Clock },
    pending:      { label: 'در انتظار مدارک',  cls: 'bg-gray-50 text-gray-600 border-gray-200',    Icon: Clock },
    rejected:     { label: 'رد شده',           cls: 'bg-red-50 text-red-700 border-red-200',       Icon: XCircle },
  };
  const badge = STATUS[p.kycStatus ?? 'pending'] ?? STATUS.pending;

  return (
    <div>
      <ModeHeader mode={p.mode} theme={p.theme} title="احراز هویت" reduce={p.reduce} />

      {p.isVerified ? (
        // Verified — never fabricated; this branch only renders when the service returned 'verified'.
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" aria-hidden />
          <div>
            <div className="font-bold text-green-800 mb-0.5">هویت شما تأیید شده است</div>
            <p className="text-sm text-green-700 leading-relaxed">می‌توانید به مرحلهٔ بعد بروید و سفر خود را ثبت کنید.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">وضعیت احراز هویت</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
                <badge.Icon className="w-3 h-3" />{badge.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              برای ثبت سفر باید هویت شما تأیید شود. مدرک شناسایی و سلفی خود را بارگذاری کنید؛ پس از
              بررسی، وضعیت به «تأیید شده» تغییر می‌کند.
            </p>
          </div>

          {/* The REAL capture UI, wired to the kyc service (doc upload + face-match). Not simulated. */}
          <IdentityVerification enabled={p.captureOpen} onToggle={p.setCaptureOpen}
            status={p.isVerified ? 'VERIFIED' : 'PENDING'} />

          <button onClick={p.onRecheck} disabled={p.kycLoading}
            className="w-full h-11 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${p.kycLoading ? 'animate-spin' : ''}`} />
            بررسی مجدد وضعیت
          </button>
          <p className="text-[11px] text-gray-500 text-center">تا زمانی که وضعیت «تأیید شده» نشود، امکان ثبت سفر وجود ندارد.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 4 — carry options + prohibited-goods hard-stop + payout ──────────────
function StepCarryPayout(p: {
  mode: ModeId; theme: typeof NEUTRAL; reduce: boolean;
  carry: string[]; setCarry: (v: string[]) => void;
  prohibitedAck: boolean; setProhibitedAck: (v: boolean) => void;
  payoutMethod: string | null; setPayoutMethod: (v: string) => void;
  accountName: string; setAccountName: (v: string) => void;
}) {
  const toggleCarry = (k: string) =>
    p.setCarry(p.carry.includes(k) ? p.carry.filter(x => x !== k) : [...p.carry, k]);

  return (
    <div>
      <ModeHeader mode={p.mode} theme={p.theme} title="حمل و تسویه" reduce={p.reduce} />

      {/* carry categories */}
      <div className="mb-5">
        <div className="text-xs font-bold text-gray-600 mb-2">چه نوع کالایی حمل می‌کنید؟<span className="text-red-500"> *</span></div>
        <div className="flex flex-wrap gap-2">
          {CARRY_OPTIONS.map(o => {
            const on = p.carry.includes(o.key);
            return (
              <button key={o.key} onClick={() => toggleCarry(o.key)} aria-pressed={on}
                className="px-3 h-10 rounded-xl border-2 text-sm font-semibold transition-colors"
                style={{ borderColor: on ? p.theme.mark : '#e5e7eb',
                         backgroundColor: on ? p.theme.soft : '#ffffff',
                         color: on ? p.theme.text : '#374151' }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* prohibited-goods — RULES-BASED HARD STOP (static list, never an AI judgment) */}
      <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden />
          <span className="text-sm font-bold text-red-800">کالای ممنوعه (حمل ممنوع)</span>
        </div>
        <ul className="text-[13px] text-red-700 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
          {PROHIBITED_CATEGORIES.map(c => <li key={c}>• {c}</li>)}
        </ul>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={p.prohibitedAck} onChange={e => p.setProhibitedAck(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-red-600" />
          <span className="text-[13px] font-semibold text-red-800">
            تأیید می‌کنم که هیچ‌کدام از موارد بالا را حمل نمی‌کنم.<span className="text-red-500"> *</span>
          </span>
        </label>
      </div>

      {/* payout — COLLECTION ONLY, no payment wiring */}
      <div>
        <div className="text-xs font-bold text-gray-600 mb-2">روش تسویه<span className="text-red-500"> *</span></div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PAYOUT_METHODS.map(m => {
            const on = p.payoutMethod === m.key;
            return (
              <button key={m.key} onClick={() => p.setPayoutMethod(m.key)} aria-pressed={on}
                className="px-3 h-10 rounded-xl border-2 text-sm font-semibold transition-colors"
                style={{ borderColor: on ? p.theme.mark : '#e5e7eb',
                         backgroundColor: on ? p.theme.soft : '#ffffff',
                         color: on ? p.theme.text : '#374151' }}>
                {m.label}
              </button>
            );
          })}
        </div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">نام صاحب حساب<span className="text-red-500"> *</span></label>
        <input type="text" value={p.accountName} onChange={e => p.setAccountName(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none"
          placeholder="نام و نام خانوادگی صاحب حساب" />
        <p className="mt-2 text-[11px] text-gray-500">جزئیات تسویه فقط ذخیره می‌شود؛ در این مرحله پرداختی انجام نمی‌شود.</p>
      </div>
    </div>
  );
}
