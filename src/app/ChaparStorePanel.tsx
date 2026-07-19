// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Check, RotateCw } from "lucide-react";
import { brandColor } from "./brandTheme";
export default function ChaparStorePanel({ product, onContinue, onBack, initialVariantData = null }) {
  // Perceived speed: the panel opens instantly with what the search result already gave us
  // (image / title / price hint). Only the variants (colors/sizes) arrive later — `enriching`
  // gates that section alone, never the whole panel.
  //
  // The variants scrape (Bright Data) is flaky: it can 504 after ~60s, or return an empty /
  // garbage body (r.json() then throws). Two hard rules so the user is NEVER trapped:
  //   1. a client-side timeout caps the wait — a hung scrape must not keep ادامه greyed.
  //   2. every failure/empty-body is treated as `degraded` → honest note + retry, and ادامه
  //      becomes tappable so the user can proceed without picking a variant.
  const [data, setData] = useState(initialVariantData);
  const [enriching, setEnriching] = useState(!initialVariantData);
  const [degraded, setDegraded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [color, setColor] = useState(initialVariantData?.colors?.[0]?.label ?? null);
  const [size, setSize] = useState(null);
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => {
    if (initialVariantData) { setEnriching(false); setDegraded(false); return; } // prefetched — nothing to fetch
    let alive = true; setEnriching(true); setDegraded(false);
    const ctrl = new AbortController();
    // Hard client cap — nginx only 504s at 60s, far too long to hold the button. 15s then fall back.
    const timer = setTimeout(() => ctrl.abort(), 15000);
    (async () => {
      try {
        const r = await fetch("/api/product/variants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: product?.searchQuery || product?.title }), signal: ctrl.signal });
        const d = r.ok ? await r.json().catch(() => null) : null; // empty/garbage body → null, not a throw
        if (!alive) return;
        if (d?.ok) { setData(d); if (d.colors?.[0]) setColor(d.colors[0].label); } // valid (may be genuinely empty)
        else { setData({}); setDegraded(true); }                                   // non-200 / empty body / ok:false
      } catch { if (alive) { setData({}); setDegraded(true); } }                    // timeout / network
      finally { clearTimeout(timer); if (alive) setEnriching(false); }
    })();
    return () => { alive = false; clearTimeout(timer); ctrl.abort(); };
  }, [product, initialVariantData, reloadKey]);
  const colors = data?.colors || [], sizes = data?.sizes || [];
  const brand = data?.brand || product?.brand || "";
  const domain = data?.brandDomain;
  const title = data?.title || product?.title || `${product?.brand || ""} ${product?.model || ""}`;
  const price = data?.priceFrom ?? product?.priceUSD ?? product?.priceLocal;
  const selColor = colors.find((c) => c.label === color);
  const heroImg = selColor?.image || colors[0]?.image || product?.image;
  // ادامه is tappable in all three cases: (a) variants loaded, no sizes to pick; (b) a size is
  // picked; (c) variants degraded/failed — proceed without a variant. Only held while `enriching`,
  // which is now bounded by the 15s timeout above, so it can never stay greyed indefinitely.
  const canContinue = !enriching && (degraded || !sizes.length || !!size);
  const accent = brandColor(brand, domain);
  const accentTint = accent + "26"; // ~15% opacity tint for selected bg
  return (
    <div dir="rtl" className="p-5 font-sans text-white">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50"><ArrowLeft size={15} /> بازگشت</button>
      <div className="mb-4 flex items-center gap-3">
        {domain && logoOk ? <img src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`} onError={() => setLogoOk(false)} alt={brand} className="h-8 w-8 rounded bg-white/90 p-1 object-contain" /> : <div className="text-lg font-extrabold tracking-wide">{brand || "Store"}</div>}
        {brand && <div className="text-xs text-white/50">فروشگاهِ {brand}</div>}
      </div>
      {heroImg && <img src={heroImg} alt={title} className="mb-3 h-44 w-full rounded-2xl bg-white object-contain" />}
      {enriching && <div className="mb-3 text-xs text-white/50">در حال دریافت قیمت‌ها از فروشگاه‌ها — بار اول کمی طول می‌کشد</div>}
      <div className="mb-1 text-base font-bold">{title}</div>
      {price != null && <div className="mb-4 font-medium" style={{ color: accent }}>از ${price}</div>}
      {enriching ? (
        /* inline skeleton — only the variants section waits, the rest of the panel is live */
        <div className="mb-5">
          <div className="mb-2 h-3 w-10 animate-pulse rounded bg-white/10" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 w-14 animate-pulse rounded-xl bg-white/5" />)}
          </div>
        </div>
      ) : degraded ? (
        /* honest fallback — scrape failed/timed out/empty; never trap the user */
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="text-xs leading-relaxed text-white/70">رنگ/سایز در دسترس نیست — می‌توانید ادامه دهید</div>
          <button onClick={() => setReloadKey((k) => k + 1)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white/80 hover:text-white">
            <RotateCw size={13} /> تلاش دوباره
          </button>
        </div>
      ) : (
        <>
          {colors.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs text-white/50">رنگ</div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c, i) => (
                  <button key={i} onClick={() => setColor(c.label)} className="overflow-hidden rounded-xl border transition-all" style={{ borderColor: color === c.label ? accent : "rgba(255,255,255,0.12)", boxShadow: color === c.label ? `0 0 0 2px ${accent}55` : "none" }}>
                    {c.image ? <img src={c.image} alt={c.label} className="h-14 w-14 object-cover" /> : <div className="grid h-14 w-14 place-items-center bg-white/5 px-1 text-center text-[10px] text-white/70">{c.label}</div>}
                  </button>
                ))}
              </div>
              {selColor && selColor.label && !/^default$/i.test(selColor.label) && <div className="mt-1 text-xs text-white/50">{selColor.label}</div>}
            </div>
          )}
          {sizes.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-xs text-white/50">سایز</div>
              <div dir="ltr" className="flex flex-wrap gap-2">
                {sizes.map((s) => <button key={s} onClick={() => setSize(s)} className="rounded-lg border px-3 py-2 text-sm transition-all" style={{ borderColor: size === s ? accent : "rgba(255,255,255,0.12)", background: size === s ? accentTint : "rgba(255,255,255,0.03)", color: size === s ? "#fff" : "rgba(255,255,255,0.7)" }}>{s}</button>)}
              </div>
            </div>
          )}
        </>
      )}
      <button disabled={!canContinue} onClick={() => onContinue({ color, size, image: heroImg, link: selColor?.link || product?.link, priceUSD: price })} className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}>
        <span className="inline-flex items-center justify-center gap-1"><Check size={15} /> ادامه</span>
      </button>
    </div>
  );
}
