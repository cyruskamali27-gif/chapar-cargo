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
//
// CMD-66 adds `tone`. The buy and send flows are light surfaces, so amber-50/amber-800 is the
// default and nothing about them changes. ChaparConcierge is a dark panel, where that light box
// would blow out; `tone="dark"` is the same component at the same amber hue, re-weighted for a
// dark ground (amber-400/10 fill, amber-200 text) — exactly the treatment the bespoke box it
// replaces already used there. A tone prop, not a second component: the wording, the ARIA
// contract and the "optional fields never appear here" rule must stay single-sourced.
export default function RequiredHint({ missing, tone = 'light' }: { missing: string[]; tone?: 'light' | 'dark' }) {
  if (!missing.length) return null;
  const box  = tone === 'dark' ? 'border-amber-400/30 bg-amber-400/10' : 'border-amber-200 bg-amber-50';
  const icon = tone === 'dark' ? 'text-amber-300' : 'text-amber-600';
  const text = tone === 'dark' ? 'text-amber-200' : 'text-amber-800';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 ${box}`}
    >
      <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${icon}`} aria-hidden />
      <p className={`text-sm leading-relaxed ${text}`}>
        <span className="font-semibold">برای ادامه این موارد را کامل کنید: </span>
        <span className="font-extrabold">{missing.join('، ')}</span>
      </p>
    </div>
  );
}
