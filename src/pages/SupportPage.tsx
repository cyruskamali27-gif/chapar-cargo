/**
 * Support page — ports support.html exactly.
 * localStorage keys: cp_support_tickets (write via Store.set('support_tickets'))
 * URL params: ?id= (trackId, optional)
 * Session: pre-fills name/email if logged in (no auth required)
 */
import { useState, useEffect } from 'react';
import { Store, getSession } from '../lib/store';
import { useLang } from '../lib/LangContext';

export default function SupportPage() {
  const { t, isRTL } = useLang();
  const SUBJECTS = [
    { value: 'order',   label: t.supSubjOrder },
    { value: 'payment', label: t.supSubjPayment },
    { value: 'tracking',label: t.supSubjTracking },
    { value: 'traveler',label: t.supSubjTraveler },
    { value: 'account', label: t.supSubjAccount },
    { value: 'suggest', label: t.supSubjSuggest },
    { value: 'other',   label: t.supSubjOther },
  ];

  const params  = new URLSearchParams(location.search);
  const session = getSession();

  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [subject, setSubject] = useState('');
  const [trackId, setTrackId] = useState(params.get('id') ? params.get('id')!.toUpperCase() : '');
  const [message, setMessage] = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pre-fill from session
  useEffect(() => {
    if (!session) return;
    setName(((session.firstName || '') + ' ' + (session.lastName || '')).trim());
    setEmail(session.email || '');
  }, []);

  function sendSupport(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    if (!name.trim()) { setErr(t.supErrName); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setErr(t.supErrEmail); return; }
    if (!subject) { setErr(t.supErrSubject); return; }
    if (!message.trim() || message.trim().length < 10) { setErr(t.supErrMessage); return; }

    setLoading(true);
    const tickets = Store.get<object[]>('support_tickets') ?? [];
    tickets.unshift({
      id:        'TK-' + Date.now(),
      name:      name.trim(),
      email:     email.trim(),
      subject,
      trackId:   trackId || null,
      message:   message.trim(),
      createdAt: Date.now(),
      status:    'open',
    });
    Store.set('support_tickets', tickets.slice(0, 100));

    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 800);
  }

  function resetForm() {
    setName(''); setEmail(''); setSubject(''); setTrackId(''); setMessage('');
    setErr(''); setSuccess(false);
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{t.supBack}</button>
        <span className="text-sm font-bold text-gray-900">{t.supTitle}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        <div className="flex items-center justify-center mb-1">
          <img src="/assets/chapar-logo.png" alt="چاپار" className="h-8 object-contain" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1">{t.supTitle}</h2>
        <p className="text-sm text-gray-500 text-center mb-6">{t.supSubtitle}</p>

        {/* Online status */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 mb-5">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
          <div className="text-sm text-green-700">
            <strong>{t.supOnline}</strong> · {t.supHours}
          </div>
        </div>

        {/* Contact methods */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <a href="https://t.me/ChaparSupport"
             className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 text-center no-underline hover:border-blue-200 hover:bg-blue-50 transition-all group">
            <span className="text-2xl">✈️</span>
            <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{t.supTelegram}</span>
            <span className="text-[11px] text-gray-400">@ChaparSupport</span>
          </a>
          <a href="mailto:support@chapar.app"
             className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 text-center no-underline hover:border-blue-200 hover:bg-blue-50 transition-all group">
            <span className="text-2xl">✉️</span>
            <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{t.supEmail}</span>
            <span className="text-[11px] text-gray-400">support@chapar.app</span>
          </a>
          <a href="https://t.me/ChaparTrackBot"
             className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 text-center no-underline hover:border-blue-200 hover:bg-blue-50 transition-all group">
            <span className="text-2xl">🤖</span>
            <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{t.supBot}</span>
            <span className="text-[11px] text-gray-400">@ChaparTrackBot</span>
          </a>
        </div>

        {/* Contact form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t.supSendMessage}</div>

          {/* Success state */}
          {success && (
            <div className="text-center py-6">
              <span className="text-5xl block mb-4">✅</span>
              <div className="text-lg font-bold text-gray-900 mb-2">{t.supSuccessTitle}</div>
              <div className="text-sm text-gray-500 leading-relaxed mb-5">
                {t.supSuccessDesc}
              </div>
              <button onClick={resetForm}
                      className="h-11 px-6 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                {t.supNewMessage}
              </button>
            </div>
          )}

          {!success && (
            <form onSubmit={sendSupport} noValidate>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.supName}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                         placeholder={t.supNamePlaceholder} required
                         className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.supEmailLabel}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="email@example.com" required
                         className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors ltr" />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.supSubject}</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer">
                  <option value="" disabled>{t.supSubjectPlaceholder}</option>
                  {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.supTrackingCode}</label>
                <input type="text" value={trackId}
                       onChange={e => setTrackId(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                       placeholder="CH-XXXXX" maxLength={14}
                       className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest text-center bg-white outline-none focus:border-blue-400 transition-colors ltr" />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.supMessage}</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} required
                          placeholder={t.supMessagePlaceholder}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors resize-y leading-relaxed"
                          style={{ minHeight: '100px' }} />
              </div>

              {err && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-4">{err}</div>}

              <button type="submit" disabled={loading}
                      className="w-full h-12 rounded-2xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity">
                {loading ? t.supSending : t.supSend}
              </button>
            </form>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex gap-3 mt-5">
          <button onClick={() => history.back()} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">{t.supBack}</button>
          <button onClick={() => { location.href = '/'; }} className="flex-1 h-11 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-600">{t.supHome}</button>
        </div>
      </div>
    </div>
  );
}
