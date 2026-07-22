import { useState, useEffect } from 'react';
import { Send, Mail, MessageSquare, MessageCircle, Check, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useLang } from '../lib/LangContext';
import { useSession } from '../lib/SessionContext';

// ── CMD-51 (3a-1) — «از کجا خبرت کنیم؟» ───────────────────────────────────────
//
// ONE component, rendered in BOTH registration flows (traveler shell + cargo/ثبت کالا) so the
// question is asked identically in each. It writes the user-level preference through the EXISTING
// endpoint — PATCH /api/auth/profile { preferredChannel } (auth-server.js:1745-1763) — which
// already validates against NOTIFY_CHANNELS. ZERO backend change for the preference itself.
//
// ADDITIVE BY CONSTRUCTION: this is a section inside a step, never a gate. It has no validity to
// report to its parent, nothing awaits it, and a failed PATCH is shown inline and moves on. Skipping
// it leaves the account default ('email'), which is exactly what deliverNotification() falls back to.
//
// HONESTY (spec item 2): today, picking Telegram while telegramLinked=false silently degrades to
// email — deliverNotification() catches the no-contact case and falls back without telling anyone.
// That silence is the bug. We now say it plainly AND offer the real link flow
// (POST /api/auth/telegram/link-start → t.me deep link). Same for WhatsApp, whose Twilio sandbox
// needs a one-time opt-in before delivery works at all, and for sms/whatsapp with no phone on file.

export type PreferredChannel = 'email' | 'sms' | 'whatsapp' | 'telegram';

const CHANNELS: { key: PreferredChannel; Icon: typeof Mail; labelKey: 'channelEmail' | 'channelSms' | 'channelWhatsapp' | 'channelTelegram' }[] = [
  { key: 'telegram', Icon: Send,          labelKey: 'channelTelegram' },
  { key: 'email',    Icon: Mail,          labelKey: 'channelEmail'    },
  { key: 'sms',      Icon: MessageSquare, labelKey: 'channelSms'      },
  { key: 'whatsapp', Icon: MessageCircle, labelKey: 'channelWhatsapp' },
];

export default function PreferredChannelStep() {
  const { t } = useLang();
  const { session } = useSession();

  const [pref,      setPref]      = useState<PreferredChannel>('email');
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState(0);
  const [err,       setErr]       = useState('');
  const [linked,    setLinked]    = useState<boolean | null>(null);
  const [phone,     setPhone]     = useState<string>('');
  const [linking,   setLinking]   = useState(false);
  const [tgAck,     setTgAck]     = useState(false);   // "proceed unlinked" acknowledged

  // Pre-select the CURRENT preference. /api/auth/me returns the whole user row (minus the hash),
  // so preferredChannel + telegramLinked + phone all come from one call we already make.
  useEffect(() => {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    let alive = true;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d?.ok || !d.user) return;
        const u = d.user as { preferredChannel?: string; telegramLinked?: boolean; phone?: string };
        if (u.preferredChannel && CHANNELS.some(c => c.key === u.preferredChannel)) {
          setPref(u.preferredChannel as PreferredChannel);
        }
        setLinked(!!u.telegramLinked);
        setPhone(u.phone || '');
      })
      .catch(() => { /* additive: the picker still works, it just starts on email */ });
    return () => { alive = false; };
  }, [session?.userId]);

  async function choose(ch: PreferredChannel) {
    setPref(ch);
    setErr('');
    setTgAck(false);
    const token = localStorage.getItem('cp_token');
    if (!token) return;                       // not logged in yet — the flow's own auth gate owns this
    setSaving(true);
    try {
      const r = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredChannel: ch }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setSavedAt(Date.now());
    } catch {
      setErr(t.npSaveErr);                    // shown inline; never blocks the flow
    } finally {
      setSaving(false);
    }
  }

  async function linkTelegram() {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setLinking(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/telegram/link-start', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.deepLink) throw new Error('link_failed');
      window.open(d.deepLink, '_blank', 'noopener,noreferrer');
    } catch {
      setErr(t.npSaveErr);
    } finally {
      setLinking(false);
    }
  }

  // Honest degradation notices — each states what ACTUALLY happens today, not what we wish happened.
  const tgUnlinked = pref === 'telegram' && linked === false;
  const noPhone    = (pref === 'sms' || pref === 'whatsapp') && !phone;
  const waSandbox  = pref === 'whatsapp' && !!phone;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-1 text-sm font-bold text-gray-900">{t.npTitle}</div>
      <p className="mb-3 text-xs text-gray-500 leading-relaxed">{t.npDesc}</p>

      <div className="grid grid-cols-2 gap-2.5">
        {CHANNELS.map(c => {
          const on = pref === c.key;
          return (
            <button key={c.key} type="button" onClick={() => choose(c.key)}
              aria-pressed={on} disabled={saving}
              className="ds-choice flex items-center gap-2 px-3 h-11 text-sm font-semibold disabled:opacity-60">
              <c.Icon className={`w-4 h-4 flex-shrink-0 ${on ? 'text-cyan-700' : 'text-gray-500'}`} aria-hidden />
              <span className="flex-1 text-start">{t[c.labelKey]}</span>
              {on && <Check className="w-4 h-4 text-cyan-700 flex-shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* Telegram chosen but not linked — the silent-fallback gap, stated plainly + a real CTA */}
      {tgUnlinked && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-amber-800">{t.npTgUnlinkedTitle}</div>
              <p className="mt-0.5 text-[12px] text-amber-700 leading-relaxed">{t.npTgUnlinkedBody}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={linkTelegram} disabled={linking}
              className="ds-btn-primary disabled:opacity-60" style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
              {linking
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />{t.npTgLinking}</>
                : <><ExternalLink className="w-3.5 h-3.5" aria-hidden />{t.npTgLinkCta}</>}
            </button>
            <button type="button" onClick={() => setTgAck(true)}
              className="text-[12px] font-semibold text-amber-800 underline underline-offset-2">
              {t.npTgProceed}
            </button>
          </div>
          {tgAck && <p className="mt-2 text-[11px] text-amber-700">{t.npTgUnlinkedBody}</p>}
        </div>
      )}

      {/* WhatsApp: the Twilio sandbox needs a one-time opt-in before ANY message lands */}
      {waSandbox && (
        <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">{t.npWaSandbox}</p>
      )}

      {/* sms/whatsapp with no phone on file — same honest statement ProfilePage makes */}
      {noPhone && (
        <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">{t.npNoPhone}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-500">{t.npOptional}</span>
        {saving
          ? <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" aria-hidden /></span>
          : savedAt
            ? <span className="text-[11px] font-semibold text-green-700 inline-flex items-center gap-1"><Check className="w-3 h-3" aria-hidden />{t.npSaved}</span>
            : null}
      </div>

      {err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
