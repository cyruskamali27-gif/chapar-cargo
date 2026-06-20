// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Send, Mic, Image as ImageIcon, Check, RotateCw, ExternalLink, ShoppingBag, MapPin, Volume2, VolumeX } from "lucide-react";

const LANGS = {
  fa: { name: "Persian (Farsi)", tts: "fa-IR", label: "فا", greet: "خوش آمدید. چه چیزی برایتان بخرم؟" },
  en: { name: "English", tts: "en-US", label: "EN", greet: "Welcome. What should I buy for you?" },
  ar: { name: "Arabic", tts: "ar-SA", label: "ع", greet: "أهلاً بك. ماذا أشتري لك؟" },
  tr: { name: "Turkish", tts: "tr-TR", label: "TR", greet: "Hoş geldiniz. Sizin için ne alayım?" },
  fr: { name: "French", tts: "fr-FR", label: "FR", greet: "Bienvenue. Que dois-je acheter pour vous ?" },
};

export default function ChaparConcierge() {
  const [lang, setLang] = useState("fa");
  const [messages, setMessages] = useState([{ role: "assistant", text: LANGS.fa.greet, _api: null }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const fileRef = useRef(null), scrollRef = useRef(null), canvasRef = useRef(null);
  const speakingRef = useRef(false), loadingRef = useRef(false), listeningRef = useRef(false);
  const audioLevelRef = useRef(0), audioCtxRef = useRef(null), streamRef = useRef(null), analyserRef = useRef(null), micRafRef = useRef(null);

  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf, t = 0;
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
    resize(); window.addEventListener("resize", resize);
    const draw = () => {
      const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const sp = speakingRef.current, ld = loadingRef.current, ls = listeningRef.current, lvl = audioLevelRef.current;
      t += sp ? 0.05 : ld ? 0.045 : 0.02;
      const N = 110, baseR = Math.min(w, h) * 0.21;
      const energy = sp ? 1 : ls ? (0.3 + lvl * 0.6) : ld ? 0.55 : 0.28;
      for (let ring = 0; ring < 2; ring++) {
        ctx.beginPath();
        const rr = baseR * (0.62 - ring * 0.12) + Math.sin(t * 1.4 + ring) * 3 * dpr;
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${(t * 50 + ring * 120) % 360},90%,60%,0.25)`;
        ctx.lineWidth = 1.5 * dpr; ctx.shadowBlur = 10 * dpr; ctx.shadowColor = `hsl(${(t * 50) % 360},90%,60%)`;
        ctx.stroke();
      }
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + t * 0.2;
        const wave = Math.sin(a * 6 + t * 2) * 0.5 + Math.sin(a * 3 - t * 1.3) * 0.5;
        const spike = sp ? Math.random() * 0.7 : ls ? lvl * Math.random() * 0.5 : ld ? Math.abs(Math.sin(a * 9 + t * 4)) * 0.3 : 0;
        const len = baseR * (0.55 * energy) * (0.45 + 0.55 * Math.abs(wave) + spike);
        const r1 = baseR, r2 = baseR + len;
        const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
        const x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
        const hue = (i / N * 300 + t * 40) % 360;
        ctx.strokeStyle = `hsl(${hue},95%,62%)`;
        ctx.lineWidth = 2.2 * dpr; ctx.shadowBlur = 14 * dpr; ctx.shadowColor = `hsl(${hue},95%,62%)`;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      const cr = baseR * (0.32 + (sp ? Math.sin(t * 8) * 0.05 : 0));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      g.addColorStop(0, "rgba(120,220,255,0.30)"); g.addColorStop(1, "rgba(120,220,255,0)");
      ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  function speak(text) {
    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = LANGS[lang].tts;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(lang));
    if (v) u.voice = v; u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }
  async function callAI(hist, img) {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          messages: hist.filter((m) => m._api).map((m) => m._api),
          ...(img ? { imageBase64: img.b64, imageMimeType: img.mime } : {}),
        }),
      });
      const data = await res.json();
      const reply = data.reply || "…";
      const product = data.resolved ? (data.product || null) : null;
      setMessages((m) => [...m, { role: "assistant", text: reply, product, _api: { role: "assistant", content: reply } }]);
      speak(reply);
    } catch { setMessages((m) => [...m, { role: "assistant", text: "ارتباط برقرار نشد.", _api: null }]); } finally { setLoading(false); }
  }
  function send(txt) { const t = (txt ?? input).trim(); if (!t || loading) return; const next = [...messages, { role: "user", text: t, _api: { role: "user", content: t } }]; setMessages(next); setInput(""); callAI(next); }
  function more() { if (loading) return; const next = [...messages, { role: "user", text: "بیشتر بگردیم.", _api: { role: "user", content: "Suggest a different option." } }]; setMessages(next); callAI(next); }
  function confirm() { setMessages((m) => [...m, { role: "assistant", text: "✅ تأیید شد — مرحلهٔ بعد.", handoff: true, _api: null }]); }
  function onImg(e) { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const d = String(rd.result), b = d.split(",")[1]; const next = [...messages, { role: "user", text: "📷", image: d, _api: { role: "user", content: "Identify this product." } }]; setMessages(next); callAI(next, { b64: b, mime: f.type || "image/jpeg" }); }; rd.readAsDataURL(f); e.target.value = ""; }
  async function startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an); analyserRef.current = an;
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { if (!analyserRef.current) return; an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } audioLevelRef.current = Math.min(1, Math.sqrt(s / buf.length) * 3.5); micRafRef.current = requestAnimationFrame(tick); };
      tick();
    } catch { audioLevelRef.current = 0; }
  }
  function stopMic() {
    audioLevelRef.current = 0; cancelAnimationFrame(micRafRef.current);
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    analyserRef.current = null; streamRef.current = null; audioCtxRef.current = null;
  }
  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setListening(true); startMic();
    if (SR) {
      const rec = new SR(); rec.lang = LANGS[lang].tts; rec.interimResults = false;
      rec.onend = () => { setListening(false); stopMic(); };
      rec.onresult = (e) => { setListening(false); stopMic(); send(e.results[0][0].transcript); };
      rec.onerror = () => { setListening(false); stopMic(); };
      rec.start();
    } else { setTimeout(() => { setListening(false); stopMic(); }, 6000); }
  }
  function switchLang(l) { setLang(l); setMessages([{ role: "assistant", text: LANGS[l].greet, _api: null }]); }

  const status = listening ? "در حالِ شنیدن…" : loading ? "در حالِ پردازش…" : speaking ? "در حالِ صحبت…" : "آماده‌ام";

  return (
    <div dir="rtl" className="relative mx-auto flex h-[680px] w-full max-w-md flex-col overflow-hidden rounded-[28px] font-sans" style={{ background: "radial-gradient(130% 80% at 50% 25%, #0f1330, #05060d 70%)" }}>
      <style>{`@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes pd{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
      <div className="relative h-[290px] w-full shrink-0">
        <canvas ref={canvasRef} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="mb-1 text-sm font-bold tracking-wide text-white/90">Chapar AI Concierge</div>
            <div className="flex items-center justify-center gap-2 text-xs text-cyan-200/90">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" style={{ animation: "pd 1.5s infinite" }} /> {status}
            </div>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="relative z-10 flex-1 space-y-2 overflow-y-auto px-4">
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
                  <button onClick={confirm} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#10b981,#22d3ee)" }}><Check size={15} /> بله، همین است</button>
                  <button onClick={more} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70"><RotateCw size={14} /> بیشتر</button>
                </div>
              </div>
            )}
            {m.handoff && <div className="mt-2 rounded-2xl border border-dashed border-cyan-400/30 p-2.5" style={{ background: "rgba(34,211,238,.07)" }}><div className="flex items-center gap-2 text-sm font-semibold text-cyan-300"><MapPin size={15} /> مرحلهٔ بعد</div></div>}
          </div>
        ))}
      </div>
      <div className="relative z-10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">{Object.keys(LANGS).map((l) => <button key={l} onClick={() => switchLang(l)} className={`rounded-full px-2 py-0.5 text-[11px] ${lang === l ? "bg-cyan-400 text-slate-900" : "bg-white/5 text-white/50"}`}>{LANGS[l].label}</button>)}</div>
          <button onClick={() => setMuted(!muted)} className="text-white/60">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/60"><ImageIcon size={19} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImg} />
          <button onClick={voice} className={`grid h-10 w-10 place-items-center rounded-full ${listening ? "bg-rose-500 text-white" : "bg-white/5 text-cyan-300"}`}><Mic size={19} /></button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="بنویسید یا حرف بزنید…" className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
          <button onClick={() => send()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1)" }}><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}
