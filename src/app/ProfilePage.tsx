import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';

const AUTH_BASE = '/api/auth';

// ── Avatar gradient ────────────────────────────────────────────────────────────
const GRAD_PAIRS = [
  ['#1683ff','#0d5ec7'], ['#00d68f','#00a86b'], ['#b39dff','#7c4dff'],
  ['#ffc947','#e67e22'], ['#ff6b6b','#c0392b'], ['#00cec9','#00858e'],
];
function avatarGrad(name?: string) {
  const idx = (name || 'A').charCodeAt(0) % GRAD_PAIRS.length;
  const p = GRAD_PAIRS[idx];
  return `linear-gradient(135deg,${p[0]},${p[1]})`;
}

function pwStrength(pw: string): { score: number; color: string; label: string } {
  let s = 0;
  if (pw.length >= 8)         s++;
  if (/[A-Z]/.test(pw))       s++;
  if (/[0-9]/.test(pw))       s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی'];
  const colors = ['bg-gray-200','bg-red-400','bg-yellow-400','bg-green-400','bg-emerald-500'];
  return { score: s, label: labels[s] || '', color: colors[s] || 'bg-gray-200' };
}

interface BackendUser {
  id: string; email: string | null; phone: string | null;
  firstName: string; lastName: string;
  emailVerified: boolean; telegramLinked: boolean;
  createdAt: string;
}

interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onOpenWallet: () => void; onOpenOrders: () => void; }

export default function ProfilePage({ onHome, onOpenWallet, onOpenOrders }: Props) {
  const { session, setSession, clearSession } = useSession();
  const { t, isRTL } = useLang();
  const [user, setUser]         = useState<BackendUser | null>(null);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');

  // Edit info
  const [eFirst, setEFirst]   = useState('');
  const [eLast,  setELast]    = useState('');
  const [saving, setSaving]   = useState(false);
  const [infoErr, setInfoErr] = useState<Record<string, string>>({});

  // Change password
  const [pOld,     setPOld]     = useState('');
  const [pNew,     setPNew]     = useState('');
  const [pNew2,    setPNew2]    = useState('');
  const [pwErr,    setPwErr]    = useState<Record<string, string>>({});
  const [pwSaving, setPwSaving] = useState(false);

  // Stats from localStorage (app-level data)
  const [stats, setStats] = useState({ total: 0, transit: 0, done: 0, rating: '—', walletBal: 0 });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadProfile = useCallback(async () => {
    if (!session) return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json() as { ok: boolean; user?: BackendUser };
      if (data.ok && data.user) {
        setUser(data.user);
        setEFirst(data.user.firstName || '');
        setELast(data.user.lastName   || '');
      }
    } catch {}

    // Stats from localStorage
    const allHist  = Store.get<Array<{ trackId: string; userId?: string; phone?: string }>>('history') ?? [];
    const statuses = Store.get<Record<string, string>>('admin_statuses') ?? {};
    const hist = allHist.filter(o =>
      o.userId ? o.userId === session.userId
      : o.phone && session.phone && o.phone.replace(/\D/g, '') === session.phone.replace(/\D/g, '')
    );
    const transit = hist.filter(o => { const st = statuses[o.trackId] || 'pending'; return st === 'in_transit' || st === 'matched'; }).length;
    const done    = hist.filter(o => statuses[o.trackId] === 'delivered').length;

    const myTrips   = (Store.get<Array<{ id: string; userId?: string }>>('trips') ?? []).filter(tr => tr.userId === session.userId);
    const myTripIds = myTrips.map(tr => tr.id);
    let ratingStr   = '—';
    if (myTripIds.length) {
      const allRatings = (Store.get<Array<{ tripId: string; score: number }>>('ratings') ?? []).filter(r => myTripIds.includes(r.tripId));
      if (allRatings.length) {
        const avg = allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;
        ratingStr = avg.toFixed(1) + ' ⭐';
      }
    }

    const allW      = Store.get<Record<string, { balance: number }>>('wallets') ?? {};
    const walletBal = allW[session.phone]?.balance ?? 0;
    setStats({ total: hist.length, transit, done, rating: ratingStr, walletBal });
    setLoading(false);
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (!session) return null;

  async function saveInfo() {
    const errs: Record<string, string> = {};
    if (!eFirst.trim()) errs.first = t.profErrFirst;
    if (!eLast.trim())  errs.last  = t.profErrLast;
    if (Object.keys(errs).length) { setInfoErr(errs); return; }
    setInfoErr({});
    setSaving(true);
    try {
      const token = localStorage.getItem('cp_token');
      const res   = await fetch(`${AUTH_BASE}/profile`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ firstName: eFirst.trim(), lastName: eLast.trim() }),
      });
      const data = await res.json() as { ok: boolean; user?: BackendUser };
      if (data.ok && data.user) {
        setUser(data.user);
        setSession({ ...session, firstName: data.user.firstName, lastName: data.user.lastName });
        showToast(t.profInfoSaved);
      } else {
        setInfoErr({ global: t.authErrNetwork });
      }
    } catch {
      setInfoErr({ global: t.authErrNetwork });
    }
    setSaving(false);
  }

  async function changePassword() {
    const errs: Record<string, string> = {};
    if (!pOld)                       errs.old  = t.profErrOldPw;
    if (!pNew || pNew.length < 8)    errs.new  = t.profErrNewPw;
    if (pNew && pNew2 && pNew !== pNew2) errs.new2 = t.profErrPwMatch;
    if (Object.keys(errs).length) { setPwErr(errs); return; }

    setPwSaving(true);
    setPwErr({});
    try {
      const token = localStorage.getItem('cp_token');
      const res   = await fetch(`${AUTH_BASE}/change-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ oldPassword: pOld, newPassword: pNew }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setPOld(''); setPNew(''); setPNew2('');
        showToast(t.profPwChanged);
      } else if (data.error === 'current password is incorrect') {
        setPwErr({ old: t.profErrOldPwWrong });
      } else if (data.error === 'new password must differ from current') {
        setPwErr({ new: t.profErrPwSame });
      } else {
        setPwErr({ global: t.authErrNetwork });
      }
    } catch {
      setPwErr({ global: t.authErrNetwork });
    }
    setPwSaving(false);
  }

  const str = pwStrength(pNew);
  const joinedDate = user?.createdAt
    ? t.profMemberSince.replace('{date}', new Date(user.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }))
    : t.profDefaultUser;

  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user?.email ?? user?.phone ?? '—');
  const avatarLetter = (user?.firstName || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>{t.profBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.profHome}</span>
          </button>
          <h1 className="mr-auto text-lg font-extrabold text-gray-900">{t.profTitle}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="ds-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0"
                  style={{ background: avatarGrad(user?.firstName) }}>
                  {avatarLetter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-extrabold text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
                    {user?.email && <span>✉️ {user.email}</span>}
                    {user?.phone && <span>📞 {user.phone}</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{joinedDate}</div>
                </div>
              </div>
              {/* Quick-links */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={onOpenOrders} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
                  {t.profMyOrders}
                </button>
                <button onClick={onOpenWallet} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors">
                  {t.profWallet} · {Math.round(stats.walletBal).toLocaleString('fa-IR')} ت
                </button>
                <button onClick={() => { clearSession(); window.location.href = '/'; }}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                  {t.profLogout}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: stats.total.toLocaleString('fa-IR'),   lbl: t.profStatTotal,   color: 'text-gray-900' },
                { val: stats.transit.toLocaleString('fa-IR'), lbl: t.profStatTransit, color: 'text-purple-600' },
                { val: stats.done.toLocaleString('fa-IR'),    lbl: t.profStatDone,    color: 'text-green-600' },
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
                <div className="text-[10px] text-gray-400 mt-0.5">{t.profRating}</div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(['info', 'security'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors
                    ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {tab === 'info' ? t.profTabInfo : t.profTabSecurity}
                </button>
              ))}
            </div>

            {/* Edit info tab */}
            {activeTab === 'info' && (
              <div className="ds-card p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 mb-2">{t.profEditInfo}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ds-label">{t.profFirstName}</label>
                    <input className={`ds-input ${infoErr.first ? 'border-red-400' : ''}`} value={eFirst} onChange={e => { setEFirst(e.target.value); setInfoErr(p => ({ ...p, first: '' })); }} />
                    {infoErr.first && <div className="text-xs text-red-500 mt-1">{infoErr.first}</div>}
                  </div>
                  <div>
                    <label className="ds-label">{t.profLastName}</label>
                    <input className={`ds-input ${infoErr.last ? 'border-red-400' : ''}`} value={eLast} onChange={e => { setELast(e.target.value); setInfoErr(p => ({ ...p, last: '' })); }} />
                    {infoErr.last && <div className="text-xs text-red-500 mt-1">{infoErr.last}</div>}
                  </div>
                </div>
                {/* Email & phone are identity fields — read-only, change requires re-verification */}
                {user?.email && (
                  <div>
                    <label className="ds-label">{t.profEmail}</label>
                    <input type="email" readOnly value={user.email} className="ds-input bg-gray-50 text-gray-500 cursor-default" style={{ direction: 'ltr' }} />
                  </div>
                )}
                {user?.phone && (
                  <div>
                    <label className="ds-label">{t.profPhone}</label>
                    <input type="tel" readOnly value={user.phone} className="ds-input bg-gray-50 text-gray-500 cursor-default" style={{ direction: 'ltr' }} />
                  </div>
                )}
                {infoErr.global && <div className="text-xs text-red-500">{infoErr.global}</div>}
                <button onClick={saveInfo} disabled={saving}
                  className="ds-btn-primary w-full py-3 disabled:opacity-60">
                  {saving ? t.profSaving : t.profSaveChanges}
                </button>
              </div>
            )}

            {/* Security tab */}
            {activeTab === 'security' && (
              <div className="ds-card p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 mb-2">{t.profChangePw}</h3>
                <div>
                  <label className="ds-label">{t.profCurrentPw}</label>
                  <input type="password" className={`ds-input ${pwErr.old ? 'border-red-400' : ''}`} value={pOld} onChange={e => { setPOld(e.target.value); setPwErr(p => ({ ...p, old: '' })); }} style={{ direction: 'ltr' }} />
                  {pwErr.old && <div className="text-xs text-red-500 mt-1">{pwErr.old}</div>}
                </div>
                <div>
                  <label className="ds-label">{t.profNewPw}</label>
                  <input type="password" className={`ds-input ${pwErr.new ? 'border-red-400' : ''}`} value={pNew} onChange={e => { setPNew(e.target.value); setPwErr(p => ({ ...p, new: '' })); }} style={{ direction: 'ltr' }} />
                  {pNew && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${str.color}`} style={{ width: (str.score / 4 * 100) + '%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{str.label}</span>
                    </div>
                  )}
                  {pwErr.new && <div className="text-xs text-red-500 mt-1">{pwErr.new}</div>}
                </div>
                <div>
                  <label className="ds-label">{t.profConfirmPw}</label>
                  <input type="password" className={`ds-input ${pwErr.new2 ? 'border-red-400' : ''}`} value={pNew2} onChange={e => { setPNew2(e.target.value); setPwErr(p => ({ ...p, new2: '' })); }} style={{ direction: 'ltr' }} />
                  {pwErr.new2 && <div className="text-xs text-red-500 mt-1">{pwErr.new2}</div>}
                </div>
                {pwErr.global && <div className="text-xs text-red-500">{pwErr.global}</div>}
                <button onClick={changePassword} disabled={pwSaving}
                  className="ds-btn-primary w-full py-3 disabled:opacity-60">
                  {pwSaving ? t.profSaving : t.profChangePwBtn}
                </button>

                {/* Verification status */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.profVerification ?? 'Verification'}</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={user?.emailVerified ? 'text-green-600' : 'text-gray-400'}>
                      {user?.emailVerified ? '✅' : '○'} {t.channelEmail}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={user?.telegramLinked ? 'text-green-600' : 'text-gray-400'}>
                      {user?.telegramLinked ? '✅' : '○'} {t.channelTelegram}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
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
