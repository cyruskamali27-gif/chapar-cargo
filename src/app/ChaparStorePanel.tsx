// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { brandColor } from "./brandTheme";
export default function ChaparStorePanel({ product, onContinue, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => {
    let alive = true; setLoading(true);
    (async () => {
      try {
        const r = await fetch("/api/product/variants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: product?.searchQuery || product?.title }) });
        const d = await r.json(); if (alive) { setData(d); if (d?.colors?.[0]) setColor(d.colors[0].label); }
      } catch { if (alive) setData({}); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [product]);
  const colors = data?.colors || [], sizes = data?.sizes || [];
  const brand = data?.brand || product?.brand || "";
  const domain = data?.brandDomain;
  const title = data?.title || product?.title || `${product?.brand || ""} ${product?.model || ""}`;
  const price = data?.priceFrom;
  const selColor = colors.find((c) => c.label === color);
  const heroImg = selColor?.image || colors[0]?.image || product?.image;
  const canContinue = !sizes.length || !!size;
  const accent = brandColor(brand, domain);
  const accentTint = accent + "26"; // ~15% opacity tint for selected bg
  return (
    <div dir="rtl" className="p-5 font-sans text-white">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50"><ArrowLeft size={15} /> بازگشت</button>
      <div className="mb-4 flex items-center gap-3">
        {domain && logoOk ? <img src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`} onError={() => setLogoOk(false)} alt={brand} className="h-8 w-8 rounded bg-white/90 p-1 object-contain" /> : <div className="text-lg font-extrabold tracking-wide">{brand || "Store"}</div>}
        {brand && <div className="text-xs text-white/40">فروشگاهِ {brand}</div>}
      </div>
      {loading ? <div className="py-16 text-center text-sm text-white/50">در حالِ آماده‌سازیِ فروشگاه…</div> : (
        <>
          {heroImg && <img src={heroImg} alt={title} className="mb-3 h-44 w-full rounded-2xl bg-white object-contain" />}
          <div className="mb-1 text-base font-bold">{title}</div>
          {price != null && <div className="mb-4 font-medium" style={{ color: accent }}>از ${price}</div>}
          {colors.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs text-white/45">رنگ</div>
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
              <div className="mb-2 text-xs text-white/45">سایز</div>
              <div dir="ltr" className="flex flex-wrap gap-2">
                {sizes.map((s) => <button key={s} onClick={() => setSize(s)} className="rounded-lg border px-3 py-2 text-sm transition-all" style={{ borderColor: size === s ? accent : "rgba(255,255,255,0.12)", background: size === s ? accentTint : "rgba(255,255,255,0.03)", color: size === s ? "#fff" : "rgba(255,255,255,0.7)" }}>{s}</button>)}
              </div>
            </div>
          )}
          <button disabled={!canContinue} onClick={() => onContinue({ color, size, image: heroImg, link: selColor?.link || product?.link, priceUSD: price })} className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}>
            <span className="inline-flex items-center justify-center gap-1"><Check size={15} /> ادامه</span>
          </button>
        </>
      )}
    </div>
  );
}
