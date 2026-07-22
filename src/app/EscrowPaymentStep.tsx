// ── CMD-35 — buyer card confirm for the escrow lock ────────────────────────────
// After the buyer accepts a traveler's offer the order sits in `escrow_pending` with a real Stripe
// PaymentIntent waiting on the cardholder. This renders that step: Stripe.js Elements card form →
// confirmCardPayment → tell chapar-orders → the server verifies with Stripe and completes the lock.
//
// STRICTLY ADDITIVE (CMD-35 rule): everything here is defensive. Stripe.js is injected at runtime
// from js.stripe.com rather than bundled, so if it is blocked, offline, or slow the REST of the
// order flow is untouched — this component alone shows an honest Persian error and offers a retry.
// It never throws upward and never blocks accept/edit/confirm-delivery.
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

const STRIPE_JS = 'https://js.stripe.com/v3/';

type EscrowInfo = {
  ok: boolean;
  escrowStatus: string | null;
  orderStatus: string;
  txnId: string | null;
  intentId: string | null;
  clientSecret: string | null;
  amount: number | null;
  publishableKey: string;
  simulated: boolean;
};

// Load Stripe.js once, lazily. Resolves null on ANY failure (blocked, offline, CSP) — callers treat
// null as "card step unavailable", never as a crash.
let stripeJsPromise: Promise<unknown> | null = null;
function loadStripeJs(): Promise<unknown> {
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise(resolve => {
    const w = window as unknown as { Stripe?: unknown };
    if (w.Stripe) return resolve(w.Stripe);
    const existing = document.querySelector(`script[src="${STRIPE_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve((window as unknown as { Stripe?: unknown }).Stripe ?? null));
      existing.addEventListener('error', () => resolve(null));
      return;
    }
    const s = document.createElement('script');
    s.src = STRIPE_JS;
    s.async = true;
    s.onload = () => resolve((window as unknown as { Stripe?: unknown }).Stripe ?? null);
    s.onerror = () => resolve(null);
    // A hung CDN must not leave the buyer on a spinner forever.
    setTimeout(() => resolve((window as unknown as { Stripe?: unknown }).Stripe ?? null), 12000);
    document.head.appendChild(s);
  });
  return stripeJsPromise;
}

// 'ownerPaid' = the buyer's card cleared and their money is held, but the escrow is not fully locked
// until the traveler posts their own deposit. Saying "locked" there would be a lie.
type Phase = 'loading' | 'ready' | 'paying' | 'locked' | 'ownerPaid' | 'error' | 'unavailable';

export function EscrowPaymentStep({
  orderId, userId, onLocked,
}: { orderId: string; userId?: string | null; onLocked?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [msg, setMsg]     = useState('');
  const [info, setInfo]   = useState<EscrowInfo | null>(null);
  const cardBoxRef        = useRef<HTMLDivElement | null>(null);
  const stripeRef         = useRef<any>(null);
  const cardRef           = useRef<any>(null);
  const mountedRef        = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // 1) Ask chapar-orders for this order's clientSecret + the publishable key. Ownership-checked
  //    server-side: a non-owner gets 403 and simply sees the step as unavailable.
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!userId) { setPhase('unavailable'); setMsg('برای پرداخت باید وارد شوید'); return; }
      try {
        const r = await fetch(`/api/marketplace/escrow/${encodeURIComponent(orderId)}?userId=${encodeURIComponent(userId)}`);
        const d: EscrowInfo = await r.json();
        if (dead) return;
        if (!r.ok || !d.ok) { setPhase('unavailable'); setMsg('اطلاعات پرداخت در دسترس نیست'); return; }
        setInfo(d);
        if (d.escrowStatus === 'locked') { setPhase('locked'); return; }
        if (!d.clientSecret || !d.publishableKey) {
          setPhase('unavailable');
          setMsg(d.simulated ? 'پرداخت در حالت آزمایشی — کارت لازم نیست' : 'درگاه پرداخت در دسترس نیست');
          return;
        }
        const Stripe = await loadStripeJs();
        if (dead) return;
        if (typeof Stripe !== 'function') {
          setPhase('error');
          setMsg('بارگذاری درگاه پرداخت ناموفق بود — اتصال اینترنت را بررسی کنید');
          return;
        }
        stripeRef.current = (Stripe as (k: string) => any)(d.publishableKey);
        setPhase('ready');
      } catch {
        if (!dead) { setPhase('error'); setMsg('ارتباط با سرویس پرداخت برقرار نشد'); }
      }
    })();
    return () => { dead = true; };
  }, [orderId, userId]);

  // 2) Mount the Elements card field once Stripe.js is live and the box exists.
  useEffect(() => {
    if (phase !== 'ready' || !stripeRef.current || !cardBoxRef.current || cardRef.current) return;
    try {
      const elements = stripeRef.current.elements({ locale: 'fa' });
      const card = elements.create('card', {
        hidePostalCode: true,
        style: {
          base: {
            fontSize: '15px', color: '#111827', fontFamily: 'inherit',
            '::placeholder': { color: '#9ca3af' },
          },
          invalid: { color: '#dc2626' },
        },
      });
      card.mount(cardBoxRef.current);
      cardRef.current = card;
    } catch {
      setPhase('error');
      setMsg('نمایش فرم کارت ممکن نشد');
    }
  }, [phase]);

  async function pay() {
    if (!stripeRef.current || !cardRef.current || !info?.clientSecret) return;
    setPhase('paying'); setMsg('');
    try {
      const res = await stripeRef.current.confirmCardPayment(info.clientSecret, {
        payment_method: { card: cardRef.current },
      });
      if (res.error) {
        setPhase('ready');
        setMsg(res.error.message || 'پرداخت انجام نشد — دوباره تلاش کنید');
        return;
      }
      // Card cleared at Stripe. Tell the server, which re-verifies with Stripe before locking —
      // a client that lies here gets a 400 back from the payment service.
      const r = await fetch('/api/marketplace/escrow/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, userId }),
      });
      const d = await r.json();
      if (!mountedRef.current) return;
      if (r.ok && d.ok && (d.escrow?.status === 'locked' || d.orderStatus === 'escrow_locked')) {
        setPhase('locked');
        onLocked?.();
      } else if (r.ok && d.ok && d.escrow?.status === 'owner_paid') {
        // Card cleared and the buyer's money is held — the traveler's deposit is still outstanding.
        setPhase('ownerPaid');
        onLocked?.();
      } else {
        setPhase('error');
        setMsg(d.message || d.error || 'قفل اسکرو کامل نشد — پشتیبانی را در جریان بگذارید');
      }
    } catch {
      if (mountedRef.current) { setPhase('error'); setMsg('خطای شبکه هنگام پرداخت'); }
    }
  }

  function retry() {
    cardRef.current = null;
    stripeJsPromise = null;
    setMsg(''); setPhase('loading');
    // Re-run the fetch effect by nudging state through a microtask.
    setTimeout(() => setInfo(i => (i ? { ...i } : i)), 0);
    setPhase('loading');
    (async () => {
      try {
        const r = await fetch(`/api/marketplace/escrow/${encodeURIComponent(orderId)}?userId=${encodeURIComponent(userId || '')}`);
        const d: EscrowInfo = await r.json();
        if (!r.ok || !d.ok) { setPhase('unavailable'); setMsg('اطلاعات پرداخت در دسترس نیست'); return; }
        setInfo(d);
        if (d.escrowStatus === 'locked') { setPhase('locked'); return; }
        const Stripe = await loadStripeJs();
        if (typeof Stripe !== 'function') {
          setPhase('error'); setMsg('بارگذاری درگاه پرداخت ناموفق بود — اتصال اینترنت را بررسی کنید'); return;
        }
        stripeRef.current = (Stripe as (k: string) => any)(d.publishableKey);
        setPhase('ready');
      } catch { setPhase('error'); setMsg('ارتباط با سرویس پرداخت برقرار نشد'); }
    })();
  }

  // ── states ───────────────────────────────────────────────────────────────────
  if (phase === 'locked') {
    return (
      <div dir="rtl" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" aria-hidden />
          <div className="text-xs font-bold text-emerald-800">پرداخت شد — وجه در اسکرو قفل شد</div>
        </div>
        <p className="mt-1 text-[11px] text-emerald-700 leading-relaxed">
          وجه تا تحویل کالا نزد چاپار نگه داشته می‌شود و پس از تأیید شما به مسافر پرداخت خواهد شد.
        </p>
      </div>
    );
  }

  if (phase === 'ownerPaid') {
    return (
      <div dir="rtl" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">✓</span>
          <div className="text-xs font-bold text-emerald-800">پرداخت شد — وجه شما نزد چاپار محفوظ است</div>
        </div>
        <p className="mt-1 text-[11px] text-emerald-700 leading-relaxed">
          قفل نهایی اسکرو پس از واریز ودیعهٔ مسافر کامل می‌شود.
        </p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div dir="rtl" className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs font-bold text-gray-700 mb-0.5">در انتظار پرداخت</div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{msg || 'این مرحله در حال حاضر در دسترس نیست.'}</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs font-bold text-amber-900">در انتظار پرداخت</div>
        {info?.amount != null && (
          <div className="text-xs font-extrabold text-amber-900 tabular-nums">${info.amount}</div>
        )}
      </div>
      <p className="text-[11px] text-amber-800 leading-relaxed mb-2">
        برای قفل شدن وجه در اسکرو، اطلاعات کارت خود را وارد کنید. مبلغ بلافاصله برداشت نمی‌شود و تا
        تأیید تحویل نزد چاپار می‌ماند.
      </p>

      {phase === 'loading' && (
        <div className="text-[11px] text-amber-700">در حال آماده‌سازی درگاه پرداخت…</div>
      )}

      {(phase === 'ready' || phase === 'paying') && (
        <>
          <div
            ref={cardBoxRef}
            dir="ltr"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2.5 mb-2"
          />
          <button
            type="button"
            onClick={pay}
            disabled={phase === 'paying'}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white
                       transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {phase === 'paying' ? 'در حال پرداخت…' : 'پرداخت و قفل وجه در اسکرو'}
          </button>
        </>
      )}

      {phase === 'error' && (
        <div className="mt-1">
          <p className="text-[11px] text-red-600 leading-relaxed mb-2">
            خطای پرداخت — {msg || 'دوباره تلاش کنید'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px]
                       font-bold text-amber-900 transition-colors hover:bg-amber-100"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {msg && phase === 'ready' && (
        <p className="mt-1.5 text-[11px] text-red-600 leading-relaxed">{msg}</p>
      )}
    </div>
  );
}
