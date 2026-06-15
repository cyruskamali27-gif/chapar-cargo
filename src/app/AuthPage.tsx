import { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';

// ── Password strength ─────────────────────────────────────────────────────────
function pwScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9؀-ۿ\s]/.test(pw)) s++;
  return Math.min(4, Math.max(pw.length ? 1 : 0, s));
}

const PW_COLORS = ['', '#ff4757', '#ffa502', '#4cd964', '#2ecc71'];

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs font-semibold text-red-600 mt-1.5">{msg}</p>;
}

function PwInput({
  id, value, onChange, placeholder, onEnter,
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder: string; onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }}
        className="ds-input pr-11"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function StrengthMeter({ pw }: { pw: string }) {
  const { t } = useLang();
  const score = pwScore(pw);
  const PW_LABELS = ['', t.authPwWeak, t.authPwMedium, t.authPwStrong, t.authPwVeryStrong];
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{ background: i < score ? PW_COLORS[score] : '#E5E7EB' }}
          />
        ))}
      </div>
      {pw && (
        <p className="text-[11px] font-bold mt-1.5 transition-colors" style={{ color: PW_COLORS[score] }}>
          {PW_LABELS[score]}
        </p>
      )}
    </div>
  );
}

interface Props {
  onHome: () => void;
  onSuccess?: () => void;
  defaultTab?: 'login' | 'register';
}

type Tab = 'login' | 'register' | 'verify' | 'success';

const AUTH_BASE = '/api/auth';

function userToSession(user: { id: string; email: string | null; phone: string | null; emailVerified?: boolean }) {
  return {
    userId: user.id,
    firstName: '',
    lastName: '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    emailVerified: user.emailVerified ?? false,
  };
}

export default function AuthPage({ onHome, onSuccess, defaultTab = 'login' }: Props) {
  const { setSession } = useSession();
  const { t, isRTL } = useLang();
  const [tab, setTab] = useState<Tab>(defaultTab);

  // ── Login state ──────────────────────────────────────────────────────────────
  const [lId,      setLId]      = useState('');
  const [lPw,      setLPw]      = useState('');
  const [lErr,     setLErr]     = useState<{ id?: string; pw?: string; global?: string }>({});
  const [lLoading, setLLoading] = useState(false);

  // ── Register state ───────────────────────────────────────────────────────────
  const [rId,      setRId]      = useState('');
  const [rPw,      setRPw]      = useState('');
  const [rPw2,     setRPw2]     = useState('');
  const [rTerms,   setRTerms]   = useState(false);
  const [rErr,     setRErr]     = useState<Record<string, string>>({});
  const [rLoading, setRLoading] = useState(false);

  // ── Verify step state ────────────────────────────────────────────────────────
  const [vCode,       setVCode]       = useState('');
  const [vErr,        setVErr]        = useState('');
  const [vLoading,    setVLoading]    = useState(false);
  const [vSending,    setVSending]    = useState(false);
  const [vIdentifier, setVIdentifier] = useState('');
  const [countdown,   setCountdown]   = useState(0);

  // ── Shared success state ─────────────────────────────────────────────────────
  const [successTitle, setSuccessTitle] = useState('');
  const [successSub,   setSuccessSub]   = useState('');

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ── OTP helpers ──────────────────────────────────────────────────────────────
  async function sendOtp() {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setVSending(true);
    setVErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel: 'email' }),
      });
      const data = await res.json();
      if (data.ok) {
        setCountdown(60);
      } else if (data.error === 'resend cooldown') {
        setCountdown(data.cooldownLeft ?? 60);
      } else {
        setVErr(t.otpErrSend);
      }
    } catch {
      setVErr(t.authErrNetwork);
    } finally {
      setVSending(false);
    }
  }

  async function doVerify() {
    const code = vCode.trim();
    if (!code) return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setVLoading(true);
    setVErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh session so emailVerified is true in cp_session
        const meRes  = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        const meData = await meRes.json();
        if (meData.ok) setSession(userToSession(meData.user));
        setSuccessTitle(t.otpSuccessTitle);
        setSuccessSub(t.otpSuccessSub);
        setTab('success');
        setTimeout(onSuccess ?? onHome, 1400);
      } else {
        const tooMany = data.error === 'too many attempts, request a new code' || data.attemptsLeft === 0;
        if (tooMany) {
          setVErr(t.otpErrTooMany);
        } else {
          const left = data.attemptsLeft != null ? ` (${data.attemptsLeft})` : '';
          setVErr(t.otpErrInvalid + left);
        }
      }
    } catch {
      setVErr(t.authErrNetwork);
    } finally {
      setVLoading(false);
    }
  }

  function doSkip() {
    (onSuccess ?? onHome)();
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async function doLogin() {
    const errors: typeof lErr = {};
    if (!lId.trim()) errors.id = t.authErrEmailRequired;
    if (!lPw)        errors.pw = t.authErrPasswordRequired;
    if (Object.keys(errors).length) { setLErr(errors); return; }

    setLLoading(true);
    setLErr({});
    try {
      const res  = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: lId.trim(), password: lPw }),
      });
      const data = await res.json();
      if (!data.ok) { setLErr({ global: t.authErrInvalidCredentials }); return; }
      localStorage.setItem('cp_token', data.token);
      setSession(userToSession(data.user));
      setSuccessTitle(t.authSuccessLoginPrefix.trim() + '!');
      setSuccessSub(t.authSuccessLoginSub);
      setTab('success');
      setTimeout(onSuccess ?? onHome, 1400);
    } catch {
      setLErr({ global: t.authErrNetwork });
    } finally {
      setLLoading(false);
    }
  }

  // ── Register ─────────────────────────────────────────────────────────────────
  async function doRegister() {
    const errs: Record<string, string> = {};
    if (!rId.trim())              errs.id    = t.authErrEmailRequired;
    if (!rPw || rPw.length < 8)  errs.pw    = t.authErrPasswordLength;
    if (rPw && rPw2 && rPw !== rPw2) errs.pw2 = t.authErrPasswordMatch;
    if (!rTerms)                  errs.terms = t.authErrTerms;
    if (Object.keys(errs).length) { setRErr(errs); return; }

    setRLoading(true);
    setRErr({});
    try {
      const signupRes  = await fetch(`${AUTH_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: rId.trim(), password: rPw }),
      });
      const signupData = await signupRes.json();
      if (!signupData.ok) {
        setRErr({
          global: signupData.error === 'account already exists'
            ? t.authErrAccountExists
            : t.authErrNetwork,
        });
        return;
      }

      // Auto-login after signup
      const loginRes  = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: rId.trim(), password: rPw }),
      });
      const loginData = await loginRes.json();
      if (!loginData.ok) { setTab('login'); return; }

      localStorage.setItem('cp_token', loginData.token);
      setSession(userToSession(loginData.user));

      // Route through email verification
      setVIdentifier(rId.trim());
      setVCode('');
      setVErr('');
      setTab('verify');
      sendOtp(); // fire-and-forget; has its own vSending state
    } catch {
      setRErr({ global: t.authErrNetwork });
    } finally {
      setRLoading(false);
    }
  }

  const inputCls = (err?: string) =>
    `ds-input ${err ? 'border-red-400 bg-red-50 focus:border-red-400' : ''}`;

  const showTabs = tab !== 'success' && tab !== 'verify';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 pt-20 pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-12 mx-auto mb-4" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {tab === 'login'    && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authWelcome}</h2><p className="text-sm text-gray-500 mt-1">{t.authLoginSubtitle}</p></>}
          {tab === 'register' && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authRegisterTitle}</h2><p className="text-sm text-gray-500 mt-1">{t.authRegisterSubtitle}</p></>}
          {tab === 'verify'   && <><h2 className="text-2xl font-extrabold text-gray-900">{t.otpTitle}</h2><p className="text-sm text-gray-500 mt-1">{t.otpSubtitle}</p></>}
        </div>

        <div className="ds-card p-6">
          {/* Login / Register tab switcher */}
          {showTabs && (
            <div className="flex bg-gray-100 border border-gray-200 rounded-xl p-1 mb-6 gap-1">
              {(['login', 'register'] as const).map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all ${
                    tab === tabKey
                      ? 'bg-white text-cyan-600 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}>
                  {tabKey === 'login' ? t.authTabLogin : t.authTabRegister}
                </button>
              ))}
            </div>
          )}

          {/* ── Login ─────────────────────────────────────────────────────────── */}
          {tab === 'login' && (
            <div>
              <div className="mb-4">
                <label className="ds-label">{t.authEmailOrPhone}</label>
                <input type="text" value={lId} onChange={e => { setLId(e.target.value); setLErr({}); }}
                  placeholder={t.authEmailOrPhonePlaceholder} autoComplete="username"
                  className={inputCls(lErr.id)} />
                <FieldError msg={lErr.id ?? ''} />
              </div>
              <div className="mb-2">
                <label className="ds-label">{t.authPassword}</label>
                <PwInput id="lPw" value={lPw} onChange={v => { setLPw(v); setLErr({}); }} placeholder={t.authPasswordPlaceholder} onEnter={doLogin} />
                <FieldError msg={lErr.pw ?? ''} />
              </div>
              <FieldError msg={lErr.global ?? ''} />
              <button className="block text-[11px] font-semibold text-gray-400 hover:text-cyan-600 mb-5 mt-1 transition-colors"
                onClick={() => alert(t.authForgotPasswordAlert)}>
                {t.authForgotPassword}
              </button>
              <button onClick={doLogin} disabled={lLoading} className="ds-btn-primary w-full h-12 disabled:opacity-60">
                {lLoading ? '…' : t.authLoginBtn}
              </button>
              <div className="flex items-center gap-3 my-5 text-gray-400 text-xs">
                <span className="flex-1 border-t border-gray-200" />{t.authOr}<span className="flex-1 border-t border-gray-200" />
              </div>
              <p className="text-center text-sm text-gray-500">
                {t.authNoAccount}{' '}
                <button onClick={() => setTab('register')} className="text-cyan-600 font-bold hover:underline">{t.authSignUpLink}</button>
              </p>
            </div>
          )}

          {/* ── Register ──────────────────────────────────────────────────────── */}
          {tab === 'register' && (
            <div>
              <div className="mb-4">
                <label className="ds-label">{t.authEmailOrPhone}</label>
                <input type="text" value={rId} onChange={e => { setRId(e.target.value); setRErr(p => ({ ...p, id: '' })); }}
                  placeholder={t.authEmailOrPhonePlaceholder} autoComplete="username"
                  className={inputCls(rErr.id)} />
                <FieldError msg={rErr.id ?? ''} />
              </div>
              <div className="mb-4">
                <label className="ds-label">{t.authPassword}</label>
                <PwInput id="rPw" value={rPw} onChange={v => { setRPw(v); setRErr(p => ({ ...p, pw: '' })); }} placeholder={t.authPasswordMin} />
                <StrengthMeter pw={rPw} />
                <FieldError msg={rErr.pw ?? ''} />
              </div>
              <div className="mb-4">
                <label className="ds-label">{t.authPasswordRepeat}</label>
                <PwInput id="rPw2" value={rPw2} onChange={v => { setRPw2(v); setRErr(p => ({ ...p, pw2: '' })); }} placeholder={t.authPasswordRepeat} onEnter={doRegister} />
                <FieldError msg={rErr.pw2 ?? ''} />
              </div>
              <div className="flex items-start gap-2.5 mb-5">
                <input type="checkbox" id="rTerms" checked={rTerms} onChange={e => { setRTerms(e.target.checked); setRErr(p => ({ ...p, terms: '' })); }}
                  className="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0" />
                <label htmlFor="rTerms" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                  {t.authTermsAgreePrefix}{' '}
                  <button className="text-cyan-600 hover:underline">{t.authTermsLink1}</button>
                  {' '}{t.authOr}{' '}
                  <button className="text-cyan-600 hover:underline">{t.authTermsLink2}</button>
                  {' '}{t.authTermsAgreeSuffix}
                </label>
              </div>
              <FieldError msg={rErr.terms ?? ''} />
              <FieldError msg={rErr.global ?? ''} />
              <button onClick={doRegister} disabled={rLoading} className="ds-btn-primary w-full h-12 disabled:opacity-60">
                {rLoading ? '…' : t.authCreateAccount}
              </button>
              <div className="flex items-center gap-3 my-5 text-gray-400 text-xs">
                <span className="flex-1 border-t border-gray-200" />{t.authOr}<span className="flex-1 border-t border-gray-200" />
              </div>
              <p className="text-center text-sm text-gray-500">
                {t.authHasAccount}{' '}
                <button onClick={() => setTab('login')} className="text-cyan-600 font-bold hover:underline">{t.authLoginLink}</button>
              </p>
            </div>
          )}

          {/* ── Verify email ──────────────────────────────────────────────────── */}
          {tab === 'verify' && (
            <div className="text-center">
              {/* Icon */}
              <div className="w-16 h-16 rounded-full bg-cyan-50 border-2 border-cyan-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-cyan-500" />
              </div>

              {/* Destination */}
              <p className="text-sm font-semibold text-gray-700 mb-1 break-all">{vIdentifier}</p>
              {vSending && (
                <p className="text-xs text-gray-400 mb-4">…</p>
              )}

              {/* Code input */}
              <div className="text-left mt-5 mb-4">
                <label className="ds-label">{t.otpCodeLabel}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={vCode}
                  onChange={e => { setVCode(e.target.value.replace(/\D/g, '')); setVErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') doVerify(); }}
                  placeholder={t.otpCodePlaceholder}
                  className={`ds-input text-center text-2xl font-bold tracking-[0.5em] ${vErr ? 'border-red-400 bg-red-50' : ''}`}
                  autoComplete="one-time-code"
                />
                <FieldError msg={vErr} />
              </div>

              {/* Verify button */}
              <button
                onClick={doVerify}
                disabled={vLoading || vCode.length < 6}
                className="ds-btn-primary w-full h-12 disabled:opacity-60 mb-4 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} />
                {vLoading ? '…' : t.otpVerifyBtn}
              </button>

              {/* Resend */}
              <button
                onClick={sendOtp}
                disabled={countdown > 0 || vSending}
                className="w-full h-10 text-sm font-semibold text-cyan-600 hover:text-cyan-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors mb-3"
              >
                {countdown > 0
                  ? t.otpResendIn.replace('{n}', String(countdown))
                  : t.otpResendBtn}
              </button>

              {/* Skip */}
              <button
                onClick={doSkip}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
              >
                {t.otpSkipLink}
              </button>
            </div>
          )}

          {/* ── Success ───────────────────────────────────────────────────────── */}
          {tab === 'success' && (
            <div className="text-center py-6">
              <span className="text-6xl block mb-4">🎉</span>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{successTitle}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{successSub}</p>
            </div>
          )}
        </div>

        {/* Back home — hidden on verify/success to avoid accidental exit */}
        {showTabs && (
          <div className="mt-5 flex justify-center">
            <button onClick={onHome} className="ds-nav-btn text-sm">
              <ArrowLeft className="w-4 h-4" />
              {t.authBackHome}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
