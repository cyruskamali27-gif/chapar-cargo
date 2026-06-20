// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Send, Mic, Image as ImageIcon, Check, RotateCw, ExternalLink, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import ChaparFormSimple from "./ChaparFormSimple";

const VIDEO_URL = "https://chapar-cargo-scans.tor1.digitaloceanspaces.com/doc_2026-06-19_21-42-45.mp4";
const LANGS = {
  fa: { name: "Persian (Farsi)", tts: "fa-IR", greet: "خوش آمدید. چه چیزی برایتان بخرم؟" },
  en: { name: "English", tts: "en-US", greet: "Welcome. What should I buy for you?" },
  ar: { name: "Arabic", tts: "ar-SA", greet: "أهلاً بك. ماذا أشتري لك؟" },
  tr: { name: "Turkish", tts: "tr-TR", greet: "Hoş geldiniz. Sizin için ne alayım?" },
  fr: { name: "French", tts: "fr-FR", greet: "Bienvenue. Que dois-je acheter pour vous ?" },
};

export default function ChaparConcierge({ language = "fa", userName = "" }) {
  const lang = LANGS[language] ? language : "fa";
  const rtl = ["fa", "ar"].includes(lang);
  const [messages, setMessages] = useState([{ role: "assistant", text: LANGS[lang].greet, _api: null }]);
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false); const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false); const [orderProduct, setOrderProduct] = useState(null);
  const fileRef = useRef(null), scrollRef = useRef(null), videoRef = useRef(null);
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
  async function callAI(hist, img) {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, userName, messages: hist.filter((m) => m._api).map((m) => m._api), ...(img ? { imageBase64: img.b64, imageMimeType: img.mime } : {}) }) });
      const data = await res.json();
      const reply = data.reply || "…"; const product = data.resolved ? (data.product || null) : null;
      setMessages((m) => [...m, { role: "assistant", text: reply, product, _api: { role: "assistant", content: reply } }]); speak(reply);
    } catch { setMessages((m) => [...m, { role: "assistant", text: "ارتباط برقرار نشد.", _api: null }]); } finally { setLoading(false); }
  }
  function send(txt) { const t = (txt ?? input).trim(); if (!t || loading) return; const next = [...messages, { role: "user", text: t, _api: { role: "user", content: t } }]; setMessages(next); setInput(""); callAI(next); }
  function more() { if (loading) return; const next = [...messages, { role: "user", text: "بیشتر بگردیم.", _api: { role: "user", content: "Suggest a different option." } }]; setMessages(next); callAI(next); }
  function confirmProduct(p) { setOrderProduct(p); }
  function onImg(e) { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const d = String(rd.result), b = d.split(",")[1]; const next = [...messages, { role: "user", text: "📷", image: d, _api: { role: "user", content: "Identify this product." } }]; setMessages(next); callAI(next, { b64: b, mime: f.type || "image/jpeg" }); }; rd.readAsDataURL(f); e.target.value = ""; }
  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR(); rec.lang = LANGS[lang].tts; rec.interimResults = false; rec.continuous = false;
    rec.onstart = () => setListening(true); rec.onend = () => setListening(false);
    rec.onresult = (e) => { setListening(false); send(e.results[0][0].transcript); };
    rec.onerror = () => setListening(false);
    rec.start();
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="mx-auto flex h-[680px] w-full max-w-md flex-col overflow-hidden rounded-[28px] font-sans" style={{ background: "radial-gradient(130% 80% at 50% 25%, #0f1330, #05060d 70%)" }}>
      <style>{`@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="relative h-[290px] w-full shrink-0 overflow-hidden">
        <video ref={videoRef} src={VIDEO_URL} autoPlay loop muted playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      {orderProduct ? (
        <div className="relative z-10 flex-1 overflow-y-auto"><ChaparFormSimple product={orderProduct} onSubmit={() => {}} /></div>
      ) : (
        <>
          <div ref={scrollRef} className="relative z-10 flex-1 space-y-2 overflow-y-auto px-4 pt-2">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[86%] ${m.role === "user" ? "ms-auto" : "me-auto"}`} style={{ animation: "up .35s ease both" }}>
                {m.image && <img src={m.image} alt="" className="mb-1 max-h-28 rounded-xl border border-white/15" />}
                <div className="rounded-2xl px-3.5 py-2 text-sm leading-relaxed" style={m.role === "user" ? { background: "linear-gradient(135deg,#22d3eecc,#6366f1cc)", color: "#fff" } : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#eaf2ff" }}>{m.text}</div>
                {m.product && (
                  <div className="mt-2 rounded-2xl border border-white/10 p-3" style={{ background: "rgba(15,18,32,.7)" }}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl text-cyan-300" style={{ background: "linear-gradient(135deg,#6366f14d,#22d3ee33)" }}><ShoppingBag size={20} /></div>
                      <div className="flex-1"><div className="font-bold text-white">{m.product.title || `${m.product.brand} ${m.product.model}`}</div><div className="text-xs text-white/40">{[m.product.brand, m.product.country].filter(Boolean).join(" · ")}</div></div>
                    </div>
                    <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(m.product.searchQuery || m.product.title || "")}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-cyan-300">مشاهدهٔ محصول <ExternalLink size={14} /></a>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => confirmProduct(m.product)} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#10b981,#22d3ee)" }}><Check size={15} /> بله، همین است</button>
                      <button onClick={more} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70"><RotateCw size={14} /> بیشتر</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="relative z-10 p-3">
            <div className="mb-2 flex items-center justify-end"><button onClick={() => setMuted(!muted)} className="text-white/60">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button></div>
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/60"><ImageIcon size={19} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImg} />
              <button onClick={voice} className={`grid h-10 w-10 place-items-center rounded-full ${listening ? "bg-rose-500 text-white" : "bg-white/5 text-cyan-300"}`}><Mic size={19} /></button>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="بنویسید یا حرف بزنید…" className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
              <button onClick={() => send()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1)" }}><Send size={18} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
