import { useState, useCallback } from 'react';
import ShipmentGlobe from '../components/ShipmentGlobe';
import { DEMO_ROUTES, findDemoRoute } from '../data/demoTrackingRoutes';
import type { RouteStatus } from '../types/tracking';

// ── Status helpers ──────────────────────────────────────────────────────────
const STATUS_DOT: Record<RouteStatus, string> = {
  pending:          'bg-yellow-400',
  escrow_locked:    'bg-purple-400',
  assigned:         'bg-cyan-400',
  picked_up:        'bg-blue-400',
  in_transit:       'bg-blue-500',
  customs:          'bg-orange-400',
  out_for_delivery: 'bg-green-400',
  delivered:        'bg-green-500',
  disputed:         'bg-red-400',
};

const STATUS_COLOR: Record<RouteStatus, string> = {
  pending:          'text-yellow-300',
  escrow_locked:    'text-purple-300',
  assigned:         'text-cyan-300',
  picked_up:        'text-blue-300',
  in_transit:       'text-blue-400',
  customs:          'text-orange-300',
  out_for_delivery: 'text-green-300',
  delivered:        'text-green-300',
  disputed:         'text-red-400',
};

const STATUS_FA: Record<RouteStatus, string> = {
  pending:          'در انتظار',
  escrow_locked:    'امانت قفل‌شده',
  assigned:         'تخصیص‌یافته',
  picked_up:        'تحویل گرفته‌شد',
  in_transit:       'در حال انتقال',
  customs:          'در گمرک',
  out_for_delivery: 'در حال تحویل',
  delivered:        'تحویل داده‌شد',
  disputed:         'در اختلاف',
};

const ESCROW_FA: Record<string, string> = {
  none:     'بدون امانت',
  locked:   'امانت قفل‌شده',
  released: 'امانت آزادشده',
  refunded: 'بازپرداخت‌شده',
};

// ── Component ────────────────────────────────────────────────────────────────
export default function EarthPreview() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [searchInput, setSearchInput]   = useState('');
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [panelOpen, setPanelOpen]       = useState(true);
  const [globeReady, setGlobeReady]     = useState(false);

  const selectedRoute = selectedCode ? findDemoRoute(selectedCode) : null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const code = searchInput.trim().toUpperCase();
    if (!code) return;
    const found = findDemoRoute(code);
    if (found) {
      setSelectedCode(code);
      setSearchError(null);
    } else {
      setSearchError('کد رهگیری پیدا نشد');
      setSelectedCode(null);
    }
  }, [searchInput]);

  const selectRoute = useCallback((code: string) => {
    const isAlready = selectedCode === code;
    setSelectedCode(isAlready ? null : code);
    setSearchInput(isAlready ? '' : code);
    setSearchError(null);
  }, [selectedCode]);

  const clearSelection = useCallback(() => {
    setSelectedCode(null);
    setSearchInput('');
    setSearchError(null);
  }, []);

  return (
    <div className="w-screen h-screen bg-[#04070f] relative overflow-hidden select-none">

      {/* ── Globe — full-screen ────────────────────────────────────────────── */}
      <ShipmentGlobe
        routes={DEMO_ROUTES}
        selectedCode={selectedCode}
        onLoad={() => setGlobeReady(true)}
        className="absolute inset-0 w-full h-full"
      />

      {/* Globe loading shimmer */}
      {!globeReady && (
        <div className="absolute inset-0 z-30 bg-[#04070f] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-cyan-500/50 animate-spin" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20" />
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">در حال بارگذاری کره زمین...</div>
          </div>
        </div>
      )}

      {/* ── Top gradient ──────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#04070f]/80 to-transparent pointer-events-none z-10" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <svg className="w-4.5 h-4.5 text-white -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <div>
            <div className="text-base font-black text-white leading-none">Chapar</div>
            <div className="text-xs text-cyan-400/70 font-medium">Global Logistics · 3D</div>
          </div>
        </a>

        {/* Tracking search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <input
              className="bg-black/55 backdrop-blur-2xl border border-white/12 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono w-48 sm:w-60 transition-all shadow-xl"
              placeholder="CHP-20260607-TOR-TEH"
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value.toUpperCase()); setSearchError(null); }}
              onKeyDown={e => { if (e.key === 'Escape') clearSelection(); }}
              dir="ltr"
              spellCheck={false}
            />
            {searchError && (
              <div className="absolute top-full left-0 mt-1.5 text-xs text-red-400 bg-black/90 backdrop-blur-xl rounded-xl px-3 py-2 whitespace-nowrap border border-red-500/20 shadow-xl z-50">
                {searchError}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
          >
            زوم
          </button>
          {selectedCode && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-2.5 rounded-2xl bg-white/8 border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
            >
              ✕
            </button>
          )}
        </form>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-4">
          <a href="/tracking-preview" className="text-xs text-gray-500 hover:text-cyan-400 transition-colors">مسیر جدید</a>
          <a href="/track" className="text-xs text-gray-500 hover:text-white transition-colors">رهگیری عمومی</a>
          <a href="/" className="text-xs text-gray-600 hover:text-white transition-colors">← بازگشت</a>
        </div>
      </div>

      {/* ── Left panel: route list ─────────────────────────────────────────── */}
      <div className="absolute top-20 left-3 sm:left-4 z-20" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        <div className="bg-[#020509]/80 backdrop-blur-3xl rounded-2xl border border-white/8 shadow-2xl overflow-hidden flex flex-col w-60">
          {/* Header */}
          <button
            className="flex items-center justify-between px-4 py-3 border-b border-white/6 hover:bg-white/3 transition-colors"
            onClick={() => setPanelOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-widest">مسیرهای زنده</span>
              <span className="text-xs text-gray-600">{DEMO_ROUTES.length}</span>
            </div>
            <span className="text-xs text-gray-600">{panelOpen ? '▲' : '▼'}</span>
          </button>

          {panelOpen && (
            <>
              {/* Routes */}
              <div className="overflow-y-auto flex-1 p-1.5 space-y-1">
                {DEMO_ROUTES.map(route => {
                  const isSelected = selectedCode === route.trackingCode;
                  return (
                    <button
                      key={route.trackingCode}
                      onClick={() => selectRoute(route.trackingCode)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border-cyan-500/25 shadow-inner'
                          : 'bg-white/2 border-transparent hover:bg-white/5 hover:border-white/8'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[route.status]} ${isSelected ? 'ring-2 ring-white/30' : ''}`} />
                        <span className="text-xs font-mono text-gray-500 truncate">{route.trackingCode}</span>
                      </div>
                      <div className="text-xs font-semibold text-white pl-4 mb-0.5">
                        {route.publicOriginCity} → {route.publicDestinationCity}
                      </div>
                      <div className={`text-xs pl-4 ${STATUS_COLOR[route.status]}`}>
                        {STATUS_FA[route.status]}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="px-3 py-2.5 border-t border-white/6 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-cyan-400">{DEMO_ROUTES.length}</div>
                  <div className="text-xs text-gray-600">مسیر</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-purple-400">
                    {DEMO_ROUTES.filter(r => r.escrowStatus === 'locked').length}
                  </div>
                  <div className="text-xs text-gray-600">امانت</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-400">
                    {DEMO_ROUTES.filter(r => r.status === 'delivered').length}
                  </div>
                  <div className="text-xs text-gray-600">تحویل</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right: selected route detail ──────────────────────────────────── */}
      {selectedRoute && (
        <div
          className="absolute top-20 right-3 sm:right-4 z-20 w-64"
          key={selectedRoute.trackingCode}
        >
          <div className="bg-[#020509]/85 backdrop-blur-3xl rounded-2xl border border-white/8 shadow-2xl p-4 space-y-3">
            {/* Code + close */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-cyan-400 font-semibold">{selectedRoute.trackingCode}</span>
              <button onClick={clearSelection} className="text-gray-600 hover:text-white text-xs transition-colors p-1 rounded hover:bg-white/8">✕</button>
            </div>

            {/* Route */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-sm font-bold text-white">{selectedRoute.publicOriginCity}</div>
                <div className="text-xs text-gray-500">{selectedRoute.publicOriginCountry}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-px h-3 bg-amber-400/40" />
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[selectedRoute.status]}`} />
                <div className="w-px h-3 bg-cyan-400/40" />
              </div>
              <div className="flex-1 text-right">
                <div className="text-sm font-bold text-white">{selectedRoute.publicDestinationCity}</div>
                <div className="text-xs text-gray-500">{selectedRoute.publicDestinationCountry}</div>
              </div>
            </div>

            {/* Status badge */}
            <div className={`text-center text-xs font-bold py-1.5 rounded-xl bg-white/4 border border-white/6 ${STATUS_COLOR[selectedRoute.status]}`}>
              {STATUS_FA[selectedRoute.status]}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/4 border border-white/5 px-3 py-2.5">
                <div className="text-gray-500 mb-0.5">فاصله</div>
                <div className="text-white font-semibold">{selectedRoute.distanceText ?? '—'}</div>
              </div>
              <div className="rounded-xl bg-white/4 border border-white/5 px-3 py-2.5">
                <div className="text-gray-500 mb-0.5">زمان</div>
                <div className="text-white font-semibold">{selectedRoute.durationText ?? '—'}</div>
              </div>
              <div className="rounded-xl bg-white/4 border border-white/5 px-3 py-2.5">
                <div className="text-gray-500 mb-0.5">تحویل</div>
                <div className="text-white font-semibold">{selectedRoute.eta ?? '—'}</div>
              </div>
              <div className="rounded-xl bg-white/4 border border-white/5 px-3 py-2.5">
                <div className="text-gray-500 mb-0.5">امانت</div>
                <div className="text-white font-semibold">{ESCROW_FA[selectedRoute.escrowStatus] ?? '—'}</div>
              </div>
            </div>

            {/* Full tracking link */}
            <a
              href={`/track/${selectedRoute.trackingCode}`}
              className="block text-center text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-1"
            >
              مشاهده صفحه رهگیری کامل ←
            </a>
          </div>
        </div>
      )}

      {/* ── Demo codes hint (when nothing selected) ───────────────────────── */}
      {!selectedRoute && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 hidden sm:block">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/8 px-4 py-2.5 shadow-xl">
            <span className="text-xs text-gray-600">کد نمونه:</span>
            {DEMO_ROUTES.slice(0, 3).map(r => (
              <button
                key={r.trackingCode}
                onClick={() => { setSearchInput(r.trackingCode); selectRoute(r.trackingCode); }}
                className="text-xs font-mono text-cyan-500 hover:text-cyan-300 transition-colors"
              >
                {r.trackingCode.replace('CHP-20260607-', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="h-20 bg-gradient-to-t from-[#04070f]/50 to-transparent" />
      </div>
      <div className="absolute bottom-2 right-4 z-20 pointer-events-none">
        <div className="text-xs text-gray-700">Imagery © Esri, Maxar · CesiumJS · Chapar 2026</div>
      </div>

      {/* ── Instructions overlay (fade in after load) ─────────────────────── */}
      {globeReady && (
        <div className="absolute bottom-8 right-4 z-20 hidden lg:block pointer-events-none">
          <div className="text-xs text-gray-700 space-y-0.5 text-right">
            <div>🖱 کشیدن: چرخش کره</div>
            <div>🖱 اسکرول: زوم</div>
            <div>📍 کلیک: نمایش مسیر</div>
          </div>
        </div>
      )}
    </div>
  );
}
