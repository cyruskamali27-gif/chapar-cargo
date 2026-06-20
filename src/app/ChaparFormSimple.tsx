// @ts-nocheck
import { useState } from "react";
import { Check, ShoppingBag, ExternalLink } from "lucide-react";

export default function ChaparFormSimple({ product, onSubmit }) {
  const [f, setF] = useState({ name: "", phone: "", country: "", city: "", ship: "standard", email: "" });
  const [done, setDone] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const ok = f.name.trim() && f.phone.trim() && f.country.trim() && f.city.trim();
  const field = "w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60 transition";
  const lab = "mb-1.5 block text-xs text-white/45";

  if (done) return (
    <div dir="rtl" className="p-6 text-center font-sans text-white">
      <div className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full" style={{ background: "linear-gradient(135deg,#10b981,#22d3ee)" }}><Check size={30} /></div>
      <div className="mt-4 text-lg font-bold">سفارش ثبت شد</div>
      <div className="mt-1 text-sm text-white/50">{f.name} · {f.city}، {f.country}</div>
    </div>
  );

  return (
    <div dir="rtl" className="p-5 font-sans">
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg text-cyan-300" style={{ background: "linear-gradient(135deg,#6366f14d,#22d3ee33)" }}><ShoppingBag size={17} /></div>
        <div className="flex-1"><div className="text-sm font-bold text-white">{product?.title || `${product?.brand || ""} ${product?.model || ""}` || "محصولِ تأییدشده"}</div><div className="text-[11px] text-white/40">{[product?.brand, product?.country, "تأییدشده"].filter(Boolean).join(" · ")}</div></div>
        <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(product?.searchQuery || product?.title || "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-cyan-300"><ExternalLink size={13} /> لینک</a>
      </div>
      <div className="mt-5 mb-3 text-sm font-bold text-white/90">اطلاعاتِ گیرنده</div>
      <div className="space-y-3.5">
        <div><label className={lab}>نامِ گیرنده</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="نام و نام خانوادگی" className={field} /></div>
        <div><label className={lab}>تلفنِ گیرنده</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+98…" className={field} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lab}>کشورِ مقصد</label><input value={f.country} onChange={(e) => set("country", e.target.value)} placeholder="مثلاً ایران" className={field} /></div>
          <div><label className={lab}>شهر</label><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="مثلاً تهران" className={field} /></div>
        </div>
        <div>
          <label className={lab}>نوعِ تحویل</label>
          <div className="grid grid-cols-2 gap-3">
            {[["standard", "استاندارد"], ["express", "اکسپرس"]].map(([k, t]) => (
              <button key={k} onClick={() => set("ship", k)} className={`rounded-xl border py-3 text-sm transition ${f.ship === k ? "border-cyan-400 bg-cyan-400/10 text-white" : "border-white/12 bg-white/[0.03] text-white/60"}`}>{t}</button>
            ))}
          </div>
        </div>
        <div><label className={lab}>ایمیلِ گیرنده <span className="text-white/25">(اختیاری)</span></label><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="recipient@example.com" className={field} /></div>
        <button disabled={!ok} onClick={() => { onSubmit?.(f); setDone(true); }} className="mt-1 w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1)" }}>ثبتِ سفارش</button>
      </div>
    </div>
  );
}
