import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, setSession as storeSetSession, clearSession as storeClearSession, type Session } from './store';

interface SessionCtx {
  session: Session | null;
  setSession: (s: Session) => void;
  clearSession: () => void;
}

const Ctx = createContext<SessionCtx>({
  session: null,
  setSession: storeSetSession,
  clearSession: storeClearSession,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setLocal] = useState<Session | null>(() => getSession());

  useEffect(() => {
    const sync = () => setLocal(getSession());
    // cp:session fired by store helpers in this tab
    window.addEventListener('cp:session', sync);
    // storage event fired by other tabs
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cp:session', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setSession = (s: Session) => {
    storeSetSession(s);  // writes localStorage + fires 'cp:session'
    setLocal(s);
  };

  const clearSession = () => {
    storeClearSession();  // clears localStorage + fires 'cp:session'
    setLocal(null);
  };

  return <Ctx.Provider value={{ session, setSession, clearSession }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
