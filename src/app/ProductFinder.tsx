import { useState } from 'react';
import { Search, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';

interface AIResult {
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  confidence?: number;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  searchQuery?: string;
}

interface PriceCard {
  title: string;
  shop: string;
  country: string;
  priceUSD: number | null;
  priceLocal: number;
  currency: string;
  link: string;
  image: string;
}

export interface SelectedProduct {
  title: string;
  priceUSD: number;
  priceLocal: number;
  currency: string;
  country: string;
  shop: string;
  link: string;
  image: string;
}

interface Props {
  onSelect: (p: SelectedProduct) => void;
}

type Step = 'input' | 'confirm' | 'results';

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

export default function ProductFinder({ onSelect }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [prices, setPrices] = useState<PriceCard[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  async function identify() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در شناسایی');
      setAiResult(data);
      setStep('confirm');
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || 'خطا در شناسایی محصول');
    } finally {
      setLoading(false);
    }
  }

  async function findPrices() {
    if (!aiResult?.searchQuery) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/product/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiResult.searchQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا');
      setPrices(data.results || []);
      setSelectedIdx(null);
      setStep('results');
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || 'خطا در دریافت قیمت‌ها');
    } finally {
      setLoading(false);
    }
  }

  function resetToInput() {
    setStep('input');
    setAiResult(null);
    setPrices([]);
    setSelectedIdx(null);
    setError('');
  }

  // ── STEP: input ──────────────────────────────────────────────────────────────

  if (step === 'input') {
    return (
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-bold text-cyan-700">جستجوی هوشمند محصول</span>
        </div>
        <textarea
          dir="rtl"
          className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder:text-gray-400"
          rows={2}
          placeholder="محصول را توصیف کن (مثلاً: کفش دو Asics Nimbus مردانه)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); identify(); } }}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        <button
          onClick={identify}
          disabled={loading || !query.trim()}
          className="mt-2 w-full py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <><Spinner />در حال شناسایی...</> : 'پیدا کن'}
        </button>
      </div>
    );
  }

  // ── STEP: confirm ────────────────────────────────────────────────────────────

  if (step === 'confirm' && aiResult) {
    const productLabel = [aiResult.brand, aiResult.model].filter(Boolean).join(' ') || aiResult.title || '—';
    const confidencePct = Math.round((aiResult.confidence ?? 0) * 100);
    const highConf = confidencePct >= 80;

    return (
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-4 mb-5" dir="rtl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-cyan-700">محصول شناسایی شد</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${highConf ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
            {confidencePct}% اطمینان
          </span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
          <p className="font-extrabold text-gray-900 text-base">{productLabel}</p>
          {aiResult.category && <p className="text-xs text-gray-500 mt-0.5">{aiResult.category}</p>}
        </div>

        {aiResult.needsClarification ? (
          <>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
              {aiResult.clarifyingQuestion}
            </p>
            <textarea
              dir="rtl"
              className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400 mb-2"
              rows={2}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
            <button
              onClick={identify}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner />در حال شناسایی...</> : 'دوباره شناسایی کن'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3 text-center">این درست است؟</p>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <button
              onClick={findPrices}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner />در حال جستجو...</> : 'بله، قیمت‌ها را پیدا کن'}
            </button>
          </>
        )}

        <button
          onClick={resetToInput}
          className="mt-2 w-full py-2 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          نه، دوباره
        </button>
      </div>
    );
  }

  // ── STEP: results ────────────────────────────────────────────────────────────

  if (step === 'results') {
    return (
      <div className="mb-5" dir="rtl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-cyan-700">قیمت‌های پیدا شده</span>
          <button
            onClick={resetToInput}
            className="text-xs text-gray-500 hover:text-cyan-600 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            جست‌وجوی دوباره
          </button>
        </div>

        {prices.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center text-sm text-gray-500">
            نتیجه‌ای یافت نشد
          </div>
        )}

        <div className="space-y-3">
          {prices.map((card, i) => {
            const isDataUri = card.image?.startsWith('data:');
            const usd = card.priceUSD;

            return (
              <div
                key={i}
                className={`bg-white rounded-2xl border-2 p-4 flex gap-3 relative ${i === 0 ? 'border-cyan-400 shadow-sm' : 'border-gray-200'}`}
              >
                {i === 0 && (
                  <span className="absolute top-2 left-2 text-xs font-bold bg-cyan-500 text-white px-2 py-0.5 rounded-full">
                    ارزان‌ترین
                  </span>
                )}

                {/* Thumbnail */}
                <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center">
                  {isDataUri || !card.image
                    ? <span className="text-2xl">📦</span>
                    : <img
                        src={card.image}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mt-4">{card.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{card.shop} · {card.country}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-extrabold text-cyan-600">
                      {usd != null ? `$${usd.toFixed(2)}` : '—'}
                    </span>
                    {card.priceLocal && card.currency !== 'USD' && (
                      <span className="text-xs text-gray-400">{card.priceLocal} {card.currency}</span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2">
                    {card.link && (
                      <a
                        href={card.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-600 border border-gray-200 rounded-lg px-2 py-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        لینک
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setSelectedIdx(i);
                        onSelect({
                          title: card.title,
                          priceUSD: usd ?? 0,
                          priceLocal: card.priceLocal,
                          currency: card.currency,
                          country: card.country,
                          shop: card.shop,
                          link: card.link,
                          image: card.image,
                        });
                      }}
                      className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg border-2 transition-all ${
                        selectedIdx === i
                          ? 'bg-green-50 border-green-400 text-green-700'
                          : 'bg-cyan-500 border-cyan-500 text-white hover:bg-cyan-600'
                      }`}
                    >
                      {selectedIdx === i
                        ? <><CheckCircle className="w-3 h-3" />انتخاب شد ✓</>
                        : 'انتخاب'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
