import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home, Plane, Package as PackageIcon, Star, DollarSign, Globe, Target,
         Compass, Inbox, ClipboardList, Camera, ShoppingBag, X, Globe, Clock } from 'lucide-react';
import { CargoIcon, cargoIcon, RouteArrow, Meta, MetaIcons, Stars } from './flowIcons';
import GuidedCapture from './GuidedCapture';
import TravelerOfferSheet from './TravelerOfferSheet';
import { Store, genId } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';

interface Trip {
  id: string; userId: string; origin: string; originCity?: string;
  destination?: string; destCity?: string; date: string;
  capacity?: number; minPricePerKg?: number; phone?: string;
  cargoOptions?: string[]; description?: string; status: string; createdAt?: number;
  serverTripId?: string;
}
interface Order {
  trackId: string; userId?: string; firstName?: string; lastName?: string;
  origin?: string; dest?: string; originLabel?: string; destLabel?: string;
  cargoType?: string; weight?: number; valueUSD?: string; valueToman?: number; paidAt?: number;
}
interface Offer {
  offerId?: string; id?: string; orderId?: string; trackId?: string;
  tripId?: string; travelerId: string; travelerName?: string; travelerPhone?: string;
  price: number; message?: string; status: string; createdAt: number;
  counterPrice?: number; counterMsg?: string;
}
interface Rating { tripId: string; score: number; }

// CMD-48: categories draw from the shared Lucide map in flowIcons.tsx — no emoji.
const OFFER_STATUS_CLS: Record<string,string> = {
  pending:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  accepted:  'bg-green-50  text-green-700  border-green-200',
  declined:  'bg-red-50    text-red-700    border-red-200',
  countered: 'bg-blue-50   text-blue-700   border-blue-200',
  owner_paid:'bg-amber-50  text-amber-700  border-amber-200',
};

function fmtDate(d: string): string {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fa-IR', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return d; }
}
function fmtShortDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fa-IR', { month:'short', day:'numeric' });
}
function fmtShortNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + ' K';
  return String(n);
}

interface Props { onBack: () => void; onHome: () => void; t: Record<string,string>; onNewTrip: () => void; onNavigate: (page: string) => void; }

// Normalize a server trip record (/api/trips/listings) into the dashboard Trip card shape.
function adaptServerTrip(s: { tripId: string; userId?: string; from?: string; to?: string; date?: string; capacityKg?: number; minPricePerKg?: number; travelerName?: string }): Trip {
  return {
    id:            s.tripId,
    serverTripId:  s.tripId,
    userId:        s.userId || '',
    origin:        s.from || '',
    originCity:    s.from || '',
    destination:   s.to || '',
    destCity:      s.to || '',
    date:          s.date || '',
    capacity:      s.capacityKg ?? undefined,
    minPricePerKg: s.minPricePerKg ?? undefined,
    cargoOptions:  [],
    status:        'active',
  };
}

export default function TravelerDashboardPage({ onHome, onNewTrip, onNavigate }: Props) {
  const { session } = useSession();
  const { t, isRTL } = useLang();
  const CARGO_LABELS: Record<string,string> = {
    personal:t.tdashCargoPersonal, medicine:t.tdashCargoMedicine, documents:t.tdashCargoDocuments,
    clothing:t.tdashCargoClothing, electronics:t.tdashCargoElectronics, gift:t.tdashCargoGift,
  };
  const STATUS_FA: Record<string,string> = {
    pending:t.tdashStatusPending, matched:t.tdashStatusMatched, in_transit:t.tdashStatusTransit,
    delivered:t.tdashStatusDelivered, cancelled:t.tdashStatusCancelled, picked_up:t.tdashStatusPickedUp,
  };
  const OFFER_STATUS_FA: Record<string,string> = {
    pending:t.tdashOfferPending, accepted:t.tdashOfferAccepted, declined:t.tdashOfferDeclined,
    countered:t.tdashOfferCountered, owner_paid:t.tdashOfferPaid,
  };
  const TODAY = new Date().toISOString().split('T')[0];

  const [tab, setTab]             = useState<'trips'|'orders'|'myoffers'|'foryou'>('trips');
  // Deep link from the notifications center (P4.5): land on "پیشنهاد برای شما" when asked.
  useEffect(() => {
    try {
      if (localStorage.getItem('cp_td_tab') === 'foryou') { setTab('foryou'); localStorage.removeItem('cp_td_tab'); }
    } catch { /* ignore */ }
  }, []);

  // S2 suggestions. Nested under /api/marketplace because nginx has no /api/suggest location —
  // see the routing note in orders/server.js.
  const loadSuggestions = useCallback(() => {
    if (!session?.userId) { setSugLoading(false); return; }
    setSugLoading(true);
    fetch(`/api/marketplace/suggest/for-traveler?travelerId=${encodeURIComponent(session.userId)}`)
      .then(r => r.json())
      .then(d => setSug(d.ok ? d : null))
      .catch(() => setSug(null))
      .finally(() => setSugLoading(false));
  }, [session?.userId]);
  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);
  // بازارگاه هوشمند — offers the matcher pushed TO this traveler (not bids they made).
  const [smartOffers, setSmartOffers] = useState<any[]>([]);
  const [actingOffer, setActingOffer] = useState('');
  // بازارگاه هوشمند S2 — ranked open orders that fit this traveler's trips. Read-only: this
  // endpoint writes nothing, so polling or re-fetching it is always safe.
  const [sug, setSug] = useState<any>(null);
  const [sugLoading, setSugLoading] = useState(true);
  const [sugOffer, setSugOffer] = useState<{ orderId: string; product?: { title?: string | null } } | null>(null);
  const [tripView, setTripView]   = useState<'mine'|'market'>('mine'); // sub-view of the trips tab
  const [marketTrips, setMarketTrips] = useState<Trip[]>([]);          // server-backed open trips (all travelers)
  const [myTrips, setMyTrips]     = useState<Trip[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [statuses, setStatuses]   = useState<Record<string,string>>({});
  const [orderTrips, setOrderTrips] = useState<Record<string,string>>({});
  const [ratings, setRatings]     = useState<Rating[]>([]);
  const [offers, setOffers]       = useState<Offer[]>([]);
  const [toast, setToast]         = useState('');
  const [toastOk, setToastOk]     = useState(true);

  // Offer modal state
  const [offerOrder, setOfferOrder]   = useState<Order|null>(null);
  const [offerTripId, setOfferTripId] = useState('');
  const [offerPrice, setOfferPrice]   = useState('');
  const [offerMsg, setOfferMsg]       = useState('');
  const [offerErr, setOfferErr]       = useState('');

  // Edit trip modal state
  const [editTrip, setEditTrip] = useState<Trip|null>(null);
  const [etDate, setEtDate]     = useState('');
  const [etCap, setEtCap]       = useState('');
  const [etMinPx, setEtMinPx]   = useState('');

  // Photo modal state
  const [photoMode, setPhotoMode]   = useState<'pickup'|'delivery'|null>(null);
  const [photoOrd, setPhotoOrd]     = useState('');
  const [photoData, setPhotoData]   = useState<string|null>(null);
  const [photoCamOpen, setPhotoCamOpen] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok); setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(() => {
    if (!session) return;
    const uid = session.userId;
    setMyTrips((Store.get<Trip[]>('trips') ?? []).filter(t => t.userId === uid && t.status !== 'deleted'));
    setAllOrders(Store.get<Order[]>('history') ?? []);
    setStatuses(Store.get<Record<string,string>>('admin_statuses') ?? {});
    setOrderTrips(Store.get<Record<string,string>>('order_trips') ?? {});
    setRatings(Store.get<Rating[]>('ratings') ?? []);
    setOffers(Store.get<Offer[]>('offers') ?? []);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Server-backed market view: every traveler's open trips (read-only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/trips/listings');
        const d = await r.json();
        if (!cancelled && d.ok) setMarketTrips((d.trips || []).map(adaptServerTrip));
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!session) return null; // App.tsx redirects to auth

  // ── Derived data ──────────────────────────────────────────────────────────────
  const activeTrips    = myTrips.filter(t => t.status === 'active' && t.date >= TODAY);
  const tripIds        = new Set(myTrips.map(t => t.id));
  const assignedOrds   = allOrders.filter(o => tripIds.has(orderTrips[o.trackId]));
  const deliveredCount = assignedOrds.filter(o => (statuses[o.trackId] || '') === 'delivered').length;
  const myRatings      = ratings.filter(r => tripIds.has(r.tripId));
  const avgRating      = myRatings.length ? myRatings.reduce((s, r) => s + r.score, 0) / myRatings.length : 0;

  const wallets   = Store.get<Record<string,{txns?:{type:string;amount:number}[]}>>('wallets') ?? {};
  const earnings  = (wallets[session.phone]?.txns ?? [])
    .filter(tx => tx.type === 'received').reduce((s, tx) => s + (tx.amount || 0), 0);

  const myOfferTrackIds = new Set(
    offers.filter(o => o.travelerId === session.userId).map(o => o.trackId || o.orderId || '')
  );
  const openOrders = allOrders.filter(o => {
    const st = statuses[o.trackId] || 'pending';
    return st === 'pending' && !myOfferTrackIds.has(o.trackId);
  });
  const myOffers         = offers.filter(o => o.travelerId === session.userId).sort((a, b) => b.createdAt - a.createdAt);
  const pendingOfferCount = myOffers.filter(o => o.status === 'pending').length;

  const sortedTrips = myTrips.slice().sort((a, b) => {
    const aA = a.status === 'active' && a.date >= TODAY;
    const bA = b.status === 'active' && b.date >= TODAY;
    if (aA && !bA) return -1;
    if (!aA && bA) return  1;
    return b.date.localeCompare(a.date);
  });

  // ── Actions ───────────────────────────────────────────────────────────────────
  function openOfferModal(order: Order) {
    setOfferOrder(order);
    setOfferTripId(activeTrips[0]?.id || '');
    setOfferPrice(''); setOfferMsg(''); setOfferErr('');
  }

  function submitOffer() {
    if (!offerTripId)          { setOfferErr(t.tdashErrTrip); return; }
    const price = parseFloat(offerPrice) || 0;
    if (!price || price <= 0)  { setOfferErr(t.tdashErrPrice); return; }
    if (!offerOrder) return;
    const trip = myTrips.find(t => t.id === offerTripId);
    const oid  = genId('OF');
    const offer: Offer = {
      offerId: oid, id: oid,
      trackId: offerOrder.trackId, orderId: offerOrder.trackId,
      tripId: offerTripId,
      travelerId: session.userId,
      travelerName: (session.firstName + ' ' + session.lastName).trim(),
      travelerPhone: trip?.phone || session.phone || '',
      price, message: offerMsg.trim(), status: 'pending', createdAt: Date.now(),
    };
    const all = Store.get<Offer[]>('offers') ?? [];
    all.unshift(offer);
    Store.set('offers', all.slice(0, 500));

    const notifs = Store.get<object[]>('notifications') ?? [];
    notifs.unshift({ id: genId('N'), type: 'offer_received',
      title: t.tdashNotifTitle,
      body: t.tdashNotifBody.replace('{name}', offer.travelerName ?? '').replace('{id}', offer.orderId ?? ''),
      orderId: offer.orderId, offerId: oid, at: Date.now(), read: false });
    Store.set('notifications', notifs.slice(0, 200));

    setOfferOrder(null);
    showToast(t.tdashOfferSent);
    loadData(); setTab('myoffers');
  }

  function acceptCounterOffer(offerId: string) {
    if (!confirm(t.tdashConfirmCounter)) return;
    let all = Store.get<Offer[]>('offers') ?? [];
    all = all.map(o => o.offerId !== offerId ? o : { ...o, status: 'accepted', price: o.counterPrice ?? o.price });
    Store.set('offers', all);
    const offer = all.find(o => o.offerId === offerId);
    if (offer) {
      const ot = Store.get<Record<string,string>>('order_trips') ?? {};
      ot[offer.trackId || offer.orderId || ''] = offer.tripId || '';
      Store.set('order_trips', ot);
      const st = Store.get<Record<string,string>>('admin_statuses') ?? {};
      st[offer.trackId || offer.orderId || ''] = 'matched';
      Store.set('admin_statuses', st);
    }
    showToast(t.tdashCounterAccepted); loadData();
  }

  function rejectCounterOffer(offerId: string) {
    let all = Store.get<Offer[]>('offers') ?? [];
    all = all.map(o => o.offerId !== offerId ? o : { ...o, status: 'declined' });
    Store.set('offers', all);
    showToast(t.tdashCounterRejected, false); loadData();
  }

  async function doDeleteTrip(trip: Trip) {
    if (!confirm(t.tdashConfirmDeleteTrip)) return;
    const all = Store.get<Trip[]>('trips') ?? [];
    Store.set('trips', all.map(tr => tr.id === trip.id ? { ...tr, status: 'deleted' } : tr));
    if (trip.serverTripId) {
      try {
        await fetch('/api/trips/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: trip.serverTripId, userId: session.userId }),
        });
      } catch { /* non-fatal */ }
    }
    showToast(t.tdashTripDeleted, false); loadData();
  }

  function openEditModal(trip: Trip) {
    const hasMatchedOrd = assignedOrds.some(o => {
      const st = statuses[o.trackId] || '';
      return (st === 'matched' || st === 'in_transit') &&
        offers.some(of => of.orderId === o.trackId && of.travelerId === session.userId && of.status === 'accepted');
    });
    if (hasMatchedOrd) { showToast(t.tdashEditLocked, false); return; }
    setEditTrip(trip);
    setEtDate(trip.date || '');
    setEtCap(String(trip.capacity ?? ''));
    setEtMinPx(String(trip.minPricePerKg ?? ''));
  }

  async function saveEdit() {
    if (!etDate || !editTrip) { showToast(t.tdashErrDate, false); return; }
    const edited = editTrip;
    const all = Store.get<Trip[]>('trips') ?? [];
    Store.set('trips', all.map(tr => tr.id !== edited.id ? tr : {
      ...tr, date: etDate,
      capacity: parseFloat(etCap) || undefined,
      minPricePerKg: parseFloat(etMinPx) || undefined,
      updatedAt: Date.now(),
    }));
    if (edited.serverTripId) {
      try {
        await fetch('/api/trips/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: edited.serverTripId, userId: session.userId,
            date: etDate,
            capacityKg: parseFloat(etCap) || null,
            minPricePerKg: parseFloat(etMinPx) || null,
          }),
        });
      } catch { /* non-fatal */ }
    }
    setEditTrip(null); showToast(t.tdashTripEdited); loadData();
  }

  function openPickup(ordId: string)   { setPhotoMode('pickup');   setPhotoOrd(ordId); setPhotoData(null); setPhotoCamOpen(false); }
  function openDelivery(ordId: string) { setPhotoMode('delivery'); setPhotoOrd(ordId); setPhotoData(null); setPhotoCamOpen(false); }

  function submitPhoto() {
    if (!photoData) { showToast(t.tdashErrPhoto, false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracking: any[] = Store.get('_test_tracking') ?? [];
    let idx = tracking.findIndex((t: { orderId?: string; trackId?: string }) => t.orderId === photoOrd || t.trackId === photoOrd);
    if (idx === -1) { tracking.push({ orderId: photoOrd, trackId: photoOrd }); idx = tracking.length - 1; }
    const entry = tracking[idx];
    const st = Store.get<Record<string,string>>('admin_statuses') ?? {};
    if (photoMode === 'pickup') {
      Object.assign(entry, { pickupPhoto: true, pickupPhotoAt: Date.now(), pickupPhotoData: 'captured' });
      st[photoOrd] = 'picked_up';
      showToast(t.tdashPickupConfirmed);
    } else {
      Object.assign(entry, { deliveryPhoto: true, deliveryPhotoAt: Date.now(), deliveryPhotoData: 'captured' });
      st[photoOrd] = 'delivered';
      showToast(t.tdashDeliveryConfirmed);
    }
    Store.set('admin_statuses', st);
    Store.set('_test_tracking', tracking);
    setPhotoMode(null); setPhotoData(null); loadData();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // ── بازارگاه هوشمند ────────────────────────────────────────────────────────
  const MARKET_FA: Record<string,{flag:string;name:string}> = {
    AE:{flag:'🇦🇪',name:'امارات'}, CA:{flag:'🇨🇦',name:'کانادا'}, US:{flag:'🇺🇸',name:'آمریکا'},
    GB:{flag:'🇬🇧',name:'انگلیس'}, TR:{flag:'🇹🇷',name:'ترکیه'}, DE:{flag:'🇩🇪',name:'آلمان'}, FR:{flag:'🇫🇷',name:'فرانسه'},
  };
  const loadSmartOffers = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const r = await fetch(`/api/offers?travelerId=${encodeURIComponent(session.userId)}&status=sent`);
      const d = await r.json();
      setSmartOffers(d.ok ? (d.offers || []) : []);
    } catch { setSmartOffers([]); }
  }, [session?.userId]);
  useEffect(() => { loadSmartOffers(); }, [loadSmartOffers]);

  async function respondOffer(offerId: string, action: 'accept' | 'decline') {
    if (!session?.userId || actingOffer) return;
    setActingOffer(offerId);
    try {
      const r = await fetch(`/api/offers/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, travelerId: session.userId }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setToastOk(true);
        setToast(action === 'accept' ? 'پذیرفتید — خریدار باید تأیید کند' : 'رد شد');
      } else if (r.status === 409) {
        // Lost the race. This is a normal outcome of a broadcast, not an error — say so plainly.
        setToastOk(false);
        setToast(d.message || 'این سفارش توسط مسافر دیگری پذیرفته شد');
      } else {
        setToastOk(false); setToast('انجام نشد — دوباره تلاش کنید');
      }
    } catch { setToastOk(false); setToast('ارتباط برقرار نشد'); }
    setActingOffer('');
    loadSmartOffers();
  }

  function expiryLabel(iso: string) {
    const ms = Date.parse(iso) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 'منقضی شد';
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h >= 1 ? `${h} ساعت تا انقضا` : `${m} دقیقه تا انقضا`;
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="ds-nav-btn group">
            <ArrowLeft className="w-4 h-4" /><span>{t.tdashBack}</span>
          </button>
          <button onClick={onHome} className="ds-nav-btn ds-nav-btn-home">
            <Home className="w-4 h-4" /><span>{t.tdashHome}</span>
          </button>
          <div className="mr-auto">
            <h1 className="text-base font-extrabold text-gray-900">{t.tdashTitle}</h1>
            <p className="text-xs text-gray-500">{t.tdashGreeting.replace('{name}', session.firstName || '')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { Icon:Plane,   val:myTrips.length,                      lbl:t.tdashStatTrips,     cls:'text-blue-600'  },
            { Icon:PackageIcon, val:deliveredCount,                  lbl:t.tdashStatDelivered, cls:'text-green-600' },
            { Icon:Star,    val:avgRating > 0 ? avgRating.toFixed(1) : '—', lbl:t.tdashStatRating, cls:'text-amber-600' },
            { Icon:DollarSign, val:earnings > 0 ? fmtShortNum(earnings) : '—', lbl:t.tdashStatEarnings, cls:'text-green-600' },
          ].map(s => (
            <div key={s.lbl} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <s.Icon className={`w-6 h-6 mx-auto mb-1.5 ${s.cls}`} aria-hidden />
              <div className={`text-2xl font-extrabold mb-0.5 ${s.cls}`}>{s.val}</div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* New trip CTA */}
        <button onClick={onNewTrip}
          className="w-full ds-btn-primary py-3 flex items-center justify-center gap-2 mb-5 rounded-xl text-sm font-bold">
          {t.tdashNewTrip}
        </button>


        {/* Tab bar */}
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1.5 mb-5">
          {([
            { key:'trips',    label:t.tdashTabTrips,  badge:0,                  badgeCls:'' },
            { key:'orders',   label:t.tdashTabOrders, badge:openOrders.length,  badgeCls:'' },
            { key:'myoffers', label:t.tdashTabOffers, badge:pendingOfferCount,  badgeCls:'bg-amber-500' },
            { key:'foryou',   label:'پیشنهاد برای شما', badge:smartOffers.length, badgeCls:'bg-emerald-600' },
          ] as const).map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all
                ${tab === tb.key ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tb.label}
              {tb.badge > 0 && (
                <span className={`text-[9px] font-extrabold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-white ${tb.badgeCls || 'bg-cyan-500'}`}>
                  {tb.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tab: My Trips ─── */}
        {tab === 'trips' && (
          <>
          <div dir="rtl" className="mb-4 flex gap-2">
            <button onClick={() => setTripView('mine')}
              className={"rounded-full px-4 py-1.5 text-sm font-bold border " + (tripView === 'mine' ? "bg-cyan-50 text-cyan-700 border-cyan-300" : "bg-white text-gray-500 border-gray-200")}>سفرهای من</button>
            <button onClick={() => setTripView('market')}
              className={"rounded-full px-4 py-1.5 text-sm font-bold border " + (tripView === 'market' ? "bg-cyan-50 text-cyan-700 border-cyan-300" : "bg-white text-gray-500 border-gray-200")}>بازار سفرها</button>
          </div>
          {tripView === 'mine' ? (
          sortedTrips.length === 0 ? (
            /* One account = all roles: a user with no trips is not "not a traveler" — they are a
               traveler who hasn't registered a trip yet. Empty state with the CTA that fills it,
               never a block. */
            <div className="text-center py-12">
              <Plane className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">{t.tdashNoTrips}</div>
              <div className="text-sm text-gray-500 mb-1">{t.tdashNoTripsDesc}</div>
              <div className="text-xs text-gray-500 mb-5 max-w-xs mx-auto leading-relaxed">
                سفر خود را ثبت کنید تا سفارش‌های هم‌مسیر برای شما پیشنهاد شود.
              </div>
              <button onClick={onNewTrip}
                className="px-6 py-2.5 rounded-xl bg-cyan-700 text-white text-sm font-bold">
                ثبت اولین سفر
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTrips.map(trip => {
                const isActive    = trip.status === 'active' && trip.date >= TODAY;
                const isPending   = trip.status === 'pending';
                const tripRatings = myRatings.filter(r => r.tripId === trip.id);
                const tripAvg     = tripRatings.length ? tripRatings.reduce((s, r) => s + r.score, 0) / tripRatings.length : 0;
                const tripOrds    = assignedOrds.filter(o => orderTrips[o.trackId] === trip.id);
                return (
                  <div key={trip.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${isActive ? 'border-blue-200' : isPending ? 'border-amber-200' : 'border-gray-100 opacity-70'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-base font-extrabold text-gray-900">
                          {trip.originCity || trip.origin || '—'} <RouteArrow mode={trip.mode} isRTL /> {trip.destCity || trip.destination || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono tracking-wide mt-0.5">{trip.id}</div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        isActive  ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : isPending ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>{isActive ? t.tdashTripActive : isPending ? t.tdashTripPending : t.tdashTripPast}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                      <Meta icon={MetaIcons.Date}>{fmtDate(trip.date)}</Meta>
                      {trip.capacity != null   && <Meta icon={MetaIcons.Weight}>{trip.capacity} kg</Meta>}
                      {trip.minPricePerKg != null && <Meta icon={MetaIcons.Price}>{Number(trip.minPricePerKg).toFixed(2)}</Meta>}
                      {trip.phone             && <Meta icon={MetaIcons.Phone}>{trip.phone}</Meta>}
                    </div>
                    {trip.cargoOptions && trip.cargoOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {trip.cargoOptions.map(opt => (
                          <span key={opt} className="text-[11px] bg-blue-50 border border-blue-100 text-blue-700 font-bold rounded-lg px-2 py-0.5">
                            <CargoIcon type={opt} className="w-3 h-3 inline-block align-middle me-1" />{CARGO_LABELS[opt] || opt}
                          </span>
                        ))}
                      </div>
                    )}
                    {tripAvg > 0 && (
                      <div className="text-sm text-amber-500 mb-2">
                        <Stars value={tripAvg} />
                        <span className="font-bold text-amber-600 mr-1">{tripAvg.toFixed(1)}</span>
                        <span className="text-xs text-gray-500">({tripRatings.length} {t.tdashReviews})</span>
                      </div>
                    )}
                    {tripOrds.length > 0 ? (
                      <div className="space-y-1.5 mb-2">
                        <div className="text-xs font-bold text-gray-500">{t.tdashAssignedOrders.replace('{n}', String(tripOrds.length))}</div>
                        {tripOrds.map(o => {
                          const st      = statuses[o.trackId] || '';
                          const canChat = st === 'matched' || st === 'in_transit';
                          const canPick = st === 'matched';
                          const canDel  = st === 'in_transit' || st === 'picked_up';
                          return (
                            <div key={o.trackId} className="space-y-1">
                              <a href={`/track?id=${o.trackId}`}
                                className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 no-underline hover:bg-blue-100 transition-colors">
                                <CargoIcon type={o.cargoType} className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-extrabold text-blue-700 font-mono">{o.trackId}</div>
                                  <div className="text-xs text-gray-500">{o.originLabel || o.origin || '—'} ← {o.destLabel || o.dest || '—'}</div>
                                </div>
                                <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                  {STATUS_FA[st] || '—'}
                                </span>
                              </a>
                              {canChat && (
                                <a href={`/film-preview.html?page=chat&order=${encodeURIComponent(o.trackId)}&name=${encodeURIComponent((o.firstName||'')+' '+(o.lastName||''))}&role=traveler`}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl no-underline hover:bg-blue-100 transition-colors">
                                  {t.tdashChatSender}
                                </a>
                              )}
                              {canPick && (
                                <button onClick={() => openPickup(o.trackId)}
                                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-xl hover:bg-green-100 transition-colors">
                                  {t.tdashConfirmPickup}
                                </button>
                              )}
                              {canDel && (
                                <button onClick={() => openDelivery(o.trackId)}
                                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition-colors">
                                  {t.tdashConfirmDelivery}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 mb-2">{t.tdashNoAssigned}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {isActive && (
                        <button onClick={() => openEditModal(trip)}
                          className="flex-1 h-9 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors">
                          {t.tdashEdit}
                        </button>
                      )}
                      <button onClick={() => doDeleteTrip(trip)}
                        className="flex-1 h-9 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors">
                        {t.tdashDelete}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
          ) : (
          marketTrips.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">{t.tdashNoTrips}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {marketTrips.map(trip => {
                const owned = trip.userId === session.userId;
                return (
                  <div key={trip.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-base font-extrabold text-gray-900">
                          {trip.originCity || trip.origin || '—'} <RouteArrow mode={trip.mode} isRTL /> {trip.destCity || trip.destination || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono tracking-wide mt-0.5">{trip.id}</div>
                      </div>
                      {owned && <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200">{t.tdashTripActive}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <Meta icon={MetaIcons.Date}>{fmtDate(trip.date)}</Meta>
                      {trip.capacity != null && <Meta icon={MetaIcons.Weight}>{trip.capacity} kg</Meta>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
          )}
          </>
        )}

        {/* ─── Tab: Open Orders ─── */}
        {/* ── بازارگاه هوشمند — offers the matcher pushed to this traveler ────────
            The cross-country case is the point: the buyer wanted country X, nobody flies from X,
            so we ask this traveler to bring it from THEIRS. Colors follow Rule 20 (gray-500 /
            cyan-700 / emerald-700 on white — all ≥4.5:1). */}
        {tab === 'foryou' && (<>
          {smartOffers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-10 h-10 mx-auto mb-2 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">فعلاً پیشنهادی نیست</div>
              <div className="text-sm">وقتی سفارشی با مسیر شما بخورد، همین‌جا نشان داده می‌شود.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {smartOffers.map(o => {
                const ord   = o.order || {};
                const q     = ord.priceQuote;
                const cross = o.kind === 'cross_country';
                const want  = o.buyerCountry ? MARKET_FA[o.buyerCountry] : null;
                const mine  = MARKET_FA[o.fromCountry] || { flag: '', name: o.fromCountry };
                const busy  = actingOffer === o.offerId;
                return (
                  <div key={o.offerId} className={`bg-white border rounded-2xl p-4 shadow-sm ${cross ? 'border-emerald-200' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      {ord.image
                        ? <img src={ord.image} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                        : <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0"><PackageIcon className="w-6 h-6 text-gray-400" aria-hidden /></div>}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold text-gray-900 truncate">{ord.title || '—'}</div>
                        <div className="text-[10px] text-gray-500 font-mono tracking-wide mt-0.5">{o.orderId}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          وزن: {o.weightUnknown ? 'نامشخص' : `${o.estWeightKg} کیلوگرم`}
                        </div>
                      </div>
                    </div>

                    {/* The cross-country ask — the whole reason this feature exists. */}
                    {cross && want && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 mb-3">
                        <div className="text-xs font-bold text-emerald-800 mb-1">
                          از کشور خودت بیاور؟ {mine.flag}
                        </div>
                        <div className="text-xs text-emerald-700 leading-relaxed">
                          خریدار {want.flag} {want.name} را انتخاب کرده بود، ولی مسافری از آنجا نیست.
                          اگر بپذیرید، قیمت {mine.name} برای خریدار محاسبه و به او پیشنهاد می‌شود.
                        </div>
                      </div>
                    )}
                    {!cross && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 mb-3 text-xs text-gray-600">
                        {o.buyerCountry
                          ? `خریدار ${MARKET_FA[o.buyerCountry]?.name || o.buyerCountry} را می‌خواهد — همان کشور مبدأ شماست.`
                          : 'خریدار کشور خاصی تعیین نکرده — مسیر شما مناسب است.'}
                      </div>
                    )}

                    {/* The buyer's accepted quote — an ESTIMATE, never the final price. */}
                    {q && (
                      <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 mb-2">
                        <span className="text-base leading-none">{MARKET_FA[q.country]?.flag || <Globe className="w-4 h-4 inline-block text-gray-400" aria-hidden />}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-gray-900">
                            ${q.priceUSD}
                            {q.shop && <span className="font-normal text-gray-500"> · {q.shop}</span>}
                          </div>
                          <div className="text-[10px] text-gray-500">قیمتی که خریدار پذیرفته — تخمینی، بدون مالیات و حمل</div>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500 mb-3 flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden />{expiryLabel(o.expiresAt)}</div>

                    <div className="flex gap-2">
                      <button disabled={busy} onClick={() => respondOffer(o.offerId, 'accept')}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
                        {busy ? 'در حال ثبت…' : 'می‌آورم'}
                      </button>
                      <button disabled={busy} onClick={() => respondOffer(o.offerId, 'decline')}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold disabled:opacity-50">
                        نه
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                      قیمت نهایی را خودتان پیشنهاد می‌دهید — این عدد فقط مبنای خریدار است.
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── بازارگاه هوشمند S2 — کالاهای پیشنهادی مسیر شما ──────────────────
              SUGGESTIONS, not offers. The block above is what the matcher pushed at this
              traveler and is a live commitment they can accept or decline. This block is a
              browse aid: nothing has been offered, nothing is reserved, and the ranking is
              read-only. Committing goes through the CMD-16 sheet, exactly as it does from the
              marketplace — same component, one implementation. */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="mb-1 text-base font-extrabold text-gray-900">کالاهای پیشنهادی مسیر شما</div>
            <p className="mb-4 text-xs text-gray-500 leading-relaxed">
              این‌ها هنوز پیشنهاد نشده‌اند — سفارش‌های بازی هستند که با مسیر و ظرفیت سفر شما می‌خوانند.
            </p>

            {sugLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">در حال بررسی مسیرهای شما…</div>
            ) : !sug ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                فهرست پیشنهادها در دسترس نیست — بعداً دوباره تلاش کنید.
              </div>
            ) : sug.items.length === 0 ? (
              /* The two empties are DIFFERENT problems with different fixes — "you have no
                 trips" must not be shown to someone who has trips that simply match nothing. */
              <div className="text-center py-8">
                <Compass className="w-10 h-10 mx-auto mb-2 text-gray-300" aria-hidden />
                <div className="text-sm font-bold text-gray-700 mb-1">
                  {sug.note?.startsWith('no open trips') ? 'هنوز سفری ثبت نکرده‌اید' : 'سفارشی مناسب مسیر شما نیست'}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto mb-4">
                  {sug.note?.startsWith('no open trips')
                    ? 'سفر خود را ثبت کنید تا سفارش‌های هم‌مسیر این‌جا نشان داده شود.'
                    : 'به‌محض اینکه سفارشی با مسیر و ظرفیت شما بخورد، همین‌جا اضافه می‌شود.'}
                </p>
                {sug.note?.startsWith('no open trips') && (
                  <button onClick={onNewTrip} className="px-5 py-2 rounded-xl bg-cyan-700 text-white text-sm font-bold">ثبت سفر</button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sug.items.map((s: any) => {
                  const cross = s.kind === 'cross_country';
                  const from  = MARKET_FA[s.fromCountry] || { flag: '', name: s.fromCountry };
                  return (
                    <div key={s.orderId} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        {s.product?.image
                          ? <img src={s.product.image} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                          : <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-6 h-6 text-gray-400" aria-hidden /></div>}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-extrabold text-gray-900 truncate">{s.product?.title || '—'}</div>
                          <div className="text-[10px] text-gray-500 font-mono tracking-wide mt-0.5">{s.orderId}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${cross ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {cross ? 'کشور متفاوت' : 'مسیر مستقیم'}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {from.flag} {from.name} ← {s.destCountry}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-2">
                          <div className="text-[10px] text-gray-500 mb-0.5">ارزش کالا</div>
                          <div className="text-xs font-extrabold text-gray-900">
                            {s.rewardProxyUSD != null ? `$${s.rewardProxyUSD}` : '—'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-2">
                          <div className="text-[10px] text-gray-500 mb-0.5">وزن / ظرفیت</div>
                          <div className="text-xs font-extrabold text-gray-900">
                            {s.weightUnknown ? 'نامشخص' : `${s.estWeightKg} از ${s.remainingKg ?? '—'} kg`}
                          </div>
                          {/* The capacity-fit figure above is driven by estWeightKg, which for most
                              open orders is the CMD-46 estimator's output rather than a declared
                              weight. Say so — a traveler planning around "0.95 kg" deserves to know
                              it was inferred. Only for source 'ai_estimate': orders whose weight
                              came from elsewhere must not be labelled an estimate. */}
                          {!s.weightUnknown && s.estWeightSource === 'ai_estimate' && (
                            <div className="text-[9px] font-normal text-gray-400 leading-tight">تخمینی</div>
                          )}
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-2">
                          <div className="text-[10px] text-gray-500 mb-0.5">ثبت شده</div>
                          <div className="text-xs font-extrabold text-gray-900">
                            {s.ageDays != null ? `${s.ageDays} روز پیش` : '—'}
                          </div>
                        </div>
                      </div>

                      {s.specialRequest && (
                        <div className="mb-3 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 leading-relaxed">
                          {s.specialRequest}
                        </div>
                      )}

                      {/* The handoff: browse → commit. Same sheet the marketplace opens. */}
                      <button onClick={() => setSugOffer({ orderId: s.orderId, product: { title: s.product?.title } })}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-700 to-blue-700 text-white text-sm font-bold">
                        پیشنهاد می‌دهم
                      </button>
                      <div className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                        قیمت نهایی کالا را چاپار برای کشور شما استعلام می‌کند — دستمزد خود را در گام بعد وارد می‌کنید.
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>)}

        {tab === 'orders' && (
          activeTrips.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Plane className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">{t.tdashNoActiveTrip}</div>
              <p className="text-sm mb-4">{t.tdashNoActiveTripDesc}</p>
              <button onClick={onNewTrip} className="ds-btn-primary px-6 py-2.5 text-sm">{t.tdashNewTrip}</button>
            </div>
          ) : openOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">{t.tdashNoOpenOrders}</div>
              <div className="text-sm">{t.tdashNoOpenOrdersDesc}</div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-bold text-gray-500 mb-3">{t.tdashOpenForOffers.replace('{n}', String(openOrders.length))}</div>
              <div className="space-y-3">
                {openOrders.map(o => {
                  const OrdIcon = cargoIcon(o.cargoType);
                  const val  = o.valueUSD  ? `$ ${parseFloat(o.valueUSD).toFixed(0)}`
                             : o.valueToman ? Number(o.valueToman).toLocaleString('fa-IR') + ' ت' : '';
                  return (
                    <div key={o.trackId} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-cyan-200 transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0"><OrdIcon className="w-5 h-5 text-blue-600" aria-hidden /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-extrabold text-gray-900">{o.originLabel || o.origin || '—'} <RouteArrow isRTL /> {o.destLabel || o.dest || '—'}</div>
                          <div className="text-[10px] text-gray-500 font-mono tracking-wide">{o.trackId}</div>
                        </div>
                        {val && <div className="text-sm font-extrabold text-amber-600 flex-shrink-0">{val}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                        {o.cargoType && <Meta icon={cargoIcon(o.cargoType)}>{o.cargoType}</Meta>}
                        {o.weight    && <Meta icon={MetaIcons.Weight}>{o.weight} kg</Meta>}
                        {o.paidAt    && <Meta icon={MetaIcons.Date}>{fmtShortDate(o.paidAt)}</Meta>}
                      </div>
                      <button onClick={() => openOfferModal(o)}
                        className="w-full ds-btn-primary py-2.5 text-sm rounded-xl">
                        {t.tdashSendOffer}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ─── Tab: My Offers ─── */}
        {tab === 'myoffers' && (
          myOffers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-base font-bold text-gray-700 mb-1">{t.tdashNoOffers}</div>
              <div className="text-sm">{t.tdashNoOffersDesc}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map(offer => {
                const order = allOrders.find(o => o.trackId === (offer.trackId || offer.orderId));
                const trip  = myTrips.find(t => t.id === offer.tripId);
                const stCls = OFFER_STATUS_CLS[offer.status] || 'bg-gray-50 text-gray-600 border-gray-200';
                const stLbl = OFFER_STATUS_FA[offer.status] || '—';
                return (
                  <div key={offer.offerId || offer.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-extrabold text-gray-900">
                          {order?.originLabel || order?.origin || '—'} <RouteArrow isRTL /> {order?.destLabel || order?.dest || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">{offer.trackId || offer.orderId}</div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${stCls}`}>{stLbl}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-bold text-amber-600">$ {parseFloat(String(offer.price)).toFixed(2)} USD</span>
                      {trip?.date && <span className="mr-2">· {t.tdashTripLabel} {fmtDate(trip.date)}</span>}
                      {trip?.origin && <span className="mr-2">· {trip.originCity || trip.origin} → {trip.destCity || trip.destination}</span>}
                    </div>
                    {offer.message && (
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-2 leading-relaxed">{offer.message}</div>
                    )}
                    {offer.status === 'owner_paid' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                        <div className="text-xs font-bold text-amber-700 mb-2">{t.tdashOwnerPaid}</div>
                        <a href={`/traveler-deposit?offerId=${offer.offerId || offer.id}`}
                          className="flex items-center justify-center gap-1 bg-amber-500 text-white text-xs font-extrabold rounded-xl py-2 no-underline hover:opacity-90">
                          {t.tdashPayDeposit}
                        </a>
                      </div>
                    )}
                    {offer.status === 'accepted' && (
                      <a href={`/track?id=${offer.trackId || offer.orderId}`}
                        className="flex items-center justify-center gap-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-xl py-2 mb-2 no-underline hover:bg-green-100">
                        {t.tdashViewOrder}
                      </a>
                    )}
                    {offer.status === 'countered' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <div className="text-xs font-bold text-blue-700 mb-1">{t.tdashCounterTitle}</div>
                        <div className="text-lg font-extrabold text-amber-600 mb-1">
                          $ {parseFloat(String(offer.counterPrice || 0)).toFixed(2)} USD
                        </div>
                        {offer.counterMsg && <div className="text-xs text-gray-500 mb-2 leading-relaxed">{offer.counterMsg}</div>}
                        <div className="flex gap-2">
                          <button onClick={() => rejectCounterOffer(offer.offerId || offer.id || '')}
                            className="flex-1 py-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors">
                            {t.tdashCounterReject}
                          </button>
                          <button onClick={() => acceptCounterOffer(offer.offerId || offer.id || '')}
                            className="flex-[2] py-2 ds-btn-primary text-xs rounded-xl">
                            {t.tdashCounterAccept}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ─── Offer Modal ─── */}
      {offerOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setOfferOrder(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold">{t.tdashOfferModalTitle}</h3>
              <button onClick={() => setOfferOrder(null)} className="text-gray-500 text-xl font-bold hover:text-gray-700" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-3">
              <CargoIcon type={offerOrder.cargoType} className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{offerOrder.originLabel || offerOrder.origin || '—'} <RouteArrow isRTL /> {offerOrder.destLabel || offerOrder.dest || '—'}</div>
                <div className="text-[10px] text-gray-500 font-mono">{offerOrder.trackId}</div>
              </div>
              {offerOrder.valueUSD && <div className="text-sm font-bold text-amber-600">$ {parseFloat(offerOrder.valueUSD).toFixed(0)}</div>}
            </div>
            <div className="mb-3">
              <label className="ds-label block mb-1">{t.tdashRelatedTrip}</label>
              <select value={offerTripId} onChange={e => setOfferTripId(e.target.value)} className="ds-input w-full">
                {activeTrips.map(tr => (
                  <option key={tr.id} value={tr.id}>
                    {tr.originCity || tr.origin} → {tr.destCity || tr.destination} ({tr.date})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="ds-label block mb-1">{t.tdashOfferPrice}</label>
              <input type="number" value={offerPrice} onChange={e => setOfferPrice(e.target.value)}
                placeholder={t.tdashOfferPricePlaceholder} min="0" className="ds-input w-full" style={{ direction: 'ltr' }} />
            </div>
            <div className="mb-4">
              <label className="ds-label block mb-1">{t.tdashOfferMsg}</label>
              <textarea value={offerMsg} onChange={e => setOfferMsg(e.target.value)}
                placeholder={t.tdashOfferMsgPlaceholder} className="ds-input w-full min-h-[72px] resize-none" />
            </div>
            {offerErr && (
              <div className="text-xs text-red-600 font-bold mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{offerErr}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setOfferOrder(null)} className="flex-1 ds-btn-secondary py-2.5">{t.tdashCancel}</button>
              <button onClick={submitOffer} className="flex-[2] ds-btn-primary py-2.5">{t.tdashSubmitOffer}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Trip Modal ─── */}
      {editTrip && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setEditTrip(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-extrabold">{t.tdashEditTripTitle}</h3>
              <button onClick={() => setEditTrip(null)} className="text-gray-500 text-xl font-bold hover:text-gray-700" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <div className="text-[10px] text-gray-500 font-mono mb-4">{editTrip.id}</div>
            <div className="mb-3">
              <label className="ds-label block mb-1">{t.tdashTripDate}</label>
              <input type="date" value={etDate} onChange={e => setEtDate(e.target.value)} className="ds-input w-full" style={{ direction: 'ltr' }} />
            </div>
            <div className="mb-3">
              <label className="ds-label block mb-1">{t.tdashCapacity}</label>
              <input type="number" value={etCap} onChange={e => setEtCap(e.target.value)} placeholder={t.tdashCapacityPlaceholder} min="0" className="ds-input w-full" style={{ direction: 'ltr' }} />
            </div>
            <div className="mb-4">
              <label className="ds-label block mb-1">{t.tdashMinPrice}</label>
              <input type="number" value={etMinPx} onChange={e => setEtMinPx(e.target.value)} placeholder={t.tdashMinPricePlaceholder} min="0" step="0.1" className="ds-input w-full" style={{ direction: 'ltr' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditTrip(null)} className="flex-1 ds-btn-secondary py-2.5">{t.tdashCancel}</button>
              <button onClick={saveEdit} className="flex-[2] ds-btn-primary py-2.5">{t.tdashSave}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Photo Confirm Modal ─── */}
      {photoMode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setPhotoMode(null)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-base font-extrabold">
                  {photoMode === 'pickup' ? t.tdashPickupTitle : t.tdashDeliveryTitle}
                </h3>
                <div className="text-xs text-gray-500 mt-0.5">{t.tdashOrderLabel} {photoOrd}</div>
              </div>
              <button onClick={() => setPhotoMode(null)} className="text-gray-500 text-xl font-bold hover:text-gray-700" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            {photoData ? (
              <div className="rounded-xl overflow-hidden border border-blue-200 mb-4 mt-3">
                <img src={photoData} alt="عکس" className="w-full max-h-52 object-cover" />
              </div>
            ) : (
              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl p-7 text-center cursor-pointer mb-4 mt-3"
                onClick={() => setPhotoCamOpen(true)}>
                <Camera className="w-10 h-10 mx-auto mb-2 text-gray-300" aria-hidden />
                <div className="text-sm font-bold text-blue-700">{t.tdashTakePhoto}</div>
              </div>
            )}
            {photoCamOpen && (
              <GuidedCapture
                mode="photo"
                onBack={() => setPhotoCamOpen(false)}
                onHome={() => { setPhotoCamOpen(false); setPhotoMode(null); }}
                onComplete={result => {
                  const blob = result.frames[0]?.blob;
                  if (blob) setPhotoData(URL.createObjectURL(blob));
                  setPhotoCamOpen(false);
                }}
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => setPhotoMode(null)} className="flex-1 ds-btn-secondary py-2.5">{t.tdashCancel}</button>
              <button onClick={submitPhoto} disabled={!photoData}
                className="flex-[2] ds-btn-primary py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {t.tdashConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl ${toastOk ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast}
        </div>
      )}

      {/* The CMD-16 commitment sheet, opened from an S2 suggestion card. Same component the
          marketplace uses — a suggestion and a marketplace card commit through one code path. */}
      {sugOffer && session?.userId && (
        <TravelerOfferSheet
          order={sugOffer}
          travelerId={session.userId}
          onClose={() => setSugOffer(null)}
          onSubmitted={() => { setSug(null); loadSuggestions(); }}
          onRegisterTrip={onNewTrip}
        />
      )}
    </div>
  );
}
