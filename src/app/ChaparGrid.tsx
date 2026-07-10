// @ts-nocheck
import { ArrowLeft } from "lucide-react";
export default function ChaparGrid({ results, onPick, onBack }) {
  return (
    <div dir="rtl" className="p-4 font-sans text-white">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50"><ArrowLeft size={15} /> بازگشت</button>
      <div className="mb-3 text-sm font-bold text-white/90">یکی را انتخاب کن</div>
      {(!results || results.length === 0) ? <div className="py-10 text-center text-sm text-white/40">موردی پیدا نشد</div> : (
        <div className="grid grid-cols-2 gap-3">
          {results.map((r, i) => (
            <button key={i} onClick={() => onPick(r)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-right">
              {r.image ? <img src={r.image} alt={r.title} className="h-28 w-full bg-white object-contain" /> : <div className="grid h-28 w-full place-items-center bg-white/5 text-xs text-white/40">بدون عکس</div>}
              <div className="p-2.5">
                <div className="line-clamp-2 text-xs font-medium text-white">{r.title}</div>
                {r.priceUSD != null && <div className="mt-1 text-xs text-cyan-300">${r.priceUSD}</div>}
                {r.seller && <div className="text-[10px] text-white/35">{r.seller}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
