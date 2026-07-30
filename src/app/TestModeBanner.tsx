import { FlaskConical } from 'lucide-react';
import { TEST_MODE_ESCROW } from '../lib/testModeEscrow';

// ── CMD-68 (1) — HONESTY GUARD ────────────────────────────────────────────────
//
// A tester must never come away believing real money moved. Escrow is ON during the human-test
// window but the Stripe rail runs on TEST keys, so every «پرداخت موفق» on these screens is a
// test-mode charge against a test card — the money is not real and no card is ever billed.
//
// Deliberately loud rather than a footnote: it sits directly above the amount and the pay button,
// in Persian, on the two screens that take payment. It names the test card so a tester is not
// tempted to reach for their own, and says plainly that a real card will be refused — which is
// Stripe's own behaviour on test keys, not a claim this component makes.
//
// Renders nothing at all once TEST_MODE_ESCROW is false, so turning escrow back off removes the
// banner in the same flip.
export default function TestModeBanner() {
  if (!TEST_MODE_ESCROW) return null;
  return (
    <div
      role="status"
      dir="rtl"
      className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-amber-900">
            حالت آزمایشی — پول واقعی جابه‌جا نمی‌شود
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            این یک پرداخت <strong>آزمایشی</strong> است. هیچ مبلغی از کارت شما کم نمی‌شود و هیچ پول
            واقعی منتقل نمی‌شود. لطفاً فقط از کارت آزمایشی
            {' '}<code className="rounded bg-amber-100 px-1 font-mono text-[11px]">4242 4242 4242 4242</code>{' '}
            استفاده کنید (تاریخ آینده، CVC دلخواه). کارت بانکی واقعی پذیرفته نمی‌شود و رد خواهد شد.
          </p>
        </div>
      </div>
    </div>
  );
}
