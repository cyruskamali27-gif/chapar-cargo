import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store, getLiveRate } from '../lib/store';
import { useSession } from '../lib/SessionContext';

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

const PAY_LABELS: Record<string, string> = { card:'کارت', toman:'واریز', usdt:'USDT', paypal:'PayPal' };
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

function fmtToman(n: number) { return Math.round(n).toLocaleString('fa-IR') + ' تومان'; }
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

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">💳</div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">کیف پول</h2>
          <p className="text-sm text-gray-500 mb-6">برای مشاهده کیف پول باید ورود کنید.</p>
          <button onClick={onHome} className="ds-btn-primary w-full py-3">ورود / ثبت‌نام</button>
        </div>
      </div>
    );
  }

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
    if (!amt || amt < 10000) { setChargeErr('حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است'); return; }
    if (!chargePay)           { setChargeErr('روش پرداخت را انتخاب کنید'); return; }
    setChargeState('processing');
    setTimeout(() => {
      wlCredit(session.phone, amt, 'شارژ کیف پول (' + PAY_LABELS[chargePay] + ')', 'charge', null);
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
    if (!amt || amt < 500000) { setWithdrawErr('حداقل مبلغ برداشت ۵۰۰٬۰۰۰ تومان است'); return; }
    if (amt > bal)             { setWithdrawErr('موجودی کافی نیست (موجودی: ' + fmtToman(bal) + ')'); return; }
    if (!iban)                 { setWithdrawErr('شماره شبا را وارد کنید'); return; }
    if (!iban.toUpperCase().startsWith('IR')) { setWithdrawErr('شماره شبا باید با IR شروع شود'); return; }
    setWithdrawState('processing');
    setTimeout(() => {
      wlDebit(session.phone, amt, 'درخواست برداشت به ' + iban.slice(0,8) + '****', 'withdraw', null);
      refresh();
      setWithdrawState('success');
    }, 2000);
  }

  function resetWithdraw() {
    setWithdrawAmt(''); setWithdrawIBAN(''); setWithdrawErr(''); setWithdrawState('form');
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>بازگشت</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>خانه</span>
          </button>
          <h1 className="mr-auto text-lg font-extrabold text-gray-900">کیف پول</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Balance card */}
        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="text-xs font-bold opacity-70 mb-1">موجودی کل</div>
          <div className="text-3xl font-extrabold mb-1">{fmtToman(bal)}</div>
          <div className="text-sm opacity-70">≈ $ {(bal / rate).toFixed(2)}</div>
          {held > 0 && (
            <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 text-xs font-bold">
              🔒 در توقف: {fmtToman(held)}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => { resetCharge(); setShowCharge(true); }}
              className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-xl transition-colors border border-white/30">
              شارژ کیف پول
            </button>
            <button onClick={() => {
                if (bal < 500000) { showToast('موجودی کافی نیست — حداقل ۵۰۰٬۰۰۰ تومان'); return; }
                resetWithdraw(); setShowWithdraw(true);
              }}
              disabled={bal < 500000}
              className="flex-1 py-2.5 bg-white text-cyan-700 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 hover:bg-gray-50">
              برداشت
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: fmtStat(statIn),  lbl: 'دریافتی',   color:'text-green-600' },
            { val: fmtStat(statOut), lbl: 'پرداختی',   color:'text-red-500'   },
            { val: active.length || '۰', lbl: 'معاملات فعال', color:'text-cyan-600' },
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
            <div className="text-sm font-extrabold text-gray-800 mb-3">معاملات فعال ({active.length})</div>
            <div className="space-y-2">
              {active.map((o, i) => {
                const order = orders.find(h => h.id === o.orderId || h.trackId === o.orderId) ?? {};
                const desc = order.description || order.cargo || 'بسته';
                const isTraveler = !!o.travelerDepositTxnId;
                const isOwner    = !!o.ownerTxnId;
                if (isTraveler) {
                  return (
                    <a key={i} href={`/track?id=${o.travelerDepositTxnId}&role=traveler`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 no-underline text-inherit hover:bg-gray-100 transition-colors"
                      style={{ textDecoration:'none', color:'inherit' }}>
                      <span className="text-xl">🧳</span>
                      <div className="flex-1"><div className="text-sm font-bold">حمل: {desc}</div><div className="text-xs text-gray-400">مسافر</div></div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">در جریان</span>
                    </a>
                  );
                } else if (isOwner) {
                  return (
                    <a key={i} href={`/track?id=${o.ownerTxnId}&role=owner`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 no-underline text-inherit hover:bg-gray-100 transition-colors"
                      style={{ textDecoration:'none', color:'inherit' }}>
                      <span className="text-xl">📦</span>
                      <div className="flex-1"><div className="text-sm font-bold">ارسال: {desc}</div><div className="text-xs text-gray-400">{o.travelerName || 'مسافر'}</div></div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">در جریان</span>
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
            <div className="text-sm font-extrabold text-gray-800">تراکنش‌ها</div>
            <div className="flex gap-1.5">
              {([['all','همه'],['in','دریافتی'],['out','پرداختی'],['hold','بلوکه']] as const).map(([v,l]) => (
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
              <div className="text-sm">{txFilter === 'all' ? 'هنوز تراکنشی ندارید' : 'تراکنشی با این فیلتر یافت نشد'}</div>
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
              <h3 className="text-base font-extrabold text-gray-900">شارژ کیف پول</h3>
              <button onClick={() => setShowCharge(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            {chargeState === 'form' && (
              <>
                <div className="mb-4">
                  <label className="ds-label">مبلغ (تومان)</label>
                  <input type="number" className="ds-input" placeholder="حداقل ۱۰٬۰۰۰ تومان" min="10000"
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
                  <label className="ds-label">روش پرداخت</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[['card','💳','کارت بانکی'],['toman','🏦','واریز تومانی'],['usdt','₮','USDT'],['paypal','🅿️','PayPal']].map(([id, icon, lbl]) => (
                      <button key={id} onClick={() => setChargePay(id as string)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors
                          ${chargePay === id ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                        <span>{icon}</span><span>{lbl}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {chargeErr && <div className="text-sm text-red-600 mb-3 font-medium">{chargeErr}</div>}
                <button onClick={doCharge} className="ds-btn-primary w-full py-3">پرداخت</button>
              </>
            )}
            {chargeState === 'processing' && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                <div className="text-sm font-bold text-gray-600">در حال پردازش...</div>
              </div>
            )}
            {chargeState === 'success' && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-base font-extrabold text-gray-900 mb-1">
                  {Number(parseInt(chargeAmt)).toLocaleString('fa-IR')} تومان اضافه شد
                </div>
                <div className="text-sm text-gray-400 mb-5">کیف پول شما با موفقیت شارژ شد</div>
                <button onClick={() => setShowCharge(false)} className="ds-btn-primary px-8 py-2.5">بستن</button>
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
              <h3 className="text-base font-extrabold text-gray-900">برداشت از کیف پول</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            {withdrawState === 'form' && (
              <>
                <div className="mb-3 text-xs text-gray-400">موجودی قابل برداشت: <strong className="text-gray-700">{fmtToman(bal)}</strong></div>
                <div className="mb-4">
                  <label className="ds-label">مبلغ برداشت (تومان)</label>
                  <input type="number" className="ds-input" placeholder="حداقل ۵۰۰٬۰۰۰ تومان" min="500000"
                    value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} style={{ direction:'ltr' }} />
                  {parseInt(withdrawAmt) >= 500000 && (
                    <div className="text-xs text-gray-400 mt-1">≈ $ {(parseInt(withdrawAmt) / rate).toFixed(2)}</div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="ds-label">شماره شبا (IBAN)</label>
                  <input type="text" className="ds-input" placeholder="IR..." maxLength={26}
                    value={withdrawIBAN} onChange={e => setWithdrawIBAN(e.target.value)} style={{ direction:'ltr' }} />
                </div>
                {withdrawErr && <div className="text-sm text-red-600 mb-3 font-medium">{withdrawErr}</div>}
                <button onClick={doWithdraw} className="ds-btn-primary w-full py-3">درخواست برداشت</button>
              </>
            )}
            {withdrawState === 'processing' && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                <div className="text-sm font-bold text-gray-600">در حال پردازش...</div>
              </div>
            )}
            {withdrawState === 'success' && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-base font-extrabold text-gray-900 mb-1">درخواست برداشت ثبت شد</div>
                <div className="text-sm text-gray-400 mb-5">
                  {Number(parseInt(withdrawAmt)).toLocaleString('fa-IR')} تومان ظرف ۱ تا ۳ روز کاری واریز می‌شود
                </div>
                <button onClick={() => setShowWithdraw(false)} className="ds-btn-primary px-8 py-2.5">بستن</button>
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
