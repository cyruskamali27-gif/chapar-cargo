import { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft, Mail, Send, Phone, LogIn, UserPlus, MessageSquare } from 'lucide-react';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import { useOtpChannel, OtpChannelPanel } from '../lib/useOtpChannel';
import { PhoneField, isValidPhoneNumber } from '../lib/PhoneField';
import type { Country } from '../lib/PhoneField';

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
  const { isRTL } = useLang();
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
        className={`ds-input ${isRTL ? 'pl-11' : 'pr-11'}`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors`}
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

type Tab = 'login' | 'register' | 'verify' | 'forgot' | 'success';

const AUTH_BASE = '/api/auth';

function userToSession(user: { id: string; email: string | null; phone: string | null; firstName?: string; lastName?: string; emailVerified?: boolean; telegramLinked?: boolean }) {
  // phone-only users have no email to verify — treat as verified so the gate doesn't block them
  const emailVerified = user.email ? (user.emailVerified ?? false) : true;
  return {
    userId: user.id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    emailVerified,
    telegramLinked: user.telegramLinked ?? false,
  };
}

// Identifier-mode toggle (Email vs Phone) used in both login and register
type IdMode = 'email' | 'phone';

function IdModeToggle({
  mode,
  setMode,
}: {
  mode:    IdMode;
  setMode: (m: IdMode) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex bg-gray-100 border border-gray-200 rounded-xl p-0.5 mb-3 gap-1">
      {(['email', 'phone'] as const).map(m => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`flex-1 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            mode === m
              ? 'bg-white text-cyan-600 shadow-sm border border-gray-200'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {m === 'email' ? <Mail size={12} /> : <Phone size={12} />}
          {m === 'email' ? t.channelEmail : t.idModePhone}
        </button>
      ))}
    </div>
  );
}

export default function AuthPage({ onHome, onSuccess, defaultTab = 'login' }: Props) {
  const { session, setSession } = useSession();
  const { t, isRTL } = useLang();
  const [tab, setTab] = useState<Tab>(defaultTab);

  // ── Login state ──────────────────────────────────────────────────────────────
  const [lId,      setLId]      = useState('');
  const [lPw,      setLPw]      = useState('');
  const [lErr,     setLErr]     = useState<{ id?: string; pw?: string; global?: string }>({});
  const [lLoading, setLLoading] = useState(false);
  const [lIdMode,  setLIdMode]  = useState<IdMode>('email');
  const [lPhone,   setLPhone]   = useState('');

  // ── Register state ───────────────────────────────────────────────────────────
  const [rId,      setRId]      = useState('');
  const [rPw,      setRPw]      = useState('');
  const [rPw2,     setRPw2]     = useState('');
  const [rTerms,   setRTerms]   = useState(false);
  const [rErr,     setRErr]     = useState<Record<string, string>>({});
  const [rLoading, setRLoading] = useState(false);
  const [rIdMode,  setRIdMode]  = useState<IdMode>('email');
  const [rPhone,   setRPhone]   = useState('');

  // ── Verify step state ────────────────────────────────────────────────────────
  const [vIdentifier, setVIdentifier] = useState('');

  // ── Forgot-password / reset state ───────────────────────────────────────────
  const [forgotStep,    setForgotStep]    = useState<1 | 2>(1);
  const [fId,           setFId]           = useState('');
  const [fIdMode,       setFIdMode]       = useState<IdMode>('email');
  const [fPhone,        setFPhone]        = useState('');
  const [fCode,         setFCode]         = useState('');
  const [fPw,           setFPw]           = useState('');
  const [fPw2,          setFPw2]          = useState('');
  const [fErr,          setFErr]          = useState('');
  const [fErrCode,      setFErrCode]      = useState('');
  const [fLoading,      setFLoading]      = useState(false);
  const [fCountdown,    setFCountdown]    = useState(0);
  const [fChannel,      setFChannel]      = useState<'email' | 'telegram' | 'sms'>('email');

  // ── Shared success state ─────────────────────────────────────────────────────
  const [successTitle, setSuccessTitle] = useState('');
  const [successSub,   setSuccessSub]   = useState('');

  // Countdown ticker (forgot)
  useEffect(() => {
    if (fCountdown <= 0) return;
    const timer = setTimeout(() => setFCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [fCountdown]);

  // ── OTP channel hook ─────────────────────────────────────────────────────────
  const otpChannel = useOtpChannel({ session, setSession, onVerified: handleVerifySuccess });

  async function handleVerifySuccess() {
    const token = localStorage.getItem('cp_token');
    if (token) {
      try {
        const meRes  = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        const meData = await meRes.json();
        if (meData.ok) setSession(userToSession(meData.user));
      } catch {}
    }
    setSuccessTitle(t.otpSuccessTitle);
    setSuccessSub(t.otpSuccessSub);
    setTab('success');
    setTimeout(onSuccess ?? onHome, 1400);
  }


  // ── Forgot password ───────────────────────────────────────────────────────────
  async function doForgotSend() {
    if (fIdMode === 'phone') {
      if (!fPhone || !isValidPhoneNumber(fPhone)) { setFErr(t.authErrPhoneInvalid); return; }
    } else {
      if (!fId.trim()) { setFErr(t.authErrEmailRequired); return; }
    }
    const identifier = fIdMode === 'phone' ? fPhone : fId.trim();
    setFLoading(true);
    setFErr('');
    setFErrCode('');
    try {
      const res  = await fetch(`${AUTH_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel: fChannel }),
      });
      const data = await res.json();
      if (data.code === 'NOT_REGISTERED') {
        setFErrCode('NOT_REGISTERED');
        setFErr(t.forgotErrNotRegistered);
        return;
      }
      if (!data.ok || data.code === 'SEND_FAILED') {
        setFErr(t.forgotErrSendFailed);
        return;
      }
      // SENT — advance to code entry
      setForgotStep(2);
      setFCountdown(60);
    } catch {
      setFErr(t.authErrNetwork);
    } finally {
      setFLoading(false);
    }
  }

  async function doForgotResend() {
    const identifier = fIdMode === 'phone' ? fPhone : fId.trim();
    if (!identifier) return;
    setFLoading(true);
    setFErr('');
    setFErrCode('');
    try {
      const res  = await fetch(`${AUTH_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel: fChannel }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFErr(t.forgotErrSendFailed);
        return;
      }
      setFCountdown(60);
    } catch {
      setFErr(t.authErrNetwork);
    } finally {
      setFLoading(false);
    }
  }

  async function doForgotReset() {
    const code = fCode.trim();
    const identifier = fIdMode === 'phone' ? fPhone : fId.trim();
    if (!code) { setFErr(t.otpErrInvalid); return; }
    if (!fPw || fPw.length < 8) { setFErr(t.authErrPasswordLength); return; }
    if (fPw !== fPw2) { setFErr(t.authErrPasswordMatch); return; }
    setFLoading(true);
    setFErr('');
    try {
      const res  = await fetch(`${AUTH_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code, newPassword: fPw, channel: fChannel }),
      });
      const data = await res.json();
      if (data.ok) {
        setLId(fId.trim()); // pre-fill login identifier
        setSuccessTitle(t.forgotSuccessTitle);
        setSuccessSub(t.forgotSuccessSub);
        setTab('success');
        setTimeout(() => setTab('login'), 2000);
      } else {
        const tooMany = data.error === 'too many attempts, request a new code' || data.attemptsLeft === 0;
        if (tooMany) {
          setFErr(t.otpErrTooMany);
        } else {
          const left = data.attemptsLeft != null ? ` (${data.attemptsLeft})` : '';
          setFErr(t.otpErrInvalid + left);
        }
      }
    } catch {
      setFErr(t.authErrNetwork);
    } finally {
      setFLoading(false);
    }
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async function doLogin() {
    const errors: typeof lErr = {};
    if (lIdMode === 'email') {
      if (!lId.trim()) errors.id = t.authErrEmailRequired;
    } else {
      if (!lPhone || !isValidPhoneNumber(lPhone)) errors.id = t.authErrPhoneInvalid;
    }
    if (!lPw) errors.pw = t.authErrPasswordRequired;
    if (Object.keys(errors).length) { setLErr(errors); return; }

    const identifier = lIdMode === 'phone' ? lPhone : lId.trim();
    setLLoading(true);
    setLErr({});
    try {
      const res  = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: lPw }),
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
    if (rIdMode === 'email') {
      if (!rId.trim()) errs.id = t.authErrEmailRequired;
    } else {
      if (!rPhone || !isValidPhoneNumber(rPhone)) errs.id = t.authErrPhoneInvalid;
    }
    if (!rPw || rPw.length < 8)      errs.pw    = t.authErrPasswordLength;
    if (rPw && rPw2 && rPw !== rPw2) errs.pw2   = t.authErrPasswordMatch;
    if (!rTerms)                      errs.terms = t.authErrTerms;
    if (Object.keys(errs).length) { setRErr(errs); return; }

    const identifier = rIdMode === 'phone' ? rPhone : rId.trim();
    setRLoading(true);
    setRErr({});
    try {
      const signupRes  = await fetch(`${AUTH_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: rPw }),
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

      // Auto-login after signup — use same identifier (E.164 phone or email)
      const loginRes  = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: rPw }),
      });
      const loginData = await loginRes.json();
      if (!loginData.ok) { setTab('login'); return; }

      localStorage.setItem('cp_token', loginData.token);

      if (rIdMode === 'phone') {
        // Phone signup: bypass email verify (SMS OTP in future phase)
        setSession({ ...userToSession(loginData.user), emailVerified: true });
        setSuccessTitle(t.authSuccessLoginPrefix.trim() + '!');
        setSuccessSub(t.authSuccessLoginSub);
        setTab('success');
        setTimeout(onSuccess ?? onHome, 1400);
      } else {
        setSession(userToSession(loginData.user));
        // Route through email verification
        setVIdentifier(rId.trim());
        otpChannel.reset();
        setTab('verify');
        otpChannel.selectChannel('email');
      }
    } catch {
      setRErr({ global: t.authErrNetwork });
    } finally {
      setRLoading(false);
    }
  }

  const inputCls = (err?: string) =>
    `ds-input ${err ? 'border-red-400 bg-red-50 focus:border-red-400' : ''}`;

  const defaultPhoneCountry: Country = isRTL ? 'IR' : 'CA';

  const showTabs = tab !== 'success' && tab !== 'verify' && tab !== 'forgot';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 pt-20 pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-12 mx-auto mb-4" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {tab === 'login'    && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authWelcome}</h2><p className="text-sm text-gray-500 mt-1">{t.authLoginSubtitle}</p></>}
          {tab === 'register' && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authRegisterTitle}</h2><p className="text-sm text-gray-500 mt-1">{t.authRegisterSubtitle}</p></>}
          {tab === 'verify'   && <h2 className="text-2xl font-extrabold text-gray-900">{t.otpTitle}</h2>}
          {tab === 'forgot'   && <><h2 className="text-2xl font-extrabold text-gray-900">{t.forgotTitle}</h2></>}
        </div>

        <div className="ds-card p-6">
          {/* Login / Register tab switcher */}
          {showTabs && (
            <div className="flex bg-gray-100 border border-gray-200 rounded-xl p-1 mb-6 gap-1">
              {(['login', 'register'] as const).map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === tabKey
                      ? 'bg-white text-cyan-600 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}>
                  {tabKey === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
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
                <IdModeToggle
                  mode={lIdMode}
                  setMode={m => { setLIdMode(m); setLErr({}); setLPhone(''); }}
                />
                {lIdMode === 'email' ? (
                  <input type="text" value={lId} onChange={e => { setLId(e.target.value); setLErr({}); }}
                    placeholder={t.authEmailOrPhonePlaceholder} autoComplete="username"
                    className={inputCls(lErr.id)} />
                ) : (
                  <PhoneField
                    value={lPhone}
                    onChange={v => { setLPhone(v); setLErr({}); }}
                    defaultCountry={defaultPhoneCountry}
                    placeholder={t.phonePlaceholder}
                    hasError={!!lErr.id}
                  />
                )}
                <FieldError msg={lErr.id ?? ''} />
              </div>
              <div className="mb-2">
                <label className="ds-label">{t.authPassword}</label>
                <PwInput id="lPw" value={lPw} onChange={v => { setLPw(v); setLErr({}); }} placeholder={t.authPasswordPlaceholder} onEnter={doLogin} />
                <FieldError msg={lErr.pw ?? ''} />
              </div>
              <FieldError msg={lErr.global ?? ''} />
              <button className="block text-[11px] font-semibold text-gray-400 hover:text-cyan-600 mb-5 mt-1 transition-colors"
                onClick={() => { setFId(lId); setFPhone(lIdMode === 'phone' ? lPhone : ''); setFIdMode(lIdMode); setForgotStep(1); setFCode(''); setFPw(''); setFPw2(''); setFErr(''); setFErrCode(''); setFCountdown(0); setFChannel(lIdMode === 'phone' ? 'sms' : 'email'); setTab('forgot'); }}>
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
                <IdModeToggle
                  mode={rIdMode}
                  setMode={m => { setRIdMode(m); setRErr(p => ({ ...p, id: '' })); setRPhone(''); }}
                />
                {rIdMode === 'email' ? (
                  <input type="text" value={rId} onChange={e => { setRId(e.target.value); setRErr(p => ({ ...p, id: '' })); }}
                    placeholder={t.authEmailOrPhonePlaceholder} autoComplete="username"
                    className={inputCls(rErr.id)} />
                ) : (
                  <PhoneField
                    value={rPhone}
                    onChange={v => { setRPhone(v); setRErr(p => ({ ...p, id: '' })); }}
                    defaultCountry={defaultPhoneCountry}
                    placeholder={t.phonePlaceholder}
                    hasError={!!rErr.id}
                  />
                )}
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

          {/* ── Verify email / Telegram ───────────────────────────────────── */}
          {tab === 'verify' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-cyan-50 border-2 border-cyan-100 flex items-center justify-center mx-auto mb-5">
                {otpChannel.channel === 'telegram'
                  ? <Send className="w-7 h-7 text-[#229ED9]" />
                  : <Mail className="w-7 h-7 text-cyan-500" />}
              </div>
              <OtpChannelPanel hook={otpChannel} identifier={vIdentifier} />
            </div>
          )}

          {/* ── Forgot password ───────────────────────────────────────────────── */}
          {tab === 'forgot' && (
            <div>
              {forgotStep === 1 && (
                <>
                  <div className="mb-4">
                    <label className="ds-label">{t.authEmailOrPhone}</label>
                    <IdModeToggle
                      mode={fIdMode}
                      setMode={m => { setFIdMode(m); setFErr(''); setFErrCode(''); setFPhone(''); setFChannel(m === 'phone' ? 'sms' : 'email'); }}
                    />
                    {fIdMode === 'email' ? (
                      <input
                        type="text"
                        value={fId}
                        onChange={e => { setFId(e.target.value); setFErr(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') doForgotSend(); }}
                        placeholder={t.forgotIdPlaceholder}
                        autoComplete="username"
                        className={inputCls(fErr ? 'err' : '')}
                        autoFocus
                      />
                    ) : (
                      <PhoneField
                        value={fPhone}
                        onChange={v => { setFPhone(v); setFErr(''); }}
                        defaultCountry={defaultPhoneCountry}
                        placeholder={t.phonePlaceholder}
                        hasError={!!fErr}
                      />
                    )}
                  </div>
                  {fIdMode === 'email' && (
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setFChannel('email')}
                        disabled={fLoading}
                        className={`flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          fChannel === 'email' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Mail size={13} />{t.channelEmail}
                      </button>
                      <button
                        onClick={() => setFChannel('telegram')}
                        disabled={fLoading}
                        className={`flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          fChannel === 'telegram' ? 'bg-[#229ED9] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Send size={13} />{t.channelTelegram}
                      </button>
                    </div>
                  )}
                  {fIdMode === 'phone' && (
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setFChannel('sms')}
                        disabled={fLoading}
                        className={`flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          fChannel === 'sms' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <MessageSquare size={13} />{t.channelSms}
                      </button>
                      <button
                        onClick={() => setFChannel('telegram')}
                        disabled={fLoading}
                        className={`flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          fChannel === 'telegram' ? 'bg-[#229ED9] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Send size={13} />{t.channelTelegram}
                      </button>
                    </div>
                  )}
                  <FieldError msg={fErr} />
                  {fErrCode === 'NOT_REGISTERED' && (
                    <button type="button" onClick={() => setTab('register')}
                      className="mt-2 text-sm font-bold text-cyan-600 hover:underline">
                      {t.authSignUpLink}
                    </button>
                  )}
                  <button onClick={doForgotSend} disabled={fLoading}
                    className="ds-btn-primary w-full h-12 disabled:opacity-60 mb-4">
                    {fLoading ? '…' : t.forgotSendBtn}
                  </button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <p className="text-sm text-gray-500 mb-4 text-center leading-relaxed">
                    {fChannel === 'telegram' ? t.forgotSentMsgTg : fChannel === 'sms' ? t.forgotSentMsgSms : t.forgotSentMsg}
                  </p>
                  <div className="mb-3">
                    <label className="ds-label">{t.otpCodeLabel}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={fCode}
                      onChange={e => { setFCode(e.target.value.replace(/\D/g, '')); setFErr(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') doForgotReset(); }}
                      placeholder={t.otpCodePlaceholder}
                      className={`ds-input text-center text-2xl font-bold tracking-[0.5em] ${fErr ? 'border-red-400 bg-red-50' : ''}`}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="ds-label">{t.forgotNewPwPlaceholder}</label>
                    <PwInput id="fPw" value={fPw} onChange={v => { setFPw(v); setFErr(''); }} placeholder={t.forgotNewPwPlaceholder} />
                    <StrengthMeter pw={fPw} />
                  </div>
                  <div className="mb-3">
                    <label className="ds-label">{t.forgotConfirmPwPlaceholder}</label>
                    <PwInput id="fPw2" value={fPw2} onChange={v => { setFPw2(v); setFErr(''); }} placeholder={t.forgotConfirmPwPlaceholder} onEnter={doForgotReset} />
                  </div>
                  <FieldError msg={fErr} />
                  <button onClick={doForgotReset} disabled={fLoading || fCode.length < 6 || !fPw}
                    className="ds-btn-primary w-full h-12 disabled:opacity-60 mb-3">
                    {fLoading ? '…' : t.forgotResetBtn}
                  </button>
                  <button onClick={doForgotResend} disabled={fLoading || fCountdown > 0}
                    className="w-full h-10 text-sm font-semibold text-cyan-600 hover:text-cyan-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors mb-2">
                    {fCountdown > 0 ? t.otpResendIn.replace('{n}', String(fCountdown)) : t.otpResendBtn}
                  </button>
                </>
              )}

              <button onClick={() => { setTab('login'); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2 mt-1">
                {t.forgotBackToLogin}
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
