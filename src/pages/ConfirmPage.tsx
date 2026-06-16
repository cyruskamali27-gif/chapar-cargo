import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { useLang } from '../lib/LangContext';

type State = 'loading' | 'ready' | 'confirmed' | 'already_done' | 'expired' | 'invalid' | 'error';

interface Info {
  senderName: string;
  destCity: string;
}

export default function ConfirmPage() {
  const { t, isRTL } = useLang();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  const [state,   setState]   = useState<State>('loading');
  const [info,    setInfo]    = useState<Info | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    fetch(`/api/auth/confirm/lookup?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) {
          if (d.error === 'expired') setState('expired');
          else setState('invalid');
          return;
        }
        if (d.status === 'confirmed') {
          setInfo({ senderName: d.senderName, destCity: d.destCity });
          setState('already_done');
          return;
        }
        setInfo({ senderName: d.senderName, destCity: d.destCity });
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/confirm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (d.ok) {
        setState('confirmed');
      } else if (d.error === 'already_confirmed') {
        setState('already_done');
      } else if (d.error === 'expired') {
        setState('expired');
      } else {
        setState('invalid');
      }
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }

  const msgMap: Partial<Record<State, string>> = {
    expired:     t.confirmExpired,
    invalid:     t.confirmInvalid,
    error:       t.confirmInvalid,
    already_done: t.confirmAlreadyDone,
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-16"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/assets/chapar-logo.png"
            alt="Chapar"
            className="h-10 mx-auto mb-4"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <div className="ds-card p-8 text-center">
          {state === 'loading' && (
            <p className="text-gray-500">{t.confirmLoading}</p>
          )}

          {(state === 'expired' || state === 'invalid' || state === 'error') && (
            <>
              <div className="text-5xl mb-4">⛔</div>
              <p className="text-gray-700 font-semibold">{msgMap[state]}</p>
            </>
          )}

          {(state === 'confirmed' || state === 'already_done') && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-2">{t.confirmDone}</h2>
              {info && (
                <p className="text-sm text-gray-500">
                  {t.confirmDestLabel}: <strong>{info.destCity}</strong>
                </p>
              )}
            </>
          )}

          {state === 'ready' && info && (
            <>
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-cyan-50 border-2 border-cyan-100 mx-auto mb-5">
                <Package className="w-8 h-8 text-cyan-500" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-3">{t.confirmTitle}</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">{t.confirmSubtitle}</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm mb-6 text-start">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">{t.confirmSenderLabel}</span>
                  <span className="font-bold text-gray-900">{info.senderName || '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-medium">{t.confirmDestLabel}</span>
                  <span className="font-bold text-gray-900">{info.destCity || '—'}</span>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="ds-btn-primary w-full h-12 disabled:opacity-60"
              >
                {submitting ? '…' : t.confirmBtn}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
