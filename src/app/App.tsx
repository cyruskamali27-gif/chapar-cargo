import { Shield, MapPin, Scan, Globe, Users, TrendingUp, CheckCircle, Package, ArrowRight, ChevronDown, Star, Lock, Zap, Clock, CreditCard, Award, BadgeCheck, Sparkles, Activity, Plane, DollarSign, Eye, FileCheck, Building2, Verified, Trophy, Target, BarChart3, Rocket, ArrowLeft, Home } from 'lucide-react';
import AuthPage from './AuthPage';
import TravelerPageFull from './TravelerPage';
import SendPackagePage from './SendPackagePage';
import MyOrdersPage from './MyOrdersPage';
import WalletPage from './WalletPage';
import ReceiptPage from './ReceiptPage';
import ProfilePage from './ProfilePage';
import NotificationsPage from './NotificationsPage';
import TravelerDashboardPage from './TravelerDashboardPage';
import { Store } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import AirportCityAutocomplete, { type AirportOption } from './AirportCityAutocomplete';
import { SecurityBadge } from './ProtectionSelector';
import { type SecurityLevel } from './shipmentTypes';
import { IdentityVerification, CargoVerification } from './VerificationModules';
import SmartTester from './SmartTester';

// ── Social media SVG icons ────────────────────────────────────────────────────
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6">
      <rect width="20" height="20" x="2" y="2" rx="5.5" ry="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.67 7.88c-.12.57-.45.71-.92.44l-2.52-1.86-1.22 1.17c-.13.13-.25.25-.52.25l.18-2.58 4.68-4.22c.2-.18-.04-.28-.32-.1l-5.78 3.63-2.48-.77c-.54-.17-.55-.54.11-.8l9.67-3.73c.45-.16.84.11.69.79z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.02-.04z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import Map3DGlobe from './Map3DGlobe';
import { LangCode, RTL_LANGS, langMeta, translations } from './i18n';
import { useLang } from '../lib/LangContext';


// ─── Types ────────────────────────────────────────────────────────────────────
type Page = 'home' | 'buy-for-me' | 'send-package' | 'traveler' | 'marketplace' | 'trust-safety' | 'investors' | 'faq' | 'auth' | 'my-orders' | 'wallet' | 'receipt' | 'profile' | 'notifications' | 'traveler-dashboard' | 'smart-tester';

// ─── CountUpAnimation ─────────────────────────────────────────────────────────
function CountUpAnimation({ end, suffix = '', prefix = '', duration = 2 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!isInView) return;
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const value = progress * end;
      setCount(end % 1 === 0 ? Math.floor(value) : Math.round(value * 10) / 10);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return <div ref={ref}>{prefix}{count}{suffix}</div>;
}

// ─── EscrowTimeline ───────────────────────────────────────────────────────────
function EscrowTimeline() {
  const steps = [
    { title: 'Payment Locked',     description: 'Funds secured in escrow account',          icon: Lock,        status: 'completed' },
    { title: 'Traveler Accepted',  description: 'Verified traveler confirmed delivery',      icon: CheckCircle, status: 'completed' },
    { title: 'Package Delivered',  description: 'Package handed to recipient',               icon: Package,     status: 'completed' },
    { title: 'Receiver Confirmed', description: 'Delivery confirmed by recipient',           icon: BadgeCheck,  status: 'active'    },
    { title: 'Funds Released',     description: 'Payment transferred to traveler',           icon: DollarSign,  status: 'pending'   },
  ];
  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-gray-200" />
      <div className="space-y-6">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            className="relative flex items-start gap-5"
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ delay: index * 0.12 }}
          >
            {/* Icon */}
            <div className={`relative z-10 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              step.status === 'completed' ? 'bg-green-500' :
              step.status === 'active'    ? 'bg-blue-500 animate-pulse' :
              'bg-gray-100 border border-gray-200'
            }`}>
              <step.icon className={`w-6 h-6 ${step.status === 'pending' ? 'text-gray-400' : 'text-white'}`} />
            </div>

            {/* Content */}
            <div className="flex-1 pt-1.5">
              <h3 className="font-semibold text-gray-900 mb-0.5">{step.title}</h3>
              <p className="text-gray-500 text-sm">{step.description}</p>
              {step.status === 'active' && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs text-blue-600 font-semibold">In Progress</span>
                </div>
              )}
            </div>

            {/* Status label */}
            <div className={`text-xs font-medium pt-2 flex-shrink-0 ${
              step.status === 'completed' ? 'text-green-600' :
              step.status === 'active'    ? 'text-blue-600'  :
              'text-gray-400'
            }`}>
              {step.status === 'completed' ? '✓ Done' : step.status === 'active' ? 'Now' : 'Pending'}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── MarketplaceRouteBoard ────────────────────────────────────────────────────
function MarketplaceRouteBoard() {
  const routes: { from: string; to: string; flag1: string; flag2: string; travelers: number; avgPrice: number; trend: string; securityLevel: SecurityLevel }[] = [
    { from: 'Toronto',   to: 'Tehran',    flag1: '🇨🇦', flag2: '🇮🇷', travelers: 12, avgPrice: 85,  trend: 'up',     securityLevel: 'GUARANTEED' },
    { from: 'Dubai',     to: 'Vancouver', flag1: '🇦🇪', flag2: '🇨🇦', travelers: 8,  avgPrice: 120, trend: 'up',     securityLevel: 'GUARANTEED' },
    { from: 'London',    to: 'New York',  flag1: '🇬🇧', flag2: '🇺🇸', travelers: 24, avgPrice: 95,  trend: 'stable', securityLevel: 'GUARANTEED' },
    { from: 'Singapore', to: 'Sydney',    flag1: '🇸🇬', flag2: '🇦🇺', travelers: 15, avgPrice: 75,  trend: 'down',   securityLevel: 'STANDARD'   },
    { from: 'Paris',     to: 'Tokyo',     flag1: '🇫🇷', flag2: '🇯🇵', travelers: 10, avgPrice: 110, trend: 'up',     securityLevel: 'GUARANTEED' },
  ];
  return (
    <div className="space-y-3">
      {routes.map((route, index) => (
        <motion.div
          key={index}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-cyan-300 hover:shadow-md transition-all group cursor-pointer"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: index * 0.07 }} whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">

            {/* Route */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{route.flag1}</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{route.from}</div>
                  <div className="text-[11px] text-gray-400">Origin</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-2xl">{route.flag2}</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{route.to}</div>
                  <div className="text-[11px] text-gray-400">Destination</div>
                </div>
              </div>
            </div>

            {/* Stats + badge */}
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
              <SecurityBadge level={route.securityLevel} />
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{route.travelers}</div>
                <div className="text-[11px] text-gray-400">Travelers</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">${route.avgPrice}</div>
                <div className="text-[11px] text-gray-400">Avg/kg</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                route.trend === 'up'   ? 'bg-green-100 text-green-700' :
                route.trend === 'down' ? 'bg-red-100 text-red-600'     :
                                         'bg-gray-100 text-gray-500'
              }`}>
                {route.trend === 'up' ? '↗' : route.trend === 'down' ? '↘' : '→'} {route.trend}
              </span>
              <motion.button
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              >
                View Route
              </motion.button>
            </div>

          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── LanguageSelector ─────────────────────────────────────────────────────────
function LanguageSelector({ lang, setLang }: { lang: LangCode; setLang: (l: LangCode) => void }) {
  const [open, setOpen] = useState(false);
  const meta = langMeta.find(l => l.code === lang);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-xl text-white text-sm hover:from-white/15 hover:to-white/10 hover:border-cyan-500/40 transition-all shadow-sm"
      >
        <Globe className="w-4 h-4 text-cyan-400" />
        <span className="font-medium">{meta?.nativeName}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 bg-[#0a1628]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-1">
              {langMeta.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group ${
                    lang === l.code
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                      : 'text-gray-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="font-medium">{l.nativeName}</span>
                  <div className="flex items-center gap-2">
                    {RTL_LANGS.includes(l.code) && (
                      <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">RTL</span>
                    )}
                    {lang === l.code && (
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function PageHeader({ title, desc, onHome }: { title: string; desc: string; onBack?: () => void; onHome: () => void; backLabel?: string }) {
  const { t } = useLang();
  return (
    <div className="ds-page-header px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-10 flex-wrap"
        >
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t.appBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" />
            <span>{t.appMainPage}</span>
          </button>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl lg:text-6xl font-extrabold text-gray-900 mb-4 leading-tight"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-lg text-gray-500 max-w-2xl leading-relaxed"
        >
          {desc}
        </motion.p>
      </div>
    </div>
  );
}

function BuyForMePage({ onBack, onHome, t, onNavigate }: { onBack: () => void; onHome: () => void; t: typeof translations['en']; onNavigate?: (page: string) => void }) {
  return <SendPackagePage onBack={onBack} onHome={onHome} t={t} cargoType="chapar" onNavigate={onNavigate} />;
}

// ─── Traveler Acceptance Preview ─────────────────────────────────────────────
// Shows traveler what an incoming sender request looks like (security terms)
// before they click Accept, so they understand their commitments.
function TravelerAcceptancePreview({ securityLevel }: { securityLevel: SecurityLevel }) {
  const { t } = useLang();
  const [accepted, setAccepted] = useState<boolean | null>(null);

  const mockRequest = {
    sender: 'Ali R.',
    origin: 'Toronto 🇨🇦',
    dest: 'Tehran 🇮🇷',
    weight: '2.5 kg',
    category: t.appAcceptCategoryElectronics,
    value: '$320',
    date: '2026-06-18',
  };

  const depositRequired = securityLevel === 'GUARANTEED';

  return (
    <div className="ds-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-5 bg-amber-400 rounded-full" />
        <h3 className="text-sm font-bold text-gray-900">{t.appAcceptTitle}</h3>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed -mt-1">
        {t.appAcceptDesc}
      </p>

      {/* Mock request card */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-slate-50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">{mockRequest.sender}</span>
          <SecurityBadge level={securityLevel} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700 font-medium">{mockRequest.origin}</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-700 font-medium">{mockRequest.dest}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            [t.appAcceptWeight, mockRequest.weight],
            [t.appAcceptCategory, mockRequest.category],
            [t.appAcceptValue, mockRequest.value],
            [t.appAcceptDate, mockRequest.date],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-gray-400">{k}</div>
              <div className="font-semibold text-gray-800">{v}</div>
            </div>
          ))}
        </div>

        {/* Commitment box */}
        {depositRequired && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-amber-700 mb-1">{t.appAcceptCommitment}</div>
            <p className="text-xs text-amber-600 leading-relaxed">
              {t.appAcceptCommitmentDesc1} <span className="font-bold">~$32</span> {t.appAcceptCommitmentDesc2}
            </p>
          </div>
        )}

        {/* Accept / Decline buttons */}
        {accepted === null ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setAccepted(false)}
              className="py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t.appAcceptReject}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setAccepted(true)}
              className="py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {t.appAcceptAccept}
            </motion.button>
          </div>
        ) : (
          <div className={`text-center py-2.5 rounded-lg text-xs font-semibold border ${
            accepted
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {accepted ? t.appAcceptAccepted : t.appAcceptRejected}
            <button onClick={() => setAccepted(null)} className="block mx-auto mt-1 text-[10px] text-gray-400 hover:text-gray-600 underline">
              {t.appAcceptReset}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TravelerPage({ onBack, onHome, t, onNavigate }: { onBack: () => void; onHome: () => void; t: typeof translations['en']; onNavigate: (page: string) => void }) {
  return <TravelerPageFull onBack={onBack} onHome={onHome} t={t as unknown as Record<string, string>} onNavigate={onNavigate} />;
}

function MarketplacePage({ onBack, onHome, t, onBook }: { onBack: () => void; onHome: () => void; t: typeof translations['en']; onBook: () => void }) {
  const { isRTL } = useLang();
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [date, setDate] = useState('');
  const [cap,  setCap]  = useState('');
  const [sort, setSort] = useState<'date'|'capacity'|'newest'>('date');
  const [apiTrips, setApiTrips]   = useState<MktTrip[]>([]);
  const [mktLoading, setMktLoading] = useState(true);
  const [mktError, setMktError]   = useState('');

  const TODAY = new Date().toISOString().split('T')[0];

  type MktTrip = {
    id: string; origin?: string; originCity?: string;
    destination?: string; destCity?: string; date: string;
    capacity?: number; phone?: string; description?: string;
    status: string; createdAt?: number; _approvalId?: string;
  };
  type MktRating = { tripId: string; score: number; };

  useEffect(() => {
    setMktLoading(true);
    setMktError('');
    fetch('/api/listings?type=traveler_listing')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setApiTrips(d.listings ?? []); setMktLoading(false); })
      .catch(() => { setMktError(t.mktErrorLoad); setMktLoading(false); });
  }, []);

  const activeTrips = apiTrips.filter(t => t.date >= TODAY);
  const ratings    = Store.get<MktRating[]>('ratings') ?? [];

  const reqWeight = parseFloat(cap) || 0;
  let filtered = activeTrips.filter(trip => {
    const orig = ((trip.origin || '') + ' ' + (trip.originCity || '')).toLowerCase();
    const dest = ((trip.destination || '') + ' ' + (trip.destCity || '')).toLowerCase();
    if (from && !orig.includes(from.toLowerCase())) return false;
    if (to   && !dest.includes(to.toLowerCase()))   return false;
    if (date && trip.date < date)                   return false;
    if (reqWeight && (trip.capacity ?? 0) < reqWeight) return false;
    return true;
  });

  if (sort === 'date')     filtered = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  else if (sort === 'capacity') filtered = [...filtered].sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
  else                          filtered = [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const MAX_CAP = 20;
  function capPct(n: number) { return Math.min(100, Math.round((n / MAX_CAP) * 100)); }
  function capColor(capacity: number): string {
    if (!reqWeight) return '#f59e0b';
    const ratio = capacity / reqWeight;
    if (ratio >= 2)   return '#10b981';
    if (ratio >= 1.3) return '#f59e0b';
    return '#f97316';
  }
  function maskPhone(p: string) {
    const d = p.replace(/\D/g, '');
    return d.length < 4 ? p : d.slice(0, 4) + '•••' + d.slice(-2);
  }
  function fmtDate(d: string) {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' }); }
    catch { return d; }
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader title={t.marketplaceTitle} desc={t.mktBrowseDesc} onBack={onBack} onHome={onHome} backLabel={t.backHome} />

      <div className="max-w-2xl mx-auto px-4 pb-24" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* Search filters */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ds-label block mb-1">{t.mktFromLabel}</label>
              <input value={from} onChange={e => setFrom(e.target.value)}
                placeholder={t.appOriginPlaceholder} className="ds-input w-full text-sm" style={{ direction: 'ltr' }} />
            </div>
            <div>
              <label className="ds-label block mb-1">{t.mktToLabel}</label>
              <input value={to} onChange={e => setTo(e.target.value)}
                placeholder={t.appDestPlaceholder} className="ds-input w-full text-sm" style={{ direction: 'ltr' }} />
            </div>
            <div>
              <label className="ds-label block mb-1">{t.mktDateLabel}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                min={TODAY} className="ds-input w-full text-sm" style={{ direction: 'ltr' }} />
            </div>
            <div>
              <label className="ds-label block mb-1">{t.mktCapLabel}</label>
              <input type="number" value={cap} onChange={e => setCap(e.target.value)}
                placeholder={t.appWeightPlaceholder} min="0" className="ds-input w-full text-sm" style={{ direction: 'ltr' }} />
            </div>
          </div>
        </div>

        {/* Loading / error states */}
        {mktLoading && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2 animate-pulse">✈️</div>
            <div className="text-sm">{t.mktLoading}</div>
          </div>
        )}
        {!mktLoading && mktError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 font-medium mb-5">
            {mktError}
          </div>
        )}

        {/* Sort + result count + cards */}
        {!mktLoading && !mktError && (<>
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="text-xs font-bold text-gray-400">
            {filtered.length ? t.mktTravelerFound.replace('{n}', filtered.length.toLocaleString('fa-IR')) : t.mktNoTraveler}
          </div>
          <div className="flex gap-2">
            {([
              { key: 'date',     label: t.mktSortDate },
              { key: 'capacity', label: t.mktSortCapacity },
              { key: 'newest',   label: t.mktSortNewest },
            ] as const).map(s => (
              <button key={s.key} onClick={() => setSort(s.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors
                  ${sort === s.key ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">✈️</div>
            <div className="text-base font-bold text-gray-700 mb-1">{t.mktNoTraveler}</div>
            <p className="text-sm">{t.mktNoTravelerDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(trip => {
              const pct         = capPct(trip.capacity ?? 0);
              const tripRatings = ratings.filter(r => r.tripId === trip.id);
              const avgRating   = tripRatings.length ? tripRatings.reduce((s, r) => s + r.score, 0) / tripRatings.length : 0;

              const clr         = capColor(trip.capacity ?? 0);
              const meetsCap    = reqWeight > 0 && (trip.capacity ?? 0) >= reqWeight;
              return (
                <div key={trip.id} className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden hover:border-cyan-200 hover:shadow-md transition-all">
                  <div className="p-4 pb-0">
                    <div className="text-lg font-extrabold text-gray-900 flex items-center gap-2 mb-1">
                      <span>{trip.originCity || trip.origin || '—'}</span>
                      <span className="text-cyan-500 text-base">✈</span>
                      <span>{trip.destCity || trip.destination || '—'}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono tracking-wider mb-3">{trip.id}</div>
                  </div>
                  <div className="px-4">
                    <div className="flex flex-wrap gap-4 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span>📅</span><span>{fmtDate(trip.date)}</span>
                      </div>
                      {trip.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span>📞</span><span style={{ direction: 'ltr' }}>{maskPhone(trip.phone)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{t.mktCapacityLabel}</span>
                        <span className="text-sm font-extrabold" style={{ color: clr }}>
                          {trip.capacity} kg{meetsCap ? ' ✓' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${clr}, ${clr}cc)` }} />
                      </div>
                    </div>
                    {trip.description && (
                      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-relaxed">
                        {trip.description}
                      </div>
                    )}
                    {avgRating > 0 && (
                      <div className="text-sm text-amber-500 mb-3">
                        {'⭐'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                        <span className="font-bold text-amber-600 mr-1">{avgRating.toFixed(1)}</span>
                        <span className="text-xs text-gray-400">({tripRatings.length} {t.mktReviewSuffix})</span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-4">
                    <button onClick={onBook}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                      {t.mktBookBtn}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

function TrustSafetyPage({ onBack, onHome, t }: { onBack: () => void; onHome: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader title={t.trustSafetyTitle} desc={t.tsDesc} onBack={onBack} onHome={onHome} backLabel={t.backHome} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-16">

        {/* ── Certification cards ── */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.tsSecurityLayers}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Shield,    title: 'SOC 2 Type II',   desc: t.tsSoc2Desc, badge: t.tsCertified,    bg: 'ds-feature-blue',   icon_cls: 'text-blue-600'   },
              { icon: Lock,      title: 'ISO 27001',       desc: t.tsIsoDesc,  badge: t.tsCertified,    bg: 'ds-feature-purple', icon_cls: 'text-purple-600' },
              { icon: BadgeCheck,title: 'PCI DSS Level 1', desc: t.tsPciDesc,  badge: t.tsCompliant,    bg: 'ds-feature-green',  icon_cls: 'text-green-600'  },
              { icon: FileCheck, title: 'GDPR Compliant',  desc: t.tsGdprDesc, badge: t.tsVerifiedBadge,bg: 'ds-feature-cyan',   icon_cls: 'text-cyan-600'   },
            ].map((cert, i) => (
              <motion.div
                key={i}
                className={`${cert.bg} rounded-2xl p-6 text-center ds-card-hover`}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              >
                <div className="w-13 h-13 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 w-12 h-12">
                  <cert.icon className={`w-6 h-6 ${cert.icon_cls}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{cert.title}</h3>
                <p className="text-gray-500 text-xs mb-4 leading-relaxed">{cert.desc}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 border border-green-200 rounded-full">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700 font-semibold">{cert.badge}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Escrow timeline + AI monitoring ── */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* Escrow */}
          <div className="ds-card p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t.tsEscrowTitle}</h2>
            <p className="text-gray-500 text-sm mb-8">{t.tsEscrowDesc}</p>
            <EscrowTimeline />
          </div>

          {/* AI monitoring */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-5">{t.tsAiTitle}</h2>
            <div className="space-y-3">
              {[
                { title: t.tsAi1Title, desc: t.tsAi1Desc },
                { title: t.tsAi2Title, desc: t.tsAi2Desc },
                { title: t.tsAi3Title, desc: t.tsAi3Desc },
                { title: t.tsAi4Title, desc: t.tsAi4Desc },
                { title: t.tsAi5Title, desc: t.tsAi5Desc },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 shadow-sm hover:shadow-md hover:border-cyan-200 transition-all"
                  initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                >
                  <div className="w-8 h-8 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold text-sm mb-0.5">{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function InvestorsPage({ onBack, onHome, t }: { onBack: () => void; onHome: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader title={t.investorsTitle} desc={t.invDesc} onBack={onBack} onHome={onHome} backLabel={t.backHome} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 space-y-12">

        {/* ── Key metrics ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Users,      value: 50,  suffix: 'M+', prefix: '',  label: t.invNetworkUsers,  growth: t.invYoY127,         icon_cls: 'text-blue-600',   bg: 'bg-blue-50'   },
            { icon: Globe,      value: 190, suffix: '+',  prefix: '',  label: t.invCountries,     growth: t.invGlobalCoverage, icon_cls: 'text-cyan-600',   bg: 'bg-cyan-50'   },
            { icon: DollarSign, value: 100, suffix: 'B',  prefix: '$', label: t.invTAM,           growth: t.invExpandingMarket,icon_cls: 'text-green-600',  bg: 'bg-green-50'  },
            { icon: TrendingUp, value: 215, suffix: '%',  prefix: '',  label: t.invRevenueGrowth, growth: t.invYearOverYear,   icon_cls: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="ds-card ds-card-hover p-7"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            >
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.icon_cls}`} />
              </div>
              <div className="text-4xl font-black text-gray-900 mb-1">
                <CountUpAnimation end={stat.value} prefix={stat.prefix} suffix={stat.suffix} duration={2.5} />
              </div>
              <div className="text-gray-600 text-sm mb-2">{stat.label}</div>
              <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {stat.growth}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Problem / Solution / Traction ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Target,   title: t.invProblemTitle,  desc: t.invProblemDesc,  bg: 'ds-feature-blue',   icon_cls: 'text-blue-600'   },
            { icon: Zap,      title: t.invSolutionTitle, desc: t.invSolutionDesc, bg: 'ds-feature-purple', icon_cls: 'text-purple-600' },
            { icon: BarChart3,title: t.invTractionTitle, desc: t.invTractionDesc, bg: 'ds-feature-green',  icon_cls: 'text-green-600'  },
          ].map((card, i) => (
            <motion.div
              key={i}
              className={`${card.bg} rounded-2xl p-8 ds-card-hover`}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-5">
                <card.icon className={`w-6 h-6 ${card.icon_cls}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm">{card.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Investor CTA ── */}
        <div className="bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-full mb-5 shadow-sm">
            <Rocket className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600">Seed Round Open</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t.invCtaTitle}</h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">{t.invCtaDesc}</p>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            className="ds-btn-primary px-8 py-4 text-base rounded-xl"
          >
            {t.invCtaButton}
          </motion.button>
        </div>

      </div>
    </div>
  );
}

function FAQPage({ onBack, onHome, t }: { onBack: () => void; onHome: () => void; t: typeof translations['en'] }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs: { question: string; answer: string }[] = [
    { question: t.faqQ1, answer: t.faqA1 },
    { question: t.faqQ2, answer: t.faqA2 },
    { question: t.faqQ3, answer: t.faqA3 },
    { question: t.faqQ4, answer: t.faqA4 },
    { question: t.faqQ5, answer: t.faqA5 },
    { question: t.faqQ6, answer: t.faqA6 },
    { question: t.faqQ7, answer: t.faqA7 },
    { question: t.faqQ8, answer: t.faqA8 },
  ];
  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title={t.faqTitle} desc={t.faqDesc} onBack={onBack} onHome={onHome} backLabel={t.backHome} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24">
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
                openFaq === index ? 'border-cyan-200 shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300'
              }`}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: index * 0.04 }}
            >
              {/* Question row */}
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-start hover:bg-gray-50 transition-colors"
              >
                <span className={`text-sm font-semibold pe-4 leading-snug transition-colors ${
                  openFaq === index ? 'text-cyan-700' : 'text-gray-900'
                }`}>
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openFaq === index ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className={`w-5 h-5 transition-colors ${
                    openFaq === index ? 'text-cyan-500' : 'text-gray-400'
                  }`} />
                </motion.div>
              </button>

              {/* Answer panel */}
              <motion.div
                initial={false}
                animate={{ height: openFaq === index ? 'auto' : 0, opacity: openFaq === index ? 1 : 0 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                  <p className="text-gray-500 leading-relaxed text-sm">{faq.answer}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Still have questions CTA */}
        <div className="mt-10 text-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <p className="text-gray-500 text-sm mb-4">{t.appFaqMoreQ}</p>
          <button className="ds-btn-primary px-6 py-3 rounded-xl text-sm">
            {t.appFaqContactSupport}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RouteTicker ─────────────────────────────────────────────────────────────
const TICKER_ROUTES: { route: string; statusKey: keyof typeof translations['en']; color: string }[] = [
  { route: 'تورنتو → تهران',      statusKey: 'homeRouteMatched',   color: '#00d4ff' },
  { route: 'دبی → شیراز',          statusKey: 'homeRouteEscrow',    color: '#22c55e' },
  { route: 'فرانکفورت → اصفهان',  statusKey: 'homeRouteMatching',  color: '#f59e0b' },
  { route: 'لندن → مشهد',          statusKey: 'homeRouteDelivered', color: '#a855f7' },
  { route: 'استانبول → تبریز',    statusKey: 'homeRouteActive',    color: '#f97316' },
  { route: 'ونکوور → تهران',      statusKey: 'homeRouteNew',       color: '#ec4899' },
  { route: 'سنگاپور → تهران',     statusKey: 'homeRouteMatched',   color: '#22c55e' },
  { route: 'سیدنی → مشهد',        statusKey: 'homeRouteEnRoute',   color: '#3b82f6' },
  { route: 'مسکو → تهران',        statusKey: 'homeRouteEscrow',    color: '#84cc16' },
  { route: 'تهران → دبی',         statusKey: 'homeRouteDelivered', color: '#14b8a6' },
  { route: 'پاریس → تهران',       statusKey: 'homeRouteNew',       color: '#f43f5e' },
  { route: 'ابوظبی → تهران',      statusKey: 'homeRouteActive',    color: '#f59e0b' },
  { route: 'توکیو → تهران',       statusKey: 'homeRouteMatching',  color: '#d97706' },
  { route: 'دوحه → مشهد',         statusKey: 'homeRouteMatched',   color: '#6366f1' },
  { route: 'ملبورن → تهران',      statusKey: 'homeRouteNew',       color: '#ec4899' },
  { route: 'نیویورک → تهران',     statusKey: 'homeRouteEscrow',    color: '#22c55e' },
  { route: 'لس‌آنجلس → مشهد',    statusKey: 'homeRouteMatched',   color: '#a855f7' },
  { route: 'تهران → استانبول',    statusKey: 'homeRouteEnRoute',   color: '#00d4ff' },
];

function RouteTicker() {
  const { t } = useLang();
  const items = [...TICKER_ROUTES, ...TICKER_ROUTES];
  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'rgba(4,7,15,0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="py-2.5 px-4">
        <motion.div
          className="flex items-center"
          style={{ width: 'max-content', gap: '2.5rem' }}
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
        >
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-white text-sm font-medium">{item.route}</span>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-400 text-xs">{t[item.statusKey]}</span>
              <span className="text-white/10 mx-2 select-none">|</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}


// ─── HeroSection ──────────────────────────────────────────────────────────────
function HeroSection({ t, setPage, isRTL }: { t: typeof translations['en']; setPage: (p: Page) => void; isRTL?: boolean }) {
  const words = t.headline.split(' ');
  const half = Math.ceil(words.length / 2);
  const line1 = words.slice(0, half).join(' ');
  const line2 = words.slice(half).join(' ');
  const [map3DReady, setMap3DReady] = useState(false);

  const heroButtons = [
    { label: t.heroCta1, page: 'buy-for-me' as Page, primary: true },
    { label: t.heroCta2, page: 'traveler' as Page,    primary: false },
    { label: t.heroCta3, page: 'send-package' as Page, primary: false },
  ];

  return (
    <section style={{ height: '100vh' }} className="relative overflow-hidden bg-[#04070f]">
      {/* Map3D globe — sole background */}
      <div className="absolute inset-0 z-0">
        <Map3DGlobe className="w-full h-full" onReady={() => setMap3DReady(true)} />
      </div>

      {/* Dark loading overlay — covers the hero until Map3D tiles are ready */}
      <div
        className="absolute inset-0 z-[1] flex items-end justify-center pb-16 pointer-events-none"
        style={{ background: '#04070f', opacity: map3DReady ? 0 : 1, transition: 'opacity 0.8s ease' }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-pulse"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>

      {/* Directional gradient — subtle overlay, globe visible behind text */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: isRTL
            ? 'linear-gradient(to left, rgba(4,7,15,0.65) 0%, rgba(4,7,15,0.45) 40%, rgba(4,7,15,0.12) 68%, rgba(4,7,15,0) 100%)'
            : 'linear-gradient(to right, rgba(4,7,15,0.65) 0%, rgba(4,7,15,0.45) 40%, rgba(4,7,15,0.12) 68%, rgba(4,7,15,0) 100%)',
        }}
      />
      {/* Top vignette for nav readability */}
      <div className="absolute inset-x-0 top-0 h-28 z-[1] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(4,7,15,0.65), transparent)' }} />

      {/* Content panel — text floats above globe */}
      <div className="absolute inset-0 z-10 flex items-center pointer-events-none">
        <div className={`w-full lg:w-[40%] px-8 lg:px-16 pt-20 pb-24 pointer-events-auto`}>
          {/* Mobile dark overlay — lighter, preserves globe visibility */}
          <div className="absolute inset-0 lg:hidden pointer-events-none"
            style={{ background: 'rgba(4,7,15,0.70)' }} />

          <div className="relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 rounded-full mb-8 backdrop-blur-sm"
            >
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-xs text-cyan-300 font-semibold tracking-widest uppercase">Chapar Global Network</span>
            </motion.div>

            {/* Two-line headline: line 1 smaller subheader, line 2 large gradient */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-7"
            >
              <div
                className="text-base sm:text-lg lg:text-xl text-white/80 font-light mb-3 leading-relaxed"
                style={{ textShadow: '0 2px 24px rgba(0,0,0,0.99)', letterSpacing: '0.06em' }}
              >
                {line1}
              </div>
              <div
                className="text-5xl sm:text-6xl lg:text-[3.75rem] xl:text-[4.5rem] font-black tracking-tight leading-[1.06] bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-transparent whitespace-nowrap"
                style={{ filter: 'drop-shadow(0 2px 36px rgba(0,200,255,0.55))' }}
              >
                {line2}
              </div>
            </motion.div>

            {/* Description */}
            <motion.p
              className="text-base sm:text-lg text-gray-200/90 mb-10 leading-relaxed max-w-md"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35 }}
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.99), 0 0 40px rgba(0,0,0,0.8)' }}
            >
              {t.subheadline}
            </motion.p>

            {/* 3 equal-width glass CTA buttons */}
            <motion.div
              className="flex gap-2.5 mb-10"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
            >
              {heroButtons.map((btn, i) => (
                <motion.button
                  key={btn.page}
                  onClick={() => setPage(btn.page)}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all text-center ${
                    btn.primary
                      ? 'bg-gradient-to-r from-cyan-500/90 to-blue-600/90 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 border border-cyan-400/30 backdrop-blur-sm'
                      : 'text-white backdrop-blur-md border border-white/20 hover:border-white/35 hover:bg-white/10'
                  }`}
                  style={!btn.primary ? { background: 'rgba(255,255,255,0.07)' } : {}}
                  whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                >
                  {btn.label}
                </motion.button>
              ))}
            </motion.div>

            {/* Trust badges */}
            <motion.div
              className="flex flex-wrap gap-2.5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.65 }}
            >
              {[
                { icon: Shield,   label: t.escrowProtected, color: 'text-cyan-400' },
                { icon: Sparkles, label: t.aiVerified,       color: 'text-purple-400' },
                { icon: Globe,    label: t.globalNetwork,    color: 'text-blue-400' },
                { icon: MapPin,   label: t.countries190,     color: 'text-green-400' },
              ].map((badge, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 backdrop-blur-md border border-white/12 rounded-xl px-3.5 py-2.5 hover:border-white/22 transition-all cursor-default"
                  style={{ background: 'rgba(0,0,0,0.42)' }}
                  whileHover={{ scale: 1.03 }}
                >
                  <badge.icon className={`w-4 h-4 ${badge.color} flex-shrink-0`} />
                  <span className="text-xs text-gray-200 font-semibold">{badge.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Route Ticker at bottom */}
      <div className="absolute bottom-6 left-4 right-4 z-20 pointer-events-none">
        <RouteTicker />
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4, y: [0, 8, 0] }}
        transition={{ opacity: { delay: 2.5 }, y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <ChevronDown className="w-6 h-6 text-gray-400" />
      </motion.div>
    </section>
  );
}

// ─── VideoSection ─────────────────────────────────────────────────────────────
function VideoSection() {
  const { t } = useLang();
  const cards = [
    { title: t.homeWhatVid1Title, desc: t.homeWhatVid1Desc },
    { title: t.homeWhatVid2Title, desc: t.homeWhatVid2Desc },
    { title: t.homeWhatVid3Title, desc: t.homeWhatVid3Desc },
  ];
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 rounded-full mb-6 border border-cyan-200">
            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-pulse" />
            <span className="text-sm text-cyan-700 font-medium">{t.homeWhatBadge}</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">{t.homeWhatTitle}</h2>
        </motion.div>

        {/* Main featured video placeholder */}
        <motion.div
          className="mb-12 rounded-2xl overflow-hidden border border-gray-200 relative bg-slate-50"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          <div className="aspect-video flex flex-col items-center justify-center gap-5 relative">
            <motion.div
              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center border border-gray-200 bg-white shadow-md"
              whileHover={{ scale: 1.08 }}
            >
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-gray-600 border-b-[10px] border-b-transparent ml-1" />
            </motion.div>
            <p className="text-gray-500 text-sm relative z-10">{t.homeWhatVideoSoon}</p>
          </div>
        </motion.div>

        {/* 3 video cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className="rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer bg-white"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="aspect-video flex items-center justify-center relative border-b border-gray-100 bg-slate-50">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center border border-gray-200 bg-white relative z-10 group-hover:border-cyan-400 transition-colors shadow-sm"
                >
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-gray-500 border-b-[8px] border-b-transparent ml-1 group-hover:border-l-cyan-600 transition-colors" />
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-cyan-700 transition-colors">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-cyan-600 font-medium">
                  <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full" />
                  {t.homeWhatComingSoon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── ServiceCardsSection ─────────────────────────────────────────────────────
function ServiceCardsSection({ t, setPage }: { t: typeof translations['en']; setPage: (p: Page) => void }) {
  const cards = [
    {
      photo: '/assets/photo-1.jpg',
      title: t.heroCta1,
      desc: t.homeFeat1Desc,
      page: 'buy-for-me' as Page,
      tag: t.homeFeat1Tag,
    },
    {
      photo: '/assets/photo-2.png',
      title: t.heroCta2,
      desc: t.homeFeat2Desc,
      page: 'traveler' as Page,
      tag: t.homeFeat2Tag,
    },
    {
      photo: '/assets/photo-3.png',
      title: t.heroCta3,
      desc: t.homeFeat3Desc,
      page: 'send-package' as Page,
      tag: t.homeFeat3Tag,
    },
  ];
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5 mb-5">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              style={{ height: '420px' }}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setPage(card.page)}
            >
              <div className="absolute inset-0">
                <img src={card.photo} alt={card.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
              </div>
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-4 w-fit">
                  <span className="text-xs text-white/80 font-medium">{card.tag}</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{card.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">{card.desc}</p>
                <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold group-hover:gap-3 transition-all">
                  <span>{t.homeGetStarted}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {['/assets/photo-4.png', '/assets/photo-5.png', '/assets/photo-6.png', '/assets/photo-7.png'].map((photo, i) => (
            <motion.div
              key={i}
              className="relative rounded-xl overflow-hidden"
              style={{ height: '140px' }}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 + 0.35 }}
            >
              <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── StatsSection ─────────────────────────────────────────────────────────────
function StatsSection() {
  const { t } = useLang();
  const stats = [
    { end: 190,   suffix: '+',  prefix: '',  label: t.homeStatCountries, icon: Globe,        accent: 'text-cyan-600'   },
    { end: 50000, suffix: '+',  prefix: '',  label: t.homeStatTravelers, icon: Users,        accent: 'text-purple-600' },
    { end: 99.9,  suffix: '%',  prefix: '',  label: t.homeStatSuccess,   icon: CheckCircle,  accent: 'text-green-600'  },
    { end: 10,    suffix: 'K$', prefix: '',  label: t.homeStatInsurance, icon: Shield,       accent: 'text-blue-600'   },
  ];
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            >
              <stat.icon className={`w-7 h-7 ${stat.accent} mx-auto mb-4`} />
              <div className={`text-4xl lg:text-5xl font-black ${stat.accent} mb-2`}>
                <CountUpAnimation end={stat.end} suffix={stat.suffix} prefix={stat.prefix} duration={2.5} />
              </div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TrustSectionNew ──────────────────────────────────────────────────────────
function TrustSectionNew({ t, setPage }: { t: typeof translations['en']; setPage: (p: Page) => void }) {
  const features = [
    {
      icon: Lock,
      title: t.homeSecF1Title,
      desc: t.homeSecF1Desc,
      tags: [t.homeSecF1Tag1, t.homeSecF1Tag2, t.homeSecF1Tag3],
      gradient: 'bg-blue-50',
      border: 'border-blue-200',
      hoverBorder: 'hover:border-blue-300',
      accent: 'text-blue-600',
    },
    {
      icon: BadgeCheck,
      title: t.homeSecF2Title,
      desc: t.homeSecF2Desc,
      tags: [t.homeSecF2Tag1, t.homeSecF2Tag2, t.homeSecF2Tag3],
      gradient: 'bg-purple-50',
      border: 'border-purple-200',
      hoverBorder: 'hover:border-purple-300',
      accent: 'text-purple-600',
    },
    {
      icon: Shield,
      title: t.homeSecF3Title,
      desc: t.homeSecF3Desc,
      tags: ['SOC 2 Type II', 'ISO 27001', 'PCI DSS L1'],
      gradient: 'bg-green-50',
      border: 'border-green-200',
      hoverBorder: 'hover:border-green-300',
      accent: 'text-green-600',
    },
    {
      icon: Eye,
      title: t.homeSecF4Title,
      desc: t.homeSecF4Desc,
      tags: [t.homeSecF4Tag1, t.homeSecF4Tag2, t.homeSecF4Tag3],
      gradient: 'bg-cyan-50',
      border: 'border-cyan-200',
      hoverBorder: 'hover:border-cyan-300',
      accent: 'text-cyan-600',
    },
    {
      icon: CheckCircle,
      title: t.homeSecF5Title,
      desc: t.homeSecF5Desc,
      tags: [t.homeSecF5Tag1, t.homeSecF5Tag2, t.homeSecF5Tag3],
      gradient: 'bg-orange-50',
      border: 'border-orange-200',
      hoverBorder: 'hover:border-orange-300',
      accent: 'text-orange-600',
    },
    {
      icon: FileCheck,
      title: t.homeSecF6Title,
      desc: t.homeSecF6Desc,
      tags: [t.homeSecF6Tag1, t.homeSecF6Tag2, t.homeSecF6Tag3],
      gradient: 'bg-rose-50',
      border: 'border-rose-200',
      hoverBorder: 'hover:border-rose-300',
      accent: 'text-rose-600',
    },
  ];

  return (
    <section id="security" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div className="text-center mb-20" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full mb-6 border border-green-200">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">{t.homeSecBadge}</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-5">{t.trustSafety}</h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">{t.homeSecDesc}</p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {[
            { value: '99.9%', label: t.homeSecStat1, icon: Activity, accent: 'text-green-600' },
            { value: '$10K',  label: t.homeSecStat2, icon: Shield,   accent: 'text-blue-600' },
            { value: '24/7',  label: t.homeSecStat3, icon: Eye,      accent: 'text-purple-600' },
            { value: '190+',  label: t.homeSecStat4, icon: Globe,    accent: 'text-cyan-600' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="border border-gray-200 rounded-2xl p-6 text-center hover:border-gray-300 hover:shadow-sm bg-white transition-all"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
            >
              <stat.icon className={`w-5 h-5 ${stat.accent} mx-auto mb-3`} />
              <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Feature cards 2×3 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              className={`${feat.gradient} ${feat.border} ${feat.hoverBorder} border p-8 rounded-2xl transition-all group`}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <feat.icon className={`w-7 h-7 ${feat.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{feat.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">{feat.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {feat.tags.map(tag => (
                      <span key={tag} className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white/70 ${feat.accent} font-medium`}>
                        <CheckCircle className="w-3 h-3 flex-shrink-0" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Cert bar + CTA */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-between gap-6 py-6 px-8 rounded-2xl border border-gray-200 bg-white"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          <div className="flex flex-wrap gap-6 items-center">
            {['SOC 2 Type II', 'ISO 27001', 'PCI DSS Level 1', 'GDPR'].map(cert => (
              <div key={cert} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 font-medium">{cert}</span>
              </div>
            ))}
          </div>
          <motion.button
            onClick={() => setPage('trust-safety')}
            className="ds-btn-secondary whitespace-nowrap"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          >
            {t.trustSafety} ←
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

// ─── SocialSection ────────────────────────────────────────────────────────────
function SocialSection() {
  const { t } = useLang();
  const socials = [
    {
      name: 'Instagram', handle: '@chaparcargo',
      href: 'https://instagram.com/chaparcargo',
      Icon: InstagramIcon,
      gradient: 'bg-pink-50',
      border: 'border-pink-200 hover:border-pink-300',
      accent: 'text-pink-600',
      followers: '۱۲K',
    },
    {
      name: 'Telegram', handle: '@chaparcargo',
      href: 'https://t.me/chaparcargo',
      Icon: TelegramIcon,
      gradient: 'bg-sky-50',
      border: 'border-sky-200 hover:border-sky-300',
      accent: 'text-sky-600',
      followers: '۸.۵K',
    },
    {
      name: 'TikTok', handle: '@chaparcargo',
      href: 'https://tiktok.com/@chaparcargo',
      Icon: TikTokIcon,
      gradient: 'bg-gray-100',
      border: 'border-gray-300 hover:border-gray-400',
      accent: 'text-gray-800',
      followers: '۲۱K',
    },
    {
      name: 'WhatsApp', handle: t.homeSocialWhatsapp,
      href: 'https://wa.me/message/chaparcargo',
      Icon: WhatsAppIcon,
      gradient: 'bg-green-50',
      border: 'border-green-200 hover:border-green-300',
      accent: 'text-green-600',
      followers: t.homeSocialSupport,
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{t.homeSocialTitle}</h2>
          <p className="text-gray-500">{t.homeSocialDesc}</p>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {socials.map((s, i) => (
            <motion.a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${s.gradient} border ${s.border} rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all group`}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.03 }}
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <s.Icon className={`w-6 h-6 ${s.accent}`} />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-base">{s.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{s.handle}</div>
              </div>
              <div className={`text-sm font-semibold ${s.accent} bg-white px-3 py-1 rounded-full border border-gray-200`}>{s.followers}</div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
function HomePage({ t, setPage, isRTL }: { t: typeof translations['en']; setPage: (p: Page) => void; isRTL?: boolean }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <HeroSection t={t} setPage={setPage} isRTL={isRTL} />

      {/* Service Cards — photo-backed */}
      <ServiceCardsSection t={t} setPage={setPage} />

      {/* What we do — Video Section */}
      <VideoSection />

      {/* Marketplace Route Board */}
      <section id="marketplace" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full mb-6 border border-purple-200">
              <Activity className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-700 font-medium">{t.liveActivity}</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t.marketplaceTitle}</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">{t.homeRoutesDesc}</p>
          </motion.div>
          <MarketplaceRouteBoard />
          <div className="text-center mt-8">
            <button onClick={() => setPage('marketplace')} className="ds-btn-secondary">
              {t.homeRoutesViewAll}
            </button>
          </div>
        </div>
      </section>

      {/* Animated stats counters */}
      <StatsSection />

      {/* Trust & Safety — premium redesign */}
      <TrustSectionNew t={t} setPage={setPage} />

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t.homeTestimTitle}</h2>
            <p className="text-xl text-gray-500">{t.homeTestimDesc}</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { quote: t.homeTestim1Quote, name: t.homeTestim1Name, role: t.homeTestim1Role, company: t.homeTestim1Company, location: t.homeTestim1Location, image: 'https://images.unsplash.com/photo-1610631066894-62452ccb927c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
              { quote: t.homeTestim2Quote, name: t.homeTestim2Name, role: t.homeTestim2Role, company: t.homeTestim2Company, location: t.homeTestim2Location, image: 'https://images.unsplash.com/photo-1733231291455-3c4de1c24e20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
              { quote: t.homeTestim3Quote, name: t.homeTestim3Name, role: t.homeTestim3Role, company: t.homeTestim3Company, location: t.homeTestim3Location, image: 'https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
            ].map((testimonial, i) => (
              <motion.div key={i} className="ds-card ds-card-hover p-8"
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} whileHover={{ y: -5 }}>
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i2) => <Star key={i2} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-600 leading-relaxed mb-8 italic text-lg">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={testimonial.image} alt={testimonial.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Verified className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                    <div className="text-xs text-gray-500">{testimonial.company} · {testimonial.location}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 border-t border-b border-blue-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full mb-6 border border-blue-200">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{t.homeAppComingSoon}</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">{t.homeAppTitle}</h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">{t.homeAppDesc}</p>
              <div className="space-y-4 mb-8">
                {[t.homeAppFeat1, t.homeAppFeat2, t.homeAppFeat3, t.homeAppFeat4, t.homeAppFeat5].map((feature, i) => (
                  <motion.div key={i} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                {[{ store: 'App Store', sub: t.homeAppStoreSubDownload }, { store: 'Google Play', sub: t.homeAppStoreSubGet }].map(b => (
                  <motion.button key={b.store} className="px-6 py-3 bg-black border border-white/10 text-white rounded-xl flex items-center justify-center gap-3 hover:bg-gray-900 transition-colors"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <div className="text-left">
                      <div className="text-xs text-gray-400">{b.sub}</div>
                      <div className="text-sm font-semibold">{b.store}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
            <motion.div className="relative" initial={{ opacity: 0, y: 40, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <div className="relative mx-auto w-[280px] h-[560px] bg-gradient-to-b from-gray-900 to-black rounded-[3rem] border-8 border-gray-800 shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl" />
                <div className="w-full h-full bg-[#0a1628] rounded-[2.5rem] overflow-hidden p-4 space-y-3">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-green-500/30 rounded-full border border-green-500/30" />
                      <div className="flex-1">
                        <div className="h-3 bg-white/20 rounded w-24 mb-1" /><div className="h-2 bg-white/10 rounded w-16" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-600/40 to-blue-600/40 p-4 rounded-xl border border-cyan-500/20">
                    <div className="h-4 bg-white/20 rounded w-32 mb-2" /><div className="h-6 bg-white/30 rounded w-24" />
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="h-3 bg-white/20 rounded w-full mb-2" /><div className="h-3 bg-white/10 rounded w-3/4" />
                  </div>
                </div>
              </div>
              <motion.div className="absolute -top-8 -right-8 bg-white border border-gray-200 p-4 rounded-xl shadow-lg"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">Delivered!</span>
                </div>
              </motion.div>
              <motion.div className="absolute -bottom-8 -left-8 bg-white border border-gray-200 p-4 rounded-xl shadow-lg"
                animate={{ y: [0, 10, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-gray-900">5.0 Rating</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t.faqTitle}</h2>
            <p className="text-xl text-gray-500">{t.homeFaqDesc}</p>
          </motion.div>
          <div className="space-y-3">
            {[
              { q: t.homeFaq1Q, a: t.homeFaq1A },
              { q: t.homeFaq2Q, a: t.homeFaq2A },
              { q: t.homeFaq3Q, a: t.homeFaq3A },
              { q: t.homeFaq4Q, a: t.homeFaq4A },
              { q: t.homeFaq5Q, a: t.homeFaq5A },
              { q: t.homeFaq6Q, a: t.homeFaq6A },
            ].map((faq, index) => (
              <motion.div key={index} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${openFaq === index ? 'border-cyan-200' : 'border-gray-200'}`}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
                <motion.button onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-start hover:bg-gray-50 transition-colors">
                  <span className={`text-base font-semibold pe-4 ${openFaq === index ? 'text-cyan-700' : 'text-gray-900'}`}>{faq.q}</span>
                  <motion.div animate={{ rotate: openFaq === index ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 ${openFaq === index ? 'text-cyan-500' : 'text-gray-400'}`} />
                  </motion.div>
                </motion.button>
                <motion.div initial={false} animate={{ height: openFaq === index ? 'auto' : 0, opacity: openFaq === index ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                  <div className="px-6 pb-5"><p className="text-gray-600 leading-relaxed">{faq.a}</p></div>
                </motion.div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button onClick={() => setPage('faq')} className="ds-btn-secondary">
              {t.homeFaqViewAll}
            </button>
          </div>
        </div>
      </section>

      {/* Social media section */}
      <SocialSection />

      {/* Footer */}
      <footer className="bg-[#030710] text-white py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plane className="w-4 h-4 text-white -rotate-45" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">Chapar</span>
              </div>
              <p className="text-white/60 leading-relaxed mb-6 max-w-sm">The world's most trusted traveler-powered delivery network. Making global shipping accessible, affordable, and secure for everyone.</p>
              <div className="flex gap-4">
                {['Twitter', 'LinkedIn', 'GitHub'].map(social => (
                  <motion.a key={social} href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} aria-label={social}>
                    <span className="sr-only">{social}</span>
                  </motion.a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-4">Product</div>
              <div className="space-y-3">
                {['How it works', 'Pricing', 'Security', 'Insurance', 'API'].map(item => (
                  <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-4">Company</div>
              <div className="space-y-3">
                {['About', 'Blog', 'Careers', 'Press', 'Partners'].map(item => (
                  <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-4">Support</div>
              <div className="space-y-3">
                {['Help Center', 'Contact', 'Terms', 'Privacy', 'Status'].map(item => (
                  <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/50">© 2026 Chapar Cargo. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Inline Tracking Panel ────────────────────────────────────────────────────
import { findDemoRoute } from '../data/demoTrackingRoutes';

function NavTrackingPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<import('../types/tracking').ShipmentRoute | null>(null);
  const [notFound, setNotFound] = useState(false);

  const doSearch = () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    const found = findDemoRoute(code);
    setResult(found);
    setNotFound(!found);
  };

  return (
    <div className="border-t border-white/8 bg-[#04070f]/98 backdrop-blur-2xl shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-start gap-6">
          <div className="flex-1 max-w-lg">
            <div className="text-xs text-cyan-400 font-semibold uppercase tracking-widest mb-3">{t.homeTrkSection}</div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 font-mono transition-all"
                placeholder="CHP-20260607-TOR-TEH"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                dir="ltr"
                autoFocus
              />
              <button
                onClick={doSearch}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                {t.homeTrkSearch}
              </button>
            </div>
            {notFound && !result && (
              <p className="mt-2 text-xs text-red-400">{t.homeTrkNotFound}</p>
            )}
          </div>

          {result && (
            <div className="flex-1 bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-cyan-400">{result.trackingCode}</span>
                <a href={`/track/${result.trackingCode}`} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">{t.homeTrkViewFull}</a>
              </div>

              {/* Route */}
              <div className="flex items-center gap-3 text-sm">
                <div>
                  <div className="font-semibold text-white">{result.publicOriginCity}</div>
                  <div className="text-xs text-gray-500">{result.publicOriginCountry}</div>
                </div>
                <div className="text-cyan-500">→</div>
                <div>
                  <div className="font-semibold text-white">{result.publicDestinationCity}</div>
                  <div className="text-xs text-gray-500">{result.publicDestinationCountry}</div>
                </div>
              </div>

              {/* Security + escrow row */}
              <div className="flex flex-wrap items-center gap-2">
                {result.securityLevel && <SecurityBadge level={result.securityLevel} />}
                {/* Escrow status */}
                {result.escrowStatus !== 'none' && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    result.escrowStatus === 'locked'   ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                    result.escrowStatus === 'released' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                         'bg-gray-500/10 text-gray-400 border-gray-500/30'
                  }`}>
                    🔒 {result.escrowStatus === 'locked' ? t.homeTrkEscrowLocked : result.escrowStatus === 'released' ? t.homeTrkEscrowReleased : t.homeTrkEscrowRefunded}
                  </span>
                )}
              </div>

              {/* Verification statuses */}
              {(result.identityVerificationStatus || result.cargoVerificationStatus) && (
                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
                  {result.identityVerificationStatus && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">{t.homeTrkIdentity}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        result.identityVerificationStatus === 'VERIFIED'      ? 'bg-green-500/15 text-green-400' :
                        result.identityVerificationStatus === 'REJECTED'      ? 'bg-red-500/15 text-red-400'   :
                        result.identityVerificationStatus === 'MANUAL_REVIEW' ? 'bg-blue-500/15 text-blue-400'  :
                                                                                 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {result.identityVerificationStatus === 'VERIFIED' ? t.homeTrkVerified :
                         result.identityVerificationStatus === 'REJECTED' ? t.homeTrkRejected :
                         result.identityVerificationStatus === 'MANUAL_REVIEW' ? t.homeTrkReview : t.homeTrkPending}
                      </span>
                    </div>
                  )}
                  {result.cargoVerificationStatus && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">{t.homeTrkCargo}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        result.cargoVerificationStatus === 'VERIFIED'      ? 'bg-green-500/15 text-green-400' :
                        result.cargoVerificationStatus === 'REJECTED'      ? 'bg-red-500/15 text-red-400'   :
                        result.cargoVerificationStatus === 'MANUAL_REVIEW' ? 'bg-blue-500/15 text-blue-400'  :
                                                                              'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {result.cargoVerificationStatus === 'VERIFIED' ? t.homeTrkVerified :
                         result.cargoVerificationStatus === 'REJECTED' ? t.homeTrkRejected :
                         result.cargoVerificationStatus === 'MANUAL_REVIEW' ? t.homeTrkReview : t.homeTrkPending}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {result.eta && (
                <div className="text-xs text-gray-500">
                  {t.homeTrkEta} <span className="text-white font-medium">{result.eta}</span>
                  {result.distanceText && <> · {result.distanceText}</>}
                </div>
              )}
            </div>
          )}

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { lang, setLang, t, isRTL } = useLang();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    const valid: Page[] = ['home','buy-for-me','send-package','traveler','marketplace','trust-safety','investors','faq','auth','my-orders','wallet','receipt','profile','notifications','traveler-dashboard','smart-tester'];
    return valid.includes(p as Page) ? (p as Page) : 'home';
  });
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showSmartTester, setShowSmartTester] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTrackPanel, setShowTrackPanel] = useState(false);
  const { session, clearSession } = useSession();
  // Tracks which page triggered the auth gate so AuthPage can return the user there on success
  const returnPageRef = useRef<Page>('home');

  useEffect(() => {
    if (window.location.pathname === '/google-earth-preview') {
      window.history.replaceState({}, '', '/');
    }
    // Seed initial history entry so first back() has a state
    window.history.replaceState({ page: currentPage }, '');
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Push a history entry every time the user navigates to a new page
  useEffect(() => {
    if (window.history.state?.page !== currentPage) {
      window.history.pushState({ page: currentPage }, '');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Redirect logged-out users away from protected pages directly to auth (no interstitial)
  useEffect(() => {
    const protected_pages: Page[] = ['send-package', 'traveler', 'buy-for-me', 'my-orders', 'wallet', 'profile', 'traveler-dashboard'];
    if (!session && protected_pages.includes(currentPage)) {
      returnPageRef.current = currentPage;
      setCurrentPage('auth');
    }
  }, [currentPage, session]);

  // Sync React state with browser back/forward buttons
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      setCurrentPage((e.state?.page ?? 'home') as Page);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const fontStyle = isRTL ? { fontFamily: "'Vazirmatn', Tahoma, Arial, sans-serif" } : {};

  // Synchronous auth gate — determines effective page to render without a flash.
  // The useEffect below still runs to sync currentPage/history, but the render
  // already shows AuthPage on the very first frame so there is no white interstitial.
  const AUTH_PROTECTED: Page[] = ['send-package', 'traveler', 'buy-for-me', 'my-orders', 'wallet', 'profile', 'traveler-dashboard'];
  if (!session && AUTH_PROTECTED.includes(currentPage)) {
    returnPageRef.current = currentPage; // store intended destination
  }
  const renderPage: Page = (!session && AUTH_PROTECTED.includes(currentPage)) ? 'auth' : currentPage;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="relative min-h-screen bg-[#050810]" style={fontStyle}>
      {/* AI Copilot */}
      <AnimatePresence>
        {showAICopilot && (
          <motion.div className="fixed bottom-24 right-6 z-50 w-96 bg-[#0d1628] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}>
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">AI Assistant</h3>
                    <p className="text-xs text-white/80">How can I help you?</p>
                  </div>
                </div>
                <button onClick={() => setShowAICopilot(false)} className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors text-white">✕</button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-2 mb-4">
                {['How do I send a package?', 'How do I buy an item?', 'How do I become a traveler?', 'What items are prohibited?', 'How much should I charge?'].map((q, i) => (
                  <button key={i} className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors border border-white/5">{q}</button>
                ))}
              </div>
              <div className="relative">
                <input type="text" placeholder="Ask me anything..." className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500/50" />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center hover:bg-purple-700 transition-colors">
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button onClick={() => setShowAICopilot(!showAICopilot)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full shadow-2xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Sparkles className="w-6 h-6 text-white" />
      </motion.button>

      {/* Smart Tester trigger */}
      <motion.button
        onClick={() => setShowSmartTester(true)}
        className="fixed bottom-24 right-6 z-50 w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg flex items-center justify-center"
        title="Smart Tester"
        whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }}
      >
        <Activity className="w-4 h-4 text-white" />
      </motion.button>

      {/* Smart Tester modal */}
      {showSmartTester && <SmartTester onClose={() => setShowSmartTester(false)} />}

      {/* Header */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#04070f]/95 backdrop-blur-2xl border-b border-white/8 shadow-2xl shadow-black/30'
            : 'bg-[#04070f]/80 backdrop-blur-xl border-b border-white/5'
        }`}
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Logo */}
            <motion.button className="flex items-center gap-2.5 flex-shrink-0" onClick={() => setCurrentPage('home')} whileHover={{ scale: 1.04 }}>
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plane className="w-4 h-4 text-white -rotate-45" />
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-white">Chapar</span>
            </motion.button>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-0.5">
              {[
                { label: t.buyForMe, page: 'buy-for-me' as Page },
                { label: t.sendPackage, page: 'send-package' as Page },
                { label: t.becomeTraveler, page: 'traveler' as Page },
                { label: t.marketplace, page: 'marketplace' as Page },
                { label: t.trustSafety, page: 'trust-safety' as Page },
                { label: t.investors, page: 'investors' as Page },
                { label: t.faq, page: 'faq' as Page },
              ].map(item => (
                <button
                  key={item.page}
                  onClick={() => setCurrentPage(item.page)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentPage === item.page
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setShowTrackPanel(p => !p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  showTrackPanel
                    ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20'
                    : 'text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/8'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.homeNavTrackRoute}
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              {session ? (
                <>
                  <span className="text-sm text-gray-300 font-medium">{session.firstName}</span>
                  <motion.button
                    onClick={() => clearSession()}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    {t.homeNavLogout}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    onClick={() => setCurrentPage('auth')}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    {t.signIn}
                  </motion.button>
                  <motion.button
                    onClick={() => setCurrentPage('auth')}
                    className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/45 hover:from-cyan-400 hover:to-blue-500 transition-all"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    {t.getStarted}
                  </motion.button>
                </>
              )}
              <LanguageSelector lang={lang} setLang={setLang} />
            </div>

            {/* Mobile */}
            <div className="lg:hidden flex items-center gap-2">
              <LanguageSelector lang={lang} setLang={setLang} />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className={`w-5 h-0.5 bg-white transition-all mb-1.5 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <div className={`w-5 h-0.5 bg-white transition-all mb-1.5 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <div className={`w-5 h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                className="md:hidden border-t border-white/8 py-4"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              >
                <div className="space-y-1 mb-4">
                  {[
                    { label: t.buyForMe, page: 'buy-for-me' as Page },
                    { label: t.sendPackage, page: 'send-package' as Page },
                    { label: t.becomeTraveler, page: 'traveler' as Page },
                    { label: t.marketplace, page: 'marketplace' as Page },
                    { label: t.trustSafety, page: 'trust-safety' as Page },
                    { label: t.investors, page: 'investors' as Page },
                    { label: t.faq, page: 'faq' as Page },
                  ].map(item => (
                    <button
                      key={item.page}
                      onClick={() => { setCurrentPage(item.page); setMobileMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors text-sm font-medium"
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowTrackPanel(p => !p); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/8 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t.homeNavTrackRoute}
                  </button>
                </div>
                <div className="flex gap-2">
                  {session ? (
                    <button onClick={() => { clearSession(); setMobileMenuOpen(false); }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
                      {t.homeNavLogout} ({session.firstName})
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setCurrentPage('auth'); setMobileMenuOpen(false); }}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
                        {t.signIn}
                      </button>
                      <button onClick={() => { setCurrentPage('auth'); setMobileMenuOpen(false); }}
                        className="flex-1 px-4 py-2.5 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl">
                        {t.getStarted}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </motion.header>

      {/* Inline tracking panel */}
      <AnimatePresence>
        {showTrackPanel && (
          <motion.div
            className="fixed top-16 left-0 right-0 z-40"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <NavTrackingPanel onClose={() => setShowTrackPanel(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content — uses renderPage (synchronous auth gate) so AuthPage renders on first frame */}
      <AnimatePresence mode="wait">
        <motion.div key={renderPage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {renderPage === 'home' && <HomePage t={t} setPage={setCurrentPage} isRTL={isRTL} />}
          {renderPage === 'buy-for-me' && <BuyForMePage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onNavigate={(p) => { setCurrentPage(p as Page); }} />}
          {renderPage === 'send-package' && <SendPackagePage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onNavigate={(p) => { setCurrentPage(p as Page); }} />}
          {renderPage === 'traveler' && <TravelerPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onNavigate={(p) => { setCurrentPage(p as Page); }} />}
          {renderPage === 'marketplace' && <MarketplacePage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onBook={() => setCurrentPage('send-package')} />}
          {renderPage === 'trust-safety' && <TrustSafetyPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} />}
          {renderPage === 'investors' && <InvestorsPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} />}
          {renderPage === 'faq'  && <FAQPage  onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} />}
          {renderPage === 'auth' && <AuthPage onHome={() => setCurrentPage('home')} onSuccess={() => setCurrentPage(returnPageRef.current)} />}
          {renderPage === 'my-orders' && <MyOrdersPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onOpenReceipt={(id) => { setReceiptId(id); setCurrentPage('receipt'); }} />}
          {renderPage === 'wallet' && <WalletPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} />}
          {renderPage === 'receipt' && <ReceiptPage onBack={() => setCurrentPage('my-orders')} onHome={() => setCurrentPage('home')} t={t} trackId={receiptId} />}
          {renderPage === 'profile' && <ProfilePage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onOpenWallet={() => setCurrentPage('wallet')} onOpenOrders={() => setCurrentPage('my-orders')} />}
          {renderPage === 'notifications' && <NotificationsPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onNavigate={(p) => setCurrentPage(p as Page)} />}
          {renderPage === 'traveler-dashboard' && <TravelerDashboardPage onBack={() => setCurrentPage('home')} onHome={() => setCurrentPage('home')} t={t} onNewTrip={() => setCurrentPage('traveler')} onNavigate={(p) => setCurrentPage(p as Page)} />}
          {renderPage === 'smart-tester' && <SmartTester onHome={() => setCurrentPage('home')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
