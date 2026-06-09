import { Shield, MapPin, Scan, Globe, Users, TrendingUp, CheckCircle, Package, ArrowRight, ChevronDown, Star, Lock, Zap, Clock, CreditCard, Award, BadgeCheck, Sparkles, Activity, Plane, DollarSign, Eye, FileCheck, Building2, Verified, Trophy, Target, BarChart3, Rocket, ArrowLeft } from 'lucide-react';

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
import { useState, useEffect, useRef, Component, type ReactNode } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import Map3DGlobe from './Map3DGlobe';
import GlobeCanvas from './Globe';
import { LangCode, RTL_LANGS, langMeta, translations } from './i18n';

// ── GlobeErrorBoundary — prevents map crashes from blanking the page ──────────
interface GlobeErrorBoundaryState { crashed: boolean }
class GlobeErrorBoundary extends Component<{ className?: string; children: ReactNode }, GlobeErrorBoundaryState> {
  state: GlobeErrorBoundaryState = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err: Error) { console.warn('[GlobeErrorBoundary] caught:', err?.message); }
  render() {
    if (this.state.crashed) {
      return null; // canvas globe base layer is already visible underneath
    }
    return this.props.children;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Page = 'home' | 'buy-for-me' | 'send-package' | 'traveler' | 'marketplace' | 'trust-safety' | 'investors' | 'faq';

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
    { title: 'Payment Locked', description: 'Funds secured in escrow account', icon: Lock, status: 'completed' },
    { title: 'Traveler Accepted', description: 'Verified traveler confirmed delivery', icon: CheckCircle, status: 'completed' },
    { title: 'Package Delivered', description: 'Package handed to recipient', icon: Package, status: 'completed' },
    { title: 'Receiver Confirmed', description: 'Delivery confirmed by recipient', icon: BadgeCheck, status: 'active' },
    { title: 'Funds Released', description: 'Payment transferred to traveler', icon: DollarSign, status: 'pending' },
  ];
  return (
    <div className="relative">
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-blue-500 to-gray-600" />
      <div className="space-y-8">
        {steps.map((step, index) => (
          <motion.div key={index} className="relative flex items-start gap-6"
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.15 }}>
            <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center ${
              step.status === 'completed' ? 'bg-gradient-to-br from-green-500 to-green-600' :
              step.status === 'active' ? 'bg-gradient-to-br from-blue-500 to-blue-600 animate-pulse' :
              'bg-white/10'} shadow-lg`}>
              <step.icon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 pt-3">
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
              {step.status === 'active' && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-sm text-blue-300 font-medium">In Progress</span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500 pt-3">
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
  const routes = [
    { from: 'Toronto', to: 'Tehran', flag1: '🇨🇦', flag2: '🇮🇷', travelers: 12, avgPrice: 85, trend: 'up' },
    { from: 'Dubai', to: 'Vancouver', flag1: '🇦🇪', flag2: '🇨🇦', travelers: 8, avgPrice: 120, trend: 'up' },
    { from: 'London', to: 'New York', flag1: '🇬🇧', flag2: '🇺🇸', travelers: 24, avgPrice: 95, trend: 'stable' },
    { from: 'Singapore', to: 'Sydney', flag1: '🇸🇬', flag2: '🇦🇺', travelers: 15, avgPrice: 75, trend: 'down' },
    { from: 'Paris', to: 'Tokyo', flag1: '🇫🇷', flag2: '🇯🇵', travelers: 10, avgPrice: 110, trend: 'up' },
  ];
  return (
    <div className="space-y-4">
      {routes.map((route, index) => (
        <motion.div key={index}
          className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 hover:border-cyan-500/30 hover:bg-white/8 transition-all group cursor-pointer"
          initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.02 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{route.flag1}</span>
                <div>
                  <div className="font-semibold text-white">{route.from}</div>
                  <div className="text-xs text-gray-500">Origin</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
              <div className="flex items-center gap-3">
                <span className="text-3xl">{route.flag2}</span>
                <div>
                  <div className="font-semibold text-white">{route.to}</div>
                  <div className="text-xs text-gray-500">Destination</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{route.travelers}</div>
                <div className="text-xs text-gray-500">Active Travelers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">${route.avgPrice}</div>
                <div className="text-xs text-gray-500">Avg Price</div>
              </div>
              <div className={`px-3 py-1 rounded-full ${
                route.trend === 'up' ? 'bg-green-500/20 text-green-400' :
                route.trend === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-400'}`}>
                <div className="text-xs font-medium flex items-center gap-1">
                  {route.trend === 'up' ? '↗' : route.trend === 'down' ? '↘' : '→'} {route.trend}
                </div>
              </div>
              <motion.button className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-all"
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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

function PageHeader({ title, desc, onBack, backLabel }: { title: string; desc: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="relative pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#030710] via-[#060c1a] to-[#040a16]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(0,120,255,0.10),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,rgba(0,80,200,0.06),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px,rgba(255,255,255,0.6) 1px,transparent 0)', backgroundSize: '36px 36px' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.button
          onClick={onBack}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-12 group"
        >
          <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center group-hover:border-cyan-500/35 group-hover:bg-cyan-500/10 transition-all shadow-sm">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="text-sm font-medium tracking-wide">{backLabel}</span>
        </motion.button>
        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl lg:text-6xl font-extrabold text-white mb-5 leading-tight"
          style={{ textShadow: '0 2px 30px rgba(0,100,255,0.12)' }}
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-lg text-gray-400 max-w-2xl leading-relaxed"
        >
          {desc}
        </motion.p>
      </div>
    </div>
  );
}

function BuyForMePage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.buyForMeTitle} desc={t.buyForMeDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">{t.bfmFormTitle}</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.bfmProductLabel}</label>
                <input type="text" placeholder={t.bfmProductPlaceholder}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.bfmBuyFromLabel}</label>
                  <input type="text" placeholder={t.bfmBuyFromPlaceholder}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.bfmDeliverToLabel}</label>
                  <input type="text" placeholder={t.bfmDeliverToPlaceholder}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.bfmBudgetLabel}</label>
                <input type="number" placeholder="500"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.bfmNotesLabel}</label>
                <textarea rows={3} placeholder={t.bfmNotesPlaceholder}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none" />
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow">
                {t.bfmFindTraveler}
              </motion.button>
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{t.bfmHowTitle}</h2>
            {[
              { icon: Package, title: t.bfmHowStep1Title, desc: t.bfmHowStep1Desc },
              { icon: Users, title: t.bfmHowStep2Title, desc: t.bfmHowStep2Desc },
              { icon: Lock, title: t.bfmHowStep3Title, desc: t.bfmHowStep3Desc },
              { icon: CheckCircle, title: t.bfmHowStep4Title, desc: t.bfmHowStep4Desc },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}

            {/* Price estimator */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-3">{t.bfmCostTitle}</h3>
              <div className="space-y-2 text-sm">
                {[[t.bfmCostProduct, '$200–$500'], [t.bfmCostTravelerFee, '$16–$40'], [t.bfmCostPlatform, '$5'], [t.bfmCostInsurance, t.bfmCostIncluded]].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                  <span className="text-gray-300">{t.bfmCostTotal}</span>
                  <span className="text-cyan-400">$221–$545</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function SendPackagePage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  const [tier, setTier] = useState(1);
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.sendPackageTitle} desc={t.sendPackageDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">{t.spFormTitle}</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.spFromLabel}</label>
                  <input type="text" placeholder={t.spFromPlaceholder}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.spToLabel}</label>
                  <input type="text" placeholder={t.spToPlaceholder}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.spWeightLabel}</label>
                  <input type="number" placeholder="2.5"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.spValueLabel}</label>
                  <input type="number" placeholder="200"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t.spDeadlineLabel}</label>
                  <input type="date"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.spDescLabel}</label>
                <textarea rows={3} placeholder={t.spDescPlaceholder}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none" />
              </div>

              {/* Service tier */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">{t.spServiceTierLabel}</label>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: t.spTierStandard, time: t.spDays57, price: '$45', id: 0 },
                    { label: t.spTierExpress, time: t.spDays23, price: '$85', id: 1 },
                    { label: t.spTierSameDay, time: t.sp24Hours, price: '$150', id: 2 }].map(s => (
                    <button key={s.id} onClick={() => setTier(s.id)}
                      className={`p-4 rounded-xl border text-center transition-all ${tier === s.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
                      <div className="font-semibold text-white text-sm">{s.label}</div>
                      <div className="text-xs text-gray-400">{s.time}</div>
                      <div className="text-cyan-400 font-bold mt-1">{s.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/25">
                {t.spPostPackage}
              </motion.button>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">{t.spWhyTitle}</h3>
              <div className="space-y-3">
                {[[t.spBenefit1Val, t.spBenefit1Lbl],
                  [t.spBenefit2Val, t.spBenefit2Lbl],
                  [t.spBenefit3Val, t.spBenefit3Lbl],
                  [t.spBenefit4Val, t.spBenefit4Lbl]].map(([v, l]) => (
                  <div key={v} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <div className="text-white text-sm font-medium">{v}</div>
                      <div className="text-gray-500 text-xs">{l}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-xl p-6">
              <div className="text-4xl font-bold text-white mb-1">99.8%</div>
              <div className="text-green-400 text-sm font-medium">{t.spSuccessRate}</div>
              <div className="text-gray-400 text-xs mt-1">{t.spDeliveries}</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function TravelerPage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  const [weight, setWeight] = useState(5);
  const earning = Math.round(weight * 18);
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.travelerTitle} desc={t.travelerDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Steps */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-white">{t.travHowTitle}</h2>
            {[
              { step: '01', title: t.travStep1Title, desc: t.travStep1Desc, icon: Users },
              { step: '02', title: t.travStep2Title, desc: t.travStep2Desc, icon: BadgeCheck },
              { step: '03', title: t.travStep3Title, desc: t.travStep3Desc, icon: Plane },
              { step: '04', title: t.travStep4Title, desc: t.travStep4Desc, icon: Package },
              { step: '05', title: t.travStep5Title, desc: t.travStep5Desc, icon: DollarSign },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                className="flex gap-5 bg-white/5 border border-white/10 rounded-xl p-5 hover:border-cyan-500/30 transition-colors">
                <div className="text-4xl font-black text-white/10 font-mono w-12 flex-shrink-0">{s.step}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-lg flex items-center justify-center">
                      <s.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-white">{s.title}</h3>
                  </div>
                  <p className="text-gray-400 text-sm">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Earnings calculator */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-5">{t.travCalcTitle}</h3>
              <div className="mb-5">
                <label className="block text-sm text-gray-400 mb-2">{t.travLuggageLabel} <span className="text-white">{weight}kg</span></label>
                <input type="range" min={1} max={15} value={weight} onChange={e => setWeight(Number(e.target.value))}
                  className="w-full accent-cyan-500" />
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-xl p-5 text-center">
                <div className="text-4xl font-bold text-white mb-1">${earning}</div>
                <div className="text-cyan-400 text-sm">{t.travEstPerTrip}</div>
                <div className="text-gray-500 text-xs mt-1">{t.travAvgPricing}</div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {[[t.travMonthly, `$${earning * 2}`], [t.travAnnually, `$${earning * 24}`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">{t.travReqTitle}</h3>
              <div className="space-y-3">
                {[t.travReq1, t.travReq2, t.travReq3, t.travReq4, t.travReq5].map(r => (
                  <div key={r} className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300 text-sm">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/25">
              {t.travRegister}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function MarketplacePage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.marketplaceTitle} desc={t.mktBrowseDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex gap-4 mb-8 flex-wrap">
          {[t.mktAllRoutes, t.mktToTehran, t.mktToDubai, t.mktToLondon, t.mktToNewYork, t.mktToToronto].map((f, i) => (
            <button key={f} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${i === 0 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
              {f}
            </button>
          ))}
        </div>
        <MarketplaceRouteBoard />
        <div className="mt-8 text-center">
          <button className="px-8 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-colors">
            {t.mktLoadMore}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrustSafetyPage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.trustSafetyTitle} desc={t.tsDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-12">
        {/* Security layers */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">{t.tsSecurityLayers}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'SOC 2 Type II', desc: t.tsSoc2Desc, badge: t.tsCertified, color: 'from-blue-500/20 to-blue-600/10' },
              { icon: Lock, title: 'ISO 27001', desc: t.tsIsoDesc, badge: t.tsCertified, color: 'from-purple-500/20 to-purple-600/10' },
              { icon: BadgeCheck, title: 'PCI DSS Level 1', desc: t.tsPciDesc, badge: t.tsCompliant, color: 'from-green-500/20 to-green-600/10' },
              { icon: FileCheck, title: 'GDPR Compliant', desc: t.tsGdprDesc, badge: t.tsVerifiedBadge, color: 'from-cyan-500/20 to-cyan-600/10' },
            ].map((cert, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`bg-gradient-to-br ${cert.color} border border-white/10 p-6 rounded-2xl text-center`}>
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <cert.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-white mb-2">{cert.title}</h3>
                <p className="text-gray-400 text-sm mb-3">{cert.desc}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">{cert.badge}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Escrow */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">{t.tsEscrowTitle}</h2>
            <p className="text-gray-400 mb-6">{t.tsEscrowDesc}</p>
            <EscrowTimeline />
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-3">{t.tsAiTitle}</h2>
            {[
              { title: t.tsAi1Title, desc: t.tsAi1Desc },
              { title: t.tsAi2Title, desc: t.tsAi2Desc },
              { title: t.tsAi3Title, desc: t.tsAi3Desc },
              { title: t.tsAi4Title, desc: t.tsAi4Desc },
              { title: t.tsAi5Title, desc: t.tsAi5Desc },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestorsPage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.investorsTitle} desc={t.invDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Users, value: 50, suffix: 'M+', label: t.invNetworkUsers, growth: t.invYoY127 },
            { icon: Globe, value: 190, suffix: '+', label: t.invCountries, growth: t.invGlobalCoverage },
            { icon: DollarSign, value: 100, suffix: 'B', prefix: '$', label: t.invTAM, growth: t.invExpandingMarket },
            { icon: TrendingUp, value: 215, suffix: '%', label: t.invRevenueGrowth, growth: t.invYearOverYear },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/8 transition-colors">
              <stat.icon className="w-8 h-8 text-blue-400 mb-4" />
              <div className="text-4xl font-bold text-white mb-2">
                <CountUpAnimation end={stat.value} prefix={stat.prefix} suffix={stat.suffix} duration={2.5} />
              </div>
              <div className="text-gray-300 mb-2">{stat.label}</div>
              <div className="text-sm text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {stat.growth}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Target, title: t.invProblemTitle, color: 'text-blue-400', desc: t.invProblemDesc },
            { icon: Zap, title: t.invSolutionTitle, color: 'text-purple-400', desc: t.invSolutionDesc },
            { icon: BarChart3, title: t.invTractionTitle, color: 'text-green-400', desc: t.invTractionDesc },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
              className="bg-white/5 border border-white/10 p-8 rounded-2xl">
              <card.icon className={`w-8 h-8 ${card.color} mb-4`} />
              <h3 className="text-2xl font-bold text-white mb-3">{card.title}</h3>
              <p className="text-gray-400 leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t.invCtaTitle}</h2>
          <p className="text-gray-400 mb-6">{t.invCtaDesc}</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/25">
            {t.invCtaButton}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function FAQPage({ onBack, t }: { onBack: () => void; t: typeof translations['en'] }) {
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #030710, #050810 120px, #050810)' }}>
      <PageHeader title={t.faqTitle} desc={t.faqDesc} onBack={onBack} backLabel={t.backHome} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
              <motion.button onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors">
                <span className="text-base font-semibold text-white pr-4">{faq.question}</span>
                <motion.div animate={{ rotate: openFaq === index ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </motion.div>
              </motion.button>
              <motion.div initial={false} animate={{ height: openFaq === index ? 'auto' : 0, opacity: openFaq === index ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                <div className="px-6 pb-5">
                  <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RouteTicker ─────────────────────────────────────────────────────────────
const TICKER_ROUTES = [
  { route: 'تورنتو → تهران',      status: 'مسافر تأیید شد',       color: '#00d4ff' },
  { route: 'دبی → شیراز',          status: 'پرداخت امانی فعال',    color: '#22c55e' },
  { route: 'فرانکفورت → اصفهان',  status: 'بسته در حال تطبیق',   color: '#f59e0b' },
  { route: 'لندن → مشهد',          status: 'تحویل تأیید شد',       color: '#a855f7' },
  { route: 'استانبول → تبریز',    status: 'مسیر فعال',            color: '#f97316' },
  { route: 'ونکوور → تهران',      status: 'سفارش جدید',           color: '#ec4899' },
  { route: 'سنگاپور → تهران',     status: 'مسافر تأیید شد',       color: '#22c55e' },
  { route: 'سیدنی → مشهد',        status: 'در راه',               color: '#3b82f6' },
  { route: 'مسکو → تهران',        status: 'پرداخت امانی فعال',    color: '#84cc16' },
  { route: 'تهران → دبی',         status: 'تحویل تأیید شد',       color: '#14b8a6' },
  { route: 'پاریس → تهران',       status: 'سفارش جدید',           color: '#f43f5e' },
  { route: 'ابوظبی → تهران',      status: 'مسیر فعال',            color: '#f59e0b' },
  { route: 'توکیو → تهران',       status: 'بسته در حال تطبیق',   color: '#d97706' },
  { route: 'دوحه → مشهد',         status: 'مسافر تأیید شد',       color: '#6366f1' },
  { route: 'ملبورن → تهران',      status: 'سفارش جدید',           color: '#ec4899' },
  { route: 'نیویورک → تهران',     status: 'پرداخت امانی فعال',    color: '#22c55e' },
  { route: 'لس‌آنجلس → مشهد',    status: 'مسافر تأیید شد',       color: '#a855f7' },
  { route: 'تهران → استانبول',    status: 'در راه',               color: '#00d4ff' },
];

function RouteTicker() {
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
              <span className="text-gray-400 text-xs">{item.status}</span>
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
  const [loadMap3D, setLoadMap3D] = useState(false);

  useEffect(() => {
    // Defer Map3D until after the page is interactive — prevents blocking hero render
    const t = setTimeout(() => setLoadMap3D(true), 800);
    return () => clearTimeout(t);
  }, []);

  const heroButtons = [
    { label: t.heroCta1, page: 'buy-for-me' as Page, primary: true },
    { label: t.heroCta2, page: 'traveler' as Page,    primary: false },
    { label: t.heroCta3, page: 'send-package' as Page, primary: false },
  ];

  return (
    <section style={{ height: '100vh' }} className="relative overflow-hidden">
      {/* Canvas globe — renders immediately, always visible as safe fallback */}
      <div className="absolute inset-0 z-0">
        <GlobeCanvas className="w-full h-full" />
      </div>

      {/* Map3D — loaded after 800ms so hero text/buttons are interactive first.
          Returns null on failure/timeout so canvas globe shows through. */}
      {loadMap3D && (
        <div className="absolute inset-0 z-0">
          <GlobeErrorBoundary className="w-full h-full">
            <Map3DGlobe className="w-full h-full" />
          </GlobeErrorBoundary>
        </div>
      )}

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
  const cards = [
    { title: 'مسافر کیست؟',    desc: 'ویدیو آینده برای توضیح اینکه مسافر کیست، چگونه مسیر خود را ثبت می‌کند، چگونه درآمد کسب می‌کند و فرآیند تأیید هویت چگونه انجام می‌شود.' },
    { title: 'خرید برای شما',  desc: 'ویدیو آینده برای توضیح اینکه چاپار چگونه می‌تواند کالا را از کشور دیگر برای کاربر خریداری کند و از طریق مسافران تأییدشده تحویل دهد.' },
    { title: 'ارسال کالا',     desc: 'ویدیو آینده برای توضیح اینکه کاربران چگونه می‌توانند کالای خود را با پرداخت امانی، تأیید تحویل و امنیت کامل از طریق چاپار ارسال کنند.' },
  ];
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #04070f, #070d1c)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] blur-[130px] rounded-full" style={{ background: 'rgba(0,120,255,0.06)' }} />
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 rounded-full mb-6 border border-cyan-500/20">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-sm text-cyan-300 font-medium">چاپار</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">ما چه کاری انجام می‌دهیم</h2>
        </motion.div>

        {/* Main featured video placeholder */}
        <motion.div
          className="mb-12 rounded-2xl overflow-hidden border border-white/8 relative"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', backdropFilter: 'blur(20px)' }}
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          <div className="aspect-video flex flex-col items-center justify-center gap-5 relative">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px,rgba(255,255,255,0.8) 1px,transparent 0)', backgroundSize: '32px 32px' }} />
            <motion.div
              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center border border-white/20"
              style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
              whileHover={{ scale: 1.08 }}
            >
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white/70 border-b-[10px] border-b-transparent ml-1" />
            </motion.div>
            <p className="text-gray-400 text-sm relative z-10">ویدیو معرفی چاپار به‌زودی اضافه می‌شود</p>
          </div>
        </motion.div>

        {/* 3 video cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className="rounded-2xl overflow-hidden border border-white/8 hover:border-white/16 transition-all group cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', backdropFilter: 'blur(16px)' }}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="aspect-video flex items-center justify-center relative border-b border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px,rgba(255,255,255,0.6) 1px,transparent 0)', backgroundSize: '24px 24px' }} />
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center border border-white/15 relative z-10 group-hover:border-cyan-400/40 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white/60 border-b-[8px] border-b-transparent ml-1 group-hover:border-l-cyan-300/80 transition-colors" />
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-200 transition-colors">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-cyan-500/60 font-medium">
                  <div className="w-1.5 h-1.5 bg-cyan-500/60 rounded-full" />
                  به‌زودی
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
      desc: 'کالا را از هر فروشگاهی در جهان سفارش دهید. مسافران تأییدشده آن را مستقیماً به دستتان می‌رسانند.',
      page: 'buy-for-me' as Page,
      tag: 'خرید جهانی',
    },
    {
      photo: '/assets/photo-2.png',
      title: t.heroCta2,
      desc: 'در سفرهای خود درآمد کسب کنید. بسته‌ها را با حفاظت کامل امانی تحویل دهید.',
      page: 'traveler' as Page,
      tag: 'کسب درآمد از سفر',
    },
    {
      photo: '/assets/photo-3.png',
      title: t.heroCta3,
      desc: 'کالای شخصی را با سیستم پرداخت امانی و تأیید تحویل به هر نقطه‌ای از دنیا ارسال کنید.',
      page: 'send-package' as Page,
      tag: 'ارسال مطمئن',
    },
  ];
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(to bottom, #04070f, #060c18)' }}>
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
                  <span>شروع کنید</span>
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
  const stats = [
    { end: 190,   suffix: '+',  prefix: '',  label: 'کشور تحت پوشش',        icon: Globe,        accent: 'text-cyan-400'   },
    { end: 50000, suffix: '+',  prefix: '',  label: 'مسافر تأییدشده',        icon: Users,        accent: 'text-purple-400' },
    { end: 99.9,  suffix: '%',  prefix: '',  label: 'نرخ موفقیت تحویل',      icon: CheckCircle,  accent: 'text-green-400'  },
    { end: 10,    suffix: 'K$', prefix: '',  label: 'پوشش بیمه هر مرسوله',   icon: Shield,       accent: 'text-blue-400'   },
  ];
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-b border-white/5" style={{ background: 'linear-gradient(to right, #050810, #070d1a, #050810)' }}>
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
              <div className="text-gray-400 text-sm">{stat.label}</div>
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
      title: 'پرداخت امانی رمزنگاری‌شده',
      desc: 'وجوه شما تا تأیید تحویل موفق در سیستم امانی رمزنگاری‌شده محافظت می‌شود.',
      tags: ['رمزنگاری AES-256', 'استرداد خودکار', 'ثبت بلاکچین'],
      gradient: 'from-blue-500/15 to-blue-600/5',
      border: 'border-blue-500/20',
      hoverBorder: 'hover:border-blue-400/40',
      accent: 'text-blue-400',
    },
    {
      icon: BadgeCheck,
      title: 'تأیید هویت با هوش مصنوعی',
      desc: 'هر مسافر از فرآیند تأیید جامع هوش مصنوعی شامل بررسی چهره و پاسپورت عبور می‌کند.',
      tags: ['تشخیص چهره', 'تأیید پاسپورت', 'بررسی سابقه'],
      gradient: 'from-purple-500/15 to-purple-600/5',
      border: 'border-purple-500/20',
      hoverBorder: 'hover:border-purple-400/40',
      accent: 'text-purple-400',
    },
    {
      icon: Shield,
      title: 'گواهینامه‌های امنیتی بین‌المللی',
      desc: 'انطباق کامل با بالاترین استانداردهای امنیت اطلاعات جهانی.',
      tags: ['SOC 2 Type II', 'ISO 27001', 'PCI DSS L1'],
      gradient: 'from-green-500/15 to-green-600/5',
      border: 'border-green-500/20',
      hoverBorder: 'hover:border-green-400/40',
      accent: 'text-green-400',
    },
    {
      icon: Eye,
      title: 'نظارت بلادرنگ ۲۴/۷',
      desc: 'هوش مصنوعی تمام تراکنش‌ها را برای شناسایی ناهنجاری‌ها بررسی می‌کند.',
      tags: ['تشخیص تقلب آنی', 'هشدار فوری', 'GDPR'],
      gradient: 'from-cyan-500/15 to-cyan-600/5',
      border: 'border-cyan-500/20',
      hoverBorder: 'hover:border-cyan-400/40',
      accent: 'text-cyan-400',
    },
    {
      icon: CheckCircle,
      title: 'تأیید تحویل هوشمند',
      desc: 'تحویل کالا فقط با تأیید دیجیتال گیرنده نهایی می‌شود. سیستم هوشمند ما اطمینان می‌دهد که بسته به دست صحیح رسیده است.',
      tags: ['تأیید دیجیتال', 'امضای الکترونیک', 'عکس تحویل'],
      gradient: 'from-orange-500/15 to-orange-600/5',
      border: 'border-orange-500/20',
      hoverBorder: 'hover:border-orange-400/40',
      accent: 'text-orange-400',
    },
    {
      icon: FileCheck,
      title: 'حل اختلاف شفاف',
      desc: 'در صورت هرگونه مشکل، تیم داوری ما ظرف ۴۸ ساعت با بررسی مدارک دیجیتال موضوع را حل می‌کند و بازگشت کامل وجه تضمین می‌شود.',
      tags: ['داوری ۴۸ ساعته', 'بازگشت تضمینی', 'مدارک دیجیتال'],
      gradient: 'from-rose-500/15 to-rose-600/5',
      border: 'border-rose-500/20',
      hoverBorder: 'hover:border-rose-400/40',
      accent: 'text-rose-400',
    },
  ];

  return (
    <section id="security" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #080f1e, #050810)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] blur-[140px] rounded-full" style={{ background: 'rgba(30,80,200,0.07)' }} />
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div className="text-center mb-20" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full mb-6 border border-green-500/20">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300 font-medium">امنیت سازمانی</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5">{t.trustSafety}</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">زیرساخت سطح بانکی برای حفاظت از هر تراکنش</p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {[
            { value: '99.9%', label: 'نرخ موفقیت',      icon: Activity, accent: 'text-green-400' },
            { value: '$10K',  label: 'پوشش بیمه',        icon: Shield,   accent: 'text-blue-400' },
            { value: '24/7',  label: 'نظارت امنیتی',    icon: Eye,      accent: 'text-purple-400' },
            { value: '190+',  label: 'کشور تحت پوشش',   icon: Globe,    accent: 'text-cyan-400' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="border border-white/8 rounded-2xl p-6 text-center hover:border-white/14 transition-all"
              style={{ background: 'rgba(255,255,255,0.025)' }}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
            >
              <stat.icon className={`w-5 h-5 ${stat.accent} mx-auto mb-3`} />
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Feature cards 2×3 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              className={`bg-gradient-to-br ${feat.gradient} border ${feat.border} ${feat.hoverBorder} p-8 rounded-2xl transition-all group`}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <feat.icon className={`w-7 h-7 ${feat.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">{feat.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {feat.tags.map(tag => (
                      <span key={tag} className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 ${feat.accent} font-medium`}>
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
          className="flex flex-col sm:flex-row items-center justify-between gap-6 py-6 px-8 rounded-2xl border border-white/8"
          style={{ background: 'rgba(255,255,255,0.02)' }}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          <div className="flex flex-wrap gap-6 items-center">
            {['SOC 2 Type II', 'ISO 27001', 'PCI DSS Level 1', 'GDPR'].map(cert => (
              <div key={cert} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300 font-medium">{cert}</span>
              </div>
            ))}
          </div>
          <motion.button
            onClick={() => setPage('trust-safety')}
            className="px-6 py-3 border border-white/15 text-gray-200 rounded-xl text-sm font-medium hover:border-white/30 transition-all whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.06)' }}
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
  const socials = [
    {
      name: 'Instagram', handle: '@chaparcargo',
      href: 'https://instagram.com/chaparcargo',
      Icon: InstagramIcon,
      gradient: 'from-pink-500/15 to-purple-600/8',
      border: 'border-pink-500/20 hover:border-pink-400/45',
      accent: 'text-pink-400',
      followers: '۱۲K',
    },
    {
      name: 'Telegram', handle: '@chaparcargo',
      href: 'https://t.me/chaparcargo',
      Icon: TelegramIcon,
      gradient: 'from-sky-500/15 to-blue-600/8',
      border: 'border-sky-500/20 hover:border-sky-400/45',
      accent: 'text-sky-400',
      followers: '۸.۵K',
    },
    {
      name: 'TikTok', handle: '@chaparcargo',
      href: 'https://tiktok.com/@chaparcargo',
      Icon: TikTokIcon,
      gradient: 'from-white/8 to-white/4',
      border: 'border-white/15 hover:border-white/35',
      accent: 'text-white',
      followers: '۲۱K',
    },
    {
      name: 'WhatsApp', handle: 'چاپار',
      href: 'https://wa.me/message/chaparcargo',
      Icon: WhatsAppIcon,
      gradient: 'from-green-500/15 to-emerald-600/8',
      border: 'border-green-500/20 hover:border-green-400/45',
      accent: 'text-green-400',
      followers: 'پشتیبانی',
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#04070f]">
      <div className="max-w-5xl mx-auto">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">ما را در شبکه‌های اجتماعی دنبال کنید</h2>
          <p className="text-gray-400">آخرین اخبار، داستان‌های موفقیت و به‌روزرسانی‌های چاپار</p>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {socials.map((s, i) => (
            <motion.a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-gradient-to-br ${s.gradient} border ${s.border} rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all group`}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.03 }}
            >
              <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <s.Icon className={`w-6 h-6 ${s.accent}`} />
              </div>
              <div>
                <div className="font-bold text-white text-base">{s.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{s.handle}</div>
              </div>
              <div className={`text-sm font-semibold ${s.accent} bg-white/5 px-3 py-1 rounded-full border border-white/8`}>{s.followers}</div>
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
      <section id="marketplace" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050810]">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full mb-6 border border-purple-500/20">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">{t.liveActivity}</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">{t.marketplaceTitle}</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">مسیرهای فعال با مسافران آماده برای تحویل</p>
          </motion.div>
          <MarketplaceRouteBoard />
          <div className="text-center mt-8">
            <button onClick={() => setPage('marketplace')} className="px-8 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-colors">
              مشاهده همه مسیرها
            </button>
          </div>
        </div>
      </section>

      {/* Animated stats counters */}
      <StatsSection />

      {/* Trust & Safety — premium redesign */}
      <TrustSectionNew t={t} setPage={setPage} />

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050810]">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">تجربه‌های واقعی کاربران ما</h2>
            <p className="text-xl text-gray-400">داستان‌های واقعی از جامعه جهانی چاپار</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { quote: 'چاپار کاملاً نحوه ارسال بسته‌هایم به ایران را تغییر داد. سیستم پرداخت امانی فوق‌العاده است — با خیال راحت وسایل گران‌قیمت را می‌فرستم.', name: 'نیلوفر رستمی', role: 'کارآفرین تجارت الکترونیک', company: 'استارتاپ تورنتو', location: 'تورنتو، کانادا', image: 'https://images.unsplash.com/photo-1610631066894-62452ccb927c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
              { quote: 'در سفرهای تجاری‌ام بیش از ۱۵,۰۰۰ دلار از طریق تحویل بسته کسب کرده‌ام. پلتفرم بی‌نقص، پرداخت‌ها فوری و جامعه کاربران کاملاً قابل اعتماد است.', name: 'محمد احمدی', role: 'مشاور کسب‌وکار و مسافر', company: 'شرکت راه‌حل‌های جهانی', location: 'دبی، امارات', image: 'https://images.unsplash.com/photo-1733231291455-3c4de1c24e20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
              { quote: 'بیش از ۳۰ ارسال بین‌المللی از طریق چاپار داشته‌ام. هوش مصنوعی تطبیق فوق‌العاده عمل می‌کند و پشتیبانی کاملاً حرفه‌ای است. دیگر نمی‌توانم از حمل‌ونقل سنتی استفاده کنم.', name: 'آناهیتا علیزاده', role: 'مدیر زنجیره تأمین', company: 'شرکت تجارت جهانی', location: 'سنگاپور', image: 'https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxoYXBweSUyMGN1c3RvbWVyJTIwdGVzdGltb25pYWwlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3ODA1OTUxOTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
            ].map((testimonial, i) => (
              <motion.div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:border-cyan-500/20 transition-all"
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} whileHover={{ y: -5 }}>
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i2) => <Star key={i2} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-300 leading-relaxed mb-8 italic text-lg">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={testimonial.image} alt={testimonial.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-white/10" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Verified className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-lg">{testimonial.name}</div>
                    <div className="text-sm text-gray-400">{testimonial.role}</div>
                    <div className="text-xs text-gray-500">{testimonial.company} · {testimonial.location}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-indigo-600/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#080f1e]" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-indigo-600/10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6 border border-white/20">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">به‌زودی</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">مدیریت مرسولات در هر مکان</h2>
              <p className="text-xl text-white/80 mb-8 leading-relaxed">اپلیکیشن موبایل چاپار را برای iOS و Android دانلود کنید. بسته‌ها را ردیابی کنید، با مسافران پیام بفرستید و تحویل‌ها را از هر جای دنیا مدیریت کنید.</p>
              <div className="space-y-4 mb-8">
                {['اعلان‌های فوری بلادرنگ', 'پیام‌رسانی داخلی با مسافران', 'ردیابی GPS زنده', 'پرداخت تک‌لمسی', 'پشتیبانی از حالت آفلاین'].map((feature, i) => (
                  <motion.div key={i} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white/90">{feature}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                {[{ store: 'App Store', sub: 'دانلود از' }, { store: 'Google Play', sub: 'دریافت از' }].map(b => (
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
              <motion.div className="absolute -top-8 -right-8 bg-[#0d1628] border border-white/10 p-4 rounded-xl shadow-lg"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-semibold text-white">Delivered!</span>
                </div>
              </motion.div>
              <motion.div className="absolute -bottom-8 -left-8 bg-[#0d1628] border border-white/10 p-4 rounded-xl shadow-lg"
                animate={{ y: [0, 10, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-white">5.0 Rating</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050810]">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">{t.faqTitle}</h2>
            <p className="text-xl text-gray-400">همه چیزی که باید درباره چاپار بدانید</p>
          </motion.div>
          <div className="space-y-3">
            {[
              { q: 'سیستم پرداخت امانی چگونه کار می‌کند؟', a: 'هنگام ثبت سفارش، وجه شما به‌صورت امن در حساب امانی رمزنگاری‌شده نگهداری می‌شود. پول فقط پس از تأیید تحویل موفق توسط شما به مسافر منتقل می‌شود. در صورت هرگونه اختلاف، تیم حل اختلاف ما بررسی می‌کند و با پوشش کامل استرداد، نتیجه عادلانه‌ای برای هر دو طرف تضمین می‌شود.' },
              { q: 'مسافران چگونه تأیید هویت می‌شوند؟', a: 'هر مسافر از فرآیند جامع تأیید هویت شامل کارت ملی، تأیید پاسپورت، بررسی سوابق و تشخیص چهره عبور می‌کند. آن‌ها باید حداقل امتیاز ۴.۵ ستاره را حفظ کنند و ما از سیستم تشخیص تقلب مبتنی بر هوش مصنوعی با نظارت مستمر استفاده می‌کنیم.' },
              { q: 'چه اقلامی را می‌توان از طریق چاپار ارسال کرد؟', a: 'می‌توانید اکثر اقلام شخصی، اسناد، لوازم الکترونیکی، هدایا و محصولات تجاری کوچک زیر ۱۵ کیلوگرم را ارسال کنید. اقلام ممنوعه شامل مواد خطرناک، مواد مخدر، سلاح، حیوانات زنده، محصولات فاسدشدنی و اقلام نیازمند مجوز خاص می‌باشد.' },
              { q: 'اگر بسته‌ام تحویل داده نشود چه اتفاقی می‌افتد؟', a: 'هر مرسوله به‌طور خودکار تا سقف ۱۰,۰۰۰ دلار بیمه دارد، بدون هزینه اضافه. اگر تحویل در بازه زمانی توافق‌شده تأیید نشود، استرداد کامل وجه به‌علاوه خسارت بیمه‌ای برای ارزش اعلام‌شده دریافت می‌کنید.' },
              { q: 'به‌عنوان مسافر چقدر می‌توانم درآمد داشته باشم؟', a: 'اکثر مسافران برای هر تحویل ۵۰ تا ۳۰۰ دلار درآمد دارند و برترین‌ها سالانه بیش از ۱۵,۰۰۰ دلار کسب می‌کنند. شما نرخ خود را تعیین می‌کنید و انتخاب می‌کنید کدام بسته‌ها را بپذیرید.' },
              { q: 'آیا چاپار در کشور من فعال است؟', a: 'بله! چاپار در بیش از ۱۹۰ کشور در تمام قاره‌ها فعالیت می‌کند و مسیرهای فعال آن ۹۵٪ از جمعیت جهان را پوشش می‌دهد.' },
            ].map((faq, index) => (
              <motion.div key={index} className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
                <motion.button onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors">
                  <span className="text-base font-semibold text-white pr-4">{faq.q}</span>
                  <motion.div animate={{ rotate: openFaq === index ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  </motion.div>
                </motion.button>
                <motion.div initial={false} animate={{ height: openFaq === index ? 'auto' : 0, opacity: openFaq === index ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                  <div className="px-6 pb-5"><p className="text-gray-400 leading-relaxed">{faq.a}</p></div>
                </motion.div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button onClick={() => setPage('faq')} className="px-8 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-colors">
              مشاهده همه سؤالات
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
            <div className="text-xs text-cyan-400 font-semibold uppercase tracking-widest mb-3">رهگیری مرسوله</div>
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
                جستجو
              </button>
            </div>
            {notFound && !result && (
              <p className="mt-2 text-xs text-red-400">کد رهگیری پیدا نشد. لطفاً کد را بررسی کنید.</p>
            )}
          </div>

          {result && (
            <div className="flex-1 bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-cyan-400">{result.trackingCode}</span>
                <a
                  href={`/track/${result.trackingCode}`}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  مشاهده کامل ←
                </a>
              </div>
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
              {result.eta && (
                <div className="mt-2 text-xs text-gray-500">
                  تحویل: <span className="text-white font-medium">{result.eta}</span>
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
  const [lang, setLang] = useState<LangCode>('fa');
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTrackPanel, setShowTrackPanel] = useState(false);

  const t = translations[lang];
  const isRTL = RTL_LANGS.includes(lang);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const fontStyle = isRTL ? { fontFamily: "'Vazirmatn', Tahoma, Arial, sans-serif" } : {};

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
                رهگیری مسیر
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <motion.button
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                {t.signIn}
              </motion.button>
              <motion.button
                className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/45 hover:from-cyan-400 hover:to-blue-500 transition-all"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                {t.getStarted}
              </motion.button>
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
                    رهگیری مسیر
                  </button>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">{t.signIn}</button>
                  <button className="flex-1 px-4 py-2.5 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl">{t.getStarted}</button>
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

      {/* Page content */}
      <AnimatePresence mode="wait">
        <motion.div key={currentPage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {currentPage === 'home' && <HomePage t={t} setPage={setCurrentPage} isRTL={isRTL} />}
          {currentPage === 'buy-for-me' && <BuyForMePage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'send-package' && <SendPackagePage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'traveler' && <TravelerPage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'marketplace' && <MarketplacePage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'trust-safety' && <TrustSafetyPage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'investors' && <InvestorsPage onBack={() => setCurrentPage('home')} t={t} />}
          {currentPage === 'faq' && <FAQPage onBack={() => setCurrentPage('home')} t={t} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
