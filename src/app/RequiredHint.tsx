import { AlertCircle } from 'lucide-react';

// ── CMD-65 (B) — «چه چیزی مانده؟» ─────────────────────────────────────────────
//
// A gated NEXT/publish button must never be a silent dead button. design-system.css already
// makes a disabled .ds-btn-primary READ disabled (opacity .45, cursor not-allowed) — that was
// the CMD-49 fix. But that rule also sets `pointer-events: none`, so the button cannot host a
// title/tooltip: hovering a disabled button produces nothing at all. The explanation therefore
// has to live OUTSIDE the button, as inline text, which is what this renders.
//
// Callers pass the field labels EXACTLY as those fields are labelled on screen (t.spOrigin,
// t.spWeightLabel, …) so the hint names things the way the user just read them, and no new
// i18n keys are introduced.
//
// Optional fields must never appear here — see the per-step required lists in each flow.
export default function RequiredHint({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm text-amber-800 leading-relaxed">
        <span className="font-semibold">برای ادامه این موارد را کامل کنید: </span>
        <span className="font-extrabold">{missing.join('، ')}</span>
      </p>
    </div>
  );
}
