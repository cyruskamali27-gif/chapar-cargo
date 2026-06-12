import { ArrowLeft, Home } from 'lucide-react';
import { Store } from '../lib/store';

// ── Labels (exact from receipt.html) ──────────────────────────────────────────
const TYPE_LABELS:  Record<string, string> = { personal:'ارسال شخصی', store:'سفارش فروشگاه', chapar:'خرید توسط چاپار' };
const CARGO_LABELS: Record<string, string> = { clothing:'پوشاک', electronics:'الکترونیک', documents:'اسناد', medicine:'دارو', food:'خوراکی', other:'سایر' };
const PAY_LABELS:   Record<string, string> = { card:'کارت بانکی', toman:'واریز تومانی', usd:'USD', paypal:'PayPal', debit:'Debit Card', credit:'Credit Card', usdt:'USDT', usdc:'USDC', wallet:'Digital Wallet' };

const STATUS_MAP: Record<string, string> = {
  delivered: 'تحویل موفق ✅',
  cancelled: 'لغو شده ❌',
  in_transit: 'در مسیر ✈️',
  matched: 'مسافر تأیید شد 👤',
};

interface Order {
  trackId: string; type?: string; origin?: string; dest?: string;
  originLabel?: string; destLabel?: string; cargoType?: string; detectedItem?: string;
  weight?: number | null; sendDate?: string; date?: string;
  firstName?: string; lastName?: string; email?: string; phone?: string;
  recFirstName?: string; recLastName?: string; recvFirstName?: string; recvLastName?: string;
  recPhone?: string; recvPhone?: string; recAddress?: string; recvAddress?: string;
  valueUSD?: string; valueToman?: number; valueAmount?: number; valueCurrency?: string;
  payMethod?: string; paidAt?: number; status?: string;
}

interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; trackId: string | null; }

export default function ReceiptPage({ onBack, onHome, trackId }: Props) {
  // Also support URL param (when navigated from legacy HTML)
  const urlId = new URLSearchParams(window.location.search).get('id');
  const id = trackId || urlId;

  const hist     = Store.get<Order[]>('history') ?? [];
  const statuses = Store.get<Record<string,string>>('admin_statuses') ?? {};

  const order: Order | undefined = id ? hist.find(o => o.trackId === id) : undefined;

  if (!order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">سفارش یافت نشد</h2>
          <p className="text-sm text-gray-400 mb-5">این رسید وجود ندارد یا حذف شده است.</p>
          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 ds-btn-secondary py-2.5">بازگشت</button>
            <button onClick={onHome} className="flex-1 ds-btn-primary py-2.5">خانه</button>
          </div>
        </div>
      </div>
    );
  }

  const adminStatus = statuses[order.trackId] || order.status || 'pending';
  const statusLabel = STATUS_MAP[adminStatus] ?? 'در پردازش ⏳';

  const paidDate = order.paidAt
    ? new Date(order.paidAt).toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' }) +
      ' · ' + new Date(order.paidAt).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit' })
    : '—';

  const usdDisplay = order.valueUSD
    ? parseFloat(order.valueUSD).toFixed(2)
    : (order.valueAmount && order.valueCurrency && order.valueCurrency !== 'TMN')
      ? parseFloat(String(order.valueAmount)).toFixed(2) + ' ' + order.valueCurrency
      : null;

  const recvName = (
    (order.recFirstName || order.recvFirstName || '') + ' ' +
    (order.recLastName  || order.recvLastName  || '')
  ).trim();

  const rows: [string, string, boolean][] = [
    ['مسیر',        (order.originLabel || order.origin || '—') + ' ← ' + (order.destLabel || order.dest || '—'), true],
    ['نوع سفارش',   TYPE_LABELS[order.type ?? ''] || order.type || '—',         true],
    ['نوع کالا',    CARGO_LABELS[order.cargoType ?? ''] || order.cargoType || order.detectedItem || '—', true],
    ['وزن',         order.weight ? order.weight + ' kg' : '—',                   false],
    ['تاریخ ارسال', order.sendDate || order.date || '—',                         false],
    ['نام فرستنده', ((order.firstName || '') + ' ' + (order.lastName || '')).trim() || '—', true],
    ['ایمیل',       order.email  || '—',                                          false],
    ['شماره تماس',  order.phone  || '—',                                          false],
    ['نام گیرنده',  recvName     || '—',                                          true],
    ['تلفن گیرنده', order.recPhone  || order.recvPhone  || '—',                  false],
    ['آدرس تحویل',  order.recAddress || order.recvAddress || '—',                 true],
    ['روش پرداخت',  PAY_LABELS[order.payMethod ?? ''] || order.payMethod || '—', true],
    ['تاریخ پرداخت', paidDate,                                                    false],
    ['وضعیت',       statusLabel,                                                  true],
  ];

  function shareReceipt() {
    const url  = window.location.origin + '?page=receipt&id=' + order.trackId;
    const text = 'رسید سفارش چاپار — ' + order.trackId;
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {});
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 print:hidden">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>بازگشت</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>خانه</span>
          </button>
          <div className="mr-auto">
            <h1 className="text-sm font-extrabold text-gray-900">رسید سفارش</h1>
            <div className="text-xs text-gray-400 font-mono">{order.trackId}</div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 pb-24">
        {/* Actions */}
        <div className="flex gap-3 mb-5 print:hidden">
          <button onClick={() => window.print()}
            className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors">
            🖨️ چاپ
          </button>
          <button onClick={shareReceipt}
            className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors">
            📤 اشتراک‌گذاری
          </button>
        </div>

        {/* Receipt card */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">📦</div>
              <div>
                <div className="text-xs font-bold opacity-70">کد پیگیری</div>
                <div className="text-lg font-extrabold tracking-wider font-mono">{order.trackId}</div>
              </div>
            </div>
            <div className="text-xl font-extrabold">
              {Number(order.valueToman || 0).toLocaleString('fa-IR')} تومان
              {usdDisplay && <span className="text-sm opacity-70 mr-2">· {usdDisplay}</span>}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {rows.map(([key, val, rtl]) => (
              <div key={key} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs font-bold text-gray-400">{key}</span>
                <span className={`text-sm font-semibold text-gray-800 text-right max-w-[60%] ${rtl ? '' : 'font-mono'}`}
                  style={{ direction: rtl ? 'rtl' : 'ltr' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Track link */}
        <div className="mt-4 text-center">
          <a href={`/track?id=${order.trackId}`}
            className="text-sm font-bold text-cyan-600 hover:underline"
            style={{ textDecoration:'none' }}>
            پیگیری وضعیت سفارش →
          </a>
        </div>
      </div>
    </div>
  );
}
