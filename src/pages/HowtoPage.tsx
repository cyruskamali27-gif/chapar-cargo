/**
 * How-to page — ports howto.html exactly.
 * No localStorage keys. No session required.
 * Static content: trust badges, 4 steps, 6 FAQ items with accordion, CTA.
 */
import { useState } from 'react';

const STEPS = [
  { num: '۱', icon: '📦', title: 'ثبت سفارش کالا',      desc: 'مبدا، مقصد و مشخصات کالا را وارد کنید. ویدیویی کوتاه از کالا آپلود کنید تا مسافران اطمینان حاصل کنند.' },
  { num: '۲', icon: '✈️', title: 'تطبیق با مسافر',      desc: 'سیستم چاپار، سفارش شما را با مسافران تأیید‌شده همان مسیر تطبیق می‌دهد. می‌توانید خودتان هم از صفحه مسافران انتخاب کنید.' },
  { num: '۳', icon: '🔒', title: 'پرداخت امن (اسکرو)',  desc: 'مبلغ توافق‌شده در حساب امانی چاپار نگهداری می‌شود. مسافر پس از تحویل موفق، مبلغ را دریافت می‌کند.' },
  { num: '۴', icon: '🎉', title: 'تحویل موفق',           desc: 'گیرنده کالا را تأیید می‌کند، مبلغ به مسافر پرداخت می‌شود و سفارش با موفقیت تکمیل می‌شود.' },
];

const FAQS = [
  {
    q: 'چه نوع کالایی قابل ارسال است؟',
    a: 'پوشاک، الکترونیک، اسناد، دارو، خوراکی و سایر اقلام قانونی قابل حمل هستند. کالاهای ممنوع، خطرناک یا مایعات بیش از حد مجاز پذیرفته نمی‌شوند. در صورت تردید با پشتیبانی تماس بگیرید.',
  },
  {
    q: 'هزینه ارسال چقدر است؟',
    a: 'هزینه ارسال توسط مسافر تعیین می‌شود و بر اساس وزن، مسافت و زمان تفاوت دارد. معمولاً بین ۵۰ تا ۷۰ درصد ارزان‌تر از پست یا باربری‌های سنتی است. قبل از پرداخت، هزینه نهایی نمایش داده می‌شود.',
  },
  {
    q: 'اگر کالا آسیب ببیند یا گم شود چه؟',
    a: 'چاپار قبل از ارسال ویدیوی احراز هویت کالا دریافت می‌کند. در صورت بروز مشکل، تیم پشتیبانی بررسی می‌کند و مبلغ امانی تا رفع اختلاف آزاد نمی‌شود. توصیه می‌کنیم کالا را بیمه کنید.',
  },
  {
    q: 'چقدر طول می‌کشد تا کالا برسد؟',
    a: 'زمان تحویل به تاریخ پرواز مسافر بستگی دارد. پس از پرداخت، تاریخ دقیق تحویل در صفحه پیگیری نمایش داده می‌شود. اکثر سفارش‌ها ظرف ۲ تا ۷ روز به مقصد می‌رسند.',
  },
  {
    q: 'چطور می‌توانم مسافر شوم؟',
    a: 'از صفحه «ثبت مسیر مسافر» مسیر و ظرفیت خود را اعلام کنید. بعد از احراز هویت، سفارش‌دهندگان می‌توانند با شما تماس بگیرند. کار جانبی مطمئن در هر سفر!',
  },
  {
    q: 'آیا اطلاعاتم محفوظ است؟',
    a: 'اطلاعات شما فقط روی همین دستگاه ذخیره می‌شود و به هیچ سرور خارجی ارسال نمی‌شود. شماره تلفن مسافران تا تأیید سفارش پنهان است.',
  },
];

export default function HowtoPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function toggleFaq(idx: number) {
    setOpenFaq(prev => (prev === idx ? null : idx));
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← بازگشت</button>
        <span className="text-sm font-bold text-gray-900">چطور کار می‌کند؟</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        <div className="flex items-center justify-center mb-1">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-8 object-contain" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1">چطور کار می‌کند؟</h2>
        <p className="text-sm text-gray-500 text-center mb-6">ارسال کالا با چاپار، ساده و مطمئن</p>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: '🔒', label: 'پرداخت امن امانی' },
            { icon: '⚡', label: 'تحویل سریع' },
            { icon: '🛡️', label: 'احراز هویت' },
          ].map(b => (
            <div key={b.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <div className="text-2xl mb-1.5">{b.icon}</div>
              <div className="text-xs font-bold text-gray-500 leading-relaxed">{b.label}</div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">مراحل ارسال</div>
        <div className="mb-6">
          {STEPS.map((step, idx) => (
            <div key={idx} className="flex gap-4 items-start mb-1">
              <div className="flex flex-col items-center shrink-0 w-11">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-base font-bold text-white shadow-md">
                  {step.num}
                </div>
                {idx < STEPS.length - 1 && <div className="w-0.5 bg-blue-100 flex-1 min-h-7 mt-1.5" />}
              </div>
              <div className={`flex-1 ${idx < STEPS.length - 1 ? 'pb-7' : 'pb-0'}`}>
                <div className="text-lg mb-1.5">{step.icon}</div>
                <div className="text-base font-bold text-gray-900 mb-1.5">{step.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">سؤالات متداول</div>
        <div className="space-y-2 mb-6">
          {FAQS.map((faq, idx) => (
            <div key={idx}
                 className={`bg-white border rounded-2xl overflow-hidden transition-colors ${openFaq === idx ? 'border-blue-200' : 'border-gray-100'}`}>
              <button onClick={() => toggleFaq(idx)}
                      className="w-full flex items-center justify-between px-4 py-4 text-sm font-bold text-gray-900 text-right hover:bg-gray-50 transition-colors">
                <span>{faq.q}</span>
                <span className={`text-blue-500 text-xs shrink-0 mr-2 transition-transform duration-250 ${openFaq === idx ? 'rotate-180' : ''}`}>▾</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-96' : 'max-h-0'}`}>
                <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a href="/order"
           className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-blue-600 text-white font-bold text-sm no-underline mb-3 shadow-sm hover:bg-blue-700 transition-colors">
          <span className="text-lg">📦</span>
          شروع کنید ← ثبت سفارش
        </a>
        <div className="text-center mb-5">
          <a href="/support"
             className="text-xs font-bold text-gray-400 no-underline hover:text-gray-600 transition-colors">
            💬 سوال دیگری دارید؟ با پشتیبانی تماس بگیرید
          </a>
        </div>

        {/* Bottom nav */}
        <div className="flex gap-3">
          <button onClick={() => history.back()} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">← بازگشت</button>
          <button onClick={() => { location.href = '/'; }} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">خانه</button>
        </div>
      </div>
    </div>
  );
}
