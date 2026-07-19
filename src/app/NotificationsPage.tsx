import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store } from '../lib/store';
import { useLang } from '../lib/LangContext';
import { useSession } from '../lib/SessionContext';
import type { translations } from './i18n';

type T = typeof translations['en'];

// ── Type metadata ─────────────────────────────────────────────────────────────
// Legacy (localStorage) types + the P4/P4.5 server-feed event types.
const TYPE_META: Record<string, { icon: string; cls: string; group: string }> = {
  new_order:              { icon:'📦', cls:'ni-offer',    group:'offer'    },
  offer_received:         { icon:'✈️', cls:'ni-offer',    group:'offer'    },
  order_returned_to_pool: { icon:'📦', cls:'ni-offer',    group:'offer'    },
  offer_expired:          { icon:'⏰', cls:'ni-rejected',  group:'offer'    },
  offer_accepted:         { icon:'✅', cls:'ni-accepted',  group:'offer'    },
  offer_rejected:         { icon:'✕',  cls:'ni-rejected',  group:'offer'    },
  traveler_accepted:      { icon:'✅', cls:'ni-accepted',  group:'offer'    },
  counter_offer:          { icon:'💬', cls:'ni-counter',   group:'offer'    },
  counter_offer_ready:    { icon:'💬', cls:'ni-counter',   group:'offer'    },
  buyer_accepted:         { icon:'🤝', cls:'ni-accepted',  group:'offer'    },
  delivery_confirmed:     { icon:'📦', cls:'ni-delivery',  group:'delivery' },
  dispute_update:         { icon:'⚠️', cls:'ni-dispute',  group:'dispute'  },
};

const GROUP_COLORS: Record<string, string> = {
  offer:    'bg-blue-50 text-blue-700',
  delivery: 'bg-green-50 text-green-700',
  dispute:  'bg-orange-50 text-orange-700',
};

interface Notif {
  id: string; type: string; title: string; body: string;
  orderId?: string | null; offerId?: string | null;
  at: number; read: boolean;
  _src?: 'server' | 'local';
}

interface ServerNotif {
  id: string; type: string; title: string; body: string;
  orderId?: string | null; offerId?: string | null; at: string; read: boolean;
}

function fmtRelTime(ts: number, t: T) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return t.notifTimeDaysAgo.replace('{n}', String(d));
  if (h > 0)  return t.notifTimeHoursAgo.replace('{n}', String(h));
  if (m > 0)  return t.notifTimeMinsAgo.replace('{n}', String(m));
  return t.notifTimeNow;
}

function getNavUrl(n: Notif): string {
  if (n.type === 'dispute_update'     && n.orderId) return '/dispute?id=' + encodeURIComponent(n.orderId);
  if (n.type === 'delivery_confirmed' && n.orderId) return '/track?id=' + encodeURIComponent(n.orderId) + '&role=receiver';
  if (n.type === 'offer_accepted'     && n.offerId) return '/traveler-deposit?offerId=' + encodeURIComponent(n.offerId);
  if (n.orderId) return '/track?id=' + encodeURIComponent(n.orderId);
  return '/';
}

// Buyer-facing events open the buyer's order card; traveler-facing events open the traveler
// dashboard on the "پیشنهاد برای شما" tab. These are the in-site deep links the spec asks for.
const BUYER_TYPES    = new Set(['counter_offer_ready', 'traveler_accepted', 'counter_offer']);
const TRAVELER_TYPES = new Set(['offer_received', 'order_returned_to_pool', 'offer_expired', 'buyer_accepted', 'new_order']);

interface Props {
  onBack: () => void; onHome: () => void; t: Record<string, string>;
  onNavigate: (page: string) => void;
  onOpenOrder?: (orderId: string) => void;   // set myOrderId + open marketplace card
}

export default function NotificationsPage({ onHome, onNavigate, onOpenOrder }: Props) {
  const { t, isRTL } = useLang();
  const { session }  = useSession();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [filter, setFilter] = useState('');
  const [toast, setToast]   = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    // Local notifications (delivery/dispute/deposit flows still write these).
    const local = (Store.get<Notif[]>('notifications') ?? []).map(n => ({ ...n, _src: 'local' as const }));

    // Server feed (P4/P4.5 marketplace events) — the source of truth Telegram mirrors.
    let server: Notif[] = [];
    if (session?.userId) {
      try {
        const r = await fetch(`/api/marketplace/notifications?userId=${encodeURIComponent(session.userId)}`);
        const d = await r.json() as { ok: boolean; notifications?: ServerNotif[] };
        if (d.ok && d.notifications) {
          server = d.notifications.map(s => ({
            id: s.id, type: s.type, title: s.title, body: s.body,
            orderId: s.orderId, offerId: s.offerId,
            at: Date.parse(s.at) || Date.now(), read: s.read, _src: 'server' as const,
          }));
        }
      } catch { /* offline → show local only */ }
    }

    const merged = [...server, ...local].sort((a, b) => b.at - a.at);
    setNotifs(merged);
  }, [session?.userId]);

  useEffect(() => { load(); }, [load]);

  function applyRead(pred: (n: Notif) => boolean) {
    setNotifs(prev => prev.map(n => pred(n) ? { ...n, read: true } : n));
  }

  async function markRead(n: Notif) {
    applyRead(x => x.id === n.id);
    if (n._src === 'server') {
      if (session?.userId) {
        try {
          await fetch('/api/marketplace/notifications/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId, ids: [n.id] }),
          });
        } catch { /* best-effort */ }
      }
    } else {
      const updated = (Store.get<Notif[]>('notifications') ?? []).map(x => x.id === n.id ? { ...x, read: true } : x);
      Store.set('notifications', updated);
    }
  }

  async function markAllRead() {
    applyRead(() => true);
    const localUpdated = (Store.get<Notif[]>('notifications') ?? []).map(x => ({ ...x, read: true }));
    Store.set('notifications', localUpdated);
    if (session?.userId) {
      try {
        await fetch('/api/marketplace/notifications/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.userId }),   // no ids → all
        });
      } catch { /* best-effort */ }
    }
    showToast(t.notifAllRead);
  }

  function openNotif(n: Notif) {
    markRead(n);
    // Buyer's order card (counter-offer / traveler-accepted) — reuse the myOrderId deep link.
    if (BUYER_TYPES.has(n.type) && n.orderId && onOpenOrder) { onOpenOrder(n.orderId); return; }
    if (n.type === 'counter_offer') { onNavigate('marketplace'); return; }
    // Traveler's "پیشنهاد برای شما" tab.
    if (TRAVELER_TYPES.has(n.type)) {
      try { localStorage.setItem('cp_td_tab', 'foryou'); } catch { /* ignore */ }
      onNavigate('traveler-dashboard');
      return;
    }
    // Legacy static-page targets.
    window.location.href = getNavUrl(n);
  }

  const FILTER_CHIPS = [
    { val: '',         label: t.notifFilterAll      },
    { val: 'unread',   label: t.notifFilterUnread   },
    { val: 'offer',    label: t.notifFilterOffer    },
    { val: 'delivery', label: t.notifFilterDelivery },
    { val: 'dispute',  label: t.notifFilterDispute  },
  ];

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter) return (TYPE_META[n.type]?.group || '') === filter;
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>{t.notifBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.notifHome}</span>
          </button>
          <div className="mr-auto flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-gray-900">{t.notifTitle}</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center bg-cyan-700 text-white text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full px-1">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-transparent border-none cursor-pointer p-0">
              {t.notifMarkAllRead}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Sub-title */}
        <p className="text-sm text-gray-500 mb-4">
          {t.notifCount.replace('{n}', String(notifs.length))}{unreadCount > 0 ? ` · ${t.notifUnread.replace('{n}', String(unreadCount))}` : ''}
        </p>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {FILTER_CHIPS.map(c => (
            <button key={c.val} onClick={() => setFilter(c.val)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors
                ${filter === c.val ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">🔔</div>
            <div className="text-base font-bold text-gray-700 mb-1">{t.notifEmpty}</div>
            <div className="text-sm">{t.notifEmptyDesc}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => {
              const meta = TYPE_META[n.type] ?? { icon:'🔔', cls:'', group:'' };
              const gc   = GROUP_COLORS[meta.group] ?? 'bg-gray-50 text-gray-700';
              return (
                <button key={n.id} onClick={() => openNotif(n)}
                  className={`w-full text-right flex items-start gap-3 p-4 rounded-xl border transition-all hover:shadow-sm
                    ${n.read ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-blue-50/60 border-blue-200 hover:border-blue-300'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${gc}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold mb-0.5 ${n.read ? 'text-gray-800' : 'text-gray-900'}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-gray-500 leading-relaxed mb-1">{n.body}</div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <span>{fmtRelTime(n.at, t)}</span>
                      {n.orderId && (
                        <span className="font-bold text-cyan-600 font-mono" style={{ direction:'ltr' }}>{n.orderId}</span>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
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
