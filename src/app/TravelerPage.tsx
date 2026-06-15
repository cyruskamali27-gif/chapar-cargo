import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, ArrowLeft, Home } from 'lucide-react';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { getAirportByIata } from './airports';
import { IdentityVerification } from './VerificationModules';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { useVerifyGate } from '../lib/useVerifyGate';
import { Store, genId } from '../lib/store';
import SecuritySelector from './ProtectionSelector';
import { type SecurityLevel } from './shipmentTypes';

// ── Static data (keys / flags that don't change with language) ────────────────

const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'AED', 'IRR'];

const WEIGHT_KEYS = ['1', '2', '5', '10', '20', 'سفارشی'] as const;

// ── Country → flag ────────────────────────────────────────────────────────────
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
  const { t } = useLang();
  const PILL_LABELS = [t.travPill1, t.travPill2, t.travPill3, t.travPill4, t.travPill5];
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

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader({ onHome }: { onHome: () => void }) {
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
          className="text-4xl font-extrabold text-gray-900 mb-4">{t.travPageTitle}</motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-lg text-gray-500 max-w-2xl">{t.travPageDesc}</motion.p>
      </div>
    </div>
  );
}

// ── Main TravelerPage ─────────────────────────────────────────────────────────
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onNavigate: (page: string) => void; }

export default function TravelerPage({ onHome, onNavigate }: Props) {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const { gate, modal } = useVerifyGate();

  // Cargo options built from translations
  const CARGO_OPTIONS = [
    { key: 'personal',    icon: '📦', name: t.travCargoPersonal,    sub: t.travCargoPersonalSub,    needCapacity: true  },
    { key: 'medicine',    icon: '💊', name: t.travCargoMedicine,    sub: t.travCargoMedicineSub,    needCapacity: true  },
    { key: 'documents',   icon: '📄', name: t.travCargoDocuments,   sub: t.travCargoDocumentsSub,   needCapacity: false },
    { key: 'clothing',    icon: '👗', name: t.travCargoClothing,    sub: t.travCargoClothingSub,    needCapacity: true  },
    { key: 'electronics', icon: '💻', name: t.travCargoElectronics, sub: t.travCargoElectronicsSub, needCapacity: true  },
    { key: 'gift',        icon: '🎁', name: t.travCargoGift,        sub: t.travCargoGiftSub,        needCapacity: true  },
  ];

  // Doc types built from translations
  const DOC_TYPES = [
    { key: 'passport', icon: '🛂', name: t.docPassportName, req: t.docFrontSelfieReq,     needBack: false },
    { key: 'driving',  icon: '🪪', name: t.docDriverName,   req: t.docFrontBackSelfieReq, needBack: true  },
    { key: 'national', icon: '🪪', name: t.docNationalName, req: t.docFrontBackSelfieReq, needBack: true  },
  ];

  // Payout methods built from translations
  const PAYOUT_METHODS = [
    { key: 'bank',   icon: '🏦',  label: t.travPayBank   },
    { key: 'debit',  icon: '💳',  label: t.travPayDebit  },
    { key: 'credit', icon: '💳',  label: t.travPayCredit },
    { key: 'paypal', icon: '🅿️', label: t.travPayPaypal },
    { key: 'wallet', icon: '📱',  label: t.travPayWallet },
    { key: 'usdt',   icon: '₮',   label: 'USDT'          },
    { key: 'usdc',   icon: '🔵',  label: 'USDC'          },
  ];

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

  const [matchAllDates, setMatchAllDates] = useState(false);
  const [err, setErr] = useState('');

  const today = new Date().toISOString().split('T')[0];

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

  useEffect(() => {
    if (!session) return;
    if (session.phone) setPhone(session.phone);
    const full = [session.firstName, session.lastName].filter(Boolean).join(' ');
    if (full) setAccountName(full);
  }, [session?.userId]);

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

  const needsCapacity = () =>
    cargoOptions.length > 0 &&
    cargoOptions.some(k => CARGO_OPTIONS.find(o => o.key === k)?.needCapacity);

  const toggleCargo = (key: string) => {
    setErr('');
    setCargoOptions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  function validateStep1(): boolean {
    if (!origin)   { setErr(t.travErrNoOrigin);  return false; }
    if (!dest)     { setErr(t.travErrNoDest);    return false; }
    if (!date)     { setErr(t.travErrNoDate);    return false; }
    if (!phone || phone.replace(/\D/g, '').length < 10)
                   { setErr(t.travErrNoPhone);   return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (cargoOptions.length === 0)
      { setErr(t.travErrNoCargo); return false; }
    if (needsCapacity()) {
      if (!selectedWeight) { setErr(t.travErrNoCapacity); return false; }
      if (selectedWeight === 'سفارشی' && (!customKg || parseFloat(customKg) <= 0))
        { setErr(t.travErrNoCapacity); return false; }
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!verifyDone) { setErr(t.travErrNeedVerify); return false; }
    return true;
  }

  function validateStep4(): boolean {
    if (!accountDone) { setErr(t.travErrNeedAccount); return false; }
    return true;
  }

  function goStep(n: number) {
    setErr('');
    if (n > step) {
      if (step === 1 && !validateStep1()) return;
      if (step === 2 && !validateStep2()) return;
      if (step === 3 && !validateStep3()) return;
      if (step === 4 && !validateStep4()) return;
      if (step === 4 && n === 5) { gate(publishTrip); return; }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectDocType(key: string) {
    setDocTypeState(key);
    setVerifyDone(false);
    setVerifyItems([]);
    setVerifying(false);
  }

  function startVerification() {
    if (!docType) { setErr(t.travErrSelectDocType); return; }
    setErr('');
    setVerifying(true);
    setVerifyItems([]);
    const checks = [
      t.travVerCheckFace,
      t.travVerCheckValid,
      t.travVerCheckType,
      t.travVerCheckCountry,
      t.travVerCheckFraud,
    ];
    setTimeout(() => {
      setVerifying(false);
      checks.forEach((c, i) => {
        setTimeout(() => setVerifyItems(prev => [...prev, c]), i * 200);
      });
      setTimeout(() => setVerifyDone(true), checks.length * 200 + 100);
    }, 1800);
  }

  function startAccountVerification() {
    if (!payoutMethod) { setErr(t.travErrSelectPayout); return; }
    if (!accountName.trim()) { setErr(t.travErrAccountName); return; }
    setErr('');
    setAcctVerifying(true);
    setTimeout(() => {
      setAcctVerifying(false);
      setAccountDone(true);
    }, 1200);
  }

  async function publishTrip() {
    if (!session) { setErr(t.travErrNeedLogin); return; }
    if (!verifyDone) { setErr(t.travErrNeedKyc); return; }
    if (!origin || !dest) return;

    setPublishing(true);

    const capacity = needsCapacity() && selectedWeight
      ? (selectedWeight === 'سفارشی' ? (parseFloat(customKg) || null) : parseFloat(selectedWeight))
      : null;

    const newTripId = genId('T');

    const trip = {
      id:            newTripId,
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

    try {
      await fetch('/api/approvals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'traveler_listing', refId: newTripId, payload: trip }),
      });
    } catch { /* non-fatal */ }

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
    } catch { /* non-fatal */ }

    setTripId(newTripId);
    setApiRoute(routeResult);
    setPublishing(false);
    setStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!session) return null;

  // ── Step 5 — Success ─────────────────────────────────────────────────────
  if (step === 5 && tripId) {
    return (
      <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
        <PageHeader onHome={onHome} />
        <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
          <div className="ds-card p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{t.travSuccessTitle}</h2>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl px-4 py-2 mb-4">
              <span>⏳</span><span>{t.travSuccessPending}</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{t.travSuccessDesc}</p>

            <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-6 py-4 mb-6 text-center">
              <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">{t.travTrackingCode}</div>
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
              {date && <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold uppercase text-xs">{t.travDateLabel}</span><span className="font-bold">{date}</span></div>}
              {origin && dest && <div className="flex justify-between text-sm mt-2"><span className="text-gray-500 font-bold uppercase text-xs">{t.travRouteLabel}</span><span className="font-bold font-mono">{origin.iata} → {dest.iata}</span></div>}
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => onNavigate('marketplace')}
                 className="ds-btn-primary py-3 w-full"
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52 }}>
                {t.travViewOrders}
              </button>
              <button onClick={() => onNavigate('traveler-dashboard')}
                 className="ds-btn-secondary py-3 w-full"
                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.travDashboard}
              </button>
              <button onClick={() => { setStep(1); setTripId(null); setOrigin(null); setDest(null); setDate(''); setCargoOptions([]); setSelectedWeight(null); setCustomKg(''); setPriceAmount(''); setDocTypeState(null); setVerifyDone(false); setPayoutMethod(null); setAccountDone(false); }}
                className="ds-btn-secondary py-3 w-full">{t.travNewTrip}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {modal}
      <PageHeader onHome={onHome} />
      <div className="max-w-2xl mx-auto px-4 py-10 pb-24">
        <StepPills step={step} />

        {/* ══════════ STEP 1 ══════════ */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '1').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">{t.travTStep1Title}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <AirportCityAutocomplete label={t.spOrigin} value={origin} onChange={v => { setOrigin(v); setErr(''); }} placeholder={t.spOriginPlaceholder} />
              <AirportCityAutocomplete label={t.spDest}   value={dest}   onChange={v => { setDest(v);   setErr(''); }} placeholder={t.spDestPlaceholder} />
            </div>

            <div className="mb-4">
              <label className="ds-label">{t.travTripDate}</label>
              <input type="date" className="ds-input" min={today} value={date}
                onChange={e => { setDate(e.target.value); setErr(''); }} />
            </div>

            <div className="mb-4">
              <label className="ds-label">{t.travMobilePhone}</label>
              <input type="tel" className="ds-input" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={phone}
                onChange={e => { setPhone(e.target.value.trim()); setErr(''); }} />
            </div>

            {matchBoxData !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                {(matchAllDates ? matchBoxData.all : matchBoxData.forDate) > 0 ? (
                  <>
                    <div className="text-sm font-bold text-blue-700 mb-2">
                      ✈️ <strong>{t.travMatchOrders.replace('{n}', String(matchAllDates ? matchBoxData.all : matchBoxData.forDate))}</strong> {t.travMatchOrdersReady}
                    </div>
                    <button onClick={() => onNavigate('marketplace')}
                       className="ds-btn-primary block text-center py-2 text-sm w-full mb-2"
                       style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40 }}>
                      {t.travMatchViewOrders}
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-gray-500 leading-relaxed mb-2">
                    {t.travMatchNoOrders}
                  </div>
                )}
                <button onClick={() => setMatchAllDates(m => !m)}
                  className="text-xs text-cyan-600 font-bold hover:underline bg-transparent border-none cursor-pointer p-0">
                  {matchAllDates ? t.travMatchShowDate : t.travMatchShowAll.replace('{n}', String(matchBoxData.all))}
                </button>
              </div>
            )}

            <Err msg={err} />
            <button onClick={() => goStep(2)} className="ds-btn-primary w-full mt-4 py-3">{t.wizardContinue}</button>
          </motion.div>
        )}

        {/* ══════════ STEP 2 ══════════ */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '2').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">{t.travTStep2Title}</h2>

            <label className="ds-label">{t.travCargoLabel}</label>
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
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">{t.travCapacityLabel}</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {WEIGHT_KEYS.map(w => (
                    <button key={w} onClick={() => { setSelectedWeight(w); setErr(''); }}
                      className={`py-2 px-1 rounded-xl border-2 text-sm font-bold text-center transition-all
                        ${selectedWeight === w
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}>
                      {w === 'سفارشی' ? t.travCustomWeight : `${w} kg`}
                    </button>
                  ))}
                </div>
                {selectedWeight === 'سفارشی' && (
                  <div className="mb-4">
                    <label className="ds-label">{t.travCustomCapacity}</label>
                    <input type="number" className="ds-input" placeholder={t.travCustomCapacityPlaceholder} min="0.5" step="0.5"
                      value={customKg} onChange={e => { setCustomKg(e.target.value); setErr(''); }} />
                  </div>
                )}

                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">{t.travBasePriceLabel}</div>
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
                <input type="number" className="ds-input" placeholder={t.travBasePricePlaceholder} min="0" step="any" style={{ direction: 'ltr' }}
                  value={priceAmount} onChange={e => setPriceAmount(e.target.value)} />
                <p className="text-xs text-gray-400 mt-2">{t.travBasePriceHint}</p>
              </div>
            )}

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
              <button onClick={() => goStep(1)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.travPrevStep}</button>
              <button onClick={() => goStep(3)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ══════════ STEP 3 ══════════ */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '3').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">{t.travTStep3Title}</h2>

            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.travDocTypeLabel}</div>
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

            {docType && (
              <div className="mb-5">
                <IdentityVerification enabled={idEnabled} onToggle={setIdEnabled} status={verifyDone ? 'VERIFIED' : 'PENDING'} />
              </div>
            )}

            {docType && !verifyDone && !verifying && (
              <button onClick={startVerification}
                className="ds-btn-primary w-full py-3 mb-4">
                {t.travStartVerification}
              </button>
            )}

            {verifying && (
              <div className="flex items-center justify-center gap-3 py-4 text-gray-500 text-sm">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                {t.travVerifyingDocs}
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
                {t.travVerifyDone}
              </div>
            )}

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(2)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.travPrevStep}</button>
              <button onClick={() => goStep(4)} className="ds-btn-primary flex-1 py-3">{t.wizardContinue}</button>
            </div>
          </motion.div>
        )}

        {/* ══════════ STEP 4 ══════════ */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ds-card p-6 sm:p-8">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t.wizardStep.replace('{n}', '4').replace('{m}', '5')}</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">{t.travTStep4Title}</h2>

            <label className="ds-label">{t.travPayoutLabel}</label>
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
              <label className="ds-label">{t.travAccountName}</label>
              <input type="text" className="ds-input" placeholder={t.travAccountPlaceholder}
                value={accountName} onChange={e => { setAccountName(e.target.value); setAccountDone(false); setErr(''); }} />
            </div>

            {!accountDone && (
              <button onClick={startAccountVerification} disabled={acctVerifying}
                className="ds-btn-primary w-full py-3 mb-4 disabled:opacity-60">
                {acctVerifying
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.travAccountVerifying}</span>
                  : t.travVerifyAccountBtn}
              </button>
            )}

            {accountDone && (
              <div className="space-y-2 mb-4">
                {[t.travAccountItem1, t.travAccountItem2].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mt-2">
                  {t.travAccountVerified}
                </div>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 mb-4">
              {t.travPayNote}
            </div>

            <Err msg={err} />
            <div className="flex gap-3 mt-2">
              <button onClick={() => goStep(3)} className="ds-btn-secondary flex-shrink-0 px-5 py-3">{t.travPrevStep}</button>
              <button onClick={() => goStep(5)} disabled={publishing}
                className="ds-btn-primary flex-1 py-3 disabled:opacity-60">
                {publishing
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.travPublishing}</span>
                  : t.travPublish}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Draft shape ───────────────────────────────────────────────────────────────
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
