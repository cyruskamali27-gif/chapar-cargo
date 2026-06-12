/**
 * PaymentPage — ports payment.html exactly.
 * localStorage keys (mirrors payment.html):
 *   cp_order        — pending order draft (read via getOrder / saveOrder / clearOrder)
 *   cp_history      — order history array
 *   cp_wallets      — wallet balances + transactions
 *   cp_notifications — notification list
 * No API calls — 100% localStorage simulation, same as payment.html.
 */
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store, genId, getOrder, saveOrder, clearOrder, getSession, getLiveRate } from '../lib/store';

// ── Wallet helpers (mirrors wallet.html WL) ──────────────────────────────────
interface Wallet { balance: number; held: number; transactions: Array<Record<string, unknown>>; }

function wlGet(phone: string): Wallet {
  const all = Store.get<Record<string, Wallet>>('wallets') ?? {};
  return all[phone] ?? { balance: 0, held: 0, transactions: [] };
}
function wlDebit(phone: string, amount: number, desc: string, orderId: string) {
  const all = Store.get<Record<string, Wallet>>('wallets') ?? {};
  const w   = all[phone] ?? { balance: 0, held: 0, transactions: [] };
  w.balance = Math.max(0, (w.balance || 0) - amount);
  w.transactions = [
    { id: 'TX-' + Date.now(), type: 'payment', amount: -amount, desc, at: Date.now(), orderId },
    ...(w.transactions || []),
  ];
  all[phone] = w;
  Store.set('wallets', all);
}

function fmtToman(n: number) { return Math.round(n).toLocaleString('fa-IR') + ' تومان'; }
function tomanToUSD(toman: number): string {
  const rate = getLiveRate();
  return (toman / rate).toFixed(2);
}

type ViewState = 'form' | 'processing' | 'success' | 'fail';

const METHOD_LABELS: Record<string, string> = {
  card:   'پرداخت با کارت بانکی',
  toman:  'پرداخت با واریز تومانی',
  usd:    'پرداخت با دلار (USD)',
  paypal: 'پرداخت با PayPal',
  wallet: 'پرداخت از کیف پول',
};

const METHODS = [
  { method: 'card',   icon: '💳', label: 'کارت بانکی'    },
  { method: 'toman',  icon: '🏦', label: 'واریز تومانی'  },
  { method: 'usd',    icon: '💵', label: 'USD'            },
  { method: 'paypal', icon: '🅿️',  label: 'PayPal'        },
];

export default function PaymentPage() {
  const [viewState,   setViewState]   = useState<ViewState>('form');
  const [payMethod,   setPayMethod]   = useState('');
  const [orderToman,  setOrderToman]  = useState(0);
  const [orderUSD,    setOrderUSD]    = useState('0.00');
  const [walletFmt,   setWalletFmt]   = useState('');
  const [walletOk,    setWalletOk]    = useState(false);
  const [hasSession,  setHasSession]  = useState(false);
  const [trackId,     setTrackId]     = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [successName, setSuccessName] = useState('');
  const [error,       setError]       = useState('');
  const [failReason,  setFailReason]  = useState('');
  const [toast,       setToast]       = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const order = getOrder();
    const toman = parseFloat(String(order.valueToman || 0)) || 0;
    setOrderToman(toman);
    setOrderUSD(tomanToUSD(toman));

    const sess = getSession();
    if (sess) {
      setHasSession(true);
      const w   = wlGet(sess.phone);
      const bal = w.balance || 0;
      setWalletFmt(fmtToman(bal));
      setWalletOk(bal >= toman);
    }
  }, []);

  function pickPayment(method: string) {
    if (method === 'wallet' && !walletOk) {
      showToast('موجودی کیف پول کافی نیست — ابتدا شارژ کنید');
      return;
    }
    setPayMethod(method);
    setError('');
  }

  const processPayment = useCallback(() => {
    if (!payMethod) { setError('لطفاً روش پرداخت را انتخاب کنید'); return; }

    const sess = getSession();
    if (payMethod === 'wallet') {
      if (!sess) { setError('ابتدا وارد حساب کاربری شوید'); return; }
      const order = getOrder();
      const toman = parseFloat(String(order.valueToman || 0)) || 0;
      const w     = wlGet(sess.phone);
      if ((w.balance || 0) < toman) {
        setError('موجودی کیف پول کافی نیست — ابتدا کیف پول را شارژ کنید');
        return;
      }
    }

    setViewState('processing');

    const timeoutId = setTimeout(() => {
      setViewState('fail');
      setFailReason('اتصال به درگاه پرداخت قطع شد — لطفاً دوباره امتحان کنید (کد خطا: TIMEOUT)');
    }, 8000);

    setTimeout(() => {
      clearTimeout(timeoutId);

      const order   = getOrder();
      const toman   = parseFloat(String(order.valueToman || 0)) || 0;
      const newId   = genId('CH');
      const code    = String(Math.floor(1000 + Math.random() * 9000));
      const sess2   = getSession();

      saveOrder({ trackId: newId, status: 'paid', payMethod });

      // Save to history (same shape as cargo.html publishOrder)
      const hist = Store.get<Record<string, unknown>[]>('history') ?? [];
      const saved = {
        ...order,
        trackId: newId,
        paidAt: Date.now(),
        confirmationCode: code,
        userId: sess2?.userId ?? null,
      };
      Store.set('history', [saved, ...hist].slice(0, 50));

      // Deduct from wallet if wallet method
      if (payMethod === 'wallet' && sess2) {
        wlDebit(sess2.phone, toman, 'پرداخت سفارش ' + newId, newId);
      }

      // Notify preferred traveler (mirrors payment.html notification block)
      if (order.preferredTripId) {
        const notifs = Store.get<Record<string, unknown>[]>('notifications') ?? [];
        notifs.unshift({
          id: genId('N'), type: 'new_order',
          title: 'یک سفارش جدید برای شما ←',
          body: 'فرستنده‌ای مسیر شما را انتخاب کرد. سفارش ' + newId + ' را در داشبورد خود مشاهده کنید.',
          orderId: newId, tripId: order.preferredTripId,
          at: Date.now(), read: false,
        });
        Store.set('notifications', notifs.slice(0, 200));
      }

      clearOrder();

      const name = ((String(order.firstName || '')) + ' ' + (String(order.lastName || ''))).trim();
      setSuccessName(name
        ? name + ' عزیز، سفارش شما با موفقیت ثبت و پرداخت انجام شد.'
        : 'سفارش شما با موفقیت ثبت و پرداخت انجام شد.');
      setTrackId(newId);
      setConfirmCode(code);
      setViewState('success');
    }, 2200);
  }, [payMethod]);

  function retryPayment() {
    setViewState('form');
    setError('');
    setFailReason('');
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /><span>بازگشت</span>
          </button>
          <button onClick={() => { window.location.href = '/'; }}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <Home className="w-4 h-4" /><span>خانه</span>
          </button>
          <h1 className="mr-auto text-lg font-extrabold text-gray-900">پرداخت امن</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">

        {/* ── Form / Processing ── */}
        {(viewState === 'form' || viewState === 'processing') && (
          <>
            {/* Amount card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1">مبلغ قابل پرداخت</div>
                <div className="text-2xl font-extrabold text-gray-900">$ {orderUSD}</div>
              </div>
              <div className="text-base font-bold text-gray-600">{fmtToman(orderToman)}</div>
            </div>

            {/* Escrow explanation */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed">
              <div className="font-bold text-blue-700 mb-1">🔒 پرداخت اسکرو (امانی)</div>
              مبلغ پرداختی شما بلافاصله به مسافر منتقل <strong>نمی‌شود</strong>. پول در حساب امانی چاپار نگهداری
              می‌شود و فقط پس از <strong>تأیید دریافت کالا</strong> توسط گیرنده به مسافر آزاد می‌شود. در صورت
              بروز مشکل، مبلغ به شما بازگشت داده می‌شود.
            </div>

            {/* Payment method grid */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-3">روش پرداخت را انتخاب کنید</div>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(m => (
                  <button key={m.method} onClick={() => pickPayment(m.method)}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all
                      ${payMethod === m.method
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-xs font-bold text-gray-700">{m.label}</span>
                  </button>
                ))}

                {/* Wallet — only shown when logged in */}
                {hasSession && (
                  <button onClick={() => pickPayment('wallet')} disabled={!walletOk}
                    className={`flex flex-col items-center gap-1 py-4 rounded-2xl border-2 transition-all
                      ${payMethod === 'wallet'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'}
                      ${!walletOk ? 'opacity-45 cursor-not-allowed' : ''}`}>
                    <span className="text-2xl">👛</span>
                    <span className="text-xs font-bold text-gray-700">کیف پول</span>
                    <span className="text-[10px] font-bold text-green-600">{walletFmt}</span>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button onClick={processPayment}
              disabled={!payMethod || viewState === 'processing'}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all">
              {viewState === 'processing'
                ? 'در حال پردازش...'
                : (METHOD_LABELS[payMethod] || 'انتخاب روش پرداخت')}
            </button>
          </>
        )}

        {/* ── Success ── */}
        {viewState === 'success' && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-xl font-extrabold text-gray-900 mb-2">سفارش ثبت شد!</div>
              <div className="text-sm text-gray-500 mb-6">{successName}</div>

              {/* Track code — clickable */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 mb-4">
                <div className="text-xs font-bold text-gray-400 mb-2">کد پیگیری سفارش</div>
                <button onClick={() => { window.location.href = '/track?id=' + trackId; }}
                  title="کلیک برای پیگیری"
                  className="text-xl font-extrabold text-gray-900 tracking-wider font-mono hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none p-0">
                  {trackId}
                </button>
              </div>

              {/* Confirmation code */}
              {confirmCode && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 mb-4">
                  <div className="text-xs font-bold text-gray-400 mb-2">کد تأیید تحویل — به گیرنده بدهید</div>
                  <button onClick={() => navigator.clipboard?.writeText(confirmCode)}
                    title="کلیک برای کپی"
                    className="text-4xl font-extrabold text-green-600 tracking-widest font-mono cursor-pointer bg-transparent border-none p-0">
                    {confirmCode}
                  </button>
                  <div className="text-xs text-gray-400 mt-1">کلیک برای کپی</div>
                </div>
              )}

              {/* Telegram bot */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-gray-600 leading-relaxed text-right">
                <span className="text-lg ml-1">📱</span>
                برای دریافت آپدیت‌های لحظه‌ای وضعیت کالا در تلگرام، به بات چاپار پیام دهید:<br />
                <strong className="text-blue-700">@ChaparTrackBot</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a href="/?page=my-orders"
                className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-sm no-underline hover:bg-amber-100 transition-colors">
                📄 مشاهده رسید
              </a>
              <a href={'/track?id=' + trackId}
                className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm no-underline hover:bg-blue-100 transition-colors">
                🔍 پیگیری سفارش
              </a>
            </div>
            <a href="/?page=my-orders"
              className="flex items-center justify-center h-11 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-sm no-underline hover:bg-gray-50 transition-colors">
              📋 سفارش‌های من
            </a>
            <a href="/"
              className="flex items-center justify-center h-11 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 font-bold text-sm no-underline hover:bg-gray-200 transition-colors">
              خانه
            </a>
          </>
        )}

        {/* ── Fail ── */}
        {viewState === 'fail' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-3">❌</div>
            <div className="text-xl font-extrabold text-red-600 mb-2">پرداخت ناموفق</div>
            <div className="text-sm text-gray-500 mb-6 leading-relaxed">
              {failReason || 'خطا در پردازش پرداخت. لطفاً دوباره امتحان کنید.'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={retryPayment}
                className="h-11 rounded-xl bg-blue-600 text-white font-bold text-sm hover:opacity-90 transition-all">
                🔄 تلاش مجدد
              </button>
              <a href="/order"
                className="flex items-center justify-center h-11 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm no-underline hover:bg-gray-200 transition-colors">
                ↩ بازگشت
              </a>
            </div>
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
