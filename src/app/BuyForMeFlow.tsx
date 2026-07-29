import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Home, ShoppingCart, Building2, ChevronDown } from 'lucide-react';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import type { Translations } from './i18n';
import ChaparConcierge from './ChaparConcierge';

// ── Buy flow — mode selector → ChaparConcierge ────────────────────────────────
//
// CMD-67: BuyForMeForm and everything only it used are DELETED — ~430 lines: the form itself,
// LinkTab, EditableProductFields, SectionHeader, Err, the CURRENCIES/CURR_FLAGS/getUSD money
// helpers, the ProductInfo/DestInfo/ValueInfo/RecipInfo/FetchResult types, and the lifted
// product/value state that existed only to feed the form. The ProductFinder, PhoneField and
// RequiredHint imports went with them.
//
// It was never mounted. The `mode === 'buyforme'` branch below has rendered ChaparConcierge and
// nothing else, so the form was unreachable in every shipped build — including the publish gate
// CMD-65 added to it, which no user ever saw. Concierge is the single shipped buy path (product
// decision, CMD-67), and a dead parallel implementation of the same flow is exactly the thing
// that drifts: CMD-65 hardened the copy nobody runs while the live path stayed ungated for
// another two commands. Deleting it means there is one buy path to gate, and gating it is not
// optional-looking.
//
// git history keeps it: `git show 725eb41d^:src/app/BuyForMeFlow.tsx`. Its /api/orders/create
// contract is untouched and still served — nothing here changes the server.

type Mode = 'selector' | 'buyforme' | 'commercial';

// ── Mode Selector (2 cards: Buy-For-Me + Commercial) ─────────────────────────

function ModeSelector({ t, isRTL, onSelectBuyForMe, onSelectCommercial }: {
  t: Translations;
  isRTL: boolean;
  onSelectBuyForMe: () => void;
  onSelectCommercial: () => void;
}) {
  const modes = [
    {
      key: 'buyforme',
      icon: <ShoppingCart className="w-7 h-7 text-cyan-600" />,
      title: t.buyForMe,
      desc: t.buyForMeDesc,
      gradient: 'from-cyan-50 to-blue-50',
      border: 'border-cyan-200 hover:border-cyan-400',
      badge: null as string | null,
      disabled: false,
      onClick: onSelectBuyForMe,
    },
    {
      key: 'commercial',
      icon: <Building2 className="w-7 h-7 text-gray-500" />,
      title: t.bfm2Commercial,
      desc: t.bfm2CommercialDesc,
      gradient: 'from-gray-50 to-slate-50',
      border: 'border-gray-200',
      badge: t.bfm2ComingSoon,
      disabled: true,
      onClick: onSelectCommercial,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{t.bfm2ModeTitle}</h2>
        <p className="text-sm text-gray-500">{t.bfm2ModeDesc}</p>
      </div>
      {modes.map((m, i) => (
        <motion.button
          key={m.key}
          onClick={m.disabled ? undefined : m.onClick}
          disabled={m.disabled}
          className={`w-full text-${isRTL ? 'right' : 'left'} bg-gradient-to-br ${m.gradient} border-2 ${m.border} rounded-2xl p-5 transition-all flex items-start gap-4 ${m.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          whileHover={m.disabled ? {} : { y: -2, scale: 1.01 }}
          whileTap={m.disabled ? {} : { scale: 0.98 }}
        >
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-gray-900 text-base">{m.title}</span>
              {m.badge && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  {m.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
          </div>
          {!m.disabled && (
            <ChevronDown className={`w-5 h-5 text-gray-500 flex-shrink-0 mt-1 ${isRTL ? 'rotate-90' : '-rotate-90'}`} />
          )}
        </motion.button>
      ))}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export default function BuyForMeFlow({ onBack, onHome, t, isRTL, onNeedAuth, initialMode, onPublished }: {
  onBack: () => void;
  onHome: () => void;
  t: Translations;
  isRTL: boolean;
  // Passed by App.tsx and part of this component's contract, but nothing left in the tree
  // consumes it — the deleted form was the only reader. Declared, not destructured.
  onNavigate?: (page: string) => void;
  onNeedAuth?: () => void;
  initialMode?: Mode;
  // CMD-67: was destructured at line 594 but never declared — the prop the Concierge's publish
  // success calls back through. vite does not typecheck on build, so it went unnoticed.
  onPublished?: (orderId: string) => void;
}) {
  const { lang } = useLang();
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>(initialMode ?? 'selector');

  function goBack() {
    if (mode !== 'selector') setMode('selector');
    else onBack();
  }

  const headingLabel = mode === 'selector' ? t.buyForMeTitle : t.buyForMe;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold text-gray-900 leading-tight truncate">{headingLabel}</h1>
        </div>
        <button onClick={onHome} className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <Home className="w-7 h-7" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
        <AnimatePresence mode="wait">

          {/* ── Selector: choose Buy-For-Me or Commercial ── */}
          {mode === 'selector' && (
            <motion.div key="selector" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ModeSelector
                t={t}
                isRTL={isRTL}
                onSelectBuyForMe={() => setMode('buyforme')}
                onSelectCommercial={() => setMode('commercial')}
              />
            </motion.div>
          )}

          {/* ── Buy-For-Me: the single shipped buy path ── */}
          {mode === 'buyforme' && (
            <motion.div key="buyforme" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ChaparConcierge language={lang} userName={session?.firstName || ""} userId={session?.userId} onNeedAuth={onNeedAuth} onPublished={onPublished} />
            </motion.div>
          )}

          {/* ── Commercial: coming-soon stub ── */}
          {mode === 'commercial' && (
            <motion.div key="commercial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="ds-card p-10 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-extrabold text-gray-800 mb-2">{t.bfm2Commercial}</h2>
              <p className="text-sm text-gray-500 mb-4">{t.bfm2CommercialDesc}</p>
              <span className="inline-block text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                {t.bfm2ComingSoon}
              </span>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
