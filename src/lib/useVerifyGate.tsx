import { useState, useEffect } from 'react';
import { useSession } from './SessionContext';
import { useLang } from './LangContext';

const AUTH_BASE = '/api/auth';

export function useVerifyGate() {
  const { session, setSession } = useSession();
  const { t, isRTL } = useLang();

  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [code, setCode]       = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setSending(true);
    setErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ channel: 'email' }),
      });
      const data = await res.json();
      if (data.ok) {
        setCountdown(60);
      } else if (data.error === 'resend cooldown') {
        setCountdown(data.cooldownLeft ?? 60);
      } else {
        setErr(t.otpErrSend);
      }
    } catch {
      setErr(t.authErrNetwork);
    } finally {
      setSending(false);
    }
  }

  function gate(cb: () => void) {
    if (!session || session.emailVerified) { cb(); return; }
    setPending(() => cb);
    setCode('');
    setErr('');
    setCountdown(0);
    setOpen(true);
    sendCode();
  }

  async function verify() {
    const trimmed = code.trim();
    if (!trimmed) return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        if (session) setSession({ ...session, emailVerified: true });
        setOpen(false);
        const cb = pending;
        setPending(null);
        cb?.();
      } else {
        const tooMany = data.error === 'too many attempts, request a new code' || data.attemptsLeft === 0;
        if (tooMany) {
          setErr(t.otpErrTooMany);
        } else {
          const left = data.attemptsLeft != null ? ` (${data.attemptsLeft})` : '';
          setErr(t.otpErrInvalid + left);
        }
      }
    } catch {
      setErr(t.authErrNetwork);
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setOpen(false);
    setPending(null);
  }

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="text-center mb-4">
          <p className="text-lg font-bold text-gray-900">{t.gateTitle}</p>
          <p className="text-sm text-gray-500 mt-1">{t.gateSubtitle}</p>
          {session?.email && (
            <p className="text-sm font-semibold text-gray-700 mt-1">{session.email}</p>
          )}
        </div>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }}
          placeholder={t.otpCodePlaceholder}
          className="ds-input w-full text-center text-2xl tracking-[0.4em] font-mono mb-3"
          autoFocus
        />

        {err && (
          <p className="text-xs font-semibold text-red-600 mb-3 text-center">{err}</p>
        )}

        <button
          onClick={verify}
          disabled={loading || code.length < 6}
          className="ds-btn-primary w-full h-11 mb-2 disabled:opacity-60"
        >
          {loading ? '...' : t.otpVerifyBtn}
        </button>

        <button
          onClick={sendCode}
          disabled={sending || countdown > 0}
          className="w-full text-sm py-2 disabled:text-gray-400"
          style={{ color: countdown > 0 || sending ? undefined : '#3b82f6' }}
        >
          {countdown > 0
            ? t.otpResendIn.replace('{n}', String(countdown))
            : sending ? '...' : t.otpResendBtn}
        </button>

        <button
          onClick={cancel}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-1 transition-colors"
        >
          {t.gateCancel}
        </button>
      </div>
    </div>
  ) : null;

  return { gate, modal };
}
