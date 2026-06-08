import { useState, useEffect } from 'react';
import GoogleTrackingMap from '../components/GoogleTrackingMap';
import { findDemoRoute, DEMO_ROUTES } from '../data/demoTrackingRoutes';
import type { ShipmentRoute, RouteStatus } from '../types/tracking';

interface TrackPageProps {
  initialCode?: string;
}

const STATUS_LABEL: Record<RouteStatus, { fa: string; en: string; color: string; dot: string }> = {
  pending:          { fa: 'در انتظار',       en: 'Pending',            color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',  dot: 'bg-yellow-400' },
  escrow_locked:    { fa: 'امانت قفل‌شده',   en: 'Escrow Locked',      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',  dot: 'bg-purple-400' },
  assigned:         { fa: 'تخصیص‌یافته',      en: 'Assigned',           color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',        dot: 'bg-cyan-400' },
  picked_up:        { fa: 'تحویل گرفته‌شد',  en: 'Picked Up',          color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',        dot: 'bg-blue-400' },
  in_transit:       { fa: 'در حال انتقال',   en: 'In Transit',         color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',        dot: 'bg-blue-400' },
  customs:          { fa: 'در گمرک',          en: 'Customs',            color: 'bg-orange-500/15 text-orange-300 border-orange-500/30',  dot: 'bg-orange-400' },
  out_for_delivery: { fa: 'در حال تحویل',    en: 'Out for Delivery',   color: 'bg-green-500/15 text-green-300 border-green-500/30',     dot: 'bg-green-400' },
  delivered:        { fa: 'تحویل داده‌شد',   en: 'Delivered',          color: 'bg-green-500/15 text-green-300 border-green-500/30',     dot: 'bg-green-400' },
  disputed:         { fa: 'در اختلاف',        en: 'Disputed',           color: 'bg-red-500/15 text-red-300 border-red-500/30',           dot: 'bg-red-400' },
};

const ESCROW_FA: Record<string, string> = {
  none:     'بدون امانت',
  locked:   'امانت قفل‌شده',
  released: 'امانت آزادشده',
  refunded: 'بازپرداخت‌شده',
};

const STEPS: RouteStatus[] = [
  'pending', 'escrow_locked', 'assigned', 'picked_up',
  'in_transit', 'customs', 'out_for_delivery', 'delivered',
];

function stepIndex(status: RouteStatus) {
  return STEPS.indexOf(status);
}

function RouteTimeline({ status }: { status: RouteStatus }) {
  const current = stepIndex(status);
  return (
    <div className="space-y-1">
      {STEPS.map((s, i) => {
        const info = STATUS_LABEL[s];
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className={`flex items-center gap-3 py-1 px-2 rounded-lg transition-all ${active ? 'bg-white/5' : ''}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : active ? info.dot : 'bg-white/15'}`} />
            <span className={`text-xs font-medium ${done ? 'text-green-400/80' : active ? 'text-white' : 'text-gray-600'}`}>
              {info.fa}
            </span>
            {done && <span className="ml-auto text-green-400 text-xs">✓</span>}
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          </div>
        );
      })}
    </div>
  );
}

export default function TrackPage({ initialCode = '' }: TrackPageProps) {
  const [input, setInput] = useState(initialCode.toUpperCase());
  const [route, setRoute] = useState<ShipmentRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const search = (code: string) => {
    const found = findDemoRoute(code);
    if (found) {
      setRoute(found);
      setError(null);
    } else {
      setRoute(null);
      setError('کد رهگیری پیدا نشد. لطفاً کد را بررسی کنید.');
    }
  };

  // Auto-load if code provided
  useEffect(() => {
    if (initialCode.trim()) search(initialCode.trim());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) search(input.trim());
  };

  const statusInfo = route ? STATUS_LABEL[route.status] : null;

  return (
    <div className="min-h-screen bg-[#04070f] flex flex-col relative">
      {/* Full-screen map */}
      <div className="absolute inset-0">
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
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#04070f] to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">کد رهگیری را وارد کنید</p>
            </div>
          </div>
        )}
      </div>

      {/* Header overlay */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-[#04070f]/90 to-transparent pointer-events-none">
        <a href="/" className="flex items-center gap-2 pointer-events-auto">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Chapar</span>
        </a>
        <a href="/tracking-preview" className="pointer-events-auto text-xs text-gray-400 hover:text-white transition-colors bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
          ایجاد مسیر جدید
        </a>
      </div>

      {/* Tracking panel */}
      <div className={`relative z-20 mt-auto`}>
        {/* Toggle handle */}
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-5 py-1.5 text-xs text-gray-300 hover:bg-white/15 transition-all shadow-xl"
          >
            {panelOpen ? '▼ بستن پنل' : '▲ رهگیری مرسوله'}
          </button>
        </div>

        {panelOpen && (
          <div className="mx-3 sm:mx-auto sm:max-w-2xl mb-4">
            <div className="bg-[#04070f]/92 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Search bar */}
              <div className="p-4 border-b border-white/8">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 transition-all font-mono"
                    placeholder="CHP-20260607-TOR-TEH"
                    value={input}
                    onChange={e => setInput(e.target.value.toUpperCase())}
                    dir="ltr"
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all"
                  >
                    جستجو
                  </button>
                </form>

                {error && (
                  <p className="mt-2 text-xs text-red-400 text-center">{error}</p>
                )}
              </div>

              {/* Route result (privacy-safe) */}
              {route && statusInfo && (
                <div className="p-4 space-y-4">
                  {/* Tracking code + status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-cyan-400">{route.trackingCode}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                      {statusInfo.fa} · {statusInfo.en}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <div className="text-sm font-bold text-white">{route.publicOriginCity}</div>
                      <div className="text-xs text-gray-500">{route.publicOriginCountry}</div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <div className="w-8 h-px bg-gradient-to-r from-amber-400/60 to-cyan-400/60" />
                      <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                      </svg>
                      <div className="w-8 h-px bg-gradient-to-r from-cyan-400/60 to-amber-400/60" />
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-sm font-bold text-white">{route.publicDestinationCity}</div>
                      <div className="text-xs text-gray-500">{route.publicDestinationCountry}</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {route.distanceText && (
                      <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center">
                        <div className="text-xs text-gray-500 mb-0.5">فاصله</div>
                        <div className="text-xs font-bold text-white">{route.distanceText}</div>
                      </div>
                    )}
                    {route.durationText && (
                      <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center">
                        <div className="text-xs text-gray-500 mb-0.5">زمان</div>
                        <div className="text-xs font-bold text-white">{route.durationText}</div>
                      </div>
                    )}
                    <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-2 text-center">
                      <div className="text-xs text-gray-500 mb-0.5">امانت</div>
                      <div className="text-xs font-bold text-white">{ESCROW_FA[route.escrowStatus]}</div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="rounded-xl bg-white/2 border border-white/5 p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">وضعیت مسیر</div>
                    <RouteTimeline status={route.status} />
                  </div>

                  {/* ETA */}
                  {route.eta && (
                    <div className="text-center text-xs text-gray-500">
                      تاریخ تحویل تخمینی: <span className="text-white font-semibold">{route.eta}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Demo codes */}
              {!route && !error && (
                <div className="p-4">
                  <div className="text-xs text-gray-600 uppercase tracking-widest mb-3 font-semibold">مسیرهای نمونه</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEMO_ROUTES.map(demo => (
                      <button
                        key={demo.trackingCode}
                        onClick={() => { setInput(demo.trackingCode); search(demo.trackingCode); }}
                        className="text-left rounded-xl px-3 py-2.5 bg-white/3 border border-white/8 hover:bg-white/6 hover:border-cyan-500/30 transition-all"
                      >
                        <div className="text-xs font-mono text-cyan-400/80 mb-0.5">{demo.trackingCode}</div>
                        <div className="text-xs text-gray-300">{demo.publicOriginCity} → {demo.publicDestinationCity}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
