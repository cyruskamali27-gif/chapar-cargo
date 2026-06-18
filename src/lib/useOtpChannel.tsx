import { useState, useEffect, useRef } from 'react';
import { Mail, Send, Smartphone, MessageCircle } from 'lucide-react';
import { useLang } from './LangContext';
import type { Session } from './store';

const AUTH_BASE = '/api/auth';

export type OtpChannel = 'email' | 'telegram' | 'sms' | 'whatsapp';
export type OtpStep   = 'pick' | 'link' | 'code';

export interface OtpChannelState {
  channel:          OtpChannel;
  step:             OtpStep;
  deepLink:         string;
  pollingLinked:    boolean;
  code:             string;
  setCode:          (v: string) => void;
  err:              string;
  loading:          boolean;
  sending:          boolean;
  countdown:        number;
  hasPhone:         boolean;
  selectChannel:    (ch: OtpChannel) => void;
  checkLinked:      () => void;
  verify:           () => void;
  resend:           () => void;
  reset:            () => void;
  backToPick:       () => void;
}

export function useOtpChannel({
  session,
  setSession,
  onVerified,
}: {
  session:    Session | null;
  setSession: (s: Session) => void;
  onVerified: () => void;
}): OtpChannelState {
  const { t } = useLang();
  const [channel,       setChannel]       = useState<OtpChannel>('email');
  const [step,          setStep]          = useState<OtpStep>('pick');
  const [deepLink,      setDeepLink]      = useState('');
  const [pollingLinked, setPollingLinked] = useState(false);
  const [code,          setCode]          = useState('');
  const [err,           setErr]           = useState('');
  const [loading,       setLoading]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [countdown,     setCountdown]     = useState(0);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount  = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const hasPhone = !!(session?.phone);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => () => { stopPolling(); }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPollingLinked(false);
    pollCount.current = 0;
  }

  async function doSendOtp(ch: OtpChannel) {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setSending(true);
    setErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ channel: ch }),
      });
      const data = await res.json() as { ok: boolean; error?: string; cooldownLeft?: number };
      if (data.ok) {
        setCountdown(60);
        setCode('');
        setStep('code');
      } else if (data.error === 'resend cooldown') {
        setCountdown(data.cooldownLeft ?? 60);
        setStep('code');
      } else {
        setErr(data.error || t.otpErrSend);
      }
    } catch {
      setErr(t.authErrNetwork);
    } finally {
      setSending(false);
    }
  }

  function startPolling() {
    stopPolling();
    setPollingLinked(true);
    pollCount.current = 0;
    pollRef.current = setInterval(() => {
      void (async () => {
        pollCount.current++;
        if (pollCount.current > 40) { stopPolling(); return; }
        const token = localStorage.getItem('cp_token');
        if (!token) { stopPolling(); return; }
        try {
          const res  = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json() as { ok: boolean; user?: { telegramLinked?: boolean } };
          if (data.ok && data.user?.telegramLinked) {
            stopPolling();
            const s = sessionRef.current;
            if (s) setSession({ ...s, telegramLinked: true });
            void doSendOtp('telegram');
          }
        } catch {}
      })();
    }, 3000);
  }

  async function startLinking() {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/telegram/link-start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { ok: boolean; deepLink?: string };
      if (data.ok && data.deepLink) {
        setDeepLink(data.deepLink);
        setStep('link');
        startPolling();
      } else {
        setErr(t.authErrNetwork);
      }
    } catch {
      setErr(t.authErrNetwork);
    }
  }

  function checkLinked() {
    void (async () => {
      const token = localStorage.getItem('cp_token');
      if (!token) return;
      try {
        const res  = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json() as { ok: boolean; user?: { telegramLinked?: boolean } };
        if (data.ok && data.user?.telegramLinked) {
          stopPolling();
          const s = sessionRef.current;
          if (s) setSession({ ...s, telegramLinked: true });
          void doSendOtp('telegram');
        }
      } catch {}
    })();
  }

  function selectChannel(ch: OtpChannel) {
    stopPolling();
    setChannel(ch);
    setCode('');
    setErr('');
    if (ch === 'email') {
      void doSendOtp('email');
    } else if (ch === 'telegram') {
      if (sessionRef.current?.telegramLinked) {
        void doSendOtp('telegram');
      } else {
        void startLinking();
      }
    } else {
      void doSendOtp(ch); // sms | whatsapp
    }
  }

  function verify() {
    void (async () => {
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
        const data = await res.json() as { ok: boolean; error?: string; attemptsLeft?: number };
        if (data.ok) {
          stopPolling();
          onVerified();
          return;
        }
        const tooMany = data.error === 'too many attempts, request a new code' || data.attemptsLeft === 0;
        setErr(tooMany ? t.otpErrTooMany : t.otpErrInvalid + (data.attemptsLeft != null ? ` (${data.attemptsLeft})` : ''));
      } catch {
        setErr(t.authErrNetwork);
      }
      setLoading(false);
    })();
  }

  function resend() {
    void doSendOtp(channel);
  }

  function backToPick() {
    stopPolling();
    setStep('pick');
    setCode('');
    setErr('');
  }

  function reset() {
    stopPolling();
    setChannel('email');
    setStep('pick');
    setDeepLink('');
    setCode('');
    setErr('');
    setLoading(false);
    setSending(false);
    setCountdown(0);
  }

  return {
    channel, step, deepLink, pollingLinked,
    code, setCode, err, loading, sending, countdown, hasPhone,
    selectChannel, checkLinked, verify, resend, reset, backToPick,
  };
}

// ── OtpChannelPanel ────────────────────────────────────────────────────────────
// Shared UI for the post-signup verify screen and the gate modal.

export function OtpChannelPanel({
  hook,
  identifier,
  onSkip,
}: {
  hook:        OtpChannelState;
  identifier?: string;
  onSkip?:     () => void;
}) {
  const { t } = useLang();
  const {
    channel, step, deepLink, pollingLinked,
    code, setCode, err, loading, sending, countdown, hasPhone,
    selectChannel, checkLinked, verify, resend, backToPick,
  } = hook;

  const btnClass = (ch: OtpChannel) =>
    `flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
      channel === ch
        ? ch === 'email'     ? 'bg-cyan-600 text-white shadow-sm'
        : ch === 'telegram'  ? 'bg-[#229ED9] text-white shadow-sm'
        : ch === 'sms'       ? 'bg-green-600 text-white shadow-sm'
        :                      'bg-[#25D366] text-white shadow-sm'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`;

  const channelLabel =
    channel === 'email'    ? (identifier ?? '') :
    channel === 'telegram' ? t.channelTelegram  :
    channel === 'sms'      ? t.channelSms       :
                             t.channelWhatsapp;

  return (
    <div>
      {/* Channel picker — row 1: Email + Telegram */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => selectChannel('email')}
          disabled={sending || loading}
          className={btnClass('email')}
        >
          <Mail size={13} />{t.channelEmail}
        </button>
        <button
          onClick={() => selectChannel('telegram')}
          disabled={sending || loading}
          className={btnClass('telegram')}
        >
          <Send size={13} />{t.channelTelegram}
        </button>
      </div>

      {/* Channel picker — row 2: SMS + WhatsApp (phone required) */}
      {hasPhone && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => selectChannel('sms')}
            disabled={sending || loading}
            className={btnClass('sms')}
          >
            <Smartphone size={13} />{t.channelSms}
          </button>
          <button
            onClick={() => selectChannel('whatsapp')}
            disabled={sending || loading}
            className={btnClass('whatsapp')}
          >
            <MessageCircle size={13} />{t.channelWhatsapp}
          </button>
        </div>
      )}
      {!hasPhone && <div className="mb-5" />}

      {/* Initial send spinner (pick step while first OTP fires) */}
      {sending && step === 'pick' && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Telegram linking step */}
      {step === 'link' && (
        <div className="text-center">
          {sending ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-6">
              <div className="w-5 h-5 border-2 border-green-200 border-t-green-500 rounded-full animate-spin flex-shrink-0" />
              {t.tgConnected}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-3">{t.tgConnectTitle}</p>
              {/* Primary CTA — large, unmissable */}
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-13 rounded-2xl bg-[#229ED9] hover:bg-[#1a8ac5] active:bg-[#1577ab] text-white font-bold text-base py-3 mb-3 no-underline transition-colors shadow-md"
              >
                <Send size={18} />{t.tgOpenBtn}
              </a>
              {/* Copyable fallback */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  readOnly
                  value={deepLink}
                  className="flex-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 truncate select-all"
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => { void navigator.clipboard.writeText(deepLink); }}
                  className="flex-shrink-0 text-xs font-semibold text-cyan-600 hover:text-cyan-700 border border-cyan-200 rounded-lg px-2 py-1.5 transition-colors"
                >
                  {t.tgCopyLink}
                </button>
              </div>
              {pollingLinked && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-3">
                  <div className="w-3 h-3 border-2 border-gray-200 border-t-cyan-500 rounded-full animate-spin flex-shrink-0" />
                  {t.tgWaiting}
                </div>
              )}
              <button
                onClick={checkLinked}
                className="w-full text-sm text-cyan-600 hover:text-cyan-700 font-semibold py-2 transition-colors"
              >
                {t.tgManualCheck}
              </button>
              {err && <p className="text-xs font-semibold text-red-600 mt-2">{err}</p>}
            </>
          )}
        </div>
      )}

      {/* Code entry step */}
      {step === 'code' && (
        <div>
          <p className="text-xs text-gray-500 mb-3 text-center break-all">{channelLabel}</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
            onKeyDown={e => { if (e.key === 'Enter') verify(); }}
            placeholder={t.otpCodePlaceholder}
            className={`ds-input w-full text-center text-2xl font-bold tracking-[0.5em] mb-3 ${err ? 'border-red-400 bg-red-50' : ''}`}
            autoComplete="one-time-code"
            autoFocus
          />
          {err && <p className="text-xs font-semibold text-red-600 mb-3 text-center">{err}</p>}
          <button
            onClick={verify}
            disabled={loading || code.length < 6}
            className="ds-btn-primary w-full h-11 disabled:opacity-60 mb-2 flex items-center justify-center gap-2"
          >
            {loading ? '…' : t.otpVerifyBtn}
          </button>
          <button
            onClick={resend}
            disabled={sending || countdown > 0}
            className="w-full h-10 text-sm font-semibold text-cyan-600 hover:text-cyan-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {countdown > 0
              ? t.otpResendIn.replace('{n}', String(countdown))
              : sending ? '…' : t.otpResendBtn}
          </button>
          <button
            onClick={() => selectChannel(channel === 'email' ? 'telegram' : 'email')}
            disabled={sending || loading}
            className="w-full text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors py-1 mt-1"
          >
            {channel === 'email' ? t.tgSwitchToTelegram : t.tgSwitchToEmail}
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2 mt-1 py-1"
            >
              {t.otpSkipLink}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
