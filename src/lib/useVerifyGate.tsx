import { useState } from 'react';
import { useSession } from './SessionContext';
import { useLang } from './LangContext';
import { useOtpChannel, OtpChannelPanel } from './useOtpChannel';

export function useVerifyGate() {
  const { session, setSession } = useSession();
  const { t, isRTL } = useLang();

  const [open,    setOpen]    = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  function handleVerified() {
    if (session) setSession({ ...session, emailVerified: true });
    setOpen(false);
    const cb = pending;
    setPending(null);
    cb?.();
  }

  const otpChannel = useOtpChannel({ session, setSession, onVerified: handleVerified });

  function gate(cb: () => void) {
    if (!session || session.emailVerified) { cb(); return; }
    setPending(() => cb);
    otpChannel.reset();
    setOpen(true);
    otpChannel.selectChannel('email');
  }

  function cancel() {
    otpChannel.reset();
    setOpen(false);
    setPending(null);
  }

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <p className="text-lg font-bold text-gray-900 text-center mb-5">{t.gateTitle}</p>
        <OtpChannelPanel hook={otpChannel} identifier={session?.email} />
        <button
          onClick={cancel}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 mt-3 transition-colors"
        >
          {t.gateCancel}
        </button>
      </div>
    </div>
  ) : null;

  return { gate, modal };
}
