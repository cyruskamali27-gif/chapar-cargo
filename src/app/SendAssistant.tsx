import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Plus, Check } from 'lucide-react';
import { useLang } from '../lib/LangContext';

// ── Send-flow AI assistant (light theme) ───────────────────────────────────────
//
// Modeled EXACTLY on TravelerAssistant: a LIGHT-THEME concierge embedded in the send
// (ثبت کالا) skeleton. It talks to the SAME /api/ai/chat engine, in the `mode:'send'`
// role. It helps the sender describe the item and PROPOSES values (item name, weight,
// value, ship mode) as tap-to-apply chips — it never writes the form itself.
//
// STRICTLY ADDITIVE: every failure path here is a caught, inline, dismissible message.
// The assistant NEVER blocks or freezes the form. The inline fallback fields in the parent
// are always visible, so the form is fully usable with the assistant collapsed, erroring, or
// disabled. On any error we call onUnavailable?.() as a NOTIFICATION — the parent already
// shows its inline fields; nothing awaits us.
//
// The `send` AI response shape is:
//   { ok, reply, needPhotos, collected:{ item, weightKg, valueAmount, currency, shipMode }, done }
// (NOT `suggestions`). We turn the non-null `collected` fields into tap-to-apply chips.

// Parent-facing apply fields (the parent owns the whitelist too).
export type SendApplyField = 'title' | 'weight' | 'value' | 'shipMode' | 'notes';
export type SendApplyValue = string | number | { amount: string; currency: string };

interface Collected {
  item?: string | null;
  weightKg?: number | string | null;
  valueAmount?: number | string | null;
  currency?: string | null;
  shipMode?: string | null;
  notes?: string | null;
}
interface Chip { key: string; label: string; field: SendApplyField; value: SendApplyValue; }
interface Msg { role: 'user' | 'assistant'; text: string; chips?: Chip[]; }

const STARTERS = [
  'می‌خوام یه جفت کفش بفرستم',
  'وزن و ارزش کالا رو چطور وارد کنم؟',
  'چه کالاهایی رو نمی‌شه فرستاد؟',
];

// Build tap-to-apply chips from a `collected` object. Only non-null fields become chips.
function chipsFromCollected(c: Collected | null | undefined, msgIdx: number): Chip[] {
  if (!c || typeof c !== 'object') return [];
  const out: Chip[] = [];
  if (c.item != null && String(c.item).trim()) {
    out.push({ key: `${msgIdx}-item`, label: `مورد: ${c.item}`, field: 'title', value: String(c.item).trim() });
  }
  if (c.weightKg != null && !Number.isNaN(Number(c.weightKg))) {
    out.push({ key: `${msgIdx}-weight`, label: `وزن: ${c.weightKg}kg`, field: 'weight', value: String(c.weightKg) });
  }
  if (c.valueAmount != null && !Number.isNaN(Number(c.valueAmount))) {
    const cur = c.currency ? String(c.currency) : 'USD';
    out.push({
      key: `${msgIdx}-value`,
      label: `ارزش: ${c.valueAmount} ${cur}`,
      field: 'value',
      value: { amount: String(c.valueAmount), currency: cur },
    });
  }
  if (c.shipMode != null && String(c.shipMode).trim()) {
    out.push({ key: `${msgIdx}-shipMode`, label: `روش ارسال: ${c.shipMode}`, field: 'shipMode', value: String(c.shipMode).trim() });
  }
  if (c.notes != null && String(c.notes).trim()) {
    out.push({ key: `${msgIdx}-notes`, label: `یادداشت: ${c.notes}`, field: 'notes', value: String(c.notes).trim() });
  }
  return out;
}

export default function SendAssistant({
  onApply, onUnavailable,
}: {
  // Applies a proposed value into the form. The PARENT owns the whitelist too — this is the only
  // way the assistant can affect form state, and only for the allowed fields.
  onApply: (field: SendApplyField, value: SendApplyValue) => void;
  // Told the parent the engine is unreachable so it can reveal/keep its inline fields.
  // This is a NOTIFICATION, not a gate — the parent shows fields, it never waits for us.
  onUnavailable?: () => void;
}) {
  const { isRTL } = useLang();
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([
    { role: 'assistant', text: 'سلام! می‌تونم کمکت کنم کالا رو توصیف کنی و وزن و ارزش تقریبی رو تخمین بزنی. این پیشنهادها تخمینی‌ست و چیزی رو خودکار پر نمی‌کنم — با زدن روی هر پیشنهاد در فرم اعمال می‌شه.' },
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
        body: JSON.stringify({ messages: history, language: 'fa', mode: 'send' }),
      });
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) throw new Error('bad_response');
      const chips = chipsFromCollected(d.collected as Collected, next.length);
      setMsgs(m => [...m, { role: 'assistant', text: d.reply || '…', chips }]);
    } catch {
      // Additive: an error is shown in-panel and never propagates to the form.
      setErr('دستیار در دسترس نیست. مشخصات کالا را می‌توانید مستقیم وارد کنید.');
      onUnavailable?.();
    } finally {
      setLoading(false);
    }
  }

  function apply(c: Chip) {
    onApply(c.field, c.value);
    setApplied(prev => new Set(prev).add(c.key));
  }

  // Collapsed launcher — a quiet pill, never a modal that blocks the form.
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 bg-white text-start transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--ds-brand-border)' }}>
        <span className="inline-flex w-8 h-8 rounded-xl items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--ds-brand-bg)' }}>
          <Sparkles className="w-4 h-4" style={{ color: 'var(--ds-brand-text)' }} aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold" style={{ color: 'var(--ds-brand-text)' }}>دستیار هوشمند ارسال</span>
          <span className="block text-[11px] text-gray-500">کمک برای توصیف کالا و تخمین وزن و ارزش — اختیاری</span>
        </span>
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: 'var(--ds-brand-border)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* header — light */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: 'var(--ds-brand-bg)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--ds-brand-text)' }} aria-hidden />
          </span>
          <div>
            <div className="text-sm font-bold text-gray-900">دستیار هوشمند ارسال</div>
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
                style={m.role === 'user' ? { backgroundColor: 'var(--ds-brand-text)' } : undefined}>
                {m.text}
              </div>
              {/* tap-to-apply chips */}
              {m.chips && m.chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.chips.map(c => {
                    const done = applied.has(c.key);
                    return (
                      <button key={c.key} onClick={() => !done && apply(c)} disabled={done}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-70"
                        style={{ borderColor: 'var(--ds-brand-border)', color: 'var(--ds-brand-text)', backgroundColor: done ? 'var(--ds-brand-bg)' : '#fff' }}>
                        {done ? <Check className="w-3 h-3" aria-hidden /> : <Plus className="w-3 h-3" aria-hidden />}
                        {c.label}
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
            <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ds-brand)', borderTopColor: 'transparent' }} />
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
          placeholder="کالا رو توصیف کن…"
          className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none" />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--ds-brand-text)' }} aria-label="ارسال">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
