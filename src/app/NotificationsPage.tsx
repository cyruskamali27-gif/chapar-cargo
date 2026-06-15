import { useState, useEffect } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Store, genId } from '../lib/store';
import { useLang } from '../lib/LangContext';
import type { translations } from './i18n';

type T = typeof translations['en'];

// ── Type metadata (exact from notifications.html) ─────────────────────────────
const TYPE_META: Record<string, { icon: string; cls: string; group: string }> = {
  new_order:          { icon:'📦', cls:'ni-offer',    group:'offer'    },
  offer_received:     { icon:'✈️', cls:'ni-offer',    group:'offer'    },
  offer_accepted:     { icon:'✅', cls:'ni-accepted',  group:'offer'    },
  offer_rejected:     { icon:'✕',  cls:'ni-rejected',  group:'offer'    },
  counter_offer:      { icon:'💬', cls:'ni-counter',   group:'offer'    },
  delivery_confirmed: { icon:'📦', cls:'ni-delivery',  group:'delivery' },
  dispute_update:     { icon:'⚠️', cls:'ni-dispute',  group:'dispute'  },
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
}

function seedDemoNotifs(t: T): Notif[] {
  const now = Date.now();
  return [
    { id: genId('N'), type:'offer_received',     title:t.notifDemoOfferTitle,     body:t.notifDemoOfferBody,     orderId:'CH-12345', at:now-3600000,   read:false },
    { id: genId('N'), type:'offer_accepted',      title:t.notifDemoAcceptedTitle,  body:t.notifDemoAcceptedBody,  orderId:'CH-11111', at:now-7200000,   read:false },
    { id: genId('N'), type:'delivery_confirmed',  title:t.notifDemoDeliveredTitle, body:t.notifDemoDeliveredBody, orderId:'CH-99999', at:now-86400000,  read:true  },
    { id: genId('N'), type:'counter_offer',       title:t.notifDemoCounterTitle,   body:t.notifDemoCounterBody,   orderId:'CH-77777', at:now-172800000, read:false },
    { id: genId('N'), type:'dispute_update',      title:t.notifDemoDisputeTitle,   body:t.notifDemoDisputeBody,   orderId:'CH-55555', at:now-259200000, read:true  },
  ];
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

interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onNavigate: (page: string) => void; }

export default function NotificationsPage({ onHome, onNavigate }: Props) {
  const { t, isRTL } = useLang();
  const [notifs, setNotifs]       = useState<Notif[]>([]);
  const [filter, setFilter]       = useState('');
  const [toast, setToast]         = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    let list = Store.get<Notif[]>('notifications') ?? [];
    if (!list.length) {
      list = seedDemoNotifs(t);
      Store.set('notifications', list);
    }
    setNotifs(list);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markRead(id: string) {
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifs(updated);
    Store.set('notifications', updated);
  }

  function markAllRead() {
    const updated = notifs.map(n => ({ ...n, read: true }));
    setNotifs(updated);
    Store.set('notifications', updated);
    showToast(t.notifAllRead);
  }

  function openNotif(n: Notif) {
    markRead(n.id);
    if (n.type === 'counter_offer') { onNavigate('marketplace'); return; }
    if ((n.type === 'new_order' || n.type === 'offer_received') && n.orderId) { onNavigate('my-orders'); return; }
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
              <span className="inline-flex items-center justify-center bg-cyan-500 text-white text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full px-1">
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
        <p className="text-sm text-gray-400 mb-4">
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
          <div className="text-center py-16 text-gray-400">
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
                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
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
