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

function userToSession(user: { id: string; email: string | null; phone: string | null; emailVerified?: boolean; telegramLinked?: boolean }): Session {
  return { userId: user.id, firstName: '', lastName: '', email: user.email ?? '', phone: user.phone ?? '', emailVerified: user.emailVerified ?? false, telegramLinked: user.telegramLinked ?? false };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setLocal] = useState<Session | null>(() => getSession());

  // Validate JWT on mount; clear stale session if token is expired/missing
  useEffect(() => {
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const s = userToSession(data.user);
          storeSetSession(s);
          setLocal(s);
        } else {
          localStorage.removeItem('cp_token');
          storeClearSession();
          setLocal(null);
        }
      })
      .catch(() => {});
  }, []);

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
    storeSetSession(s);
    setLocal(s);
  };

  const clearSession = () => {
    localStorage.removeItem('cp_token');
    storeClearSession();
    setLocal(null);
  };

  return <Ctx.Provider value={{ session, setSession, clearSession }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
