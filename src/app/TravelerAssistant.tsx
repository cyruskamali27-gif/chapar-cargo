import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Plus } from 'lucide-react';
import { useLang } from '../lib/LangContext';

// ── CMD-25 — traveler registration AI assistant (light theme) ──────────────────
//
// A LIGHT-THEME concierge, embedded in the multi-route shell. It talks to the SAME /api/ai/chat
// engine as the buyer concierge, in the new `mode:'traveler'` role. It helps the traveler fill the
// form: it PROPOSES values (capacity estimate, min price, a note) as tap-to-apply chips — it never
// writes the form itself, and it never touches identity/prohibited/payout (those are the form's
// own gated steps).
//
// STRICTLY ADDITIVE (the voice-work lesson): every failure path here is a caught, inline, dismissible
// message. The assistant NEVER blocks or freezes the form — the form is fully usable with the
// assistant collapsed, erroring, or disabled. No await in this file gates any form control.
//
// LIGHT THEME by design: CMD-20 flagged the dark concierge card as the one remaining dark-card
// problem. This is the white-SaaS answer — no dark surface anywhere.

type ApplyField = 'capacityKg' | 'minPricePerKg' | 'note';
export interface AssistSuggestion { field: ApplyField; value: number | string; label: string; }
interface Msg { role: 'user' | 'assistant'; text: string; suggestions?: AssistSuggestion[]; }

const STARTERS = [
  'چقدر می‌تونم بار ببرم؟',
  'قوانین حمل بار چیه؟',
  'قیمت هر کیلو رو چطور تعیین کنم؟',
];

export default function TravelerAssistant({
  accent, onApply,
}: {
  accent: { text: string; mark: string; soft: string };
  // Applies a proposed value into the form. The SHELL owns the whitelist too — this is the only
  // way the assistant can affect form state, and only for the three allowed fields.
  onApply: (field: ApplyField, value: number | string) => void;
}) {
  const { isRTL } = useLang();
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([
    { role: 'assistant', text: 'سلام! می‌تونم کمکت کنم ظرفیت بار رو تخمین بزنی یا قوانین حمل رو توضیح بدم. این پیشنهادها تخمینی‌ست و چیزی رو خودکار پر نمی‌کنم.' },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs, loading]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setErr('');
    const next: Msg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.map(m => ({ role: m.role, content: m.text }));
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, language: 'fa', mode: 'traveler' }),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) throw new Error('bad_response');
      const allowed: ApplyField[] = ['capacityKg', 'minPricePerKg', 'note'];
      const suggestions: AssistSuggestion[] = Array.isArray(d.suggestions)
        ? d.suggestions.filter((s: AssistSuggestion) => allowed.includes(s.field) && s.value != null)
        : [];
      setMsgs(m => [...m, { role: 'assistant', text: d.reply || '…', suggestions }]);
    } catch {
      // Additive: an error is shown in-panel and never propagates to the form.
      setErr('دستیار در دسترس نیست. می‌تونی فرم رو بدون کمک دستیار کامل کنی.');
    } finally {
      setLoading(false);
    }
  }

  function apply(s: AssistSuggestion, key: string) {
    onApply(s.field, s.value);
    setApplied(prev => new Set(prev).add(key));
  }

  // Collapsed launcher — a quiet pill, never a modal that blocks the form.
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 bg-white text-start transition-colors hover:bg-gray-50"
        style={{ borderColor: accent.mark }}>
        <span className="inline-flex w-8 h-8 rounded-xl items-center justify-center flex-shrink-0" style={{ backgroundColor: accent.soft }}>
          <Sparkles className="w-4 h-4" style={{ color: accent.mark }} aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold" style={{ color: accent.text }}>دستیار هوشمند مسافر</span>
          <span className="block text-[11px] text-gray-500">کمک برای تخمین ظرفیت و قوانین حمل — اختیاری</span>
        </span>
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: accent.mark }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* header — light */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: accent.soft }}>
            <Sparkles className="w-4 h-4" style={{ color: accent.mark }} aria-hidden />
          </span>
          <div>
            <div className="text-sm font-bold text-gray-900">دستیار هوشمند مسافر</div>
            <div className="text-[10px] text-gray-500">پیشنهادها تخمینی‌ست؛ با زدن روی هر پیشنهاد، در فرم اعمال می‌شود.</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="بستن"
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* messages — light */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className="max-w-[88%]">
              <div className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                m.role === 'user' ? 'text-white' : 'bg-white border border-gray-200 text-gray-800'}`}
                style={m.role === 'user' ? { backgroundColor: accent.text } : undefined}>
                {m.text}
              </div>
              {/* tap-to-apply suggestion chips */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.suggestions.map((s, j) => {
                    const key = `${i}-${j}`;
                    const done = applied.has(key);
                    return (
                      <button key={j} onClick={() => !done && apply(s, key)} disabled={done}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-70"
                        style={{ borderColor: accent.mark, color: accent.text, backgroundColor: done ? accent.soft : '#fff' }}>
                        {done ? '✓' : <Plus className="w-3 h-3" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: accent.mark, borderTopColor: 'transparent' }} />
            در حال فکر کردن…
          </div>
        )}
        {err && <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{err}</div>}
      </div>

      {/* starters */}
      {msgs.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {STARTERS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-[11px] rounded-full border border-gray-200 px-2.5 py-1 text-gray-600 hover:bg-gray-50">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* composer — light */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="سؤالت رو بنویس…"
          className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none" />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
          style={{ backgroundColor: accent.text }} aria-label="ارسال">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
