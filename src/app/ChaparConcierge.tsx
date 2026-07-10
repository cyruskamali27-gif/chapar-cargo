// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Send, Mic, Image as ImageIcon, Check, RotateCw, ExternalLink, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import ChaparStorePanel from "./ChaparStorePanel";
import ChaparGrid from "./ChaparGrid";

const LANGS = {
  fa: { name: "Persian (Farsi)", tts: "fa-IR", greet: "خوش آمدید. چه چیزی برایتان بخرم؟" },
  en: { name: "English", tts: "en-US", greet: "Welcome. What should I buy for you?" },
  ar: { name: "Arabic", tts: "ar-SA", greet: "أهلاً بك. ماذا أشتري لك؟" },
  tr: { name: "Turkish", tts: "tr-TR", greet: "Hoş geldiniz. Sizin için ne alayım?" },
  fr: { name: "French", tts: "fr-FR", greet: "Bienvenue. Que dois-je acheter pour vous ?" },
};

const CARD_BG = { background: "radial-gradient(130% 80% at 50% 25%, #0f1330, #05060d 70%)" };

const TAX = { CA: 0.13, US: 0.07, GB: 0.20, DE: 0.19, FR: 0.20, TR: 0.20, AE: 0.05 };
const COUNTRIES = [
  { code: "CA", label: "کانادا 🇨🇦" }, { code: "US", label: "آمریکا 🇺🇸" },
  { code: "GB", label: "انگلیس 🇬🇧" }, { code: "DE", label: "آلمان 🇩🇪" },
  { code: "FR", label: "فرانسه 🇫🇷" }, { code: "TR", label: "ترکیه 🇹🇷" }, { code: "AE", label: "امارات 🇦🇪" },
];

export default function ChaparConcierge({ language = "fa", userName = "", onPublished }: { language?: string; userName?: string; onPublished?: (orderId: string) => void }) {
  const lang = LANGS[language] ? language : "fa";
  const rtl = ["fa", "ar"].includes(lang);
  const [messages, setMessages] = useState([{ role: "assistant", text: LANGS[lang].greet, _api: null }]);
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false); const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false); const [orderProduct, setOrderProduct] = useState(null);
  const [stage, setStage] = useState(null); const [variant, setVariant] = useState(null);
  const [gridResults, setGridResults] = useState([]);
  const [voiceErr, setVoiceErr] = useState("");
  const [priority, setPriority] = useState(null);   // "fast" | "any"
  const [estCountry, setEstCountry] = useState("CA");
  const [specialRequest, setSpecialRequest] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const fileRef = useRef(null), scrollRef = useRef(null);

  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  function speak(text) {
    if (muted || !window.speechSynthesis) return;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(lang));
    if (!v) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = LANGS[lang].tts; u.voice = v;
    u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  async function fetchPrice(q) {
    try {
      const r = await fetch("/api/product/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      const d = await r.json();
      if (!d.ok || !d.cheapest) return null;
      const c = d.cheapest;
      return { title: c.title || null, priceUSD: c.priceUSD ?? null, currency: c.currency || null, country: c.country || null, link: c.link || null, image: c.image || null };
    } catch { return null; }
  }

  async function callAI(hist, img) {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, userName, messages: hist.filter((m) => m._api).map((m) => m._api), ...(img ? { imageBase64: img.b64, imageMimeType: img.mime } : {}) }) });
      const data = await res.json();
      if (data.browse && data.searchQuery) {
        setMessages((m) => [...m, { role: "assistant", text: data.reply || "چند گزینه آوردم", _api: { role: "assistant", content: data.reply || "" } }]);
        speak(data.reply || "");
        try {
          const r = await fetch("/api/product/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: data.searchQuery }) });
          const sd = await r.json();
          setGridResults(sd.results || []);
          setStage("grid");
        } catch {}
        setLoading(false);
        return;
      }
      const reply = data.reply || "…";
      const rawProduct = data.resolved ? (data.product || null) : null;
      const msgId = Date.now();
      const product = rawProduct ? { ...rawProduct, priceLoading: true, _msgId: msgId } : null;
      setMessages((m) => [...m, { role: "assistant", text: reply, product, _api: { role: "assistant", content: reply } }]);
      speak(reply);
      if (rawProduct?.searchQuery) {
        fetchPrice(rawProduct.searchQuery).then((priceData) => {
          setMessages((m) => m.map((msg) => {
            if (msg.product?._msgId === msgId) {
              const merged = priceData ? { ...msg.product, ...priceData } : msg.product;
              return { ...msg, product: { ...merged, priceLoading: false } };
            }
            return msg;
          }));
        });
      }
    } catch { setMessages((m) => [...m, { role: "assistant", text: "ارتباط برقرار نشد.", _api: null }]); } finally { setLoading(false); }
  }

  function send(txt) { const t = (txt ?? input).trim(); if (!t || loading) return; const next = [...messages, { role: "user", text: t, _api: { role: "user", content: t } }]; setStage(null); setOrderProduct(null); setPublishResult(null); setGridResults([]); setMessages(next); setInput(""); callAI(next); }
  function more() { if (loading) return; const next = [...messages, { role: "user", text: "بیشتر بگردیم.", _api: { role: "user", content: "Suggest a different option." } }]; setMessages(next); callAI(next); }
  function confirmProduct(p) { setOrderProduct(p); setStage("store"); }
  async function doPublish() {
    setPublishing(true);
    try {
      const r = await fetch("/api/marketplace/publish", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: orderProduct, variant: variant || null,
          priority: priority || "any", country: estCountry, specialRequest: specialRequest || "" }) });
      const d = await r.json();
      if (d.ok) { setPublishResult(d.orderId); if (onPublished) setTimeout(() => onPublished(d.orderId), 1800); } else setPublishResult(null);
    } catch { setPublishResult(null); }
    setPublishing(false);
  }
  function onImg(e) { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const d = String(rd.result), b = d.split(",")[1]; const next = [...messages, { role: "user", text: "📷", image: d, _api: { role: "user", content: "Identify this product." } }]; setMessages(next); callAI(next, { b64: b, mime: f.type || "image/jpeg" }); }; rd.readAsDataURL(f); e.target.value = ""; }
  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceErr("این مرورگر تشخیصِ گفتار ندارد — از Chrome استفاده کنید"); return; }
    setVoiceErr("");
    const rec = new SR(); rec.lang = LANGS[lang].tts; rec.interimResults = false; rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => { setListening(false); send(e.results[0][0].transcript); };
    rec.onerror = (e) => { setListening(false); setVoiceErr("خطای میکروفون: " + (e.error || "نامشخص")); };
    try { rec.start(); } catch (err) { setVoiceErr("خطا در شروع: " + (err?.message || err)); }
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-2xl space-y-4 p-3 font-sans">
      <style>{`@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* video hero */}
      <div className="relative h-[30vh] max-h-[320px] w-full overflow-hidden rounded-3xl mb-4">
        <video src="https://chapar-cargo-scans.tor1.digitaloceanspaces.com/doc_2026-06-19_21-42-45.mp4" autoPlay loop muted playsInline preload="metadata" onError={(e) => (e.currentTarget.style.display = 'none')} className="absolute inset-0 h-full w-full object-cover" />
      </div>


      {/* ── SECTION 1 — AI CARD (always visible) ── */}
      <div className="overflow-hidden rounded-[28px]" style={CARD_BG}>

        {/* chat messages */}
        <div ref={scrollRef} className="max-h-[40vh] space-y-2 overflow-y-auto px-4 pt-2">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[86%] ${m.role === "user" ? "ms-auto" : "me-auto"}`} style={{ animation: "up .35s ease both" }}>
              {m.image && <img src={m.image} alt="" className="mb-1 max-h-28 rounded-xl border border-white/15" />}
              <div className="rounded-2xl px-3.5 py-2 text-sm leading-relaxed" style={m.role === "user" ? { background: "linear-gradient(135deg,#22d3eecc,#6366f1cc)", color: "#fff" } : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#eaf2ff" }}>{m.text}</div>
              {m.product && (
                <div className="mt-2 rounded-2xl border border-white/10 p-3" style={{ background: "rgba(15,18,32,.7)" }}>
                  {m.product.image && (m.product.image.startsWith("http") || m.product.image.startsWith("data:")) && (
                    <img src={m.product.image} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
                  )}
                  <div className="flex items-center gap-3">
                    {!(m.product.image && (m.product.image.startsWith("http") || m.product.image.startsWith("data:"))) && (
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-cyan-300" style={{ background: "linear-gradient(135deg,#6366f14d,#22d3ee33)" }}><ShoppingBag size={20} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-bold text-white">{m.product.title || `${m.product.brand || ""} ${m.product.model || ""}`.trim()}</div>
                      <div className="text-xs text-white/40">
                        {m.product.priceLoading
                          ? "در حال یافتن بهترین قیمت…"
                          : [m.product.priceUSD != null && `$${m.product.priceUSD}`, m.product.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <a href={m.product.link || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(m.product.searchQuery || m.product.title || "")}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-cyan-300">مشاهدهٔ محصول <ExternalLink size={14} /></a>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => confirmProduct(m.product)} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#10b981,#22d3ee)" }}><Check size={15} /> بله، همین است</button>
                    <button onClick={more} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70"><RotateCw size={14} /> بیشتر</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && <div className="me-auto max-w-[86%]"><div className="rounded-2xl px-3.5 py-2 text-sm text-white/40" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>…</div></div>}
        </div>

        {/* input bar */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-end"><button onClick={() => setMuted(!muted)} className="text-white/60">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button></div>
          {voiceErr && <div className="mb-1 text-center text-[11px] text-rose-300">{voiceErr}</div>}
          <div className="flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/60"><ImageIcon size={19} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImg} />
            <button onClick={voice} className={`grid h-10 w-10 place-items-center rounded-full ${listening ? "bg-rose-500 text-white" : "bg-white/5 text-cyan-300"}`}><Mic size={19} /></button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="بنویسید یا حرف بزنید…" className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
            <button onClick={() => send()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1)" }}><Send size={18} /></button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 — PROCESS CARD (only when stage !== null) ── */}
      {stage && (
        <div className="overflow-hidden rounded-[28px]" style={CARD_BG}>
          {stage === "grid" && (
            <ChaparGrid
              results={gridResults}
              onPick={(r) => confirmProduct(r)}
              onBack={() => setStage(null)}
            />
          )}
          {stage === "store" && (
            <ChaparStorePanel
              product={orderProduct}
              onContinue={(v) => { setVariant(v); setStage("estimate"); }}
              onBack={() => { if (gridResults.length) { setStage("grid"); } else { setOrderProduct(null); setStage(null); } }}
            />
          )}
          {stage === "estimate" && (() => {
            const base = Number(orderProduct?.priceUSD) || 0;
            const rate = TAX[estCountry] ?? 0;
            const tax = base * rate;
            const subtotal = base + tax;
            return (
              <div dir="rtl" className="p-5 text-white">
                <button onClick={() => setStage("store")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
                <div className="mb-1 text-base font-bold">تخمین هزینه</div>
                <div className="mb-4 text-xs text-white/50">{orderProduct?.title}</div>

                <div className="mb-4">
                  <div className="mb-2 text-xs text-white/50">کشور خرید</div>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map(c => (
                      <button key={c.code} onClick={() => setEstCountry(c.code)}
                        className={"rounded-full border px-3 py-1.5 text-xs " + (estCountry === c.code ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/[0.03] text-white/60")}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                  <div className="flex justify-between"><span className="text-white/60">قیمت کالا</span><span className="text-white">${base.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">مالیات تخمینی ({Math.round(rate * 100)}٪)</span><span className="text-white">${tax.toFixed(2)}</span></div>
                  <div className="h-px bg-white/10"></div>
                  <div className="flex justify-between font-bold"><span className="text-white/80">جمع تقریبی</span><span className="text-cyan-300">${subtotal.toFixed(2)}</span></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-white/45">
                    کارمزد مسافر هنوز اضافه نشده — این مبلغ بعد از اینکه مسافر پیشنهاد داد مشخص و به جمع اضافه می‌شود.
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 text-xs text-white/50">درخواست خاص (اختیاری)</div>
                  <input value={specialRequest} onChange={e => setSpecialRequest(e.target.value)}
                    placeholder="مثلاً: روی ایرپاد حکاکی شود: Cyrus"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none" />
                </div>

                <button onClick={() => setStage("priority")}
                  className="w-full rounded-2xl bg-gradient-to-l from-cyan-400 to-blue-500 py-3 text-sm font-bold text-white">ادامه</button>
              </div>
            );
          })()}
          {stage === "priority" && (
            <div dir="rtl" className="p-5 text-white">
              <button onClick={() => setStage("estimate")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
              <div className="mb-4 text-base font-bold">چقدر عجله داری؟</div>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => { setPriority("fast"); setStage("publish"); }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.08]">
                  <div className="text-sm font-bold text-white">سریع می‌خواهم ⚡</div>
                  <div className="mt-1 text-xs text-white/50">از کشورهایی که مسافر فعال دارند</div>
                </button>
                <button onClick={() => { setPriority("any"); setStage("publish"); }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.08]">
                  <div className="text-sm font-bold text-white">فرقی نمی‌کند 🌍</div>
                  <div className="mt-1 text-xs text-white/50">ارزان‌ترین مسیر، بر اساس پیشنهاد مسافرها</div>
                </button>
              </div>
            </div>
          )}
          {stage === "publish" && (
            <div dir="rtl" className="p-5 text-white">
              <button onClick={() => setStage("priority")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
              <div className="mb-1 text-base font-bold">انتشار در بازارگاه</div>
              <div className="mb-4 text-xs text-white/50">سفارش در بازارگاه منتشر می‌شود تا مسافرها پیشنهاد بدهند.</div>
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <div className="font-medium text-white">{orderProduct?.title}</div>
                {variant && <div className="mt-1 text-xs text-white/50">{[variant.color, variant.size].filter(Boolean).join(" · ")}</div>}
                <div className="mt-1 text-xs text-white/50">{priority === "fast" ? "اولویت: سریع ⚡" : "اولویت: فرقی نمی‌کند 🌍"}</div>
              </div>
              {(() => {
                const missing = [];
                if (!orderProduct?.title || orderProduct.title.trim().length <= 2) missing.push("نام محصول معتبر");
                if (!orderProduct?.priceUSD) missing.push("قیمت تخمینی");
                if (!estCountry) missing.push("کشور مقصد");
                return missing.length > 0 ? (
                  <div className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                    برای انتشار تکمیل کنید: {missing.join("، ")}
                  </div>
                ) : null;
              })()}
              {publishResult
                ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm text-emerald-300">سفارش منتشر شد ✓<div className="mt-1 text-xs text-emerald-200/70">کد سفارش: {publishResult}</div></div>
                : <button disabled={publishing || !orderProduct?.title || (orderProduct.title.trim().length <= 2) || !orderProduct?.priceUSD || !estCountry} onClick={doPublish}
                    className="w-full rounded-2xl bg-gradient-to-l from-cyan-400 to-blue-500 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {publishing ? "در حال انتشار…" : "تأیید و انتشار در بازارگاه"}
                  </button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
