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

// The corridors we actually price. TR is in the fan-out on purpose even though the retailer
// allowlist currently leaves it dark: showing "Turkey — no verified result" is information,
// silently dropping Turkey from the comparison is not. See retailers.json → _turkeyIsDark.
const PRICE_MARKETS = ["AE", "CA", "US", "GB", "TR"];
const MARKET_META = {
  AE: { flag: "🇦🇪", name: "امارات" }, CA: { flag: "🇨🇦", name: "کانادا" },
  US: { flag: "🇺🇸", name: "آمریکا" }, GB: { flag: "🇬🇧", name: "انگلیس" },
  TR: { flag: "🇹🇷", name: "ترکیه" }, DE: { flag: "🇩🇪", name: "آلمان" }, FR: { flag: "🇫🇷", name: "فرانسه" },
};
const fmtLocal = (v, c) => (v == null ? null : `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${c || ""}`.trim());

export default function ChaparConcierge({ language = "fa", userName = "", userId, onNeedAuth, onPublished }: { language?: string; userName?: string; userId?: string; onNeedAuth?: () => void; onPublished?: (orderId: string) => void }) {
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
  const [compare, setCompare] = useState({ loading: false, data: null, error: false });
  const [quote, setQuote] = useState(null);   // the country the buyer picked out of the comparison
  const fileRef = useRef(null), scrollRef = useRef(null);
  const [reduceMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

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

  // Fan out the cheapest-country comparison. Cold, this is a real wait (~15-35s: five live
  // SERP fetches), which is why it gets the ذرات هوشمند indicator and its own stage rather
  // than blocking the chat.
  async function runCompare() {
    const q = orderProduct?.searchQuery || orderProduct?.title;
    if (!q) { setCompare({ loading: false, data: null, error: true }); return; }
    setCompare({ loading: true, data: null, error: false });
    try {
      const r = await fetch("/api/product/price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, countries: PRICE_MARKETS }),
      });
      const d = await r.json();
      if (!d.ok) { setCompare({ loading: false, data: null, error: true }); return; }
      setCompare({ loading: false, data: d, error: false });
    } catch { setCompare({ loading: false, data: null, error: true }); }
  }

  function pickCountry(row) {
    setQuote({
      country: row.country, currency: row.currency, priceLocal: row.priceLocal,
      priceUSD: row.priceUSD, shop: row.shop, title: row.title, link: row.link,
      fetchedAt: compare.data?.fetchedAt || null,
    });
    setEstCountry(row.country);
    setStage("publish");
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

  function send(txt) { const t = (txt ?? input).trim(); if (!t || loading) return; const next = [...messages, { role: "user", text: t, _api: { role: "user", content: t } }]; setStage(null); setOrderProduct(null); setPublishResult(null); setGridResults([]); setQuote(null); setCompare({ loading: false, data: null, error: false }); setMessages(next); setInput(""); callAI(next); }
  function more() { if (loading) return; const next = [...messages, { role: "user", text: "بیشتر بگردیم.", _api: { role: "user", content: "Suggest a different option." } }]; setMessages(next); callAI(next); }
  function confirmProduct(p) { setOrderProduct(p); setStage("store"); }
  async function doPublish() {
    // Ownership guard: publishing requires a logged-in user — send them to auth instead of an anonymous post.
    if (!userId) { onNeedAuth?.(); return; }
    setPublishing(true);
    try {
      const r = await fetch("/api/marketplace/publish", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: orderProduct, variant: variant || null,
          priority: priority || "any", country: estCountry, specialRequest: specialRequest || "",
          priceQuote: quote || null, userId }) });
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

  const _lastMsg = messages[messages.length - 1];
  // Contextual status: after the reply is shown we're fetching product results; otherwise still thinking.
  const thinkingStatus = (loading && _lastMsg?.role === "assistant") ? "در حال جست‌وجو…" : "در حال فکر کردن…";

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-2xl space-y-4 p-3 font-sans">
      <style>{`@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes cc-spin{to{transform:rotate(360deg)}}
@keyframes cc-breathe{0%,100%{transform:scale(.75);box-shadow:0 0 6px 0 #22d3ee}50%{transform:scale(1.15);box-shadow:0 0 18px 3px #22d3ee}}
.cc-orbit{position:relative;width:30px;height:30px;flex:0 0 auto}
.cc-orbit .cc-core{position:absolute;inset:0;margin:auto;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle,#fff,#22d3ee);animation:cc-breathe 1.8s infinite ease-in-out}
.cc-orbit .cc-ring{position:absolute;inset:0;animation:cc-spin linear infinite}
.cc-orbit .cc-ring:nth-child(2){animation-duration:1.4s}
.cc-orbit .cc-ring:nth-child(3){animation-duration:2.1s;animation-direction:reverse}
.cc-orbit .cc-ring:nth-child(4){animation-duration:2.8s}
.cc-orbit .cc-ring i{position:absolute;top:-1px;left:50%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px -1px #22d3ee}
.cc-orbit .cc-ring:nth-child(3) i{background:#6366f1;box-shadow:0 0 8px -1px #6366f1}
.cc-orbit .cc-ring:nth-child(4) i{background:#3b82f6;box-shadow:0 0 8px -1px #3b82f6}`}</style>

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
          {loading && (
            <div className="me-auto max-w-[86%]" style={{ animation: "up .35s ease both" }}>
              <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                {reduceMotion ? (
                  <span className="text-sm text-white/45">در حال پردازش…</span>
                ) : (
                  <>
                    <span className="cc-orbit"><span className="cc-core" /><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span></span>
                    <span className="text-xs text-white/45">{thinkingStatus}</span>
                  </>
                )}
              </div>
            </div>
          )}
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
                <button onClick={() => { setPriority("cheapest"); setStage("cheapest"); runCompare(); }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.08]">
                  <div className="text-sm font-bold text-white">ارزان‌ترین 💰</div>
                  <div className="mt-1 text-xs text-white/50">قیمت را در ۵ کشور مقایسه می‌کنیم و خودتان انتخاب می‌کنید</div>
                </button>
                <button onClick={() => { setPriority("any"); setStage("publish"); }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.08]">
                  <div className="text-sm font-bold text-white">فرقی نمی‌کند 🌍</div>
                  <div className="mt-1 text-xs text-white/50">ارزان‌ترین مسیر، بر اساس پیشنهاد مسافرها</div>
                </button>
              </div>
            </div>
          )}

          {/* ── CHEAPEST — live cross-country comparison ────────────────────────────
              Three outcomes share this screen as equals: a price, "no verified result"
              (calm, muted — the honest-match filter found nothing it could stand behind),
              and "temporary network error" (retryable — we never got to look). None of
              them is an error toast. */}
          {stage === "cheapest" && (
            <div dir="rtl" className="p-5 text-white">
              <button onClick={() => setStage("priority")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
              <div className="mb-1 text-base font-bold">مقایسهٔ قیمت</div>
              <div className="mb-4 truncate text-xs text-white/50">{orderProduct?.title}</div>

              {compare.loading && (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  {reduceMotion
                    ? <span className="text-sm text-white/50">در حال مقایسهٔ قیمت در ۵ کشور…</span>
                    : (<>
                        <span className="cc-orbit"><span className="cc-core" /><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span></span>
                        <div>
                          <div className="text-sm text-white/70">در حال مقایسهٔ قیمت در ۵ کشور…</div>
                          <div className="mt-0.5 text-[11px] text-white/35">اولین بار تا نیم دقیقه طول می‌کشد</div>
                        </div>
                      </>)}
                </div>
              )}

              {compare.error && !compare.loading && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
                  <div className="text-sm text-amber-200">مقایسهٔ قیمت انجام نشد</div>
                  <div className="mt-1 text-xs text-amber-200/60">خطای موقت شبکه — دوباره تلاش کنید</div>
                  <button onClick={runCompare} className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-200">تلاش دوباره</button>
                </div>
              )}

              {compare.data && !compare.loading && (() => {
                const { ranked = [], unavailable = [], fetchedAt, degraded } = compare.data;
                return (
                  <>
                    {ranked.length > 0 && (
                      <div className="space-y-2">
                        {ranked.map((r, i) => {
                          const m = MARKET_META[r.country] || { flag: "🏳️", name: r.country };
                          return (
                            <button key={r.country} onClick={() => pickCountry(r)}
                              className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-colors " +
                                (i === 0 ? "border-emerald-400/35 bg-emerald-400/[0.07] hover:bg-emerald-400/[0.12]"
                                         : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]")}>
                              <span className="text-xl leading-none">{m.flag}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="text-sm font-bold text-white">{m.name}</span>
                                  {i === 0 && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">ارزان‌ترین</span>}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-white/45">
                                  {[r.shop, fmtLocal(r.priceLocal, r.currency)].filter(Boolean).join(" · ")}
                                </span>
                                {r.meta && (
                                  <span className="mt-0.5 block text-[10px] text-white/30">
                                    از {r.meta.considered} نتیجه، {r.meta.allowlisted} معتبر ✓
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-base font-extrabold text-cyan-300">${r.priceUSD}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Countries with nothing to show — a first-class outcome, not a failure. */}
                    {unavailable.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {unavailable.map((u) => {
                          const m = MARKET_META[u.country] || { flag: "🏳️", name: u.country };
                          return (
                            <div key={u.country}
                              className={"flex items-center gap-3 rounded-2xl border p-3 " +
                                (u.retryable ? "border-amber-400/20 bg-amber-400/[0.05]" : "border-white/[0.07] bg-white/[0.02]")}>
                              <span className="text-xl leading-none opacity-40 grayscale">{m.flag}</span>
                              <div className="min-w-0 flex-1">
                                <div className={"text-sm font-medium " + (u.retryable ? "text-amber-200/80" : "text-white/40")}>{m.name}</div>
                                <div className={"mt-0.5 text-[11px] leading-relaxed " + (u.retryable ? "text-amber-200/50" : "text-white/30")}>
                                  {u.retryable ? u.label : "نتیجهٔ معتبری پیدا نشد — قیمت نهایی را مسافرها پیشنهاد می‌دهند"}
                                </div>
                              </div>
                              {u.retryable && (
                                <button onClick={runCompare} className="shrink-0 rounded-lg border border-amber-400/30 px-2.5 py-1 text-[11px] font-bold text-amber-200">تلاش دوباره</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {ranked.length === 0 && (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs leading-relaxed text-white/45">
                        در هیچ‌کدام از کشورها قیمت معتبری پیدا نشد. می‌توانید بدون قیمت پایه ادامه دهید — مسافرها قیمت را پیشنهاد می‌دهند.
                        <button onClick={() => setStage("publish")} className="mt-3 block w-full rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-white/70">ادامه بدون قیمت پایه</button>
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/40">
                      قیمت کالا در فروشگاه است — مالیات، عوارض گمرکی و هزینهٔ حمل حساب نشده.
                      {" "}قیمت‌ها تا ۱۲ ساعت ذخیره می‌شوند{degraded ? "" : fetchedAt ? ` (آخرین بروزرسانی: ${new Date(fetchedAt).toLocaleString("fa-IR")})` : ""}.
                      {" "}قیمت نهایی را مسافرها پیشنهاد می‌دهند.
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          {stage === "publish" && (
            <div dir="rtl" className="p-5 text-white">
              <button onClick={() => setStage(priority === "cheapest" ? "cheapest" : "priority")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
              <div className="mb-1 text-base font-bold">انتشار در بازارگاه</div>
              <div className="mb-4 text-xs text-white/50">سفارش در بازارگاه منتشر می‌شود تا مسافرها پیشنهاد بدهند.</div>
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <div className="font-medium text-white">{orderProduct?.title}</div>
                {variant && <div className="mt-1 text-xs text-white/50">{[variant.color, variant.size].filter(Boolean).join(" · ")}</div>}
                <div className="mt-1 text-xs text-white/50">{priority === "fast" ? "اولویت: سریع ⚡" : priority === "cheapest" ? "اولویت: ارزان‌ترین 💰" : "اولویت: فرقی نمی‌کند 🌍"}</div>
                {quote && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-2 text-xs">
                    <span>{MARKET_META[quote.country]?.flag}</span>
                    <span className="min-w-0 flex-1 truncate text-emerald-200/70">
                      {[MARKET_META[quote.country]?.name, quote.shop, fmtLocal(quote.priceLocal, quote.currency)].filter(Boolean).join(" · ")}
                    </span>
                    <span className="shrink-0 font-bold text-emerald-300">${quote.priceUSD}</span>
                  </div>
                )}
              </div>
              {(() => {
                const missing = [];
                if (!orderProduct?.title || orderProduct.title.trim().length <= 2) missing.push("نام محصول معتبر");
                // A quote IS the price — a cheapest-flow order carries its own base price even
                // when the chat never resolved one.
                if (!orderProduct?.priceUSD && !quote?.priceUSD) missing.push("قیمت تخمینی");
                if (!estCountry) missing.push("کشور مقصد");
                return missing.length > 0 ? (
                  <div className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                    برای انتشار تکمیل کنید: {missing.join("، ")}
                  </div>
                ) : null;
              })()}
              {publishResult
                ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm text-emerald-300">سفارش منتشر شد ✓<div className="mt-1 text-xs text-emerald-200/70">کد سفارش: {publishResult}</div></div>
                : !userId
                ? <button onClick={() => onNeedAuth?.()}
                    className="w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 py-3 text-sm font-bold text-cyan-200">
                    برای انتشار در بازارگاه، وارد شوید
                  </button>
                : <button disabled={publishing || !orderProduct?.title || (orderProduct.title.trim().length <= 2) || (!orderProduct?.priceUSD && !quote?.priceUSD) || !estCountry} onClick={doPublish}
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
