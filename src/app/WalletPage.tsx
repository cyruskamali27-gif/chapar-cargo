import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store, getLiveRate } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Tx { id: string; type: string; amount: number; desc: string; at: number; orderId?: string | null; }
interface Wallet { balance: number; held: number; transactions: Tx[]; }

type TxDir = 'in' | 'out' | 'hold';
const TX_META: Record<string, { dir: TxDir; icon: string; sign: string }> = {
  charge:   { dir:'in',   icon:'💳', sign:'+' },
  received: { dir:'in',   icon:'💰', sign:'+' },
  release:  { dir:'in',   icon:'🔓', sign:'+' },
  refund:   { dir:'in',   icon:'♻️', sign:'+' },
  payment:  { dir:'out',  icon:'📦', sign:'-' },
  withdraw: { dir:'out',  icon:'🏦', sign:'-' },
  hold:     { dir:'hold', icon:'🔒', sign:'−' },
};
const DIR_COLORS: Record<TxDir, string> = {
  in:   'text-green-600 bg-green-50',
  out:  'text-red-600   bg-red-50',
  hold: 'text-yellow-600 bg-yellow-50',
};

const PRESETS = [100000, 500000, 1000000, 5000000];

// ── WL helpers (mirrors wallet.html WL object) ────────────────────────────────
function wlGet(phone: string): Wallet {
  const all = Store.get<Record<string, Wallet>>('wallets') ?? {};
  return all[phone] ?? { balance: 0, held: 0, transactions: [] };
}
function wlSave(phone: string, w: Wallet) {
  const all = Store.get<Record<string, Wallet>>('wallets') ?? {};
  all[phone] = w; Store.set('wallets', all);
}
function wlCredit(phone: string, amount: number, desc: string, type = 'charge', orderId: string | null = null) {
  const w = wlGet(phone);
  w.balance += amount;
  w.transactions = [{ id:'TX-'+Date.now(), type, amount, desc, at:Date.now(), orderId }, ...(w.transactions||[])];
  wlSave(phone, w);
}
function wlDebit(phone: string, amount: number, desc: string, type = 'payment', orderId: string | null = null) {
  const w = wlGet(phone);
  w.balance -= amount;
  w.transactions = [{ id:'TX-'+Date.now(), type, amount, desc, at:Date.now(), orderId }, ...(w.transactions||[])];
  wlSave(phone, w);
}

function fmtToman(n: number, suffix: string) { return Math.round(n).toLocaleString('fa-IR') + ' ' + suffix; }
function fmtDate(ts: number) {
  try { return new Date(ts).toLocaleDateString('fa-IR', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return ''; }
}
function fmtStat(n: number) {
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1000)    return (n/1000).toFixed(0) + 'K';
  return String(Math.round(n));
}

interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; }

export default function WalletPage({ onHome }: Props) {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const PAY_LABELS: Record<string, string> = { card:t.walPayCard, toman:t.walPayToman, usdt:'USDT', paypal:'PayPal' };
  const [wallet, setWallet] = useState<Wallet>({ balance:0, held:0, transactions:[] });
  const [txFilter, setTxFilter] = useState<'all'|'in'|'out'|'hold'>('all');
  const [toast, setToast]       = useState('');

  // Charge modal state
  const [showCharge,    setShowCharge]    = useState(false);
  const [chargeAmt,     setChargeAmt]     = useState('');
  const [chargePay,     setChargePay]     = useState<string|null>(null);
  const [chargeErr,     setChargeErr]     = useState('');
  const [chargeState,   setChargeState]   = useState<'form'|'processing'|'success'>('form');

  // Withdraw modal state
  const [showWithdraw,  setShowWithdraw]  = useState(false);
  const [withdrawAmt,   setWithdrawAmt]   = useState('');
  const [withdrawIBAN,  setWithdrawIBAN]  = useState('');
  const [withdrawErr,   setWithdrawErr]   = useState('');
  const [withdrawState, setWithdrawState] = useState<'form'|'processing'|'success'>('form');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const refresh = useCallback(() => {
    if (!session?.phone) return;
    setWallet(wlGet(session.phone));
  }, [session?.phone]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!session) return null; // App.tsx redirects to auth

  const rate   = getLiveRate();
  const bal    = wallet.balance || 0;
  const held   = wallet.held    || 0;

  const allOffers = Store.get<Array<{status:string; ownerTxnId?:string; travelerDepositTxnId?:string; txnId?:string; orderId?:string; price?:number; travelerName?:string; description?:string}>>('offers') ?? [];
  const active    = allOffers.filter(o => o.status === 'accepted');
  const orders    = Store.get<Array<{id?:string; trackId?:string; description?:string; cargo?:string; cargoValue?:number}>>('history') ?? [];

  const inTypes  = new Set(['charge','received','release','refund']);
  const outTypes = new Set(['payment','withdraw']);
  const txs = wallet.transactions || [];
  const statIn  = txs.filter(t => inTypes.has(t.type)).reduce((s, t) => s + t.amount, 0);
  const statOut = txs.filter(t => outTypes.has(t.type)).reduce((s, t) => s + t.amount, 0);

  const filteredTxs = txFilter === 'in'   ? txs.filter(t => inTypes.has(t.type))
    : txFilter === 'out'  ? txs.filter(t => outTypes.has(t.type))
    : txFilter === 'hold' ? txs.filter(t => t.type === 'hold')
    : txs;

  function doCharge() {
    const amt = parseInt(chargeAmt) || 0;
    if (!amt || amt < 10000) { setChargeErr(t.walErrMinCharge); return; }
    if (!chargePay)           { setChargeErr(t.walErrPayMethod); return; }
    setChargeState('processing');
    setTimeout(() => {
      wlCredit(session.phone, amt, t.walChargeDesc.replace('{method}', PAY_LABELS[chargePay] ?? chargePay), 'charge', null);
      refresh();
      setChargeState('success');
    }, 2200);
  }

  function resetCharge() {
    setChargeAmt(''); setChargePay(null); setChargeErr(''); setChargeState('form');
  }

  function doWithdraw() {
    const amt  = parseInt(withdrawAmt) || 0;
    const iban = withdrawIBAN.trim();
    if (!amt || amt < 500000) { setWithdrawErr(t.walErrMinWithdraw); return; }
    if (amt > bal)             { setWithdrawErr(t.walErrInsufficient.replace('{bal}', fmtToman(bal, t.walToman))); return; }
    if (!iban)                 { setWithdrawErr(t.walErrIban); return; }
    if (!iban.toUpperCase().startsWith('IR')) { setWithdrawErr(t.walErrIbanFormat); return; }
    setWithdrawState('processing');
    setTimeout(() => {
      wlDebit(session.phone, amt, t.walWithdrawDesc.replace('{iban}', iban.slice(0,8)), 'withdraw', null);
      refresh();
      setWithdrawState('success');
    }, 2000);
  }

  function resetWithdraw() {
    setWithdrawAmt(''); setWithdrawIBAN(''); setWithdrawErr(''); setWithdrawState('form');
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>{t.walBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.walHome}</span>
          </button>
          <h1 className="mr-auto text-lg font-extrabold text-gray-900">{t.walTitle}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Balance card */}
        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="text-xs font-bold opacity-70 mb-1">{t.walTotalBalance}</div>
          <div className="text-3xl font-extrabold mb-1">{fmtToman(bal, t.walToman)}</div>
          <div className="text-sm opacity-70">≈ $ {(bal / rate).toFixed(2)}</div>
          {held > 0 && (
            <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 text-xs font-bold">
              🔒 {t.walHeld}: {fmtToman(held, t.walToman)}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => { resetCharge(); setShowCharge(true); }}
              className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-xl transition-colors border border-white/30">
              {t.walCharge}
            </button>
            <button onClick={() => {
                if (bal < 500000) { showToast(t.walToastInsufficient); return; }
                resetWithdraw(); setShowWithdraw(true);
              }}
              disabled={bal < 500000}
              className="flex-1 py-2.5 bg-white text-cyan-700 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 hover:bg-gray-50">
              {t.walWithdraw}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: fmtStat(statIn),  lbl: t.walStatIn,   color:'text-green-600' },
            { val: fmtStat(statOut), lbl: t.walStatOut,  color:'text-red-500'   },
            { val: active.length || '۰', lbl: t.walStatActive, color:'text-cyan-600' },
          ].map(s => (
            <div key={s.lbl} className="ds-card p-3 text-center">
              <div className={`text-base font-extrabold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Active deals */}
        {active.length > 0 && (
          <div className="ds-card p-4">
            <div className="text-sm font-extrabold text-gray-800 mb-3">{t.walActiveDeals} ({active.length})</div>
            <div className="space-y-2">
              {active.map((o, i) => {
                const order = orders.find(h => h.id === o.orderId || h.trackId === o.orderId) ?? {};
                const desc = order.description || order.cargo || t.walDefaultPackage;
                const isTraveler = !!o.travelerDepositTxnId;
                const isOwner    = !!o.ownerTxnId;
                if (isTraveler) {
                  return (
                    <a key={i} href={`/track?id=${o.travelerDepositTxnId}&role=traveler`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 no-underline text-inherit hover:bg-gray-100 transition-colors"
                      style={{ textDecoration:'none', color:'inherit' }}>
                      <span className="text-xl">🧳</span>
                      <div className="flex-1"><div className="text-sm font-bold">{t.walCarry}: {desc}</div><div className="text-xs text-gray-400">{t.walTraveler}</div></div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t.walInProgress}</span>
                    </a>
                  );
                } else if (isOwner) {
                  return (
                    <a key={i} href={`/track?id=${o.ownerTxnId}&role=owner`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 no-underline text-inherit hover:bg-gray-100 transition-colors"
                      style={{ textDecoration:'none', color:'inherit' }}>
                      <span className="text-xl">📦</span>
                      <div className="flex-1"><div className="text-sm font-bold">{t.walSend}: {desc}</div><div className="text-xs text-gray-400">{o.travelerName || t.walTraveler}</div></div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t.walInProgress}</span>
                    </a>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className="ds-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-extrabold text-gray-800">{t.walTransactions}</div>
            <div className="flex gap-1.5">
              {([['all',t.walFilterAll],['in',t.walFilterIn],['out',t.walFilterOut],['hold',t.walFilterHold]] as const).map(([v,l]) => (
                <button key={v} onClick={() => setTxFilter(v)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors
                    ${txFilter === v ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'border-gray-200 text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {filteredTxs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <div className="text-sm">{txFilter === 'all' ? t.walNoTx : t.walNoTxFilter}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map((tx, i) => {
                const m = TX_META[tx.type] ?? { dir:'in' as TxDir, icon:'💲', sign:'+' };
                const dc = DIR_COLORS[m.dir];
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${dc}`}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800 truncate">{tx.desc || '—'}</div>
                      <div className="text-[10px] text-gray-400">{fmtDate(tx.at)}{tx.id ? ' · ' + tx.id : ''}</div>
                    </div>
                    <div className={`text-sm font-extrabold font-mono flex-shrink-0 ${m.dir === 'out' ? 'text-red-500' : m.dir === 'hold' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {m.sign}{Math.round(tx.amount).toLocaleString('fa-IR')} ت
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Charge modal ── */}
      {showCharge && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowCharge(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-gray-900">{t.walChargeTitle}</h3>
              <button onClick={() => setShowCharge(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            {chargeState === 'form' && (
              <>
                <div className="mb-4">
                  <label className="ds-label">{t.walAmountToman}</label>
                  <input type="number" className="ds-input" placeholder={t.walMinCharge} min="10000"
                    value={chargeAmt} onChange={e => setChargeAmt(e.target.value)} style={{ direction:'ltr' }} />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {PRESETS.map(p => (
                      <button key={p} onClick={() => setChargeAmt(String(p))}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors
                          ${chargeAmt === String(p) ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {(p/1000).toLocaleString('fa-IR')}K
                      </button>
                    ))}
                  </div>
                  {parseInt(chargeAmt) >= 10000 && (
                    <div className="text-xs text-gray-400 mt-1">≈ $ {(parseInt(chargeAmt) / rate).toFixed(2)}</div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="ds-label">{t.walPayMethod}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[['card','💳',t.walPayCardBank],['toman','🏦',t.walPayTomanDeposit],['usdt','₮','USDT'],['paypal','🅿️','PayPal']].map(([id, icon, lbl]) => (
                      <button key={id} onClick={() => setChargePay(id as string)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors
                          ${chargePay === id ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                        <span>{icon}</span><span>{lbl}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {chargeErr && <div className="text-sm text-red-600 mb-3 font-medium">{chargeErr}</div>}
                <button onClick={doCharge} className="ds-btn-primary w-full py-3">{t.walPay}</button>
              </>
            )}
            {chargeState === 'processing' && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                <div className="text-sm font-bold text-gray-600">{t.walPayProcessing}</div>
              </div>
            )}
            {chargeState === 'success' && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-base font-extrabold text-gray-900 mb-1">
                  {t.walChargeSuccessAmt.replace('{n}', Number(parseInt(chargeAmt)).toLocaleString('fa-IR'))}
                </div>
                <div className="text-sm text-gray-400 mb-5">{t.walChargeSuccessDesc}</div>
                <button onClick={() => setShowCharge(false)} className="ds-btn-primary px-8 py-2.5">{t.walClose}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Withdraw modal ── */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowWithdraw(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-gray-900">{t.walWithdrawTitle}</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            {withdrawState === 'form' && (
              <>
                <div className="mb-3 text-xs text-gray-400">{t.walAvailable} <strong className="text-gray-700">{fmtToman(bal, t.walToman)}</strong></div>
                <div className="mb-4">
                  <label className="ds-label">{t.walWithdrawAmt}</label>
                  <input type="number" className="ds-input" placeholder={t.walMinWithdraw} min="500000"
                    value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} style={{ direction:'ltr' }} />
                  {parseInt(withdrawAmt) >= 500000 && (
                    <div className="text-xs text-gray-400 mt-1">≈ $ {(parseInt(withdrawAmt) / rate).toFixed(2)}</div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="ds-label">{t.walIban}</label>
                  <input type="text" className="ds-input" placeholder="IR..." maxLength={26}
                    value={withdrawIBAN} onChange={e => setWithdrawIBAN(e.target.value)} style={{ direction:'ltr' }} />
                </div>
                {withdrawErr && <div className="text-sm text-red-600 mb-3 font-medium">{withdrawErr}</div>}
                <button onClick={doWithdraw} className="ds-btn-primary w-full py-3">{t.walRequestWithdraw}</button>
              </>
            )}
            {withdrawState === 'processing' && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                <div className="text-sm font-bold text-gray-600">{t.walPayProcessing}</div>
              </div>
            )}
            {withdrawState === 'success' && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-base font-extrabold text-gray-900 mb-1">{t.walWithdrawSuccess}</div>
                <div className="text-sm text-gray-400 mb-5">
                  {t.walWithdrawSuccessDesc.replace('{n}', Number(parseInt(withdrawAmt)).toLocaleString('fa-IR'))}
                </div>
                <button onClick={() => setShowWithdraw(false)} className="ds-btn-primary px-8 py-2.5">{t.walClose}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
