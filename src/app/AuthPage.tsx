import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { genId, getUsers, saveUsers, type User } from '../lib/store';
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

type Tab = 'login' | 'register' | 'success';

export default function AuthPage({ onHome, onSuccess, defaultTab = 'login' }: Props) {
  const { setSession } = useSession();
  const { t, isRTL } = useLang();
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [lId, setLId]   = useState('');
  const [lPw, setLPw]   = useState('');
  const [lErr, setLErr] = useState<{ id?: string; pw?: string; global?: string }>({});

  const [rFirst,  setRFirst]  = useState('');
  const [rLast,   setRLast]   = useState('');
  const [rEmail,  setREmail]  = useState('');
  const [rPhone,  setRPhone]  = useState('');
  const [rPw,     setRPw]     = useState('');
  const [rPw2,    setRPw2]    = useState('');
  const [rTerms,  setRTerms]  = useState(false);
  const [rErr,    setRErr]    = useState<Record<string, string>>({});

  const [successTitle, setSuccessTitle] = useState('');
  const [successSub,   setSuccessSub]   = useState('');

  function doLogin() {
    const errors: typeof lErr = {};
    if (!lId.trim()) errors.id = t.authErrEmailRequired;
    if (!lPw)        errors.pw = t.authErrPasswordRequired;
    if (Object.keys(errors).length) { setLErr(errors); return; }

    const users = getUsers();
    const norm  = (s: string) => s.replace(/\D/g, '');
    const idNorm = lId.trim().toLowerCase();
    const user  = users.find(u =>
      u.email === idNorm ||
      u.phone === lId.trim() ||
      norm(u.phone) === norm(lId.trim())
    );

    if (!user) { setLErr({ id: t.authErrNotFound }); return; }
    if (user.password !== lPw) { setLErr({ pw: t.authErrWrongPassword }); return; }

    setLErr({});
    setSession({ userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone });
    setSuccessTitle(`${t.authSuccessLoginPrefix}${user.firstName}!`);
    setSuccessSub(t.authSuccessLoginSub);
    setTab('success');
    setTimeout(onSuccess ?? onHome, 1400);
  }

  function doRegister() {
    const errs: Record<string, string> = {};
    const email = rEmail.trim().toLowerCase();
    const phone = rPhone.trim();

    if (!rFirst.trim()) errs.first = t.authErrFirstName;
    if (!rLast.trim())  errs.last  = t.authErrLastName;
    if (!email || !/\S+@\S+\.\S+/.test(email)) errs.email = t.authErrEmail;
    if (!phone || phone.replace(/\D/g, '').length < 10) errs.phone = t.authErrPhone;
    if (!rPw || rPw.length < 8) errs.pw = t.authErrPasswordLength;
    if (rPw && rPw2 && rPw !== rPw2) errs.pw2 = t.authErrPasswordMatch;
    if (!rTerms) errs.terms = t.authErrTerms;
    if (Object.keys(errs).length) { setRErr(errs); return; }

    const users = getUsers();
    const norm  = (s: string) => s.replace(/\D/g, '');
    if (users.find(u => u.email === email))
      { setRErr({ email: t.authErrEmailExists }); return; }
    if (users.find(u => norm(u.phone) === norm(phone)))
      { setRErr({ phone: t.authErrPhoneExists }); return; }

    const newUser: User = {
      id: genId('U'), firstName: rFirst.trim(), lastName: rLast.trim(),
      email, phone, password: rPw, createdAt: Date.now(),
    };
    try {
      saveUsers([...users, newUser]);
    } catch {
      setRErr({ global: t.authErrSave });
      return;
    }
    setSession({ userId: newUser.id, firstName: newUser.firstName, lastName: newUser.lastName, email, phone });
    setRErr({});
    setSuccessTitle(`${t.authSuccessRegisterPrefix}${rFirst.trim()}!`);
    setSuccessSub(t.authSuccessRegisterSub);
    setTab('success');
    setTimeout(onSuccess ?? onHome, 1400);
  }

  const inputCls = (err?: string) =>
    `ds-input ${err ? 'border-red-400 bg-red-50 focus:border-red-400' : ''}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 pt-20 pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-12 mx-auto mb-4" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {tab === 'login'    && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authWelcome}</h2><p className="text-sm text-gray-500 mt-1">{t.authLoginSubtitle}</p></>}
          {tab === 'register' && <><h2 className="text-2xl font-extrabold text-gray-900">{t.authRegisterTitle}</h2><p className="text-sm text-gray-500 mt-1">{t.authRegisterSubtitle}</p></>}
        </div>

        <div className="ds-card p-6">
          {tab !== 'success' && (
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

          {tab === 'login' && (
            <div>
              <div className="mb-4">
                <label className="ds-label">{t.authEmailOrPhone}</label>
                <input type="text" value={lId} onChange={e => { setLId(e.target.value); setLErr({}); }}
                  placeholder={t.authEmailOrPhonePlaceholder}
                  autoComplete="username"
                  className={inputCls(lErr.id)} />
                <FieldError msg={lErr.id ?? ''} />
              </div>

              <div className="mb-2">
                <label className="ds-label">{t.authPassword}</label>
                <PwInput id="lPw" value={lPw} onChange={v => { setLPw(v); setLErr({}); }} placeholder={t.authPasswordPlaceholder} onEnter={doLogin} />
                <FieldError msg={lErr.pw ?? ''} />
              </div>

              <button className="block text-[11px] font-semibold text-gray-400 hover:text-cyan-600 mb-5 mt-1 transition-colors"
                onClick={() => alert(t.authForgotPasswordAlert)}>
                {t.authForgotPassword}
              </button>

              <button onClick={doLogin} className="ds-btn-primary w-full h-12">
                {t.authLoginBtn}
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

          {tab === 'register' && (
            <div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="ds-label">{t.authFirstName}</label>
                  <input type="text" value={rFirst} onChange={e => { setRFirst(e.target.value); setRErr(p => ({ ...p, first: '' })); }}
                    placeholder={t.authFirstName} autoComplete="given-name" className={inputCls(rErr.first)} />
                  <FieldError msg={rErr.first ?? ''} />
                </div>
                <div className="flex-1">
                  <label className="ds-label">{t.authLastName}</label>
                  <input type="text" value={rLast} onChange={e => { setRLast(e.target.value); setRErr(p => ({ ...p, last: '' })); }}
                    placeholder={t.authLastName} autoComplete="family-name" className={inputCls(rErr.last)} />
                  <FieldError msg={rErr.last ?? ''} />
                </div>
              </div>

              <div className="mb-4">
                <label className="ds-label">{t.authEmail}</label>
                <input type="email" value={rEmail} onChange={e => { setREmail(e.target.value); setRErr(p => ({ ...p, email: '' })); }}
                  placeholder="example@email.com" autoComplete="email" className={inputCls(rErr.email)} />
                <FieldError msg={rErr.email ?? ''} />
              </div>

              <div className="mb-4">
                <label className="ds-label">{t.authPhone}</label>
                <input type="tel" value={rPhone} onChange={e => { setRPhone(e.target.value); setRErr(p => ({ ...p, phone: '' })); }}
                  placeholder={t.authPhonePlaceholder} autoComplete="tel" className={inputCls(rErr.phone)} />
                <FieldError msg={rErr.phone ?? ''} />
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

              <button onClick={doRegister} className="ds-btn-primary w-full h-12">
                {t.authCreateAccount}
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

          {tab === 'success' && (
            <div className="text-center py-6">
              <span className="text-6xl block mb-4">🎉</span>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{successTitle}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{successSub}</p>
            </div>
          )}
        </div>

        {tab !== 'success' && (
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
