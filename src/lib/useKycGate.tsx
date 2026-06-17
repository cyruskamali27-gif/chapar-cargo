import { useState, useEffect } from 'react';
import { useSession } from './SessionContext';
import { useLang } from './LangContext';

interface Options {
  onNavigate?: (page: string) => void;
}

export function useKycGate({ onNavigate }: Options = {}) {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    const token = localStorage.getItem('cp_token');
    if (!token)   { setLoading(false); return; }
    fetch('/api/kyc/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setKycStatus(d?.status ?? null); setLoading(false); })
      .catch(() => { setKycStatus(null); setLoading(false); });
  }, [session?.userId]);

  const isVerified  = kycStatus === 'verified';
  const showNotice  = !loading && !isVerified && !!session;

  const notice = showNotice ? (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl"
    >
      <span className="text-xl flex-shrink-0">🪪</span>
      <p className="text-sm text-amber-800 font-medium flex-1">{t.kycGateNotice}</p>
      <button
        type="button"
        onClick={() => onNavigate?.('profile')}
        className="flex-shrink-0 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-xl px-4 py-2 transition-colors"
      >
        {t.kycGateCta}
      </button>
    </div>
  ) : null;

  return { kycStatus, kycLoading: loading, isVerified, notice };
}
