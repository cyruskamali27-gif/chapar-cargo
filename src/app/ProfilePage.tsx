import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store, getLiveRate } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { setSession as storeSetSession } from '../lib/store';

// ── Avatar gradient (mirrors profile.html) ────────────────────────────────────
const GRAD_PAIRS = [
  ['#1683ff','#0d5ec7'], ['#00d68f','#00a86b'], ['#b39dff','#7c4dff'],
  ['#ffc947','#e67e22'], ['#ff6b6b','#c0392b'], ['#00cec9','#00858e'],
];
function avatarGrad(name?: string) {
  const idx = (name || 'A').charCodeAt(0) % GRAD_PAIRS.length;
  const p = GRAD_PAIRS[idx];
  return `linear-gradient(135deg,${p[0]},${p[1]})`;
}

function pwStrength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['خیلی ضعیف','ضعیف','متوسط','قوی','خیلی قوی'];
  const colors = ['bg-red-400','bg-orange-400','bg-yellow-400','bg-green-400','bg-emerald-500'];
  return { score: s, label: labels[s] || '—', color: colors[s] || 'bg-gray-200' };
}

interface UserRecord { id: string; firstName: string; lastName: string; email: string; phone: string; password?: string; createdAt?: number; kycVerified?: boolean; }
interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onOpenWallet: () => void; onOpenOrders: () => void; }

export default function ProfilePage({ onHome, onOpenWallet, onOpenOrders }: Props) {
  const { session, clearSession } = useSession();
  const [user, setUser]         = useState<UserRecord | null>(null);
  const [toast, setToast]       = useState('');
  const [activeTab, setActiveTab] = useState<'info'|'security'>('info');

  // Edit info
  const [eFirst, setEFirst]   = useState('');
  const [eLast,  setELast]    = useState('');
  const [eEmail, setEEmail]   = useState('');
  const [ePhone, setEPhone]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [infoErr, setInfoErr] = useState<Record<string,string>>({});

  // Change password
  const [pOld,  setPOld]   = useState('');
  const [pNew,  setPNew]   = useState('');
  const [pNew2, setPNew2]  = useState('');
  const [pwErr, setPwErr]  = useState<Record<string,string>>({});
  const [pwSaving, setPwSaving] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total:0, transit:0, done:0, rating:'—', walletBal:0 });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadProfile = useCallback(() => {
    if (!session) return;
    const users = Store.get<UserRecord[]>('users') ?? [];
    const found = users.find(u => u.id === session.userId) ?? { ...session, id: session.userId } as unknown as UserRecord;
    setUser(found);
    setEFirst(found.firstName || '');
    setELast(found.lastName   || '');
    setEEmail(found.email     || '');
    setEPhone(found.phone     || '');

    // Stats
    const allHist  = Store.get<Array<{trackId:string; userId?:string; phone?:string}>>('history') ?? [];
    const statuses = Store.get<Record<string,string>>('admin_statuses') ?? {};
    const hist = allHist.filter(o =>
      o.userId ? o.userId === session.userId
      : o.phone && session.phone && o.phone.replace(/\D/g,'') === session.phone.replace(/\D/g,'')
    );
    const transit = hist.filter(o => { const st = statuses[o.trackId] || 'pending'; return st === 'in_transit' || st === 'matched'; }).length;
    const done    = hist.filter(o => statuses[o.trackId] === 'delivered').length;

    // Traveler rating
    const myTrips = (Store.get<Array<{id:string; userId?:string}>>('trips') ?? []).filter(t => t.userId === session.userId);
    const myTripIds = myTrips.map(t => t.id);
    let ratingStr = '—';
    if (myTripIds.length) {
      const allRatings = (Store.get<Array<{tripId:string; score:number}>>('ratings') ?? []).filter(r => myTripIds.includes(r.tripId));
      if (allRatings.length) {
        const avg = allRatings.reduce((s,r) => s + r.score, 0) / allRatings.length;
        ratingStr = avg.toFixed(1) + ' ⭐';
      }
    }

    // Wallet
    const allW = Store.get<Record<string, { balance: number }>>('wallets') ?? {};
    const ww   = allW[found.phone || session.phone];
    const walletBal = ww?.balance || 0;

    setStats({ total: hist.length, transit, done, rating: ratingStr, walletBal });
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">ورود لازم است</h2>
          <button onClick={onHome} className="ds-btn-primary w-full py-3 mt-4">ورود / ثبت‌نام</button>
        </div>
      </div>
    );
  }

  function saveInfo() {
    const errs: Record<string,string> = {};
    if (!eFirst.trim()) errs.first = 'نام الزامی است';
    if (!eLast.trim())  errs.last  = 'نام خانوادگی الزامی است';
    if (!eEmail.trim() || !/\S+@\S+\.\S+/.test(eEmail)) errs.email = 'ایمیل معتبر نیست';
    if (!ePhone.trim() || ePhone.replace(/\D/g,'').length < 10) errs.phone = 'شماره موبایل معتبر نیست';
    if (Object.keys(errs).length) { setInfoErr(errs); return; }
    setInfoErr({});

    const users = Store.get<UserRecord[]>('users') ?? [];
    if (users.find(u => u.email === eEmail.toLowerCase() && u.id !== session.userId)) { setInfoErr({ email:'این ایمیل قبلاً ثبت شده است' }); return; }
    if (users.find(u => (u.phone||'').replace(/\D/g,'') === ePhone.replace(/\D/g,'') && u.id !== session.userId)) { setInfoErr({ phone:'این شماره قبلاً ثبت شده است' }); return; }

    setSaving(true);
    setTimeout(() => {
      const idx = users.findIndex(u => u.id === session.userId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], firstName: eFirst.trim(), lastName: eLast.trim(), email: eEmail.toLowerCase(), phone: ePhone.trim() };
        Store.set('users', users);
      }
      const newSession = { ...session, firstName: eFirst.trim(), lastName: eLast.trim(), email: eEmail.toLowerCase(), phone: ePhone.trim() };
      storeSetSession(newSession);
      setSaving(false);
      loadProfile();
      showToast('✅ اطلاعات با موفقیت ذخیره شد');
    }, 500);
  }

  function changePassword() {
    const errs: Record<string,string> = {};
    if (!pOld) errs.old = 'رمز عبور فعلی الزامی است';
    if (!pNew || pNew.length < 8) errs.new = 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد';
    if (pNew && pNew2 && pNew !== pNew2) errs.new2 = 'رمز عبور و تکرار آن یکسان نیستند';
    if (Object.keys(errs).length) { setPwErr(errs); return; }

    const users = Store.get<UserRecord[]>('users') ?? [];
    const u = users.find(u => u.id === session.userId);
    if (!u || u.password !== pOld) { setPwErr({ old:'رمز عبور فعلی اشتباه است' }); return; }
    if (pNew === pOld) { setPwErr({ new:'رمز عبور جدید باید با رمز فعلی متفاوت باشد' }); return; }

    setPwSaving(true);
    setTimeout(() => {
      u.password = pNew;
      Store.set('users', users);
      setPOld(''); setPNew(''); setPNew2('');
      setPwErr({});
      setPwSaving(false);
      showToast('✅ رمز عبور با موفقیت تغییر یافت');
    }, 500);
  }

  const str = pwStrength(pNew);
  const joinedDate = user?.createdAt
    ? 'عضو از ' + new Date(user.createdAt).toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' })
    : 'کاربر چاپار';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>بازگشت</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>خانه</span>
          </button>
          <h1 className="mr-auto text-lg font-extrabold text-gray-900">پروفایل</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Profile header */}
        <div className="ds-card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0"
              style={{ background: avatarGrad(user?.firstName) }}>
              {(user?.firstName || '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-extrabold text-gray-900">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
                <span>✉️ {user?.email || '—'}</span>
                <span>📞 {user?.phone || '—'}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{joinedDate}</div>
            </div>
          </div>
          {/* Quick-links */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={onOpenOrders} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
              📦 سفارش‌های من
            </button>
            <button onClick={onOpenWallet} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors">
              💳 کیف پول · {Math.round(stats.walletBal).toLocaleString('fa-IR')} ت
            </button>
            <button onClick={() => { clearSession(); window.location.href = '/'; }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
              خروج
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: stats.total.toLocaleString('fa-IR'),   lbl: 'کل سفارش‌ها',  color:'text-gray-900'   },
            { val: stats.transit.toLocaleString('fa-IR'), lbl: 'در مسیر',       color:'text-purple-600' },
            { val: stats.done.toLocaleString('fa-IR'),    lbl: 'تحویل موفق',    color:'text-green-600'  },
          ].map(s => (
            <div key={s.lbl} className="ds-card p-3 text-center">
              <div className={`text-lg font-extrabold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.lbl}</div>
            </div>
          ))}
        </div>
        {stats.rating !== '—' && (
          <div className="ds-card p-3 text-center">
            <div className="text-sm font-extrabold text-yellow-600">{stats.rating}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">امتیاز مسافر</div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {(['info','security'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors
                ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'info' ? 'اطلاعات شخصی' : 'امنیت'}
            </button>
          ))}
        </div>

        {/* Edit info tab */}
        {activeTab === 'info' && (
          <div className="ds-card p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 mb-2">ویرایش اطلاعات</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ds-label">نام</label>
                <input className={`ds-input ${infoErr.first ? 'border-red-400' : ''}`} value={eFirst} onChange={e => setEFirst(e.target.value)} />
                {infoErr.first && <div className="text-xs text-red-500 mt-1">{infoErr.first}</div>}
              </div>
              <div>
                <label className="ds-label">نام خانوادگی</label>
                <input className={`ds-input ${infoErr.last ? 'border-red-400' : ''}`} value={eLast} onChange={e => setELast(e.target.value)} />
                {infoErr.last && <div className="text-xs text-red-500 mt-1">{infoErr.last}</div>}
              </div>
            </div>
            <div>
              <label className="ds-label">ایمیل</label>
              <input type="email" className={`ds-input ${infoErr.email ? 'border-red-400' : ''}`} value={eEmail} onChange={e => setEEmail(e.target.value)} style={{ direction:'ltr' }} />
              {infoErr.email && <div className="text-xs text-red-500 mt-1">{infoErr.email}</div>}
            </div>
            <div>
              <label className="ds-label">شماره موبایل</label>
              <input type="tel" className={`ds-input ${infoErr.phone ? 'border-red-400' : ''}`} value={ePhone} onChange={e => setEPhone(e.target.value)} style={{ direction:'ltr' }} />
              {infoErr.phone && <div className="text-xs text-red-500 mt-1">{infoErr.phone}</div>}
            </div>
            <button onClick={saveInfo} disabled={saving}
              className="ds-btn-primary w-full py-3 disabled:opacity-60">
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        )}

        {/* Security tab */}
        {activeTab === 'security' && (
          <div className="ds-card p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 mb-2">تغییر رمز عبور</h3>
            <div>
              <label className="ds-label">رمز عبور فعلی</label>
              <input type="password" className={`ds-input ${pwErr.old ? 'border-red-400' : ''}`} value={pOld} onChange={e => setPOld(e.target.value)} style={{ direction:'ltr' }} />
              {pwErr.old && <div className="text-xs text-red-500 mt-1">{pwErr.old}</div>}
            </div>
            <div>
              <label className="ds-label">رمز عبور جدید</label>
              <input type="password" className={`ds-input ${pwErr.new ? 'border-red-400' : ''}`} value={pNew} onChange={e => setPNew(e.target.value)} style={{ direction:'ltr' }} />
              {pNew && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${str.color}`} style={{ width: (str.score/4*100) + '%' }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{str.label}</span>
                </div>
              )}
              {pwErr.new && <div className="text-xs text-red-500 mt-1">{pwErr.new}</div>}
            </div>
            <div>
              <label className="ds-label">تکرار رمز عبور جدید</label>
              <input type="password" className={`ds-input ${pwErr.new2 ? 'border-red-400' : ''}`} value={pNew2} onChange={e => setPNew2(e.target.value)} style={{ direction:'ltr' }} />
              {pwErr.new2 && <div className="text-xs text-red-500 mt-1">{pwErr.new2}</div>}
            </div>
            <button onClick={changePassword} disabled={pwSaving}
              className="ds-btn-primary w-full py-3 disabled:opacity-60">
              {pwSaving ? 'در حال ذخیره...' : 'تغییر رمز عبور'}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
