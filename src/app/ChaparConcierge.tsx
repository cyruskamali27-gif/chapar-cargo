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

// The old "تخمین هزینه" screen's TAX table and 7-country chip row lived here. Both are gone
// with it: the buyer now names a country exactly once, in the honest price comparison, and the
// tax rate is applied server-side (MARKET_TAX in orders/server.js) against the quote they
// actually accepted — instead of client-side against a country they merely tapped.

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
  // Search outcome, kept separate from the results array so an empty grid never masquerades as
  // "done". 'loading' → spinner, 'ok' → grid, 'empty' → honest no-match, 'unavailable' → Bright
  // Data returned garbage/timed out (retryable). Both non-ok states show a retry button, never a
  // dead-end or an endless loader. lastSearchQuery lets retry re-run the exact same search.
  const [searchState, setSearchState] = useState("ok");
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const [priority, setPriority] = useState(null);   // "fast" | "any"
  // Set ONLY by the honest price comparison (pickCountry). It has no default: on the
  // سریع / فرقی‌نمی‌کند paths the buyer never names a country — that is the whole meaning of
  // those options, the traveler's route decides — and defaulting to "CA" would have silently
  // stamped every one of those orders as Canada.
  const [estCountry, setEstCountry] = useState(null);
  const [specialRequest, setSpecialRequest] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [compare, setCompare] = useState({ loading: false, data: null, error: false });
  const [quote, setQuote] = useState(null);   // the country the buyer picked out of the comparison
  // Explicit buyer acknowledgement that they are publishing with NO estimated price. Publish is
  // never auto-enabled on a missing price — the buyer either has a real price or ticks this.
  const [noPriceAck, setNoPriceAck] = useState(false);
  const fileRef = useRef(null), scrollRef = useRef(null);
  // Variants prefetch cache, keyed by the same expression the store panel fetches with
  // (searchQuery || title — grid results carry no searchQuery). undefined = never asked,
  // null = in flight, object = ready to hand the panel as initialVariantData.
  const variantCache = useRef({});
  const [reduceMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  // As soon as search results land, warm the variants cache for the TOP 3 picks (not just #1),
  // so tapping any of the likely choices opens the store panel with colors/sizes already there.
  // Each warms an independent key; the server-side 12h variants cache then keeps popular items
  // instant for every user. Degraded/error responses are never stored (server guards on that).
  useEffect(() => {
    if (!gridResults?.length) return;
    for (const item of gridResults.slice(0, 3)) {
      const key = item?.searchQuery || item?.title;
      if (!key || variantCache.current[key] !== undefined) continue;
      variantCache.current[key] = null; // in-flight marker — panel falls back to its own fetch
      (async () => {
        try {
          const r = await fetch("/api/product/variants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: key }) });
          const d = await r.json();
          // Only keep a meaningful result; a degraded scrape shouldn't shadow a later live retry.
          if (d?.ok && d.colors?.length) variantCache.current[key] = d;
          else delete variantCache.current[key];
        } catch { delete variantCache.current[key]; } // failed — let the panel retry live
      })();
    }
  }, [gridResults]);

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
  async function runCompare(qArg) {
    // qArg lets confirmProduct start price with the just-confirmed product before setOrderProduct
    // has committed. Retry buttons wire onClick={runCompare} and pass a MouseEvent — the string
    // guard ignores that and falls back to the current product.
    // lastSearchQuery sits AHEAD of title deliberately: grid results come back with
    // searchQuery:null and a listing-specific title ("Apple - Refurbished Excellent - Right
    // Replacement AirPod Pro - 2nd Generation"). Comparing THAT across five countries matches
    // nothing — the honest-match filter returns ranked:[] in all 5 — which read to the buyer as
    // "price never loads". The AI's clean query ("airpods pro 2") is what actually cross-matches.
    const q = (typeof qArg === "string" && qArg) || orderProduct?.searchQuery || lastSearchQuery || orderProduct?.title;
    if (!q) { setCompare({ loading: false, data: null, error: true }); return; }
    setCompare({ loading: true, data: null, error: false });
    // Cold price fans out ~5 live SERP fetches in parallel; the server's own worst case
    // (BD_TIMEOUT_MS 45s + one 2.5s-backoff retry ≈ 92s) is well under nginx's 130s 504.
    // Hard client cap just ABOVE nginx so a genuinely stalled socket can never hold the
    // ذرات هوشمند loader open forever — it collapses into the honest error+retry state below.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 135000);
    try {
      const r = await fetch("/api/product/price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, countries: PRICE_MARKETS }), signal: ctrl.signal,
      });
      const d = r.ok ? await r.json().catch(() => null) : null; // 504 HTML / garbage body → null, not a throw
      if (!d?.ok) { setCompare({ loading: false, data: null, error: true }); return; }
      setCompare({ loading: false, data: d, error: false });
    } catch { setCompare({ loading: false, data: null, error: true }); }
    finally { clearTimeout(timer); }
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

  // The product search is a live Bright Data SERP fetch that is currently flaky (truncated bodies,
  // occasional >60s). Server now returns ok:false on garbage instead of an empty-but-ok grid; here
  // we translate every outcome into an explicit searchState so the UI is honest and retryable.
  async function runProductSearch(q) {
    setLastSearchQuery(q);
    setSearchState("loading");
    setGridResults([]);
    try {
      const r = await fetch("/api/product/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      const sd = await r.json();
      if (sd.ok && sd.results?.length) { setGridResults(sd.results); setSearchState("ok"); }
      else if (sd.ok) { setSearchState("empty"); }        // valid response, genuinely no match
      else { setSearchState("unavailable"); }             // ok:false → upstream garbage/timeout
    } catch { setSearchState("unavailable"); }            // network/parse failure — retryable
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
        setStage("grid");                 // show the grid section immediately (with its own loader)
        runProductSearch(data.searchQuery);
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

  function send(txt) { const t = (txt ?? input).trim(); if (!t || loading) return; const next = [...messages, { role: "user", text: t, _api: { role: "user", content: t } }]; setStage(null); setOrderProduct(null); setPublishResult(null); setGridResults([]); setSearchState("ok"); setQuote(null); setNoPriceAck(false); setCompare({ loading: false, data: null, error: false }); setMessages(next); setInput(""); callAI(next); }
  function more() { if (loading) return; const next = [...messages, { role: "user", text: "بیشتر بگردیم.", _api: { role: "user", content: "Suggest a different option." } }]; setMessages(next); callAI(next); }
  // DECOUPLE price from variants: the instant a product is confirmed, kick off the price
  // comparison IN PARALLEL with the store panel's own variants fetch. Neither gates the other —
  // variants failing/degrading never delays price, and price runs on its own loader/retry/state.
  // The query is passed explicitly because setOrderProduct is async (runCompare would otherwise
  // read the previous product). By the time the user reaches the price screen it is already in
  // flight or done, so they never tap retry just to unblock it.
  function confirmProduct(p) { setOrderProduct(p); setStage("store"); setNoPriceAck(false); runCompare(p?.searchQuery || lastSearchQuery || p?.title); }
  async function doPublish() {
    // Ownership guard: publishing requires a logged-in user — send them to auth instead of an anonymous post.
    if (!userId) { onNeedAuth?.(); return; }
    setPublishing(true);
    try {
      const r = await fetch("/api/marketplace/publish", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: orderProduct, variant: variant || null,
          priority: priority || "any", country: estCountry, specialRequest: specialRequest || "",
          // Honest price record: a real quote, or null — never a fabricated/placeholder number.
          // noPriceAck marks that the buyer explicitly accepted publishing without an estimate.
          priceQuote: quote || null, noPriceAck: !hasPrice && noPriceAck, userId }) });
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

  // ── PRICE GATE for publish ──────────────────────────────────────────────────
  // A real price is either the country the buyer picked out of the comparison (quote) or a
  // price that came attached to the product itself. Anything else is "no price".
  const hasPrice = quote?.priceUSD != null || orderProduct?.priceUSD != null;
  // The comparison is fired at confirmProduct, so on the سریع / فرقی‌نمی‌کند paths it is
  // usually still in flight when the buyer lands on publish — that is a LOADING state, not a
  // failure, and must not be mistaken for one.
  const priceLoading = !hasPrice && compare.loading;
  // No price and nothing in flight = it failed or found nothing verifiable. Honest dead-end
  // avoided by the explicit acknowledgement below rather than by silently publishing.
  const priceFailed = !hasPrice && !compare.loading;

  const _lastMsg = messages[messages.length - 1];
  // Contextual status: after the reply is shown we're fetching product results; otherwise still thinking.
  // The product search is a live Bright Data SERP fetch that can take up to a minute cold — say so,
  // rather than let a bare "در حال جست‌وجو…" read as a hang. (The request itself waits the full 60s.)
  const thinkingStatus = (loading && _lastMsg?.role === "assistant") ? "در حال جست‌وجو… بار اول تا یک دقیقه طول می‌کشد" : "در حال فکر کردن…";

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
                      <div className="text-xs text-white/50">
                        {m.product.priceLoading
                          ? "در حال یافتن بهترین قیمت…"
                          : [m.product.priceUSD != null && `$${m.product.priceUSD}`, m.product.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <a href={m.product.link || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(m.product.searchQuery || m.product.title || "")}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-cyan-300">مشاهدهٔ محصول <ExternalLink size={14} /></a>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => confirmProduct(m.product)} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#047857,#0e7490)" }}><Check size={15} /> بله، همین است</button>
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
                  <span className="text-sm text-white/50">در حال پردازش…</span>
                ) : (
                  <>
                    <span className="cc-orbit"><span className="cc-core" /><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span></span>
                    <span className="text-xs text-white/50">{thinkingStatus}</span>
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
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="بنویسید یا حرف بزنید…" className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/50" />
            <button onClick={() => send()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#0e7490,#4f46e5)" }}><Send size={18} /></button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 — PROCESS CARD (only when stage !== null) ── */}
      {stage && (
        <div className="overflow-hidden rounded-[28px]" style={CARD_BG}>
          {stage === "grid" && (
            searchState === "loading" ? (
              <div dir="rtl" className="p-6 text-center text-white">
                <span className="cc-orbit mx-auto mb-3 block"><span className="cc-core" /><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span></span>
                <div className="text-sm text-white/70">در حال جست‌وجوی فروشگاه‌ها…</div>
                <div className="mt-1 text-xs text-white/45">بار اول تا یک دقیقه طول می‌کشد</div>
              </div>
            ) : searchState === "ok" ? (
              <ChaparGrid
                results={gridResults}
                onPick={(r) => confirmProduct(r)}
                onBack={() => setStage(null)}
              />
            ) : (
              /* 'unavailable' (Bright Data garbage/timeout) or 'empty' (valid, no match) — both
                 honest and retryable, never a dead-end or an endless spinner. */
              <div dir="rtl" className="p-6 text-center text-white">
                <div className="mb-1 text-sm font-bold text-white/90">
                  {searchState === "unavailable" ? "جستجوی فروشگاه‌ها موقتاً در دسترس نیست" : "محصولی پیدا نشد"}
                </div>
                <div className="mb-4 text-xs text-white/50">
                  {searchState === "unavailable" ? "ارتباط با فروشگاه‌ها ناپایدار است. لطفاً دوباره تلاش کنید." : "می‌توانید دوباره جست‌وجو کنید یا عبارت دیگری بنویسید."}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => runProductSearch(lastSearchQuery)} disabled={!lastSearchQuery} className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#0e7490,#4f46e5)" }}><RotateCw size={15} /> تلاش دوباره</button>
                  <button onClick={() => setStage(null)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70">بازگشت</button>
                </div>
              </div>
            )
          )}
          {stage === "store" && (
            <ChaparStorePanel
              product={orderProduct}
              initialVariantData={variantCache.current[orderProduct?.searchQuery || orderProduct?.title || ""] || null}
              onContinue={(v) => { setVariant(v); setStage("priority"); }}
              onBack={() => { if (gridResults.length) { setStage("grid"); } else { setOrderProduct(null); setStage(null); } }}
            />
          )}
          {stage === "priority" && (
            <div dir="rtl" className="p-5 text-white">
              <button onClick={() => setStage("store")} className="mb-3 inline-flex items-center gap-1 text-sm text-white/50">→ بازگشت</button>
              <div className="mb-4 text-base font-bold">چقدر عجله داری؟</div>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => { setPriority("fast"); setStage("publish"); }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.08]">
                  <div className="text-sm font-bold text-white">سریع می‌خواهم ⚡</div>
                  <div className="mt-1 text-xs text-white/50">از کشورهایی که مسافر فعال دارند</div>
                </button>
                <button onClick={() => { setPriority("cheapest"); setStage("cheapest"); if (!compare.loading && !compare.data) runCompare(); }}
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
                          <div className="mt-0.5 text-[11px] text-white/50">اولین بار تا نیم دقیقه طول می‌کشد</div>
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
                                <span className="mt-0.5 block truncate text-[11px] text-white/50">
                                  {[r.shop, fmtLocal(r.priceLocal, r.currency)].filter(Boolean).join(" · ")}
                                </span>
                                {r.meta && (
                                  <span className="mt-0.5 block text-[10px] text-white/50">
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
                                <div className={"text-sm font-medium " + (u.retryable ? "text-amber-200/80" : "text-white/50")}>{m.name}</div>
                                <div className={"mt-0.5 text-[11px] leading-relaxed " + (u.retryable ? "text-amber-200/70" : "text-white/50")}>
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
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs leading-relaxed text-white/50">
                        در هیچ‌کدام از کشورها قیمت معتبری پیدا نشد. می‌توانید بدون قیمت پایه ادامه دهید — مسافرها قیمت را پیشنهاد می‌دهند.
                        <button onClick={() => setStage("publish")} className="mt-3 block w-full rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-white/70">ادامه بدون قیمت پایه</button>
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/50">
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
                {/* No quote = no country was named, by design. Say so, rather than showing a
                    country the buyer never picked. */}
                {!quote && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-white/50">
                    کشور خرید را مسافر تعیین می‌کند
                    {orderProduct?.priceUSD ? ` — قیمت تخمینی $${orderProduct.priceUSD}، بدون مالیات و حمل` : ""}.
                  </div>
                )}
              </div>

              {/* Lives here now that "تخمین هزینه" is gone — it applies to all three paths. */}
              <div className="mb-4">
                <div className="mb-1.5 text-xs text-white/50">درخواست خاص (اختیاری)</div>
                <input value={specialRequest} onChange={e => setSpecialRequest(e.target.value)}
                  placeholder="مثلاً: روی ایرپاد حکاکی شود: Cyrus"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-cyan-400 focus:outline-none" />
              </div>

              {(() => {
                // Title is the only hard requirement left. Price is NOT listed here — it has its
                // own three-state gate below (loading / loaded / failed+acknowledged), because a
                // missing price is a resolvable state, not a permanent "you forgot something".
                // Country is deliberately NOT required: only the ارزان‌ترین path names one, and
                // on the other two the traveler's route decides.
                const titleBad = !orderProduct?.title || orderProduct.title.trim().length <= 2;
                return titleBad ? (
                  <div className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                    برای انتشار تکمیل کنید: نام محصول معتبر
                  </div>
                ) : null;
              })()}

              {/* PRICE GATE — publish can never auto-advance past a missing price. */}
              {priceLoading && (
                <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="cc-orbit shrink-0"><span className="cc-core" /><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span><span className="cc-ring"><i /></span></span>
                  <div className="text-xs text-white/70">در حال دریافت قیمت...</div>
                </div>
              )}
              {priceFailed && (
                <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3">
                  <input type="checkbox" checked={noPriceAck} onChange={(e) => setNoPriceAck(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400" />
                  <span className="text-xs leading-relaxed text-amber-200">
                    بدون قیمت تخمینی ادامه می‌دهم — قیمت نهایی را مسافر تعیین می‌کند
                  </span>
                </label>
              )}

              {publishResult
                ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm text-emerald-300">سفارش منتشر شد ✓<div className="mt-1 text-xs text-emerald-200/70">کد سفارش: {publishResult}</div></div>
                : !userId
                ? <button onClick={() => onNeedAuth?.()}
                    className="w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 py-3 text-sm font-bold text-cyan-200">
                    برای انتشار در بازارگاه، وارد شوید
                  </button>
                : <button
                    disabled={publishing || !orderProduct?.title || (orderProduct.title.trim().length <= 2)
                      || priceLoading || (priceFailed && !noPriceAck)}
                    onClick={doPublish}
                    className="w-full rounded-2xl bg-gradient-to-l from-cyan-700 to-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {publishing ? "در حال انتشار…" : priceLoading ? "در حال دریافت قیمت..." : "تأیید و انتشار در بازارگاه"}
                  </button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
