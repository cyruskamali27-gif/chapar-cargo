import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Plane, Bus, TrainFront, Ship, ArrowLeft, ArrowRight, Home, Check, CheckCircle2,
         ShieldCheck, Clock, XCircle, RefreshCw, AlertTriangle, Scale, IdCard, BookUser,
         CreditCard, Camera, ScanFace, Loader2 } from 'lucide-react';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { useKycGate } from '../lib/useKycGate';
import { Store, genId } from '../lib/store';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import GuidedCapture from './GuidedCapture';
import TravelerAssistant, { type AssistSuggestion } from './TravelerAssistant';
import PreferredChannelStep from './PreferredChannelStep';
import RequiredHint from './RequiredHint';   // CMD-66: names what step 2 is still missing
import { publishTrip, toISO2, COUNTRIES, type TripMode } from '../lib/tripPublish';
import { PROHIBITED_CATEGORIES } from '../lib/prohibited';

// ── ثبت مسافر چندمسیره — CMD-48 ───────────────────────────────────────────────
//
// P1 (CMD-21) shipped step 0 (mode select) + the shell. P2 (CMD-22) shipped the shared
// tripPublish.ts. P3 (CMD-23) filled in steps 1/2 and wired publish through that SAME
// tripPublish.ts — one publish path, one ISO2 contract.
//
// CMD-48 does four things:
//   1. ONE DESIGN SYSTEM. The shell used to carry four per-mode accent palettes and raw
//      Tailwind greys, so «ثبت مسافر» and «ثبت کالا» looked like two different products.
//      Everything now renders on the shared --ds-* tokens (styles/design-system.css) with
//      ONE accent, exactly like SendPackagePage. Travel mode is expressed by icon + label.
//   2. The air corridor gets a real IATA route card (ds-route-card) instead of flag emoji.
//   3. The standalone capacity page is GONE. Capacity is a conversation with the assistant,
//      with a compact inline field as the additive fallback (see CapacityField below).
//   4. «احراز هویت» is a real doc-type → capture → status flow over the EXISTING kyc +
//      face-match services. No service contract changed.
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

// Mode is IDENTITY, not theme: an icon and a label. The accent belongs to the design system.
const MODES: { id: ModeId; label: string; hint: string; Icon: typeof Plane }[] = [
  { id: 'air',  label: 'هوایی',  hint: 'پرواز — چمدان مسافری',            Icon: Plane     },
  { id: 'land', label: 'زمینی',  hint: 'اتوبوس، ون یا خودرو',              Icon: Bus       },
  { id: 'rail', label: 'ریلی',   hint: 'قطار بین‌شهری یا بین‌المللی',       Icon: TrainFront },
  { id: 'sea',  label: 'دریایی', hint: 'کشتی — ظرفیت بیشتر، زمان بیشتر',  Icon: Ship      },
];

const STEPS = ['نوع مسیر', 'مبدأ و مقصد', 'تاریخ سفر', 'احراز هویت', 'حمل و تسویه'];

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

// Kill-switch for the capacity assistant. `off` forces the inline capacity field for everyone —
// the same surface a network failure produces, so the fallback path is testable without breaking
// the network. Anything else (including unset) leaves the assistant on.
const AI_ENABLED = (import.meta.env.VITE_TRAVELER_AI ?? '') !== 'off';

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

  // Step ALWAYS starts at 0 — «نوع مسیر» is the first screen from every entry point, with no
  // deeplink, draft or prop able to seed a later step. See the App.tsx `key` note (CMD-48 T2).
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

  // ── step 2 — date + assistant-driven capacity + optionals ──
  const [date, setDate]           = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [capacityKg, setCapacityKg]   = useState('');
  const [minPrice, setMinPrice]       = useState('');
  const [note, setNote]               = useState('');
  const [ref1, setRef1]               = useState('');   // mode-specific carrier ref (optional)
  const [ref2, setRef2]               = useState('');
  // The assistant reports its own unavailability (env flag or a failed /api/ai/chat call). The
  // shell reacts by revealing the inline capacity field — it never waits on, or blocks for, the AI.
  const [aiDown, setAiDown]           = useState(!AI_ENABLED);
  // CMD-66: `capacityNudge` state removed. It existed to reveal the inline capacity field after a
  // failed «بعدی» tap; the field is now revealed by the absence of a capacity itself (see
  // showInlineCapacity at step 2), which is strictly earlier and needs no state. One trigger for
  // one behaviour — a nudge flag alongside an auto-reveal would be two.

  // ── step 3 (احراز هویت) ──
  const [docType,   setDocType]   = useState<KycDocType | null>(null);
  const [capture,   setCapture]   = useState<null | 'document' | 'face'>(null);
  const [docDone,   setDocDone]   = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [faceMatch, setFaceMatch] = useState<'idle' | 'running' | 'sent' | 'failed'>('idle');
  const [docKey,    setDocKey]    = useState<string | null>(null);
  const [selfieKey, setSelfieKey] = useState<string | null>(null);

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

  // The corridor countries, resolved to ISO2. Air derives from the airport's country; the other
  // modes already hold ISO2 in fromCC/toCC. toISO2 accepts either, so this is one code path.
  const fromCountry = mode === 'air' ? airOrigin?.country : fromCC;
  const toCountry   = mode === 'air' ? airDest?.country   : toCC;
  const fromISO = toISO2(fromCountry);
  const toISO   = toISO2(toCountry);

  // Face-match fires once both artefacts exist — the SAME endpoint and payload the cargo flow
  // uses. The kyc/face-match services are untouched; this only calls them.
  useEffect(() => {
    if (!docKey || !selfieKey || faceMatch !== 'idle') return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setFaceMatch('running');
    fetch('/api/kyc/passport/face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ selfieMediaKey: selfieKey, passportMediaKey: docKey }),
    })
      .then(r => { setFaceMatch(r.ok ? 'sent' : 'failed'); if (r.ok) refetchKyc(); })
      .catch(() => setFaceMatch('failed'));
  }, [docKey, selfieKey, faceMatch, refetchKyc]);

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
  // ── CMD-66 — step-2 capacity gate ───────────────────────────────────────────
  //
  // Step 2 used to advance on `!!date` alone: capacity was "nudged, not gated". «بعدی» looked
  // enabled, the tap was swallowed by go(), and only THEN did the capacity field appear — the
  // one interaction CMD-65 set out to remove everywhere else. Capacity is not optional
  // (doPublish() and step2Valid() both demand it, and the matcher cannot evaluate a trip's
  // remaining capacity without it), so it belongs in the gate, not in a nudge.
  //
  // A gate alone would be worse than the nudge, though: it would disable «بعدی» over a field
  // that was not on screen. It is paired with the auto-reveal below — the two ship together or
  // not at all.
  const canAdvance =
    step === 0 ? mode !== null :
    step === 1 ? step1Valid()  :
    step === 2 ? step2Valid()  :
    step === 3 ? step3Valid()  :
    step === 4 ? step4Valid()  :
    true;

  // Named exactly as step 2 labels them on screen, per RequiredHint's contract.
  const missingStep2: string[] = [];
  if (!date)                          missingStep2.push('تاریخ حرکت');
  if (!(parseFloat(capacityKg) > 0))  missingStep2.push('ظرفیت قابل حمل');

  function go(next: number) {
    setValidationErr('');
    if (next > step) {
      if (step === 1 && !step1Valid()) { setValidationErr('مبدأ و مقصد را کامل کنید.'); return; }
      // CMD-66: the reveal-on-failed-tap that used to live here is gone — the field is now on
      // screen from the moment it is needed (see showInlineCapacity), and canAdvance blocks the
      // tap that used to trigger it, so this branch is a defensive belt only. Kept, like the
      // step-1 and step-3 guards beside it, so go() never depends on the button being correct.
      if (step === 2 && !step2Valid()) {
        setValidationErr(!date ? 'تاریخ حرکت الزامی است.' : 'ظرفیت (کیلوگرم) را وارد کنید یا از دستیار کمک بگیرید.');
        return;
      }
      if (step === 3 && !step3Valid()) { setValidationErr('برای ادامه باید احراز هویت شما تأیید شده باشد.'); return; }
    }
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const corridor = {
    fromCode: mode === 'air' ? (airOrigin?.iata ?? '') : (fromISO ?? ''),
    fromName: mode === 'air' ? (airOrigin?.city ?? '') : (fromCity || COUNTRIES.find(c => c.iso2 === fromISO)?.fa || ''),
    toCode:   mode === 'air' ? (airDest?.iata ?? '')   : (toISO ?? ''),
    toName:   mode === 'air' ? (airDest?.city ?? '')   : (toCity || COUNTRIES.find(c => c.iso2 === toISO)?.fa || ''),
  };

  // ── success screen ──
  if (result) {
    return (
      <div className="min-h-screen bg-white pt-16 sm:pt-18" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
                 style={{ background: 'var(--ds-success-bg)', border: '1px solid var(--ds-success-border)' }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--ds-success)' }} aria-hidden />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">سفر شما ثبت شد</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              سفر شما در بازارگاه دیده می‌شود و با سفارش‌های هم‌مسیر تطبیق داده می‌شود.
            </p>

            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-4">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">شناسهٔ سفر</div>
              <div className="text-xl font-extrabold text-gray-900 tracking-wider font-mono">{result.tripId}</div>
            </div>

            <div className="mb-6">
              <RouteCard mode={mode!} {...corridor} meta={`${capacityKg} kg`} isRTL={isRTL} />
            </div>

            <button onClick={onHome} className="ds-btn-primary w-full" style={{ height: 48 }}>
              بازگشت به خانه
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // App chrome is a fixed h-16 sm:h-18 z-50 header — pad + stick beneath it (P1 fix).
    <div className="min-h-screen bg-white pt-16 sm:pt-18" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="sticky top-16 sm:top-18 z-20 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid var(--ds-border)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={onBack} aria-label="بازگشت"
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <h1 className="text-[15px] font-bold text-gray-900">ثبت مسیر مسافر</h1>
          <button onClick={onHome} aria-label="خانه"
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <Home className="w-5 h-5" />
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <StepPills step={step} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-36">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>

            {step === 0 && <StepMode mode={mode} onPick={setMode} />}

            {step === 1 && (
              <StepOriginDest
                mode={mode!} corridor={corridor} isRTL={isRTL}
                airOrigin={airOrigin} airDest={airDest} setAirOrigin={setAirOrigin} setAirDest={setAirDest}
                fromCC={fromCC} toCC={toCC} setFromCC={setFromCC} setToCC={setToCC}
                fromCity={fromCity} toCity={toCity} setFromCity={setFromCity} setToCity={setToCity} />
            )}

            {step === 2 && (
              <StepDate
                mode={mode!}
                date={date} setDate={setDate} arrivalDate={arrivalDate} setArrivalDate={setArrivalDate}
                capacityKg={capacityKg} setCapacityKg={setCapacityKg}
                minPrice={minPrice} setMinPrice={setMinPrice} note={note} setNote={setNote}
                ref1={ref1} setRef1={setRef1} ref2={ref2} setRef2={setRef2}
                onApply={applyAssist}
                aiEnabled={AI_ENABLED} aiDown={aiDown} onAiDown={() => setAiDown(true)}
                // CMD-66 auto-reveal — was `aiDown || capacityNudge`, i.e. the field only
                // appeared once the assistant had failed OR the traveler had already tapped a
                // dead «بعدی». Now that capacity gates the button, that tap can never happen, so
                // the field reveals itself the moment it is what's missing. The assistant stays
                // mounted above it: propose-or-type, both offered at once, neither blocking the
                // other. Once a capacity exists this flips false and StepDate swaps to the
                // compact «ظرفیت اعلام‌شده» readout — which is still editable, so nothing is lost.
                showInlineCapacity={aiDown || !(parseFloat(capacityKg) > 0)} />
            )}

            {step === 3 && (
              <StepKyc
                mode={mode!}
                isVerified={isVerified} kycStatus={kycStatus} kycLoading={kycLoading} onRecheck={refetchKyc}
                docType={docType} setDocType={setDocType}
                docDone={docDone} selfieDone={selfieDone} faceMatch={faceMatch}
                onOpenCapture={setCapture} />
            )}

            {step === 4 && (
              <StepCarryPayout
                mode={mode!}
                carry={carry} setCarry={setCarry}
                prohibitedAck={prohibitedAck} setProhibitedAck={setProhibitedAck}
                payoutMethod={payoutMethod} setPayoutMethod={setPayoutMethod}
                accountName={accountName} setAccountName={setAccountName} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* CMD-66 — step 2's «بعدی» is now gated on capacity, and design-system.css sets
            pointer-events:none on a disabled .ds-btn-primary, so the button itself can carry no
            explanation. Same component, same wording as the buy and send flows. Only step 2 is
            hinted: steps 1, 3 and 4 were gated before this command and are out of its scope. */}
        {step === 2 && <RequiredHint missing={missingStep2} />}

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
      <div className="fixed bottom-0 inset-x-0 bg-white" style={{ borderTop: '1px solid var(--ds-border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => go(step - 1)} disabled={publishing}
              className="ds-btn-secondary disabled:opacity-40" style={{ height: 48 }}>
              قبلی
            </button>
          )}
          <button
            onClick={() => { if (step === 4) doPublish(); else go(Math.min(step + 1, 4)); }}
            disabled={!canAdvance || publishing}
            className="ds-btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ height: 48 }}>
            {publishing ? 'در حال ثبت…' : step === 4 ? 'ثبت سفر' : step === 0 ? 'ادامه' : 'بعدی'}
          </button>
        </div>
        {!session && (
          <div className="max-w-2xl mx-auto px-4 pb-3 -mt-1 text-[11px] text-gray-500">
            برای ثبت سفر باید وارد شوید.
          </div>
        )}
      </div>

      {/* KYC capture — full-screen, launched from step 3. Uses the SAME GuidedCapture the cargo
          flow uses, so doc upload / liveness / face-match all run against the existing services. */}
      {capture && (
        <GuidedCapture
          mode={capture}
          liveness={capture === 'face'}
          initialDocType={capture === 'document' ? (docType ?? undefined) : undefined}
          onBack={() => setCapture(null)}
          onHome={() => setCapture(null)}
          onComplete={(r) => {
            setCapture(null);
            if (r.docMediaKey)    { setDocKey(r.docMediaKey);    setDocDone(true); }
            if (r.selfieMediaKey) { setSelfieKey(r.selfieMediaKey); setSelfieDone(true); }
            refetchKyc();
          }}
        />
      )}
    </div>
  );
}

// ── Step rail ─────────────────────────────────────────────────────────────────
// Visually identical to SendPackagePage's StepPills — same dot size, same connector, same
// numbering, same active ring. That equality IS the "one design system" requirement.
function StepPills({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
      {STEPS.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center flex-shrink-0">
            {i > 0 && <div className={`ds-step-connector w-3 sm:w-5 ${done ? 'ds-step-connector--done' : ''}`} />}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`ds-step-dot ${done ? 'ds-step-dot--done' : active ? 'ds-step-dot--active' : ''}`}>
                {done ? <Check className="w-3.5 h-3.5" aria-hidden /> : i + 1}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap hidden sm:block ${
                active ? 'text-cyan-700' : done ? 'text-emerald-700' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Route card — IATA left / route line centre / IATA right (CMD-48 T3) ───────
// Replaces the flag-emoji + arrow treatment. Codes are the international constant; the city
// name is the human read. The centre is a hairline with one small mode glyph on it — no
// clip-art, and it composes identically in RTL because the grid is direction-agnostic and the
// two ends are labelled, not positional.
function RouteCard({ mode, fromCode, fromName, toCode, toName, meta, isRTL }: {
  mode: ModeId; fromCode: string; fromName: string; toCode: string; toName: string;
  meta?: string; isRTL: boolean;
}) {
  const m = MODES.find(x => x.id === mode)!;
  return (
    <div>
      <div className="ds-route-card">
        <div className="min-w-0">
          <div className="ds-route-label">مبدأ</div>
          <div className={`ds-route-iata ${fromCode ? '' : 'ds-route-iata--empty'}`}>{fromCode || '– – –'}</div>
          {fromName && <div className="ds-route-city">{fromName}</div>}
        </div>

        <div className="ds-route-line" aria-hidden>
          <span className="ds-route-dot" />
          <m.Icon className="w-4 h-4 flex-shrink-0"
                  style={{ transform: `rotate(${isRTL ? -90 : 90}deg)` }} />
          <span className="ds-route-dot" />
        </div>

        <div className="min-w-0 text-end">
          <div className="ds-route-label">مقصد</div>
          <div className={`ds-route-iata ${toCode ? '' : 'ds-route-iata--empty'}`}>{toCode || '– – –'}</div>
          {toName && <div className="ds-route-city">{toName}</div>}
        </div>
      </div>
      {meta && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
          <m.Icon className="w-3.5 h-3.5" aria-hidden /><span>مسیر {m.label}</span>
          <span className="text-gray-300">·</span><span>{meta}</span>
        </div>
      )}
    </div>
  );
}

// ── Step 0 — mode select ──────────────────────────────────────────────────────
function StepMode({ mode, onPick }: { mode: ModeId | null; onPick: (id: ModeId) => void }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 mb-1">سفر شما از چه راهی است؟</h2>
      <p className="text-sm text-gray-500 mb-5">هر مسیر اطلاعات کمی متفاوت می‌خواهد. با انتخاب نوع مسیر، فقط همان‌ها را می‌پرسیم.</p>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(m => {
          const selected = mode === m.id;
          return (
            <button key={m.id} onClick={() => onPick(m.id)} aria-pressed={selected} className="ds-choice p-4">
              <span className={`inline-flex w-11 h-11 rounded-xl items-center justify-center mb-3 ${
                selected ? 'bg-cyan-100' : 'bg-gray-100'}`}>
                <m.Icon className={`w-6 h-6 ${selected ? 'text-cyan-700' : 'text-gray-500'}`} aria-hidden />
              </span>
              <div className={`font-bold text-[15px] ${selected ? 'text-cyan-700' : 'text-gray-900'}`}>{m.label}</div>
              <div className="text-[11px] leading-snug mt-0.5 text-gray-500">{m.hint}</div>
              {selected && (
                <span className="absolute top-3 end-3 w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center">
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

// ── mode header (icon + label), shared by steps 1–4 ───────────────────────────
function StepHeader({ mode, title, desc }: { mode: ModeId; title: string; desc?: string }) {
  const m = MODES.find(x => x.id === mode)!;
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="inline-flex w-11 h-11 rounded-xl items-center justify-center bg-cyan-50 border border-cyan-100 flex-shrink-0">
        <m.Icon className="w-6 h-6 text-cyan-700" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-cyan-700">مسیر {m.label}</div>
        <h2 className="text-lg font-extrabold text-gray-900 leading-tight">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

// ── country picker (native select — accessible, RTL-safe, no fake autocomplete) ──
// Reads COUNTRIES from tripPublish.ts — the ONE country source. Its value is ISO2, sent verbatim
// as the corridor. No 8th copy of any country table.
function CountrySelect({ label, value, onChange }:
  { label: string; value: string; onChange: (iso2: string) => void }) {
  return (
    <div>
      <label className="ds-label font-semibold">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="ds-input">
        <option value="">— کشور را انتخاب کنید —</option>
        {COUNTRIES.map(c => (
          <option key={c.iso2} value={c.iso2}>{c.fa} ({c.iso2})</option>
        ))}
      </select>
    </div>
  );
}

// ── Step 1 — origin / destination (per mode) ──────────────────────────────────
function StepOriginDest(p: {
  mode: ModeId; isRTL: boolean;
  corridor: { fromCode: string; fromName: string; toCode: string; toName: string };
  airOrigin: AirportOption | null; airDest: AirportOption | null;
  setAirOrigin: (v: AirportOption | null) => void; setAirDest: (v: AirportOption | null) => void;
  fromCC: string; toCC: string; setFromCC: (v: string) => void; setToCC: (v: string) => void;
  fromCity: string; toCity: string; setFromCity: (v: string) => void; setToCity: (v: string) => void;
}) {
  const ref = MODE_REF[p.mode];
  return (
    <div>
      <StepHeader mode={p.mode} title="مبدأ و مقصد" />

      {/* Live corridor preview — fills in as the traveler picks. */}
      <div className="mb-5">
        <RouteCard mode={p.mode} {...p.corridor} isRTL={p.isRTL} />
      </div>

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
            <CountrySelect label="کشور مبدأ" value={p.fromCC} onChange={p.setFromCC} />
            <div>
              <label className="ds-label font-semibold">{ref.placeFrom}</label>
              <input type="text" value={p.fromCity} onChange={e => p.setFromCity(e.target.value)}
                className="ds-input" placeholder={ref.cityLabel} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <CountrySelect label="کشور مقصد" value={p.toCC} onChange={p.setToCC} />
            <div>
              <label className="ds-label font-semibold">{ref.placeTo}</label>
              <input type="text" value={p.toCity} onChange={e => p.setToCity(e.target.value)}
                className="ds-input" placeholder={ref.cityLabel} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">کشور برای تطبیق در بازارگاه استفاده می‌شود؛ نام شهر فقط برای نمایش است.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 2 — travel date (capacity is conversational — CMD-48 T4) ─────────────
// The standalone «ظرفیت خود را اعلام کنید» page is deleted. Capacity now comes from the
// assistant as a tap-to-apply proposal. The inline field below is the ADDITIVE fallback: it
// appears when the assistant is switched off, when it fails, or the moment the traveler tries to
// advance without a capacity. It is a single field in the flow — never a page of its own — so no
// AI outcome can dead-end registration.
function StepDate(p: {
  mode: ModeId;
  date: string; setDate: (v: string) => void; arrivalDate: string; setArrivalDate: (v: string) => void;
  capacityKg: string; setCapacityKg: (v: string) => void;
  minPrice: string; setMinPrice: (v: string) => void; note: string; setNote: (v: string) => void;
  ref1: string; setRef1: (v: string) => void; ref2: string; setRef2: (v: string) => void;
  onApply: (field: AssistSuggestion['field'], value: number | string) => void;
  aiEnabled: boolean; aiDown: boolean; onAiDown: () => void; showInlineCapacity: boolean;
}) {
  const ref = MODE_REF[p.mode];
  const hasCapacity = parseFloat(p.capacityKg) > 0;
  return (
    <div>
      <StepHeader mode={p.mode} title="تاریخ سفر" desc="ظرفیت را با دستیار تعیین کنید یا خودتان وارد کنید." />

      {p.aiEnabled && !p.aiDown && (
        <TravelerAssistant onApply={p.onApply} onUnavailable={p.onAiDown} />
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ds-label font-semibold">تاریخ حرکت<span className="text-red-500"> *</span></label>
            <input type="date" min={today} value={p.date} onChange={e => p.setDate(e.target.value)} className="ds-input" />
          </div>
          <div>
            <label className="ds-label font-semibold">تاریخ رسیدن (اختیاری)</label>
            <input type="date" min={p.date || today} value={p.arrivalDate} onChange={e => p.setArrivalDate(e.target.value)} className="ds-input" />
          </div>
        </div>

        {/* Capacity readout once the assistant has proposed one — compact, always editable. */}
        {hasCapacity && !p.showInlineCapacity && (
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
            <Scale className="w-5 h-5 text-cyan-700 flex-shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-cyan-700">ظرفیت اعلام‌شده</div>
              <div className="text-sm font-extrabold text-gray-900">{p.capacityKg} کیلوگرم</div>
            </div>
            <input type="number" min="0" step="0.5" inputMode="decimal" value={p.capacityKg}
              onChange={e => p.setCapacityKg(e.target.value)}
              aria-label="ویرایش ظرفیت (کیلوگرم)"
              className="ds-input w-24 text-center" style={{ padding: '8px 10px' }} />
          </div>
        )}

        {/* Additive fallback — one inline field, never a page. */}
        {p.showInlineCapacity && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-gray-500" aria-hidden />
              <span className="text-sm font-bold text-gray-800">ظرفیت قابل حمل</span>
              <span className="text-red-500">*</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" step="0.5" inputMode="decimal" value={p.capacityKg}
                onChange={e => p.setCapacityKg(e.target.value)} className="ds-input"
                placeholder="ظرفیت (کیلوگرم)" aria-label="ظرفیت به کیلوگرم" />
              <input type="number" min="0" step="1" inputMode="decimal" value={p.minPrice}
                onChange={e => p.setMinPrice(e.target.value)} className="ds-input"
                placeholder="حداقل قیمت هر کیلو ($)" aria-label="حداقل قیمت هر کیلوگرم به دلار" />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              {p.aiDown
                ? 'دستیار در دسترس نیست — ظرفیت را مستقیم وارد کنید. ثبت سفر ادامه دارد.'
                : 'ظرفیت را وارد کنید تا بتوانید ادامه دهید.'}
            </p>
          </div>
        )}

        {/* Mode-specific OPTIONAL carrier references. Clearly optional; a self-declared ref is a
            note, never a verified booking, and is stored as text only. */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">جزئیات سفر (اختیاری)</div>
          <div className="grid grid-cols-1 gap-3">
            {ref.ref1 && (
              <input type="text" value={p.ref1} onChange={e => p.setRef1(e.target.value)} className="ds-input" placeholder={ref.ref1} />
            )}
            {ref.ref2 && (
              <input type="text" value={p.ref2} onChange={e => p.setRef2(e.target.value)} className="ds-input" placeholder={ref.ref2} />
            )}
            <input type="text" value={p.note} onChange={e => p.setNote(e.target.value)} className="ds-input" placeholder="توضیحات (اختیاری)" />
          </div>
          <p className="mt-2 text-[11px] text-gray-500">این موارد خوداظهاری است و به‌عنوان «تأییدشده» نمایش داده نمی‌شود.</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — احراز هویت (CMD-48 T5) ───────────────────────────────────────────
// Three honest surfaces: pick a document, capture it, capture a selfie — then the SERVICE's
// verdict, never ours. Every state below is read from /api/kyc/status; the component has no way
// to declare someone verified.
export type KycDocType = 'passport' | 'national_id' | 'drivers_license';

const KYC_DOCS: { key: KycDocType; label: string; hint: string; Icon: typeof IdCard }[] = [
  { key: 'passport',         label: 'پاسپورت',        hint: 'صفحهٔ مشخصات',            Icon: BookUser   },
  { key: 'national_id',      label: 'کارت ملی',       hint: 'روی کارت و پشت کارت',      Icon: IdCard     },
  { key: 'drivers_license',  label: 'گواهی‌نامه',      hint: 'روی کارت و پشت کارت',      Icon: CreditCard },
];

function StepKyc(p: {
  mode: ModeId;
  isVerified: boolean; kycStatus: string | null; kycLoading: boolean; onRecheck: () => void;
  docType: KycDocType | null; setDocType: (v: KycDocType) => void;
  docDone: boolean; selfieDone: boolean; faceMatch: 'idle' | 'running' | 'sent' | 'failed';
  onOpenCapture: (m: 'document' | 'face') => void;
}) {
  // Neutral status labels only — no internal reasons leaked (matches the service contract).
  const STATUS: Record<string, { label: string; cls: string; Icon: typeof Clock; desc: string }> = {
    verified:     { label: 'تأیید شده',      cls: 'bg-green-50 text-green-700 border-green-200', Icon: ShieldCheck,
                    desc: 'هویت شما تأیید شده است. می‌توانید ادامه دهید.' },
    under_review: { label: 'در حال بررسی',    cls: 'bg-blue-50 text-blue-700 border-blue-200',   Icon: Clock,
                    desc: 'مدارک شما ارسال شد و در حال بررسی است. نتیجه به‌زودی اعلام می‌شود.' },
    pending:      { label: 'در انتظار مدارک', cls: 'bg-gray-50 text-gray-600 border-gray-200',   Icon: Clock,
                    desc: 'برای ثبت سفر، مدرک شناسایی و سلفی خود را ثبت کنید.' },
    rejected:     { label: 'رد شده',          cls: 'bg-red-50 text-red-700 border-red-200',      Icon: XCircle,
                    desc: 'مدارک تأیید نشد. می‌توانید دوباره و با کیفیت بهتر تلاش کنید.' },
  };
  const badge = STATUS[p.kycStatus ?? 'pending'] ?? STATUS.pending;
  const rejected = p.kycStatus === 'rejected';

  return (
    <div>
      <StepHeader mode={p.mode} title="احراز هویت" desc="برای ثبت سفر، هویت شما باید تأیید شود." />

      {/* (e) honest state — always visible, always from the service */}
      <div className="ds-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-800">وضعیت احراز هویت</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
            {p.kycLoading
              ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              : <badge.Icon className="w-3 h-3" aria-hidden />}
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{badge.desc}</p>
      </div>

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
          {/* (a) document type */}
          <div>
            <div className="text-xs font-bold text-gray-600 mb-2">۱ — نوع مدرک را انتخاب کنید<span className="text-red-500"> *</span></div>
            <div className="grid grid-cols-3 gap-3">
              {KYC_DOCS.map(d => {
                const on = p.docType === d.key;
                return (
                  <button key={d.key} onClick={() => p.setDocType(d.key)} aria-pressed={on} className="ds-choice p-3 text-center">
                    <span className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-2 ${on ? 'bg-cyan-100' : 'bg-gray-100'}`}>
                      <d.Icon className={`w-5 h-5 ${on ? 'text-cyan-700' : 'text-gray-500'}`} aria-hidden />
                    </span>
                    <div className={`text-[13px] font-bold ${on ? 'text-cyan-700' : 'text-gray-900'}`}>{d.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{d.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* (b)(c) capture — camera first, file fallback lives inside GuidedCapture */}
          <div>
            <div className="text-xs font-bold text-gray-600 mb-2">۲ — مدرک و سلفی خود را ثبت کنید<span className="text-red-500"> *</span></div>
            <div className="grid grid-cols-2 gap-3">
              <CaptureTile
                Icon={Camera} label="عکس مدرک" done={p.docDone}
                disabled={!p.docType}
                hint={p.docType ? 'دوربین یا انتخاب فایل' : 'ابتدا نوع مدرک را انتخاب کنید'}
                onClick={() => p.onOpenCapture('document')} />
              <CaptureTile
                Icon={ScanFace} label="سلفی زنده" done={p.selfieDone}
                hint="تشخیص زنده‌بودن + تطبیق چهره"
                onClick={() => p.onOpenCapture('face')} />
            </div>
          </div>

          {/* (d) face-match is the EXISTING service; we only report what it said */}
          {p.faceMatch !== 'idle' && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
              p.faceMatch === 'running' ? 'bg-blue-50 border-blue-200 text-blue-700'
              : p.faceMatch === 'sent'  ? 'bg-blue-50 border-blue-200 text-blue-700'
              :                           'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {p.faceMatch === 'running'
                ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />در حال تطبیق چهره با مدرک…</>
                : p.faceMatch === 'sent'
                ? <><Clock className="w-4 h-4" aria-hidden />تطبیق چهره ارسال شد؛ نتیجه در وضعیت بالا اعلام می‌شود.</>
                : <><AlertTriangle className="w-4 h-4" aria-hidden />تطبیق چهره ارسال نشد. دوباره تلاش کنید.</>}
            </div>
          )}

          {/* (e) retry — explicit for a rejected verdict, always available as a re-check */}
          <button onClick={p.onRecheck} disabled={p.kycLoading}
            className="ds-btn-secondary w-full disabled:opacity-50" style={{ height: 44 }}>
            <RefreshCw className={`w-4 h-4 ${p.kycLoading ? 'animate-spin' : ''}`} aria-hidden />
            {rejected ? 'تلاش دوباره و بررسی وضعیت' : 'بررسی مجدد وضعیت'}
          </button>
          <p className="text-[11px] text-gray-500 text-center">تا زمانی که وضعیت «تأیید شده» نشود، امکان ثبت سفر وجود ندارد.</p>
        </div>
      )}
    </div>
  );
}

function CaptureTile({ Icon, label, hint, done, disabled, onClick }: {
  Icon: typeof Camera; label: string; hint: string; done: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="ds-choice p-4 flex flex-col items-center justify-center gap-2 text-center disabled:opacity-45 disabled:cursor-not-allowed"
      style={done ? { borderColor: 'var(--ds-success-border)', background: 'var(--ds-success-bg)' } : undefined}>
      {done
        ? <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--ds-success)' }} aria-hidden />
        : <Icon className="w-6 h-6 text-gray-500" aria-hidden />}
      <span className={`text-sm font-bold ${done ? 'text-green-700' : 'text-gray-900'}`}>{label}</span>
      <span className="text-[10px] text-gray-500 leading-snug">{done ? 'ثبت شد' : hint}</span>
    </button>
  );
}

// ── Step 4 — carry options + prohibited-goods hard-stop + payout ──────────────
function StepCarryPayout(p: {
  mode: ModeId;
  carry: string[]; setCarry: (v: string[]) => void;
  prohibitedAck: boolean; setProhibitedAck: (v: boolean) => void;
  payoutMethod: string | null; setPayoutMethod: (v: string) => void;
  accountName: string; setAccountName: (v: string) => void;
}) {
  const toggleCarry = (k: string) =>
    p.setCarry(p.carry.includes(k) ? p.carry.filter(x => x !== k) : [...p.carry, k]);

  return (
    <div>
      <StepHeader mode={p.mode} title="حمل و تسویه" />

      {/* carry categories */}
      <div className="mb-5">
        <div className="text-xs font-bold text-gray-600 mb-2">چه نوع کالایی حمل می‌کنید؟<span className="text-red-500"> *</span></div>
        <div className="flex flex-wrap gap-2">
          {CARRY_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleCarry(o.key)} aria-pressed={p.carry.includes(o.key)}
              className="ds-choice px-3 h-10 text-sm font-semibold">
              {o.label}
            </button>
          ))}
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
          {PAYOUT_METHODS.map(m => (
            <button key={m.key} onClick={() => p.setPayoutMethod(m.key)} aria-pressed={p.payoutMethod === m.key}
              className="ds-choice px-3 h-10 text-sm font-semibold">
              {m.label}
            </button>
          ))}
        </div>
        <label className="ds-label font-semibold">نام صاحب حساب<span className="text-red-500"> *</span></label>
        <input type="text" value={p.accountName} onChange={e => p.setAccountName(e.target.value)}
          className="ds-input" placeholder="نام و نام خانوادگی صاحب حساب" />
        <p className="mt-2 text-[11px] text-gray-500">جزئیات تسویه فقط ذخیره می‌شود؛ در این مرحله پرداختی انجام نمی‌شود.</p>
      </div>

      {/* CMD-51 (3a-1) — «از کجا خبرت کنیم؟». Additive: step4Valid() does NOT consult it, so
          skipping leaves the account default ('email') and publish is unaffected. */}
      <div className="mt-5"><PreferredChannelStep /></div>
    </div>
  );
}
