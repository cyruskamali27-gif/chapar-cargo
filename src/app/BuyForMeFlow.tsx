import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Home, ShoppingCart, Building2, CheckCircle, ExternalLink, AlertCircle, ChevronDown } from 'lucide-react';
import { getLiveRate } from '../lib/store';
import { useSession } from '../lib/SessionContext';
import { useLang } from '../lib/LangContext';
import type { Translations } from './i18n';
import ProductFinder from './ProductFinder';
import ChaparConcierge from './ChaparConcierge';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'selector' | 'buyforme' | 'commercial';

interface ProductInfo {
  title: string;
  store: string;
  price: string;
  currency: string;
  qty: string;
  imageUrl: string;
  productUrl: string;
}

interface DestInfo {
  country: string;
  city: string;
  deliveryType: 'standard' | 'express';
}

interface ValueInfo {
  amount: string;
  currency: string;
}

interface RecipInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
}

interface FetchResult {
  ok: boolean;
  partial: boolean;
  title?: string | null;
  image?: string | null;
  price?: number | null;
  currency?: string | null;
  brand?: string | null;
  siteName?: string | null;
}

// ── Currencies (mirrors SendPackagePage) ──────────────────────────────────────

const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', rate: 1 },
  { code: 'EUR', flag: '🇪🇺', rate: 1.09 },
  { code: 'CAD', flag: '🇨🇦', rate: 0.74 },
  { code: 'GBP', flag: '🇬🇧', rate: 1.27 },
  { code: 'AED', flag: '🇦🇪', rate: 0.272 },
  { code: 'TRY', flag: '🇹🇷', rate: 0.031 },
  { code: 'SAR', flag: '🇸🇦', rate: 0.267 },
  { code: 'QAR', flag: '🇶🇦', rate: 0.274 },
  { code: 'IQD', flag: '🇮🇶', rate: 0.00076 },
  { code: 'CNY', flag: '🇨🇳', rate: 0.138 },
  { code: 'INR', flag: '🇮🇳', rate: 0.012 },
  { code: 'AMD', flag: '🇦🇲', rate: 0.0026 },
  { code: 'AZN', flag: '🇦🇿', rate: 0.588 },
  { code: 'USDT', flag: '💵', rate: 1 },
  { code: 'USDC', flag: '🔵', rate: 1 },
  { code: 'IRR', flag: '🇮🇷', rate: null },
];

const CURR_FLAGS: Record<string, string> = Object.fromEntries(CURRENCIES.map(c => [c.code, c.flag]));

function getUSD(amount: string, code: string): number {
  const a = parseFloat(amount) || 0;
  const c = CURRENCIES.find(x => x.code === code);
  if (!c) return a;
  if (code === 'IRR') return a / getLiveRate();
  return a * (c.rate ?? 1);
}

// ── Small shared components ───────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-cyan-500 rounded-full" />
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-3">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-sm font-semibold text-red-700">{msg}</p>
    </div>
  );
}

// ── Mode Selector (2 cards: Buy-For-Me + Commercial) ─────────────────────────

function ModeSelector({ t, isRTL, onSelectBuyForMe, onSelectCommercial }: {
  t: Translations;
  isRTL: boolean;
  onSelectBuyForMe: () => void;
  onSelectCommercial: () => void;
}) {
  const modes = [
    {
      key: 'buyforme',
      icon: <ShoppingCart className="w-7 h-7 text-cyan-500" />,
      title: t.buyForMe,
      desc: t.buyForMeDesc,
      gradient: 'from-cyan-50 to-blue-50',
      border: 'border-cyan-200 hover:border-cyan-400',
      badge: null as string | null,
      disabled: false,
      onClick: onSelectBuyForMe,
    },
    {
      key: 'commercial',
      icon: <Building2 className="w-7 h-7 text-gray-400" />,
      title: t.bfm2Commercial,
      desc: t.bfm2CommercialDesc,
      gradient: 'from-gray-50 to-slate-50',
      border: 'border-gray-200',
      badge: t.bfm2ComingSoon,
      disabled: true,
      onClick: onSelectCommercial,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{t.bfm2ModeTitle}</h2>
        <p className="text-sm text-gray-500">{t.bfm2ModeDesc}</p>
      </div>
      {modes.map((m, i) => (
        <motion.button
          key={m.key}
          onClick={m.disabled ? undefined : m.onClick}
          disabled={m.disabled}
          className={`w-full text-${isRTL ? 'right' : 'left'} bg-gradient-to-br ${m.gradient} border-2 ${m.border} rounded-2xl p-5 transition-all flex items-start gap-4 ${m.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          whileHover={m.disabled ? {} : { y: -2, scale: 1.01 }}
          whileTap={m.disabled ? {} : { scale: 0.98 }}
        >
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-gray-900 text-base">{m.title}</span>
              {m.badge && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  {m.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
          </div>
          {!m.disabled && (
            <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 mt-1 ${isRTL ? 'rotate-90' : '-rotate-90'}`} />
          )}
        </motion.button>
      ))}
    </div>
  );
}

// ── Product Tab: Link ─────────────────────────────────────────────────────────

function LinkTab({ t, product, setProduct }: {
  t: Translations;
  product: ProductInfo;
  setProduct: (p: ProductInfo) => void;
}) {
  const [url, setUrl] = useState(product.productUrl);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');
  const [fetchOk, setFetchOk] = useState(false);
  const [showFields, setShowFields] = useState(!!product.title);

  async function doFetch() {
    const u = url.trim();
    if (!u) return;
    setFetching(true);
    setFetchMsg('');
    setFetchOk(false);
    try {
      const res = await fetch('/api/product/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      const data: FetchResult = await res.json();
      const updated: ProductInfo = {
        ...product,
        productUrl: u,
        title: data.title || product.title,
        store: data.siteName || data.brand || product.store,
        price: data.price != null ? String(data.price) : product.price,
        currency: data.currency || product.currency,
        imageUrl: data.image || product.imageUrl,
      };
      setProduct(updated);
      setFetchOk(true);
      setShowFields(true);
      if (data.partial) setFetchMsg(t.bfm2FetchPartial);
    } catch {
      setFetchMsg(t.bfm2FetchPartial);
      setShowFields(true);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="ds-label">{t.bfm2UrlLabel}</label>
        <div className="flex gap-2">
          <input
            type="url"
            className="ds-input flex-1"
            placeholder={t.bfm2UrlPlaceholder}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doFetch(); }}
            dir="ltr"
          />
          <button
            onClick={doFetch}
            disabled={fetching || !url.trim()}
            className="ds-btn-primary px-4 py-2 flex-shrink-0 disabled:opacity-50"
          >
            {fetching ? t.bfm2Fetching : t.bfm2FetchBtn}
          </button>
        </div>
        {fetchMsg && (
          <p className={`text-xs mt-1 ${fetchOk && !product.title ? 'text-amber-600' : fetchOk ? 'text-amber-600' : 'text-red-500'}`}>
            {fetchMsg}
          </p>
        )}
      </div>

      {/* Product preview card */}
      {fetchOk && product.imageUrl && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-3">
          <img
            src={product.imageUrl}
            alt=""
            className="w-16 h-16 object-contain rounded-lg bg-white border border-gray-100 flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{product.title || '—'}</p>
            <p className="text-xs text-gray-500">{product.store}</p>
            {product.price && (
              <p className="text-sm font-bold text-cyan-600 mt-0.5">
                {CURR_FLAGS[product.currency] || ''} {product.price} {product.currency}
              </p>
            )}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-gray-400 hover:text-cyan-500">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Editable fields appear after fetch or always show */}
      {showFields && <EditableProductFields t={t} product={product} setProduct={setProduct} />}
    </div>
  );
}

// ── Editable Product Fields (shared between Link + Manual tabs) ───────────────

function EditableProductFields({ t, product, setProduct }: {
  t: Translations;
  product: ProductInfo;
  setProduct: (p: ProductInfo) => void;
}) {
  const [showCurrModal, setShowCurrModal] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <label className="ds-label">{t.bfm2ProdTitleLabel}</label>
        <input className="ds-input" placeholder={t.bfm2ProdTitlePlaceholder}
          value={product.title} onChange={e => setProduct({ ...product, title: e.target.value })} />
      </div>
      <div>
        <label className="ds-label">{t.bfm2ProdStore}</label>
        <input className="ds-input" placeholder={t.bfm2ProdStorePlaceholder}
          value={product.store} onChange={e => setProduct({ ...product, store: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="ds-label">{t.spAmount}</label>
          <input type="number" className="ds-input" placeholder="0" min="0" step="0.01"
            value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} />
        </div>
        <div className="w-32">
          <label className="ds-label">{t.spCurrency}</label>
          <button
            type="button"
            onClick={() => setShowCurrModal(true)}
            className="ds-input flex items-center justify-between w-full text-left"
          >
            <span>{CURR_FLAGS[product.currency] || ''} {product.currency}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      <div>
        <label className="ds-label">{t.bfm2ProdQty}</label>
        <input type="number" className="ds-input" placeholder="1" min="1" step="1"
          value={product.qty} onChange={e => setProduct({ ...product, qty: e.target.value })} />
      </div>
      <div>
        <label className="ds-label">{t.bfm2ProdImageUrl}</label>
        <input className="ds-input" placeholder={t.bfm2ProdImagePlaceholder} dir="ltr"
          value={product.imageUrl} onChange={e => setProduct({ ...product, imageUrl: e.target.value })} />
      </div>

      {/* Currency modal */}
      {showCurrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setShowCurrModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <span className="text-base font-extrabold text-gray-900">{t.spCurrencyModal}</span>
              <button onClick={() => setShowCurrModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="pb-6">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setProduct({ ...product, currency: c.code }); setShowCurrModal(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${product.currency === c.code ? 'bg-cyan-50' : ''}`}>
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-sm font-extrabold text-cyan-600 w-14 text-left">{c.code}</span>
                  {product.currency === c.code && <CheckCircle className="w-4 h-4 text-cyan-500 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BuyForMe Form ─────────────────────────────────────────────────────────────

function BuyForMeForm({ t, isRTL, onHome, onNavigate, onNeedAuth, product, setProduct, value, setValue }: {
  t: Translations;
  isRTL: boolean;
  onHome: () => void;
  onNavigate?: (page: string) => void;
  onNeedAuth?: () => void;
  product: ProductInfo;
  setProduct: (p: ProductInfo) => void;
  value: ValueInfo;
  setValue: (v: ValueInfo) => void;
}) {
  const { session } = useSession();
  const [tab, setTab] = useState<'link' | 'manual'>('link');
  const [dest, setDest] = useState<DestInfo>({ country: '', city: '', deliveryType: 'standard' });
  const [recip, setRecip] = useState<RecipInfo>({ firstName: '', lastName: '', phone: '', email: '', address: '' });
  const [err, setErr] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [successId, setSuccessId] = useState('');

  // Prefill value from product price when product changes
  const syncValue = useCallback((p: ProductInfo) => {
    setProduct(p);
    if (p.price && !value.amount) {
      setValue({ amount: p.price, currency: p.currency || 'USD' });
    }
  }, [setProduct, setValue, value.amount]);

  async function publish() {
    if (!session) { onNeedAuth?.(); return; }
    if (!product.title.trim() || !product.store.trim()) { setErr(t.bfm2ErrProduct); return; }
    if (!dest.country.trim() || !dest.city.trim()) { setErr(t.bfm2ErrDest); return; }
    if (!value.amount) { setErr(t.bfm2ErrValue); return; }
    if (!recip.firstName.trim() || !recip.phone.trim()) { setErr(t.bfm2ErrRecip); return; }

    const usdVal = getUSD(value.amount, value.currency);
    setErr('');
    setPublishing(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'buyforme',
          product: {
            title:    product.title,
            store:    product.store,
            url:      product.productUrl || null,
            price:    parseFloat(product.price) || null,
            currency: product.currency,
            qty:      parseInt(product.qty) || 1,
            image:    product.imageUrl || null,
          },
          destination: {
            country:      dest.country,
            city:         dest.city,
            deliveryType: dest.deliveryType,
          },
          value: {
            amount:    parseFloat(value.amount),
            currency:  value.currency,
            amountUSD: parseFloat(usdVal.toFixed(2)),
          },
          recipient: {
            name:      [recip.firstName, recip.lastName].filter(Boolean).join(' '),
            firstName: recip.firstName,
            lastName:  recip.lastName,
            phone:     recip.phone,
            email:     recip.email || null,
            address:   recip.address || null,
          },
          userId:    session?.userId ?? null,
          createdBy: [session?.firstName, session?.lastName].filter(Boolean).join(' ') || session?.email || null,
        }),
      });
      const data = await res.json() as { ok: boolean; order?: { id: string } };
      if (data.ok && data.order?.id) {
        setSuccessId(data.order.id);
      } else {
        setErr(t.bfm2ErrServer);
      }
    } catch {
      setErr(t.bfm2ErrServer);
    } finally {
      setPublishing(false);
    }
  }

  // Success screen
  if (successId) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="ds-card p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-9 h-9 text-green-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{t.bfm2SuccessTitle}</h2>
        <p className="text-gray-500 mb-4">{t.bfm2SuccessDesc}</p>
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-mono text-gray-600 mb-6 border border-gray-200">
          {t.bfm2SuccessIdLabel} <span className="font-bold text-cyan-600">{successId}</span>
        </div>
        <div className="flex flex-col gap-3">
          <button className="ds-btn-primary py-3"
            onClick={() => onNavigate?.('marketplace')}>
            {t.bfm2SuccessMarket}
          </button>
          <button className="ds-btn-secondary py-3"
            onClick={() => { setSuccessId(''); setProduct({ title:'',store:'',price:'',currency:'USD',qty:'1',imageUrl:'',productUrl:'' }); setDest({ country:'',city:'',deliveryType:'standard' }); setValue({ amount:'',currency:'USD' }); setRecip({ firstName:'',lastName:'',phone:'',email:'',address:'' }); }}>
            {t.bfm2NewOrder}
          </button>
          <button className="ds-btn-secondary py-3" onClick={onHome}>{t.backHome}</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section: Recipient + Destination */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="ds-card p-6">
        <SectionHeader title={t.bfm2RecipSection} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="ds-label">{t.bfm2DestCountry}</label>
            <input className="ds-input" placeholder={t.bfm2DestCountryPlaceholder}
              value={dest.country} onChange={e => setDest({ ...dest, country: e.target.value })} />
          </div>
          <div>
            <label className="ds-label">{t.bfm2DestCity}</label>
            <input className="ds-input" placeholder={t.bfm2DestCityPlaceholder}
              value={dest.city} onChange={e => setDest({ ...dest, city: e.target.value })} />
          </div>
        </div>
        <div className="mb-3">
          <label className="ds-label">{t.bfm2DestType}</label>
          <div className="flex gap-3">
            {(['standard', 'express'] as const).map(dt => (
              <button key={dt} onClick={() => setDest({ ...dest, deliveryType: dt })}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                  ${dest.deliveryType === dt ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                {dt === 'standard' ? t.bfm2DestStandard : t.bfm2DestExpress}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="ds-label">{t.spRecFirstName}</label>
            <input className="ds-input" placeholder={t.spRecFirstName}
              value={recip.firstName} onChange={e => setRecip({ ...recip, firstName: e.target.value })} />
          </div>
          <div>
            <label className="ds-label">{t.spRecLastName}</label>
            <input className="ds-input" placeholder={t.spRecLastName}
              value={recip.lastName} onChange={e => setRecip({ ...recip, lastName: e.target.value })} />
          </div>
        </div>
        <div className="mb-3">
          <label className="ds-label">{t.spRecPhone}</label>
          <input className="ds-input" type="tel" placeholder="+98..." dir="ltr"
            value={recip.phone} onChange={e => setRecip({ ...recip, phone: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="ds-label">{t.spRecEmail}</label>
          <input className="ds-input" type="email" placeholder={t.spRecEmailPlaceholder} dir="ltr"
            value={recip.email} onChange={e => setRecip({ ...recip, email: e.target.value })} />
        </div>
        <div>
          <label className="ds-label">{t.spRecAddress}</label>
          <input className="ds-input" placeholder={t.spRecAddressPlaceholder}
            value={recip.address} onChange={e => setRecip({ ...recip, address: e.target.value })} />
        </div>
      </motion.div>

      {/* Section 5: Review + Publish */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="ds-card p-6">
        <SectionHeader title={t.bfm2ReviewSection} />
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100 mb-5 text-sm">
          {[
            { label: t.bfm2ReviewMode,    val: t.buyForMe },
            { label: t.bfm2ReviewProduct, val: [product.title, product.store].filter(Boolean).join(' / ') || '—' },
            { label: t.bfm2ReviewDest,    val: [dest.city, dest.country].filter(Boolean).join(', ') || '—' },
            { label: t.bfm2ReviewValue,   val: value.amount ? `${CURR_FLAGS[value.currency] || ''} ${value.amount} ${value.currency}` : '—' },
            { label: t.bfm2ReviewRecip,   val: [recip.firstName, recip.lastName].filter(Boolean).join(' ') || '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between px-4 py-2.5 gap-4">
              <span className="text-gray-500 flex-shrink-0">{row.label}</span>
              <span className="font-semibold text-gray-800 text-right truncate">{row.val}</span>
            </div>
          ))}
        </div>
        <Err msg={err} />
        <button
          onClick={() => { setErr(''); publish(); }}
          disabled={publishing}
          className="ds-btn-primary w-full py-3 mt-4 disabled:opacity-60"
        >
          {publishing
            ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.bfm2Publishing}</span>
            : t.bfm2Publish}
        </button>
      </motion.div>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export default function BuyForMeFlow({ onBack, onHome, t, isRTL, onNavigate, onNeedAuth }: {
  onBack: () => void;
  onHome: () => void;
  t: Translations;
  isRTL: boolean;
  onNavigate?: (page: string) => void;
  onNeedAuth?: () => void;
}) {
  const { lang } = useLang();
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('selector');
  // Lifted state — shared between ProductFinder (lead) and BuyForMeForm
  const [product, setProduct] = useState<ProductInfo>({
    title: '', store: '', price: '', currency: 'USD', qty: '1', imageUrl: '', productUrl: '',
  });
  const [value, setValue] = useState<ValueInfo>({ amount: '', currency: 'USD' });

  function goBack() {
    if (mode !== 'selector') setMode('selector');
    else onBack();
  }

  const headingLabel = mode === 'selector' ? t.buyForMeTitle : t.buyForMe;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold text-gray-900 leading-tight truncate">{headingLabel}</h1>
        </div>
        <button onClick={onHome} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <Home className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── Selector: choose Buy-For-Me or Commercial ── */}
          {mode === 'selector' && (
            <motion.div key="selector" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ModeSelector
                t={t}
                isRTL={isRTL}
                onSelectBuyForMe={() => setMode('buyforme')}
                onSelectCommercial={() => setMode('commercial')}
              />
            </motion.div>
          )}

          {/* ── Buy-For-Me: ProductFinder lead + order form ── */}
          {mode === 'buyforme' && (
            <motion.div key="buyforme" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ChaparConcierge language={lang} userName={session?.firstName || ""} />
            </motion.div>
          )}

          {/* ── Commercial: coming-soon stub ── */}
          {mode === 'commercial' && (
            <motion.div key="commercial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="ds-card p-10 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-extrabold text-gray-800 mb-2">{t.bfm2Commercial}</h2>
              <p className="text-sm text-gray-500 mb-4">{t.bfm2CommercialDesc}</p>
              <span className="inline-block text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                {t.bfm2ComingSoon}
              </span>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
