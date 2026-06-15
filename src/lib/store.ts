/**
 * Mirrors the original /var/www/html/app.js Store exactly.
 * All keys are stored as JSON under the 'cp_' prefix so React and the
 * original HTML pages share the same localStorage slots.
 */

// ── Raw Store (mirrors app.js Store object) ──────────────────────────────────
export const Store = {
  get<T = unknown>(k: string): T | null {
    try {
      const raw = localStorage.getItem('cp_' + k);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown): void {
    localStorage.setItem('cp_' + k, JSON.stringify(v));
  },
  del(k: string): void {
    localStorage.removeItem('cp_' + k);
  },
};

// ── ID generator (mirrors app.js genId) ──────────────────────────────────────
export function genId(prefix = 'CH'): string {
  const t = Date.now().toString(36).slice(-5).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return prefix + '-' + t + r;
}

// ── Types (shapes match what the original HTML pages write) ──────────────────

export interface Session {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerified?: boolean;
  telegramLinked?: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  createdAt: number;
}

// ── Typed accessors (mirrors app.js helper functions) ────────────────────────

export const getSession  = (): Session | null => Store.get<Session>('session');
export const setSession  = (s: Session): void => {
  Store.set('session', s);
  // Notify all useSession subscribers in the same tab
  window.dispatchEvent(new Event('cp:session'));
};
export const clearSession = (): void => {
  Store.del('session');
  window.dispatchEvent(new Event('cp:session'));
};

export const getOrder  = (): Record<string, unknown> => Store.get('order') ?? {};
export const saveOrder = (data: Record<string, unknown>): void =>
  Store.set('order', { ...getOrder(), ...data });
export const clearOrder = (): void => Store.del('order');

export const getUsers  = (): User[] => Store.get<User[]>('users') ?? [];
export const saveUsers = (users: User[]): void => Store.set('users', users);

// ── Currency rate helpers (mirrors app.js, uses bare localStorage keys) ──────
export const getLiveRate = (): number => {
  const r = parseFloat(localStorage.getItem('chapar_usdt_irr_rate') ?? '0');
  return r > 10000 ? r : 62000;
};
export const setLiveRate = (rate: number): void => {
  if (!rate || rate < 10000) return;
  localStorage.setItem('chapar_usdt_irr_rate', String(rate));
  localStorage.setItem('chapar_usdt_rate_updated_at', String(Date.now()));
};
