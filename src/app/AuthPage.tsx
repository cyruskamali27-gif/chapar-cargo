import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { genId, getUsers, saveUsers, type User } from '../lib/store';
import { useSession } from '../lib/SessionContext';

// ── Password strength (mirrors app.js pwScore) ───────────────────────────────
function pwScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9؀-ۿ\s]/.test(pw)) s++;
  return Math.min(4, Math.max(pw.length ? 1 : 0, s));
}

const PW_LABELS = ['', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی'];
const PW_COLORS = ['', '#ff4757', '#ffa502', '#4cd964', '#2ecc71'];

// ── Sub-components ────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs font-semibold text-[#ff4757] mt-1.5">{msg}</p>;
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
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pr-11 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function StrengthMeter({ pw }: { pw: string }) {
  const score = pwScore(pw);
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{ background: i < score ? PW_COLORS[score] : 'rgba(255,255,255,0.1)' }}
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

// ── Main AuthPage ─────────────────────────────────────────────────────────────
interface Props {
  onHome: () => void;
  defaultTab?: 'login' | 'register';
}

type Tab = 'login' | 'register' | 'success';

export default function AuthPage({ onHome, defaultTab = 'login' }: Props) {
  const { setSession } = useSession();
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Login fields
  const [lId, setLId]   = useState('');
  const [lPw, setLPw]   = useState('');
  const [lErr, setLErr] = useState<{ id?: string; pw?: string; global?: string }>({});

  // Register fields
  const [rFirst,  setRFirst]  = useState('');
  const [rLast,   setRLast]   = useState('');
  const [rEmail,  setREmail]  = useState('');
  const [rPhone,  setRPhone]  = useState('');
  const [rPw,     setRPw]     = useState('');
  const [rPw2,    setRPw2]    = useState('');
  const [rTerms,  setRTerms]  = useState(false);
  const [rErr,    setRErr]    = useState<Record<string, string>>({});

  // Success
  const [successTitle, setSuccessTitle] = useState('');
  const [successSub,   setSuccessSub]   = useState('');

  function doLogin() {
    const errors: typeof lErr = {};
    if (!lId.trim()) errors.id = 'ایمیل یا شماره موبایل الزامی است';
    if (!lPw)        errors.pw = 'رمز عبور الزامی است';
    if (Object.keys(errors).length) { setLErr(errors); return; }

    const users = getUsers();
    const norm  = (s: string) => s.replace(/\D/g, '');
    const user  = users.find(u =>
      u.email === lId.trim() ||
      u.phone === lId.trim() ||
      norm(u.phone) === norm(lId.trim())
    );

    if (!user) { setLErr({ id: 'حسابی با این مشخصات یافت نشد' }); return; }
    if (user.password !== lPw) { setLErr({ pw: 'رمز عبور اشتباه است' }); return; }

    setLErr({});
    setSession({ userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone });
    setSuccessTitle(`سلام ${user.firstName}!`);
    setSuccessSub('با موفقیت وارد شدید. در حال انتقال...');
    setTab('success');
    setTimeout(onHome, 1400);
  }

  function doRegister() {
    const errs: Record<string, string> = {};
    const email = rEmail.trim().toLowerCase();
    const phone = rPhone.trim();

    if (!rFirst.trim()) errs.first = 'نام الزامی است';
    if (!rLast.trim())  errs.last  = 'نام خانوادگی الزامی است';
    if (!email || !/\S+@\S+\.\S+/.test(email)) errs.email = 'آدرس ایمیل معتبر نیست';
    if (!phone || phone.replace(/\D/g, '').length < 10) errs.phone = 'شماره موبایل معتبر نیست';
    if (!rPw || rPw.length < 8) errs.pw = 'رمز عبور باید حداقل ۸ کاراکتر باشد';
    if (rPw && rPw2 && rPw !== rPw2) errs.pw2 = 'رمز عبور و تکرار آن یکسان نیستند';
    if (!rTerms) errs.terms = 'پذیرش قوانین الزامی است';
    if (Object.keys(errs).length) { setRErr(errs); return; }

    const users = getUsers();
    const norm  = (s: string) => s.replace(/\D/g, '');
    if (users.find(u => u.email === email))
      { setRErr({ email: 'این ایمیل قبلاً ثبت شده است' }); return; }
    if (users.find(u => norm(u.phone) === norm(phone)))
      { setRErr({ phone: 'این شماره موبایل قبلاً ثبت شده است' }); return; }

    const newUser: User = {
      id: genId('U'), firstName: rFirst.trim(), lastName: rLast.trim(),
      email, phone, password: rPw, createdAt: Date.now(),
    };
    saveUsers([...users, newUser]);
    setSession({ userId: newUser.id, firstName: newUser.firstName, lastName: newUser.lastName, email, phone });
    setRErr({});
    setSuccessTitle(`خوش آمدید ${rFirst.trim()}!`);
    setSuccessSub('حساب شما با موفقیت ساخته شد.');
    setTab('success');
    setTimeout(onHome, 1400);
  }

  const inputCls = (err?: string) =>
    `w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${
      err ? 'border-[#ff4757]/55 bg-[#ff4757]/5' : 'border-white/10 focus:border-blue-500/60'
    }`;

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-12 mx-auto mb-4" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {tab === 'login'    && <><h2 className="text-2xl font-extrabold text-white">خوش آمدید</h2><p className="text-sm text-white/50 mt-1">وارد حساب کاربری خود شوید</p></>}
          {tab === 'register' && <><h2 className="text-2xl font-extrabold text-white">ثبت نام</h2><p className="text-sm text-white/50 mt-1">حساب کاربری جدید بسازید</p></>}
        </div>

        <div className="bg-white/[0.04] border border-white/[0.09] rounded-2xl p-6">

          {/* ── Tab switcher ── */}
          {tab !== 'success' && (
            <div className="flex bg-white/5 border border-white/[0.09] rounded-2xl p-1.5 mb-6 gap-1">
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all ${
                    tab === t
                      ? 'bg-blue-600/20 text-blue-400 shadow-[0_0_0_1px_rgba(22,131,255,.25)]'
                      : 'text-white/40 hover:text-white/60'
                  }`}>
                  {t === 'login' ? 'ورود' : 'ثبت نام'}
                </button>
              ))}
            </div>
          )}

          {/* ══ Login form ══ */}
          {tab === 'login' && (
            <div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-white/50 mb-1.5">ایمیل یا شماره موبایل</label>
                <input type="text" value={lId} onChange={e => { setLId(e.target.value); setLErr({}); }}
                  placeholder="example@email.com یا ۰۹۱۲..."
                  autoComplete="username"
                  className={inputCls(lErr.id)} />
                <FieldError msg={lErr.id ?? ''} />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-bold text-white/50 mb-1.5">رمز عبور</label>
                <PwInput id="lPw" value={lPw} onChange={v => { setLPw(v); setLErr({}); }} placeholder="رمز عبور" onEnter={doLogin} />
                <FieldError msg={lErr.pw ?? ''} />
              </div>

              <button className="block text-[11px] font-bold text-white/30 hover:text-blue-400 mb-5 mt-1 transition-colors"
                onClick={() => alert('برای بازیابی رمز عبور با پشتیبانی چاپار تماس بگیرید')}>
                رمز عبور را فراموش کردم
              </button>

              <button onClick={doLogin}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm">
                ورود
              </button>

              <div className="flex items-center gap-3 my-5 text-white/20 text-xs">
                <span className="flex-1 border-t border-white/[0.08]" />یا<span className="flex-1 border-t border-white/[0.08]" />
              </div>
              <p className="text-center text-sm text-white/40">
                حساب ندارید؟{' '}
                <button onClick={() => setTab('register')} className="text-blue-400 font-bold hover:underline">ثبت نام کنید</button>
              </p>
            </div>
          )}

          {/* ══ Register form ══ */}
          {tab === 'register' && (
            <div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-white/50 mb-1.5">نام</label>
                  <input type="text" value={rFirst} onChange={e => { setRFirst(e.target.value); setRErr(p => ({ ...p, first: '' })); }}
                    placeholder="نام" autoComplete="given-name" className={inputCls(rErr.first)} />
                  <FieldError msg={rErr.first ?? ''} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-white/50 mb-1.5">نام خانوادگی</label>
                  <input type="text" value={rLast} onChange={e => { setRLast(e.target.value); setRErr(p => ({ ...p, last: '' })); }}
                    placeholder="نام خانوادگی" autoComplete="family-name" className={inputCls(rErr.last)} />
                  <FieldError msg={rErr.last ?? ''} />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-white/50 mb-1.5">ایمیل</label>
                <input type="email" value={rEmail} onChange={e => { setREmail(e.target.value); setRErr(p => ({ ...p, email: '' })); }}
                  placeholder="example@email.com" autoComplete="email" className={inputCls(rErr.email)} />
                <FieldError msg={rErr.email ?? ''} />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-white/50 mb-1.5">شماره موبایل</label>
                <input type="tel" value={rPhone} onChange={e => { setRPhone(e.target.value); setRErr(p => ({ ...p, phone: '' })); }}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹" autoComplete="tel" className={inputCls(rErr.phone)} />
                <FieldError msg={rErr.phone ?? ''} />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-white/50 mb-1.5">رمز عبور</label>
                <PwInput id="rPw" value={rPw} onChange={v => { setRPw(v); setRErr(p => ({ ...p, pw: '' })); }} placeholder="حداقل ۸ کاراکتر" />
                <StrengthMeter pw={rPw} />
                <FieldError msg={rErr.pw ?? ''} />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-white/50 mb-1.5">تکرار رمز عبور</label>
                <PwInput id="rPw2" value={rPw2} onChange={v => { setRPw2(v); setRErr(p => ({ ...p, pw2: '' })); }} placeholder="تکرار رمز عبور" onEnter={doRegister} />
                <FieldError msg={rErr.pw2 ?? ''} />
              </div>

              <div className="flex items-start gap-2.5 mb-5">
                <input type="checkbox" id="rTerms" checked={rTerms} onChange={e => { setRTerms(e.target.checked); setRErr(p => ({ ...p, terms: '' })); }}
                  className="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0" />
                <label htmlFor="rTerms" className="text-xs text-white/50 leading-relaxed cursor-pointer">
                  با <button className="text-blue-400 hover:underline">قوانین و مقررات</button> و <button className="text-blue-400 hover:underline">سیاست حریم خصوصی</button> چاپار موافقم
                </label>
              </div>
              <FieldError msg={rErr.terms ?? ''} />

              <button onClick={doRegister}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm">
                ایجاد حساب کاربری
              </button>

              <div className="flex items-center gap-3 my-5 text-white/20 text-xs">
                <span className="flex-1 border-t border-white/[0.08]" />یا<span className="flex-1 border-t border-white/[0.08]" />
              </div>
              <p className="text-center text-sm text-white/40">
                حساب دارید؟{' '}
                <button onClick={() => setTab('login')} className="text-blue-400 font-bold hover:underline">وارد شوید</button>
              </p>
            </div>
          )}

          {/* ══ Success ══ */}
          {tab === 'success' && (
            <div className="text-center py-6">
              <span className="text-6xl block mb-4">🎉</span>
              <h3 className="text-xl font-extrabold text-white mb-2">{successTitle}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{successSub}</p>
            </div>
          )}
        </div>

        {/* Back */}
        {tab !== 'success' && (
          <div className="mt-6 text-center">
            <button onClick={onHome} className="text-sm text-white/30 hover:text-white/60 transition-colors">
              ← بازگشت
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
