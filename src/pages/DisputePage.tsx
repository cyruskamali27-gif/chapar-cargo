/**
 * Dispute page — ports dispute.html exactly.
 * localStorage keys: cp_disputes (write), cp_history (read), cp_admin_statuses (read)
 * URL params: ?id= (orderId, optional)
 */
import { useState, useEffect } from 'react';
import { Store, genId } from '../lib/store';
import { useLang } from '../lib/LangContext';
import type { translations } from '../app/i18n';

type T = typeof translations['en'];
type PartyKey = 'traveler' | 'sender' | 'unknown' | 'system';

const TL_STYLE: Record<string, { dot: string; title: string }> = {
  pass: { dot: 'bg-green-50 border-2 border-green-300',       title: 'text-green-600' },
  fail: { dot: 'bg-red-50 border-2 border-red-300',           title: 'text-red-600' },
  warn: { dot: 'bg-amber-50 border-2 border-amber-300',       title: 'text-amber-600' },
  pend: { dot: 'bg-gray-100 border-2 border-gray-200',        title: 'text-gray-400' },
};

interface OrderData {
  trackId?: string;
  origin?: string; dest?: string;
  originLabel?: string; destLabel?: string;
  adminStatus?: string;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:80px;right:50%;transform:translateX(50%);background:#111;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;opacity:0;transition:opacity .25s';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DisputePage() {
  const { t, isRTL } = useLang();
  const params = new URLSearchParams(location.search);
  const urlId  = params.get('id');

  const DISPUTE_TYPES: Record<string, { label: string; partyKey: PartyKey; action: string }> = {
    damage:   { label: t.dispDamageLabel,   partyKey: 'traveler', action: t.dispDamageAction },
    lost:     { label: t.dispLostLabel,     partyKey: 'traveler', action: t.dispLostAction },
    mismatch: { label: t.dispMismatchLabel, partyKey: 'sender',   action: t.dispMismatchAction },
    fraud:    { label: t.dispFraudLabel,    partyKey: 'unknown',  action: t.dispFraudAction },
    payment:  { label: t.dispPaymentLabel,  partyKey: 'system',   action: t.dispPaymentAction },
    other:    { label: t.dispOtherLabel,    partyKey: 'unknown',  action: t.dispOtherAction },
  };
  const partyLabel: Record<PartyKey, string> = {
    traveler: t.dispPartyTraveler, sender: t.dispPartySender, unknown: t.dispPartyUnknown, system: t.dispPartySystem,
  };
  const DTYPE_CARDS = [
    { key: 'damage',   icon: '💔', label: t.dispDamageLabel },
    { key: 'lost',     icon: '❓', label: t.dispLostLabel },
    { key: 'mismatch', icon: '🔄', label: t.dispMismatchLabel },
    { key: 'fraud',    icon: '🚨', label: t.dispFraudLabel },
    { key: 'payment',  icon: '💳', label: t.dispPaymentLabel },
    { key: 'other',    icon: '📝', label: t.dispOtherLabel },
  ];
  const TIMELINE = [
    { icon: '📷', status: 'pass', title: t.dispTl1Title, desc: t.dispTl1Desc, time: t.dispTl1Time },
    { icon: '🪪', status: 'pass', title: t.dispTl2Title, desc: t.dispTl2Desc, time: t.dispTl2Time },
    { icon: '💳', status: 'pass', title: t.dispTl3Title, desc: t.dispTl3Desc, time: t.dispTl3Time },
    { icon: '✈️', status: 'pass', title: t.dispTl4Title, desc: t.dispTl4Desc, time: t.dispTl4Time },
    { icon: '📦', status: 'pend', title: t.dispTl5Title, desc: t.dispTl5Desc, time: t.dispTl5Time },
    { icon: '⚠️', status: 'warn', title: t.dispTl6Title, desc: t.dispTl6Desc, time: t.dispTl6Time },
  ];
  const SCAN_STEPS = [t.dispScan1, t.dispScan2, t.dispScan3, t.dispScan4, t.dispScan5];

  const [orderId, setOrderId]       = useState(urlId ? urlId.toUpperCase() : '');
  const [order, setOrder]           = useState<OrderData | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [dtype, setDtype]           = useState('');
  const [desc, setDesc]             = useState('');
  const [err, setErr]               = useState('');
  const [phase, setPhase]           = useState<'form' | 'scan' | 'decision'>('form');
  const [scanVisible, setScanVisible] = useState<boolean[]>([]);
  const [ticket, setTicket]         = useState('');

  useEffect(() => {
    if (urlId) loadOrderById(urlId.toUpperCase());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadOrderById(id: string) {
    const hist  = Store.get<OrderData[]>('history') ?? [];
    const sts   = Store.get<Record<string, string>>('admin_statuses') ?? {};
    const found = hist.find(o => o.trackId === id);
    if (!found) { showToast(t.dispOrderNotFound); return; }
    setOrder({ ...found, adminStatus: sts[id] || 'pending' });
    setOrderId(id);
  }

  function handleManualSearch() {
    const id = manualInput.trim().toUpperCase();
    if (!id) { showToast(t.dispEnterCode); return; }
    loadOrderById(id);
  }

  function submitDispute() {
    setErr('');
    if (!dtype) { setErr(t.dispErrType); return; }
    if (!desc || desc.length < 20) { setErr(t.dispErrDesc); return; }

    const tk = genId('DIP');
    const disputes = Store.get<object[]>('disputes') ?? [];
    disputes.unshift({ ticketId: tk, orderId: orderId || null, dtype, desc, status: 'pending', createdAt: Date.now() });
    Store.set('disputes', disputes.slice(0, 100));

    setTicket(tk);
    setPhase('scan');

    // Animate scan steps
    SCAN_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setScanVisible(prev => {
          const next = [...prev]; next[i] = true; return next;
        });
        if (i === SCAN_STEPS.length - 1) {
          setTimeout(() => setPhase('decision'), 500);
        }
      }, 500 * (i + 1));
    });
  }

  const info    = DISPUTE_TYPES[dtype] || DISPUTE_TYPES['other'];
  const isKnown = dtype !== 'other' && dtype !== 'fraud';

  const evidences = [
    t.dispEv1,
    t.dispEv2,
    t.dispEv3,
    dtype === 'damage'   ? t.dispEvDamage :
    dtype === 'lost'     ? t.dispEvLost :
    dtype === 'mismatch' ? t.dispEvMismatch :
                           t.dispEvOther,
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{t.dispBack}</button>
        <span className="text-sm font-bold text-gray-900">{t.dispTitle}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        <div className="flex items-center justify-center mb-1">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-8 object-contain" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1">{t.dispTitle}</h2>
        <p className="text-sm text-gray-500 text-center mb-6">{t.dispSubtitle}</p>

        {/* AI monitoring banner */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-xl shrink-0" style={{ animation: 'pulse 1.8s ease infinite' }}>🤖</div>
          <div>
            <div className="text-sm font-bold text-gray-900">{t.dispAiBanner}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t.dispAiBannerDesc}</div>
          </div>
        </div>

        {/* Order chip */}
        {order ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5">
            <span className="text-2xl">📦</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-600 tracking-wider">{orderId}</div>
              <div className="text-xs text-gray-500">{(order.originLabel || order.origin || '—') + ' ← ' + (order.destLabel || order.dest || '—')}</div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">{t.dispInReview}</span>
          </div>
        ) : (
          /* Manual order entry */
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 mb-2">{t.dispManualCodeLabel}</label>
            <div className="flex gap-2">
              <input type="text" value={manualInput} onChange={e => setManualInput(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                     placeholder="CH-XXXXX"
                     className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold tracking-widest text-center bg-white outline-none focus:border-blue-400 ltr" />
              <button onClick={handleManualSearch}
                      className="shrink-0 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors">{t.dispSearch}</button>
            </div>
          </div>
        )}

        {/* AI Timeline */}
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t.dispLogTitle}</div>
        <div className="mb-6">
          {TIMELINE.map((item, idx) => (
            <div key={idx} className="flex gap-3 relative pb-4 last:pb-0">
              {idx < TIMELINE.length - 1 && (
                <div className="absolute right-[17px] top-9 bottom-0 w-0.5 bg-gray-100" />
              )}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 z-10 ${TL_STYLE[item.status]?.dot}`}>{item.icon}</div>
              <div className="flex-1 pt-1">
                <div className={`text-sm font-bold mb-0.5 ${TL_STYLE[item.status]?.title}`}>{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
                <div className="text-[10px] text-gray-400 mt-1 opacity-70">{item.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Dispute form */}
        {phase === 'form' && (
          <div className="border-t border-gray-100 pt-5">
            <div className="text-sm font-bold text-gray-900 mb-4">{t.dispFormTitle}</div>
            <div className="text-xs font-bold text-gray-500 mb-3">{t.dispTypeLabel}</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {DTYPE_CARDS.map(c => (
                <button key={c.key} onClick={() => setDtype(c.key)}
                        className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 transition-all text-right ${
                          dtype === c.key
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-100 bg-white hover:bg-gray-50'
                        }`}>
                  <span className="text-xl shrink-0">{c.icon}</span>
                  <span className={`text-xs font-bold ${dtype === c.key ? 'text-red-600' : 'text-gray-700'}`}>{c.label}</span>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-2">{t.dispDescLabel}</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4}
                        placeholder={t.dispDescPlaceholder}
                        onFocus={e => (e.target.style.borderColor = 'rgba(239,68,68,.5)')}
                        onBlur={e => (e.target.style.borderColor = '')}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white outline-none resize-vertical leading-relaxed" />
            </div>

            {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-3">{err}</div>}

            <button onClick={submitDispute}
                    className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#e03050,#b01030)' }}>
              {t.dispSubmit}
            </button>
          </div>
        )}

        {/* AI analysis (scan) */}
        {(phase === 'scan' || phase === 'decision') && (
          <div className="border-t border-gray-100 pt-5">
            <div className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">{t.dispAnalysisTitle}</div>

            <div className="mb-5 space-y-2">
              {SCAN_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl text-sm transition-all duration-300 ${scanVisible[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                  <span>{scanVisible[i] ? '✅' : '⏳'}</span>
                  <span className="text-gray-700">{step}</span>
                </div>
              ))}
            </div>

            {/* Decision card */}
            {phase === 'decision' && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">🔎</span>
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-1">{t.dispResultTitle}</div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      isKnown
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {isKnown ? t.dispResultReviewable : t.dispResultUrgent}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">{t.dispLikelyParty}</div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 mb-4">
                  <span>{info.partyKey === 'traveler' ? '✈️' : info.partyKey === 'sender' ? '📦' : '❓'}</span>
                  {partyLabel[info.partyKey]}
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">{t.dispEvidenceSummary}</div>
                <div className="mb-4 divide-y divide-gray-100">
                  {evidences.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 text-xs text-gray-600 leading-relaxed">
                      <span className="shrink-0">{ev[0]}</span>
                      <span>{ev.slice(1)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">{t.dispRecommendedAction}</div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed mb-4">{info.action}</div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed mb-4">
                  ⏱ {t.disp48h}{' '}
                  {t.dispCaseNumber} <strong className="text-blue-600 tracking-wide">{ticket}</strong>
                </div>

                <div className="flex gap-2">
                  <a href="/support"
                     className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 no-underline">
                    {t.dispSupport}
                  </a>
                  <a href={orderId ? '/track?id=' + orderId : '/'}
                     className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-600 no-underline">
                    {t.dispTrackOrder}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex gap-3 mt-6">
          <button onClick={() => history.back()} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">{t.dispBack}</button>
          <button onClick={() => { location.href = '/'; }} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">{t.dispHome}</button>
        </div>
      </div>
    </div>
  );
}
