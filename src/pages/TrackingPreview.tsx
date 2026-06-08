import { useState, useCallback } from 'react';
import { geocodeAddress } from '../lib/googleGeocoding';
import { calculateRoute } from '../lib/googleRoutes';
import GoogleTrackingMap from '../components/GoogleTrackingMap';
import TrackingSearchPanel from '../components/TrackingSearchPanel';
import type { TrackingFormValues } from '../components/TrackingSearchPanel';
import type { ShipmentRoute, RouteStatus } from '../types/tracking';
import { DEMO_ROUTES } from '../data/demoTrackingRoutes';

const STATUS_LABEL: Record<RouteStatus, { fa: string; en: string; color: string }> = {
  pending:          { fa: 'در انتظار',       en: 'Pending',            color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  escrow_locked:    { fa: 'امانت قفل‌شده',   en: 'Escrow Locked',      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  assigned:         { fa: 'تخصیص‌یافته',      en: 'Assigned',           color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  picked_up:        { fa: 'تحویل گرفته‌شد',  en: 'Picked Up',          color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  in_transit:       { fa: 'در حال انتقال',   en: 'In Transit',         color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  customs:          { fa: 'در گمرک',          en: 'Customs',            color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  out_for_delivery: { fa: 'در حال تحویل',    en: 'Out for Delivery',   color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  delivered:        { fa: 'تحویل داده‌شد',   en: 'Delivered',          color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  disputed:         { fa: 'در اختلاف',        en: 'Disputed',           color: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

const ESCROW_LABEL: Record<string, { fa: string; color: string }> = {
  none:     { fa: 'بدون امانت',      color: 'text-gray-400' },
  locked:   { fa: 'امانت قفل‌شده',   color: 'text-purple-300' },
  released: { fa: 'امانت آزادشده',   color: 'text-green-300' },
  refunded: { fa: 'بازپرداخت‌شده',   color: 'text-yellow-300' },
};

function generateTrackingCode(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CHP-${today}-${rand}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="ml-2 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all">
      {copied ? '✓ کپی‌شد' : 'کپی'}
    </button>
  );
}

export default function TrackingPreview() {
  const [route, setRoute] = useState<ShipmentRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleFormSubmit = useCallback(async (values: TrackingFormValues) => {
    setLoading(true);
    setError(null);
    setRoute(null);
    setActiveDemo(null);
    try {
      const [origin, dest] = await Promise.all([
        geocodeAddress(values.senderAddress, values.senderCity, values.senderCountry, values.senderPostal),
        geocodeAddress(values.receiverAddress, values.receiverCity, values.receiverCountry, values.receiverPostal),
      ]);
      const routeResult = await calculateRoute(origin.lat, origin.lng, dest.lat, dest.lng);
      const trackingCode = generateTrackingCode();
      const newRoute: ShipmentRoute = {
        trackingCode,
        publicOriginCity: origin.city,
        publicOriginCountry: origin.country,
        publicDestinationCity: dest.city,
        publicDestinationCountry: dest.country,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
        currentLat: origin.lat,
        currentLng: origin.lng,
        routePoints: routeResult.points,
        routeType: 'shipment',
        distanceText: routeResult.distanceText,
        durationText: routeResult.durationText,
        status: 'pending',
        escrowStatus: 'none',
        createdAt: new Date().toISOString().slice(0, 10),
        senderAddressPrivate: `${values.senderAddress}, ${values.senderCity}`,
        receiverAddressPrivate: `${values.receiverAddress}, ${values.receiverCity}`,
      };
      setRoute(newRoute);
    } catch (err: any) {
      setError(err.message ?? 'خطا در پردازش آدرس. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemo = (demo: ShipmentRoute) => {
    setRoute(demo);
    setActiveDemo(demo.trackingCode);
    setError(null);
  };

  const statusInfo = route ? STATUS_LABEL[route.status] : null;
  const escrowInfo = route ? ESCROW_LABEL[route.escrowStatus] : null;

  return (
    <div className="min-h-screen bg-[#04070f] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#04070f]/95 backdrop-blur-xl border-b border-white/8 px-6 py-4 flex items-center justify-between z-20">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">Chapar</span>
          <span className="hidden sm:block text-xs text-gray-500 border border-white/10 rounded-full px-2 py-0.5">Tracking</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/track" className="text-sm text-gray-400 hover:text-white transition-colors">رهگیری عمومی</a>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← بازگشت</a>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Left panel */}
        <div className="lg:w-[420px] xl:w-[460px] flex-shrink-0 bg-[#04070f] border-r border-white/5 overflow-y-auto">
          <div className="p-6">
            {/* Title */}
            <div className="mb-6">
              <h1 className="text-xl font-black text-white mb-1">سیستم رهگیری Chapar</h1>
              <p className="text-xs text-gray-500">Real-time logistics route tracking powered by Google Maps</p>
            </div>

            {/* Form */}
            <TrackingSearchPanel onSubmit={handleFormSubmit} loading={loading} error={error} />

            {/* Route result */}
            {route && (
              <div className="mt-6 space-y-4">
                {/* Tracking code */}
                <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 p-5">
                  <div className="text-xs text-cyan-400 font-semibold uppercase tracking-widest mb-2">کد رهگیری</div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-bold text-white">{route.trackingCode}</span>
                    <CopyButton text={route.trackingCode} />
                  </div>
                  {activeDemo && (
                    <a
                      href={`/track/${route.trackingCode}`}
                      className="mt-3 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      مشاهده صفحه عمومی رهگیری ←
                    </a>
                  )}
                </div>

                {/* Route info */}
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5 space-y-4">
                  {/* Origin → Destination */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
                      <div className="w-px h-8 bg-gradient-to-b from-amber-400/40 to-cyan-400/40 my-1" />
                      <div className="w-3 h-3 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{route.publicOriginCity}</div>
                      <div className="text-xs text-gray-500 mb-3">{route.publicOriginCountry}</div>
                      <div className="text-sm font-semibold text-white">{route.publicDestinationCity}</div>
                      <div className="text-xs text-gray-500">{route.publicDestinationCountry}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                    {route.distanceText && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">فاصله</div>
                        <div className="text-sm font-semibold text-white">{route.distanceText}</div>
                      </div>
                    )}
                    {route.durationText && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">زمان تحویل</div>
                        <div className="text-sm font-semibold text-white">{route.durationText}</div>
                      </div>
                    )}
                    {route.eta && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">تاریخ تحویل</div>
                        <div className="text-sm font-semibold text-white">{route.eta}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">نوع مسیر</div>
                      <div className="text-sm font-semibold text-white capitalize">{route.routeType}</div>
                    </div>
                  </div>
                </div>

                {/* Status cards */}
                {statusInfo && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl border px-4 py-3 ${statusInfo.color}`}>
                      <div className="text-xs opacity-70 mb-1">وضعیت مرسوله</div>
                      <div className="text-sm font-bold">{statusInfo.fa}</div>
                      <div className="text-xs opacity-60">{statusInfo.en}</div>
                    </div>
                    {escrowInfo && (
                      <div className="rounded-xl border border-white/10 px-4 py-3 bg-white/3">
                        <div className="text-xs text-gray-500 mb-1">وضعیت امانت</div>
                        <div className={`text-sm font-bold ${escrowInfo.color}`}>{escrowInfo.fa}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Demo routes */}
            <div className="mt-8">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">مسیرهای نمونه</div>
              <div className="space-y-2">
                {DEMO_ROUTES.map(demo => (
                  <button
                    key={demo.trackingCode}
                    onClick={() => loadDemo(demo)}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-all text-sm ${
                      activeDemo === demo.trackingCode
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-white/3 border-white/8 text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="font-mono text-xs text-cyan-400/80 mb-0.5">{demo.trackingCode}</div>
                    <div className="font-medium">
                      {demo.publicOriginCity} → {demo.publicDestinationCity}
                    </div>
                    <div className="text-xs opacity-60">{demo.publicOriginCountry} → {demo.publicDestinationCountry}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-[400px] lg:min-h-0 relative bg-slate-900">
          {route ? (
            <GoogleTrackingMap
              originLat={route.originLat}
              originLng={route.originLng}
              destinationLat={route.destinationLat}
              destinationLng={route.destinationLng}
              routePoints={route.routePoints}
              status={route.status}
              trackingCode={route.trackingCode}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-600">
              <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm">آدرس فرستنده و گیرنده را وارد کنید تا مسیر نمایش داده شود</p>
              <p className="text-xs">یا یکی از مسیرهای نمونه را انتخاب کنید</p>
            </div>
          )}

          {/* Map overlay: route info badge */}
          {route && (
            <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-xs pointer-events-none">
              <div className="bg-[#04070f]/80 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 shadow-2xl">
                <div className="text-xs text-cyan-400 font-mono mb-1">{route.trackingCode}</div>
                <div className="text-sm font-semibold text-white">
                  {route.publicOriginCity} → {route.publicDestinationCity}
                </div>
                {route.distanceText && (
                  <div className="text-xs text-gray-400 mt-1">{route.distanceText} · {route.durationText}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
