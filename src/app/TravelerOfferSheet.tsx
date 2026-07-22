import { useEffect, useState } from 'react';
import { X, CheckCircle2, Plane, Luggage, Ban } from 'lucide-react';
import { RouteArrow, Meta, MetaIcons } from './flowIcons';

// ── CMD-16 traveler offer sheet ──────────────────────────────────────────────
// Extracted from MarketplacePage so the S2 suggestion cards on the traveler dashboard open the
// SAME sheet rather than a second copy of it. Suggestion is browse; this is the commitment, and
// there must be exactly one implementation of committing.
//
// The component owns all of its own state (nine useStates lived in MarketplacePage before) and
// talks to the two CMD-16 endpoints directly, so a caller only has to say WHICH order and WHO is
// offering.

export type OfferSheetOrder = {
  orderId: string;
  product?: { title?: string | null } | null;
};

type OfferTrip = {
  tripId: string; from: string; to: string; date: string | null;
  capacityKg: number | null; remainingKg: number | null; note: string;
  eligible: boolean; kind: string | null; reason: string | null; reasonFa: string | null;
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fa-IR'); } catch { return d; }
}

export default function TravelerOfferSheet({
  order, travelerId, onClose, onSubmitted, onRegisterTrip,
}: {
  order: OfferSheetOrder;
  travelerId: string;
  onClose: () => void;
  onSubmitted?: (orderId: string) => void;
  onRegisterTrip?: () => void;
}) {
  const [trips, setTrips] = useState<OfferTrip[] | null>(null);
  const [err,   setErr]   = useState('');
  const [pick,  setPick]  = useState('');
  const [fee,   setFee]   = useState('');
  const [note,  setNote]  = useState('');
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState('');
  const [done,  setDone]  = useState(false);

  function load() {
    setTrips(null); setErr('');
    fetch(`/api/offers/eligible-trips?orderId=${encodeURIComponent(order.orderId)}&travelerId=${encodeURIComponent(travelerId)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setErr(d.message || 'دریافت سفرهای شما ممکن نشد'); setTrips([]); return; }
        setTrips(d.trips || []);
        // Pre-select when exactly one trip is usable — the common case, one less tap.
        const ok = (d.trips || []).filter((x: OfferTrip) => x.eligible);
        if (ok.length === 1) setPick(ok[0].tripId);
      })
      .catch(() => { setErr('ارتباط برقرار نشد'); setTrips([]); });
  }
  useEffect(load, [order.orderId, travelerId]);

  async function submit() {
    if (!pick || busy) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/offers/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId, tripId: pick, travelerId,
          travelerFeeUSD: fee ? Number(fee) : undefined,
          note: note || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok && d.ok) { setDone(true); setMsg(d.message || 'پیشنهاد شما ثبت شد'); onSubmitted?.(order.orderId); }
      else setMsg(d.message || 'پیشنهاد ثبت نشد — دوباره تلاش کنید');
    } catch { setMsg('ارتباط برقرار نشد'); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
         dir="rtl" role="dialog" aria-modal="true" onClick={() => !busy && onClose()}>
      <div className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
           onClick={e => e.stopPropagation()}>

        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-extrabold text-gray-900">پیشنهاد برای این سفارش</div>
            <div className="text-xs text-gray-500 truncate mt-0.5">{order.product?.title || order.orderId}</div>
          </div>
          <button onClick={() => !busy && onClose()}
                  className="shrink-0 text-gray-400 hover:text-gray-700 px-1" aria-label="بستن"><X className="w-5 h-5" aria-hidden /></button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" aria-hidden />
              <div className="text-base font-extrabold text-emerald-700 mb-1">{msg}</div>
              <p className="text-sm text-gray-500 leading-relaxed">
                خریدار مطلع شد. پس از تأیید او، مرحله پرداخت امانی آغاز می‌شود.
              </p>
              <button onClick={onClose} className="mt-5 w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl">بستن</button>
            </div>
          ) : trips === null ? (
            <div className="text-center py-10 text-gray-400">
              <Plane className="w-7 h-7 mx-auto mb-2 text-gray-300 animate-pulse" aria-hidden />
              <div className="text-sm">در حال بررسی سفرهای شما…</div>
            </div>
          ) : err ? (
            <div className="text-center py-8">
              <div className="text-sm font-bold text-red-600 mb-1">{err}</div>
              <button onClick={load} className="mt-3 text-xs font-bold text-cyan-700 underline">دوباره تلاش کنید</button>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8">
              <Luggage className="w-10 h-10 mx-auto mb-3 text-gray-300" aria-hidden />
              <div className="text-sm font-bold text-gray-800 mb-1">هنوز سفری ثبت نکرده‌اید</div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                برای پیشنهاد دادن به این سفارش، اول سفرتان را ثبت کنید.
              </p>
              <button onClick={() => { onClose(); onRegisterTrip?.(); }}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-700 to-blue-700 text-white text-sm font-bold rounded-xl">
                ثبت سفر
              </button>
            </div>
          ) : (<>
            {trips.every(tr => !tr.eligible) && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="text-xs font-bold text-amber-800 mb-0.5">سفری با مسیر و ظرفیت مناسب ندارید</div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  دلیل هر سفر زیر آمده است — می‌توانید سفر تازه‌ای ثبت کنید.
                </p>
              </div>
            )}

            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">سفر خود را انتخاب کنید</div>
            <div className="space-y-2 mb-4">
              {trips.map(tr => {
                const picked = pick === tr.tripId;
                return (
                  <button key={tr.tripId} type="button" disabled={!tr.eligible}
                    onClick={() => tr.eligible && setPick(tr.tripId)}
                    className={`w-full text-right rounded-xl border-2 px-3.5 py-3 transition-all
                      ${!tr.eligible
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : picked ? 'border-cyan-500 bg-cyan-50'
                                 : 'border-gray-100 hover:border-cyan-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-extrabold text-gray-900">{tr.from} <RouteArrow isRTL /> {tr.to}</span>
                      {tr.eligible && (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full
                          ${tr.kind === 'cross_country' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {tr.kind === 'cross_country' ? 'کشور متفاوت' : 'مسیر مستقیم'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                      {tr.date && <Meta icon={MetaIcons.Date}>{fmtDate(tr.date)}</Meta>}
                      {tr.remainingKg != null && <Meta icon={MetaIcons.Weight}>{tr.remainingKg} کیلوگرم آزاد</Meta>}
                    </div>
                    {!tr.eligible && tr.reasonFa && (
                      <div className="mt-1.5 text-[11px] font-bold text-gray-500 flex items-center gap-1"><Ban className="w-3 h-3 flex-shrink-0" aria-hidden />{tr.reasonFa}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {trips.some(tr => tr.eligible) && (<>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500">دستمزد شما (دلار) — اختیاری</span>
                  <input type="number" min="0" inputMode="decimal" value={fee}
                    onChange={e => setFee(e.target.value)} placeholder="مثلاً ۲۵"
                    className="mt-1 w-full rounded-xl border-2 border-gray-100 px-3 py-2 text-sm focus:border-cyan-400 outline-none" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500">یادداشت — اختیاری</span>
                  <input type="text" maxLength={200} value={note}
                    onChange={e => setNote(e.target.value)} placeholder="توضیح کوتاه"
                    className="mt-1 w-full rounded-xl border-2 border-gray-100 px-3 py-2 text-sm focus:border-cyan-400 outline-none" />
                </label>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                قیمت نهایی کالا را خود چاپار برای کشور شما استعلام می‌کند — این مبلغ فقط دستمزد شماست.
              </p>

              {msg && !done && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{msg}</div>
              )}

              <button onClick={submit} disabled={!pick || busy}
                className="w-full py-3 bg-gradient-to-r from-cyan-700 to-blue-700 text-white text-sm font-extrabold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                {busy ? 'در حال ثبت…' : 'ثبت پیشنهاد'}
              </button>
            </>)}
          </>)}
        </div>
      </div>
    </div>
  );
}
