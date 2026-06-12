/**
 * Dispute page — ports dispute.html exactly.
 * localStorage keys: cp_disputes (write), cp_history (read), cp_admin_statuses (read)
 * URL params: ?id= (orderId, optional)
 */
import { useState, useEffect } from 'react';
import { Store, genId } from '../lib/store';

// ── Data (exact from dispute.html) ───────────────────────────────────────────
const DISPUTE_TYPES: Record<string, { label: string; party: string; action: string }> = {
  damage:   { label: 'کالای آسیب‌دیده',  party: 'مسافر',    action: 'بازپرداخت خسارت از سپرده مسافر' },
  lost:     { label: 'کالای مفقود',       party: 'مسافر',    action: 'پرداخت کامل ارزش کالا از سپرده مسافر + بررسی بیشتر' },
  mismatch: { label: 'عدم تطابق کالا',   party: 'فرستنده',  action: 'مقایسه با تصاویر و ویدیوی ثبت‌شده — در صورت تأیید: کنسل' },
  fraud:    { label: 'کلاهبرداری',        party: 'نامشخص',   action: 'مسدود کردن حساب + بررسی فوری تیم امنیت' },
  payment:  { label: 'مشکل پرداخت',       party: 'سیستم',    action: 'بررسی تراکنش + بازپرداخت در صورت اشکال' },
  other:    { label: 'سایر',              party: 'نامشخص',   action: 'بررسی دستی توسط تیم پشتیبانی' },
};

const DTYPE_CARDS = [
  { key: 'damage',   icon: '💔', label: 'کالای آسیب‌دیده' },
  { key: 'lost',     icon: '❓', label: 'کالای مفقود' },
  { key: 'mismatch', icon: '🔄', label: 'عدم تطابق کالا' },
  { key: 'fraud',    icon: '🚨', label: 'کلاهبرداری' },
  { key: 'payment',  icon: '💳', label: 'مشکل پرداخت' },
  { key: 'other',    icon: '📝', label: 'سایر' },
];

const TIMELINE = [
  { icon: '📷', status: 'pass', title: 'تأیید رسانه بار',       desc: 'ویدیو و تصاویر بار توسط هوش مصنوعی بررسی شد — نوع کالا تطابق دارد — ریسک پایین', time: 'ثبت در مرحله cargo.html' },
  { icon: '🪪', status: 'pass', title: 'تأیید هویت',             desc: 'مدرک هویتی اسکن و تأیید شد — تطابق چهره: ۹۶٪ — مدرک معتبر',                    time: 'ثبت در مرحله verify.html' },
  { icon: '💳', status: 'pass', title: 'تطابق هویت پرداخت',      desc: 'پرداخت‌کننده با هویت ثبت‌شده تطابق دارد — روش پرداخت تأیید شد',                 time: 'ثبت در مرحله payment.html' },
  { icon: '✈️', status: 'pass', title: 'سازگاری مسیر',           desc: 'مبدا و مقصد اعلام‌شده با مسیر مسافر منطبق است',                                  time: 'ثبت هنگام تطابق سفارش' },
  { icon: '📦', status: 'pend', title: 'اثبات تحویل',            desc: 'در انتظار تأیید گیرنده و فرستنده',                                               time: 'در انتظار' },
  { icon: '⚠️', status: 'warn', title: 'اختلاف ثبت شد',          desc: 'کاربر درخواست بررسی اختلاف ارائه داد',                                           time: 'همین لحظه' },
];

const TL_STYLE: Record<string, { dot: string; title: string }> = {
  pass: { dot: 'bg-green-50 border-2 border-green-300',       title: 'text-green-600' },
  fail: { dot: 'bg-red-50 border-2 border-red-300',           title: 'text-red-600' },
  warn: { dot: 'bg-amber-50 border-2 border-amber-300',       title: 'text-amber-600' },
  pend: { dot: 'bg-gray-100 border-2 border-gray-200',        title: 'text-gray-400' },
};

const SCAN_STEPS = [
  'بررسی شواهد رسانه‌ای ثبت‌شده...',
  'مقایسه با داده‌های هویتی...',
  'ارزیابی ریسک هر طرف...',
  'بررسی سابقه تراکنش‌ها...',
  'تهیه گزارش اختلاف...',
];

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
  const params = new URLSearchParams(location.search);
  const urlId  = params.get('id');

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
  }, []);

  function loadOrderById(id: string) {
    const hist  = Store.get<OrderData[]>('history') ?? [];
    const sts   = Store.get<Record<string, string>>('admin_statuses') ?? {};
    const found = hist.find(o => o.trackId === id);
    if (!found) { showToast('سفارش یافت نشد'); return; }
    setOrder({ ...found, adminStatus: sts[id] || 'pending' });
    setOrderId(id);
  }

  function handleManualSearch() {
    const id = manualInput.trim().toUpperCase();
    if (!id) { showToast('کد پیگیری را وارد کنید'); return; }
    loadOrderById(id);
  }

  function submitDispute() {
    setErr('');
    if (!dtype) { setErr('لطفاً نوع مشکل را انتخاب کنید'); return; }
    if (!desc || desc.length < 20) { setErr('لطفاً شرح مشکل را کامل‌تر بنویسید (حداقل ۲۰ کاراکتر)'); return; }

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
    '✅ تصاویر و ویدیوی بار هنگام ثبت: موجود و تأیید شده',
    '✅ هویت هر دو طرف: تأیید شده',
    '✅ پرداخت: ثبت شده',
    dtype === 'damage'   ? '⚠️ گزارش آسیب توسط گیرنده: ثبت شد' :
    dtype === 'lost'     ? '❌ تأیید تحویل: دریافت نشده' :
    dtype === 'mismatch' ? '⚠️ ادعای عدم تطابق کالا با تصاویر: در بررسی' :
                           '⚠️ جزئیات اضافی: نیاز به بررسی دستی',
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← بازگشت</button>
        <span className="text-sm font-bold text-gray-900">بررسی اختلاف</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        <div className="flex items-center justify-center mb-1">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-8 object-contain" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1">بررسی اختلاف</h2>
        <p className="text-sm text-gray-500 text-center mb-6">هوش مصنوعی چاپار تمام مراحل سفارش را بررسی می‌کند</p>

        {/* AI monitoring banner */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-xl shrink-0" style={{ animation: 'pulse 1.8s ease infinite' }}>🤖</div>
          <div>
            <div className="text-sm font-bold text-gray-900">پایش هوش مصنوعی چاپار</div>
            <div className="text-xs text-gray-500 mt-0.5">از شروع تا تحویل — تمام مراحل ثبت و تحلیل می‌شود</div>
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
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">در بررسی</span>
          </div>
        ) : (
          /* Manual order entry */
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 mb-2">کد پیگیری سفارش (اختیاری)</label>
            <div className="flex gap-2">
              <input type="text" value={manualInput} onChange={e => setManualInput(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                     placeholder="CH-XXXXX"
                     className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold tracking-widest text-center bg-white outline-none focus:border-blue-400 ltr" />
              <button onClick={handleManualSearch}
                      className="shrink-0 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors">جستجو</button>
            </div>
          </div>
        )}

        {/* AI Timeline */}
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🔍 لاگ پایش هوش مصنوعی</div>
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
            <div className="text-sm font-bold text-gray-900 mb-4">ثبت اعتراض</div>
            <div className="text-xs font-bold text-gray-500 mb-3">نوع مشکل:</div>
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
              <label className="block text-xs font-bold text-gray-500 mb-2">شرح مشکل</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4}
                        placeholder="جزئیات مشکل را به طور کامل توضیح دهید..."
                        onFocus={e => (e.target.style.borderColor = 'rgba(239,68,68,.5)')}
                        onBlur={e => (e.target.style.borderColor = '')}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white outline-none resize-vertical leading-relaxed" />
            </div>

            {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-3">{err}</div>}

            <button onClick={submitDispute}
                    className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#e03050,#b01030)' }}>
              ⚠️ ارسال اعتراض برای بررسی
            </button>
          </div>
        )}

        {/* AI analysis (scan) */}
        {(phase === 'scan' || phase === 'decision') && (
          <div className="border-t border-gray-100 pt-5">
            <div className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🤖 تحلیل هوش مصنوعی</div>

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
                    <div className="text-sm font-bold text-gray-900 mb-1">نتیجه بررسی هوش مصنوعی</div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      isKnown
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {isKnown ? '⚠️ اختلاف قابل بررسی' : '🚨 نیاز به بررسی فوری'}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">طرف احتمالاً مسئول:</div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 mb-4">
                  <span>{info.party === 'مسافر' ? '✈️' : info.party === 'فرستنده' ? '📦' : '❓'}</span>
                  {info.party}
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">خلاصه شواهد:</div>
                <div className="mb-4 divide-y divide-gray-100">
                  {evidences.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 text-xs text-gray-600 leading-relaxed">
                      <span className="shrink-0">{ev[0]}</span>
                      <span>{ev.slice(1)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-bold text-gray-500 mb-2">اقدام پیشنهادی:</div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed mb-4">{info.action}</div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed mb-4">
                  ⏱ تیم چاپار ظرف <strong className="text-amber-600">۴۸ ساعت</strong> با شما تماس می‌گیرد.
                  شماره پرونده: <strong className="text-blue-600 tracking-wide">{ticket}</strong>
                </div>

                <div className="flex gap-2">
                  <a href="/support"
                     className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 no-underline">
                    💬 پشتیبانی
                  </a>
                  <a href={orderId ? '/track?id=' + orderId : '/'}
                     className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-600 no-underline">
                    🔍 پیگیری سفارش
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex gap-3 mt-6">
          <button onClick={() => history.back()} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">← بازگشت</button>
          <button onClick={() => { location.href = '/'; }} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">خانه</button>
        </div>
      </div>
    </div>
  );
}
