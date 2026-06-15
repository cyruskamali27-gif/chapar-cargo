/**
 * OrderPage — ports order.html (the "Choose Type" picker) exactly.
 *
 * localStorage keys written (mirrors order.html):
 *   cp_order.type — 'personal' | 'chapar'   (via saveOrder)
 *   cp_order.sub  — 'personal' | 'business' (via saveOrder, chapar branch only)
 *
 * No API calls — 100% localStorage, same as order.html.
 *
 * Navigation:
 *   "ارسال شخصی"           → saveOrder({type:'personal'})  → renders SendPackagePage
 *   "خرید شخصی/تجاری"      → saveOrder({type:'chapar',sub}) → renders SendPackagePage(cargoType='chapar')
 */
import { useState } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { saveOrder } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import SendPackagePage from '../app/SendPackagePage';
import { translations } from '../app/i18n';

type View = 'picker' | 'buy-types' | 'send-package' | 'buy-for-me';

export default function OrderPage() {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const [view, setView] = useState<View>('picker');

  const tProp = translations['fa'] as Record<string, string>;

  function goSendPackage() {
    saveOrder({ type: 'personal' });
    setView('send-package');
  }

  function goBuyForMe(sub: 'personal' | 'business') {
    saveOrder({ type: 'chapar', sub });
    setView('buy-for-me');
  }

  if (view === 'send-package') {
    return (
      <SendPackagePage
        onBack={() => setView('picker')}
        onHome={() => { window.location.href = '/'; }}
        t={tProp}
        cargoType="personal"
      />
    );
  }

  if (view === 'buy-for-me') {
    return (
      <SendPackagePage
        onBack={() => setView('buy-types')}
        onHome={() => { window.location.href = '/'; }}
        t={tProp}
        cargoType="chapar"
      />
    );
  }

  // ── Picker / buy-types views ───────────────────────────────────────────────
  const isPicker = view === 'picker';

  function handleBack() {
    if (view === 'buy-types') { setView('picker'); return; }
    window.history.back();
  }

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Page header */}
      <div className="ds-page-header px-4 sm:px-6">
        <div className="max-w-lg mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <button onClick={handleBack} className="ds-nav-btn group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t.ordBack}</span>
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="ds-nav-btn ds-nav-btn-home">
              <Home className="w-4 h-4" />
              <span>{t.ordHome}</span>
            </button>
          </div>

          {isPicker ? (
            <>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2">{t.ordTitle}</h1>
              <p className="text-gray-500">{t.ordSubtitle}</p>
            </>
          ) : (
            <>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{t.ordBuyTitle}</div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2">{t.ordBuyHeading}</h1>
              <p className="text-gray-500">{t.ordBuySubtitle}</p>
            </>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-24 space-y-4">

        {/* Auth banner — mirrors order.html renderAuthBanner() */}
        {session ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
              {(session.firstName || '').charAt(0)}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-gray-900">{t.ordGreeting.replace('{name}', session.firstName || '')}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.ordSavedProfile}</div>
            </div>
            <a href="/?page=profile" className="text-xs font-bold text-blue-600 no-underline flex-shrink-0">{t.ordProfileLink}</a>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5">
            <span className="text-base flex-shrink-0">ℹ️</span>
            <div className="flex-1 text-xs text-gray-500 font-semibold leading-relaxed">{t.ordLoginPrompt}</div>
            <a
              href="/?page=auth&return=/order"
              className="flex-shrink-0 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold no-underline"
            >
              {t.ordLogin}
            </a>
          </div>
        )}

        {/* ── Step 1: main type picker ── */}
        {isPicker && (
          <>
            {/* Card: ارسال شخصی */}
            <button
              type="button"
              onClick={goSendPackage}
              className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-start group"
            >
              <div>
                <div className="text-base font-bold text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">{t.ordPersonalTitle}</div>
                <div className="text-sm text-gray-500">{t.ordPersonalDesc}</div>
              </div>
              <span className="text-3xl flex-shrink-0">👤</span>
            </button>

            {/* Card: خرید توسط چاپار */}
            <button
              type="button"
              onClick={() => setView('buy-types')}
              className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-start group"
            >
              <div>
                <div className="text-base font-bold text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">{t.ordChaparTitle}</div>
                <div className="text-sm text-gray-500">{t.ordChaparDesc}</div>
              </div>
              <span className="text-3xl flex-shrink-0">🛒</span>
            </button>

            {/* Browse travelers link — mirrors order.html /travelers.html link */}
            <div className="text-center pt-1">
              <a
                href="/marketplace"
                className="text-sm font-bold text-blue-600 no-underline opacity-85 hover:opacity-100 transition-opacity"
              >
                {t.ordBrowse}
              </a>
            </div>
          </>
        )}

        {/* ── Step 2: Chapar purchase sub-types ── */}
        {view === 'buy-types' && (
          <>
            {/* Card: درخواست خرید شخصی */}
            <button
              type="button"
              onClick={() => goBuyForMe('personal')}
              className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-start group"
            >
              <div>
                <div className="text-base font-bold text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">{t.ordBuyPersonalTitle}</div>
                <div className="text-sm text-gray-500">{t.ordBuyPersonalDesc}</div>
              </div>
              <span className="text-3xl flex-shrink-0">🧍</span>
            </button>

            {/* Card: درخواست خرید تجاری */}
            <button
              type="button"
              onClick={() => goBuyForMe('business')}
              className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-start group"
            >
              <div>
                <div className="text-base font-bold text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">{t.ordBuyBusinessTitle}</div>
                <div className="text-sm text-gray-500">{t.ordBuyBusinessDesc}</div>
              </div>
              <span className="text-3xl flex-shrink-0">🏢</span>
            </button>
          </>
        )}

      </div>
    </div>
  );
}
