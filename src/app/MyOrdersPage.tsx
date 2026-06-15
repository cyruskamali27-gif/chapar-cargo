import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Home, Search } from 'lucide-react';
import { Store } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';

// ── Constants (exact from myorders.html) ─────────────────────────────────────
const CARGO_ICONS: Record<string, string> = {
  clothing:'👗', electronics:'💻', documents:'📄', medicine:'💊', food:'🍱', other:'📦',
};
const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  matched:    'bg-blue-50   text-blue-700   border-blue-200',
  in_transit: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered:  'bg-green-50  text-green-700  border-green-200',
  cancelled:  'bg-red-50    text-red-700    border-red-200',
};

interface Order {
  trackId: string; type: string; origin: string; dest: string;
  originLabel?: string; destLabel?: string; cargoType?: string;
  firstName?: string; lastName?: string; weight?: number | null;
  valueUSD?: string; valueToman?: number; valueAmount?: number; valueCurrency?: string;
  recFirstName?: string; recLastName?: string; recPhone?: string; recAddress?: string;
  paidAt?: number; userId?: string; phone?: string; adminStatus?: string;
  date?: string; payMethod?: string; status?: string;
}

interface Props { onBack: () => void; onHome: () => void; t: Record<string, string>; onOpenReceipt: (id: string) => void; }

function fmtDate(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fa-IR', { month:'short', day:'numeric' });
}

export default function MyOrdersPage({ onHome, onOpenReceipt }: Props) {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const STATUS_LABELS: Record<string, string> = {
    pending: t.mordStatusPending, matched: t.mordStatusMatched,
    in_transit: t.mordStatusTransit, delivered: t.mordStatusDelivered, cancelled: t.mordStatusCancelled,
  };
  const [orders, setOrders]           = useState<Order[]>([]);
  const [search, setSearch]           = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo,   setDateTo]         = useState('');
  const [filter,   setFilter]         = useState('');
  const [editOrder, setEditOrder]     = useState<Order | null>(null);
  const [editFirst,  setEditFirst]    = useState('');
  const [editLast,   setEditLast]     = useState('');
  const [editPhone,  setEditPhone]    = useState('');
  const [editAddr,   setEditAddr]     = useState('');
  const [editValue,  setEditValue]    = useState('');
  const [editCurr,   setEditCurr]     = useState('USD');
  const [editErr,    setEditErr]      = useState('');
  const [offersOrder, setOffersOrder] = useState<Order | null>(null);
  const [offers,      setOffers]      = useState<Array<Record<string,unknown>>>([]);
  const [toast,  setToast]            = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadOrders = useCallback(() => {
    const hist     = Store.get<Order[]>('history') ?? [];
    const statuses = Store.get<Record<string,string>>('admin_statuses') ?? {};
    let list = hist.map(o => ({ ...o, adminStatus: statuses[o.trackId] || o.status || 'pending' }));
    if (session) {
      list = list.filter(o =>
        o.userId ? o.userId === session.userId
        : o.phone && session.phone && o.phone.replace(/\D/g,'') === session.phone.replace(/\D/g,'')
      );
    }
    setOrders(list);
  }, [session]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  function getPendingOfferCount(trackId: string) {
    const allOffers = Store.get<Array<{trackId?:string; orderId?:string; status:string}>>('offers') ?? [];
    return allOffers.filter(o => (o.trackId === trackId || o.orderId === trackId) && o.status === 'pending').length;
  }

  const filtered = orders.filter(o => {
    if (filter === 'deleted')    return o.adminStatus === 'deleted';
    if (filter === 'in_transit') return o.adminStatus === 'in_transit' || o.adminStatus === 'matched';
    if (filter)                  return o.adminStatus === filter;
    return o.adminStatus !== 'deleted';
  }).filter(o => {
    if (dateFrom) { const f = new Date(dateFrom).getTime(); if (!o.paidAt || o.paidAt < f) return false; }
    if (dateTo)   { const t = new Date(dateTo + 'T23:59:59').getTime(); if (!o.paidAt || o.paidAt > t) return false; }
    if (search) {
      const q = search.toLowerCase();
      return [o.trackId, o.origin, o.originLabel, o.dest, o.destLabel, o.cargoType, o.firstName, o.lastName]
        .join(' ').toLowerCase().includes(q);
    }
    return true;
  });

  const total     = orders.filter(o => o.adminStatus !== 'deleted').length;
  const pending   = orders.filter(o => o.adminStatus === 'pending').length;
  const transit   = orders.filter(o => o.adminStatus === 'in_transit' || o.adminStatus === 'matched').length;
  const delivered = orders.filter(o => o.adminStatus === 'delivered').length;

  function cancelOrder(trackId: string) {
    if (!confirm(t.mordConfirmCancel.replace('{id}', trackId))) return;
    const statuses = Store.get<Record<string,string>>('admin_statuses') ?? {};
    statuses[trackId] = 'cancelled';
    Store.set('admin_statuses', statuses);
    showToast(t.mordCancelled.replace('{id}', trackId));
    loadOrders();
  }

  function deleteOrder(trackId: string) {
    if (!confirm(t.mordConfirmDelete)) return;
    const statuses = Store.get<Record<string,string>>('admin_statuses') ?? {};
    statuses[trackId] = 'deleted';
    Store.set('admin_statuses', statuses);
    showToast(t.mordDeleted.replace('{id}', trackId));
    loadOrders();
  }

  function openEdit(o: Order) {
    setEditOrder(o);
    setEditFirst(o.recFirstName || ''); setEditLast(o.recLastName || '');
    setEditPhone(o.recPhone || '');     setEditAddr(o.recAddress || '');
    setEditValue(String(o.valueAmount || '')); setEditCurr(o.valueCurrency || 'USD');
    setEditErr('');
  }

  function saveEdit() {
    if (!editOrder) return;
    if (!editFirst || !editLast || !editPhone || !editAddr) { setEditErr(t.mordEditErr); return; }
    const hist = Store.get<Order[]>('history') ?? [];
    const idx  = hist.findIndex(o => o.trackId === editOrder.trackId);
    if (idx !== -1) {
      hist[idx] = { ...hist[idx], recFirstName: editFirst, recLastName: editLast,
        recPhone: editPhone, recAddress: editAddr,
        valueAmount: parseFloat(editValue) || 0, valueCurrency: editCurr,
        updatedAt: Date.now() } as unknown as Order;
      Store.set('history', hist);
    }
    setEditOrder(null);
    showToast(t.mordEdited);
    loadOrders();
  }

  function openOffersModal(o: Order) {
    const allOffers = Store.get<Array<Record<string,unknown>>>('offers') ?? [];
    const orderOffers = allOffers
      .filter(f => f.trackId === o.trackId || f.orderId === o.trackId)
      .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
    setOffers(orderOffers);
    setOffersOrder(o);
  }

  function acceptOffer(offerId: string, trackId: string, tripId: string) {
    if (!confirm(t.mordConfirmAccept)) return;
    const allOffers = Store.get<Array<Record<string,unknown>>>('offers') ?? [];
    const updated = allOffers.map(o => {
      if (o.trackId !== trackId && o.orderId !== trackId) return o;
      return { ...o, status: (o.offerId === offerId || o.id === offerId) ? 'accepted' : 'declined' };
    });
    Store.set('offers', updated);
    const orderTrips = Store.get<Record<string,string>>('order_trips') ?? {};
    orderTrips[trackId] = tripId;
    Store.set('order_trips', orderTrips);
    const hist = Store.get<Order[]>('history') ?? [];
    Store.set('history', hist.map(o => o.trackId === trackId ? { ...o, acceptedOfferId: offerId } as unknown as Order : o));
    setOffersOrder(null);
    window.location.href = '/owner-payment?offerId=' + encodeURIComponent(offerId);
  }

  function declineOffer(offerId: string, trackId: string) {
    const allOffers = Store.get<Array<Record<string,unknown>>>('offers') ?? [];
    Store.set('offers', allOffers.map(o => o.offerId === offerId ? { ...o, status: 'declined' } : o));
    showToast(t.mordOfferDeclined);
    const updated = allOffers.map(o => o.offerId === offerId ? { ...o, status: 'declined' } : o);
    setOffers(updated.filter(f => f.trackId === trackId || f.orderId === trackId).sort((a, b) => (b.createdAt as number) - (a.createdAt as number)));
  }

  const FILTER_CHIPS = [
    { val: '',           label: t.mordFilterAll },
    { val: 'pending',    label: t.mordFilterPending },
    { val: 'in_transit', label: t.mordFilterTransit },
    { val: 'delivered',  label: t.mordFilterDelivered },
    { val: 'cancelled',  label: t.mordFilterCancelled },
    { val: 'deleted',    label: t.mordFilterDeleted },
  ];

  if (!session) return null; // App.tsx renderPage guard redirects to auth

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>{t.mordBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.mordHome}</span>
          </button>
          <div className="mr-auto">
            <h1 className="text-lg font-extrabold text-gray-900">{t.mordTitle}</h1>
            {session && <p className="text-xs text-gray-400">{t.mordGreeting.replace('{name}', session.firstName || '')}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { val: total,     lbl: t.mordStatTotal,     color: 'text-gray-900'   },
            { val: pending,   lbl: t.mordStatPending,   color: 'text-yellow-600' },
            { val: transit,   lbl: t.mordStatTransit,   color: 'text-purple-600' },
            { val: delivered, lbl: t.mordStatDelivered, color: 'text-green-600'  },
          ].map(s => (
            <div key={s.lbl} className="ds-card p-3 text-center">
              <div className={`text-lg font-extrabold ${s.color}`}>{s.val.toLocaleString('fa-IR')}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Search + date */}
        <div className="ds-card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" className="ds-input pr-9" placeholder={t.mordSearch}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ds-label text-[11px]">{t.mordDateFrom}</label>
              <input type="date" className="ds-input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="ds-label text-[11px]">{t.mordDateTo}</label>
              <input type="date" className="ds-input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs font-bold text-cyan-600 hover:underline bg-transparent border-none cursor-pointer p-0">
              {t.mordClearDates}
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_CHIPS.map(c => (
            <button key={c.val} onClick={() => setFilter(c.val)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors
                ${filter === c.val ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <div className="ds-card p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <div className="text-base font-extrabold text-gray-800 mb-1">
              {orders.length === 0 ? t.mordEmptyNone : t.mordEmptyNoResult}
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {orders.length === 0 ? t.mordEmptyNoneDesc : t.mordEmptyNoResultDesc}
            </p>
            {orders.length === 0 && (
              <button onClick={onHome} className="ds-btn-primary px-6 py-2.5 text-sm">{t.mordFirstOrder}</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(o => {
              const icon     = CARGO_ICONS[o.cargoType ?? ''] ?? '📦';
              const st       = o.adminStatus ?? 'pending';
              const stLabel  = STATUS_LABELS[st] ?? t.mordStatusPending;
              const stColor  = STATUS_COLORS[st] ?? STATUS_COLORS.pending;
              const offerCnt = getPendingOfferCount(o.trackId);
              return (
                <motion.div key={o.trackId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="ds-card p-4">
                  <a href={`/track?id=${o.trackId}`}
                    className="flex items-center gap-3 no-underline text-inherit mb-3" style={{ textDecoration:'none', color:'inherit' }}>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg flex-shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-extrabold text-cyan-600 tracking-wider mb-0.5 font-mono">{o.trackId}</div>
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {o.originLabel || o.origin || '—'} ← {o.destLabel || o.dest || '—'}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {o.firstName ? o.firstName + ' ' + (o.lastName || '') + ' · ' : ''}
                        {o.cargoType ? (CARGO_ICONS[o.cargoType] || '') + ' ' + o.cargoType : ''}
                        {o.weight ? ' · ' + o.weight + ' kg' : ''}
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      {o.valueUSD && <div className="text-sm font-bold text-yellow-600 font-mono">$ {parseFloat(o.valueUSD).toFixed(2)}</div>}
                      <div className="text-[11px] text-gray-400 mt-0.5 font-mono">{fmtDate(o.paidAt)}</div>
                    </div>
                  </a>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${stColor}`}>{stLabel}</span>
                    {/* Receipt */}
                    <button onClick={() => onOpenReceipt(o.trackId)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100 transition-colors">
                      {t.mordReceipt}
                    </button>
                    {/* Confirm delivery */}
                    {(st === 'in_transit' || st === 'matched') && (
                      <a href={`/track?id=${o.trackId}&role=receiver`}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors no-underline"
                        style={{ textDecoration:'none' }}>
                        {t.mordConfirmDelivery}
                      </a>
                    )}
                    {/* Chat */}
                    {(st === 'in_transit' || st === 'matched') && (() => {
                      const orderTrips = Store.get<Record<string,string>>('order_trips') ?? {};
                      const tripId = orderTrips[o.trackId];
                      if (!tripId) return null;
                      const trips = Store.get<Array<{id:string; userName?:string}>>('trips') ?? [];
                      const trip  = trips.find(t => t.id === tripId);
                      const name  = trip?.userName || t.mordTraveler;
                      return (
                        <a href={`/chat?order=${encodeURIComponent(o.trackId)}&peer=${encodeURIComponent(tripId)}&name=${encodeURIComponent(name)}&role=sender`}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors no-underline"
                          style={{ textDecoration:'none' }}>
                          {t.mordChat}
                        </a>
                      );
                    })()}
                    {/* Edit */}
                    {st === 'pending' && (
                      <button onClick={() => openEdit(o)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                        {t.mordEdit}
                      </button>
                    )}
                    {/* Cancel */}
                    {st === 'pending' && (
                      <button onClick={() => cancelOrder(o.trackId)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                        {t.mordCancel}
                      </button>
                    )}
                    {/* Delete */}
                    {(st === 'pending' || st === 'cancelled') && (
                      <button onClick={() => deleteOrder(o.trackId)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                        {t.mordDelete}
                      </button>
                    )}
                    {/* Offer badge */}
                    {st === 'pending' && offerCnt > 0 && (
                      <button onClick={() => openOffersModal(o)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-300 text-cyan-700 hover:bg-cyan-100 transition-colors">
                        💼 {offerCnt} {t.mordOffers}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
          onClick={() => setEditOrder(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-gray-900">{t.mordEditTitle.replace('{id}', editOrder.trackId)}</h3>
              <button onClick={() => setEditOrder(null)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ds-label text-[11px]">{t.mordRecFirst}</label>
                  <input className="ds-input text-sm" value={editFirst} onChange={e => setEditFirst(e.target.value)} />
                </div>
                <div>
                  <label className="ds-label text-[11px]">{t.mordRecLast}</label>
                  <input className="ds-input text-sm" value={editLast} onChange={e => setEditLast(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="ds-label text-[11px]">{t.mordRecPhone}</label>
                <input className="ds-input text-sm" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ direction:'ltr' }} />
              </div>
              <div>
                <label className="ds-label text-[11px]">{t.mordRecAddress}</label>
                <input className="ds-input text-sm" value={editAddr} onChange={e => setEditAddr(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ds-label text-[11px]">{t.mordCargoValue}</label>
                  <input type="number" className="ds-input text-sm" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ direction:'ltr' }} />
                </div>
                <div>
                  <label className="ds-label text-[11px]">{t.mordCurrency}</label>
                  <select className="ds-input text-sm" value={editCurr} onChange={e => setEditCurr(e.target.value)}>
                    {['USD','EUR','CAD','GBP','AED','IRR','USDT'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {editErr && <div className="text-sm text-red-600 font-medium">{editErr}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditOrder(null)} className="flex-1 ds-btn-secondary py-2.5">{t.mordCancelBtn}</button>
                <button onClick={saveEdit} className="flex-1 ds-btn-primary py-2.5">{t.mordSave}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offers modal */}
      {offersOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={() => setOffersOrder(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-extrabold text-gray-900">{t.mordOffersTitle}</div>
                  <div className="text-xs text-gray-400">{offersOrder.trackId} · {t.mordOffersCount.replace('{n}', String(offers.length))}</div>
                </div>
                <button onClick={() => setOffersOrder(null)} className="text-gray-400 text-xl leading-none">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 pb-8">
              {offers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">📭</div>
                  <div className="text-sm font-bold">{t.mordNoOffers}</div>
                </div>
              ) : offers.map((offer, i) => {
                const trips = Store.get<Array<{id:string; originCity?:string; origin?:string; destCity?:string; destination?:string; date?:string; capacity?:number}>>('trips') ?? [];
                const trip = trips.find(t => t.id === offer.tripId) ?? null;
                const isPending = offer.status === 'pending';
                const phone = offer.travelerPhone as string | undefined;
                const masked = phone ? phone.slice(0,4) + '████' + phone.slice(-3) : '';
                return (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-cyan-100 flex items-center justify-center text-sm font-extrabold text-cyan-700">
                        {(offer.travelerName as string || t.mordTravelerDefault).charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">{offer.travelerName as string || t.mordTravelerDefault}</div>
                        <div className="text-xs text-gray-400">{masked}</div>
                      </div>
                      <div className="text-sm font-extrabold text-yellow-600">
                        $ {parseFloat(String(offer.price || 0)).toFixed(2)}
                      </div>
                    </div>
                    {trip && (
                      <div className="text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2 mb-3">
                        ✈️ {trip.originCity || trip.origin || '—'} → {trip.destCity || trip.destination || '—'}
                        {trip.date ? ' · ' + trip.date : ''}{trip.capacity ? ' · ' + trip.capacity + ' kg' : ''}
                      </div>
                    )}
                    {offer.message && (
                      <div className="text-xs text-gray-600 border-r-2 border-blue-200 pr-3 py-1 mb-3 leading-relaxed">
                        {offer.message as string}
                      </div>
                    )}
                    {isPending ? (
                      <div className="flex gap-2">
                        <button onClick={() => declineOffer(offer.offerId as string, offersOrder.trackId)}
                          className="flex-1 py-2 text-xs font-bold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                          {t.mordDecline}
                        </button>
                        <button onClick={() => acceptOffer(offer.offerId as string, offersOrder.trackId, offer.tripId as string)}
                          className="flex-2 py-2 text-xs font-bold rounded-lg ds-btn-primary flex-1">
                          {t.mordAccept}
                        </button>
                      </div>
                    ) : (
                      <div className={`text-center text-xs font-bold py-2 ${offer.status === 'accepted' ? 'text-green-600' : 'text-gray-400'}`}>
                        {offer.status === 'accepted' ? t.mordAccepted : t.mordDeclinedLabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
