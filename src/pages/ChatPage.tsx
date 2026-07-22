/**
 * Chat page — CMD-52 (3b-1): server-backed in-platform thread.
 *
 * Was a localStorage demo with scripted auto-replies. Now it talks to the real thread in
 * chapar-orders: GET /api/marketplace/chat/:orderId?since=<seq> (polled) and
 * POST /api/marketplace/chat/:orderId/send. Access is token-gated server-side (only the buyer and
 * the accepted traveler); the SERVER is the anti-bypass gate. The client keeps a copy of the
 * filter for INSTANT feedback only — it never decides what is stored.
 *
 * URL params: ?order= | ?id=  (peer/name/role are cosmetic, still read for the header)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Package, AlertTriangle, MessageSquare, Ban, Send, Lock } from 'lucide-react';
import { Store, getSession } from '../lib/store';
import { useLang } from '../lib/LangContext';
import type { translations } from '../app/i18n';

type T = typeof translations['en'];

// ── Client filter copy — INSTANT UX ONLY (server is the gate). Mirrors orders/contact-filter.js ──
const BLOCK_PATTERNS: { re: RegExp; msgKey: keyof T }[] = [
  { re: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, msgKey: 'chatBlockEmail' },
  { re: /wa\.me\/[0-9]+/gi,                                   msgKey: 'chatBlockWhatsapp' },
  { re: /t\.me\/[A-Za-z0-9_]+/gi,                             msgKey: 'chatBlockTelegram' },
  { re: /(https?:\/\/|www\.)[^\s]+/gi,                        msgKey: 'chatBlockLink' },
  { re: /@[A-Za-z0-9_]{4,}/g,                                 msgKey: 'chatBlockTelegramId' },
  { re: /(?:\+?[۰-۹٠-٩0-9][\s\-.]?){9,13}[۰-۹٠-٩0-9]/g,     msgKey: 'chatBlockPhone' },
];

function scanMessage(text: string): (keyof T)[] {
  const blocked: (keyof T)[] = [];
  BLOCK_PATTERNS.forEach(p => { p.re.lastIndex = 0; if (p.re.test(text)) blocked.push(p.msgKey); });
  return blocked;
}

// ── Types (server thread shape) ─────────────────────────────────────────────────
interface SrvMsg { seq: number; from: string; at: string; kind: string; text: string; flags?: string[]; masked?: boolean; }
interface Order { trackId?: string; origin?: string; dest?: string; originLabel?: string; destLabel?: string; }

const POLL_FOCUS_MS = 5000;
const POLL_HIDDEN_MS = 25000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fa-IR', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ChatPage() {
  const { t, isRTL } = useLang();
  const session  = getSession();
  const params   = new URLSearchParams(location.search);
  const orderId  = params.get('order') || params.get('id') || '';   // order ids are case-sensitive base36 — do NOT uppercase
  const peerName = params.get('name') || t.chatPeerDefault;
  const peerRole = params.get('role') || '';

  const [msgs, setMsgs]           = useState<SrvMsg[]>([]);
  const [input, setInput]         = useState('');
  const [warnMsg, setWarnMsg]     = useState('');
  const [notice, setNotice]       = useState('');     // reject/mask/error notice under the composer
  const [unlocked, setUnlocked]   = useState(true);
  const [writable, setWritable]   = useState(true);
  const [sending, setSending]     = useState(false);
  const [loaded, setLoaded]       = useState(false);

  const sinceRef      = useRef(0);
  const msgsRef       = useRef<SrvMsg[]>([]);
  const pollTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEl    = useRef<HTMLDivElement>(null);
  const textareaEl    = useRef<HTMLTextAreaElement>(null);
  const token         = (() => { try { return localStorage.getItem('cp_token') || ''; } catch { return ''; } })();

  const order: Order | null = (() => {
    const hist = Store.get<Order[]>('history') ?? [];
    return orderId ? (hist.find(o => o.trackId === orderId) ?? null) : null;
  })();

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = messagesEl.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // ── poll the thread ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!orderId || !token) return;
    try {
      const r = await fetch(`/api/marketplace/chat/${encodeURIComponent(orderId)}?since=${sinceRef.current}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setUnlocked(!!d.unlocked);
        setWritable(!!d.writable);
        if (Array.isArray(d.messages) && d.messages.length) {
          const fresh = d.messages as SrvMsg[];
          msgsRef.current = [...msgsRef.current, ...fresh];
          sinceRef.current = fresh[fresh.length - 1].seq;
          setMsgs([...msgsRef.current]);
          setTimeout(() => scrollToBottom(true), 30);
        }
      }
    } catch { /* transient — next tick retries */ }
    finally { setLoaded(true); }
  }, [orderId, token, scrollToBottom]);

  // schedule polling with Page-Visibility backoff; stop on unmount
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      await poll();
      if (!alive) return;
      const delay = document.hidden ? POLL_HIDDEN_MS : POLL_FOCUS_MS;
      pollTimer.current = setTimeout(tick, delay);
    };
    tick();
    const onVis = () => { if (!document.hidden) { if (pollTimer.current) clearTimeout(pollTimer.current); tick(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; if (pollTimer.current) clearTimeout(pollTimer.current); document.removeEventListener('visibilitychange', onVis); };
  }, [poll]);

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const ta = textareaEl.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
    if (!val.trim()) { setWarnMsg(''); return; }
    const blocked = scanMessage(val);
    setWarnMsg(blocked.length ? t.chatWarnContains.replace('{items}', blocked.map(k => t[k] as string).join('، ')) : '');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !writable) return;
    setSending(true);
    setNotice('');
    try {
      const r = await fetch(`/api/marketplace/chat/${encodeURIComponent(orderId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) {
        setNotice(d?.error === 'chat_closed' ? t.chatClosedNotice : t.chatSendErr);
        return;
      }
      if (d.action === 'reject') {
        // SERVER refused: honest notice, keep the composer text so the user can edit it.
        setNotice(t.chatRejectNotice);
        return;
      }
      // allow or mask — the message is stored; pull it in immediately, then clear the box.
      if (d.action === 'mask') setNotice(t.chatMaskNotice);
      setInput('');
      if (textareaEl.current) textareaEl.current.style.height = 'auto';
      setWarnMsg('');
      await poll();
    } catch {
      setNotice(t.chatSendErr);
    } finally {
      setSending(false);
    }
  }

  const avatarLetter = () => ((session?.firstName as string) || '؟')[0] ?? '؟';
  const canSend = input.trim().length > 0 && !sending && writable;
  const peerRoleLabel = peerRole === 'traveler' ? t.chatRoleTraveler : peerRole === 'sender' ? t.chatRoleSender : peerRole;

  // ── No auth — redirect to the single auth surface, returning here ──
  if (!session) {
    window.location.replace('/auth.html?return=' + encodeURIComponent(location.href));
    return null;
  }

  function renderMsgs() {
    const nodes: React.ReactNode[] = [];
    let lastDate = '';
    msgs.forEach(m => {
      const dStr = fmtDate(m.at);
      if (dStr !== lastDate) {
        lastDate = dStr;
        nodes.push(
          <div key={'d-' + m.seq} className="flex items-center gap-2 my-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200" />{dStr}<div className="flex-1 h-px bg-gray-200" />
          </div>
        );
      }
      const ts = fmtTime(m.at);
      const mine = m.from === session!.userId;
      const maskedNote = m.masked ? (
        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600">
          <Ban className="w-3 h-3" aria-hidden />{t.chatMaskNotice}
        </div>
      ) : null;

      if (mine) {
        nodes.push(
          <div key={m.seq} className="flex items-end gap-2 max-w-[86%] self-start flex-row-reverse">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">{avatarLetter()}</div>
            <div>
              <div className="bg-blue-600 text-white rounded-2xl rounded-bl-sm px-3 py-2.5 text-sm leading-relaxed shadow-sm">{m.text}</div>
              {maskedNote}
              <div className="text-[10px] text-gray-500 mt-1 pl-1 text-left">{ts}</div>
            </div>
          </div>
        );
      } else {
        nodes.push(
          <div key={m.seq} className="flex items-end gap-2 max-w-[86%] self-end">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">؟</div>
            <div>
              <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-br-sm px-3 py-2.5 text-sm text-gray-800 leading-relaxed shadow-sm">{m.text}</div>
              {maskedNote}
              <div className="text-[10px] text-gray-500 mt-1 pr-1">{ts}</div>
            </div>
          </div>
        );
      }
    });
    return nodes;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
        <button onClick={() => history.back()}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-lg shrink-0">←</button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-base font-bold text-white shrink-0">
          {peerName[0] ?? '؟'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 truncate">{peerName}</div>
          {peerRoleLabel && <div className="text-xs text-gray-500">{peerRoleLabel}</div>}
        </div>
        <div className="text-xs text-green-600 border border-green-200 bg-green-50 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">{t.chatSecure}</div>
      </div>

      {/* Order chip */}
      {orderId && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <Package className="w-5 h-5" aria-hidden />
          <div>
            <div className="text-xs font-bold text-blue-600 tracking-wide">{orderId}</div>
            {order && (
              <div className="text-xs text-gray-500">
                {(order.originLabel || order.origin || '—') + ' → ' + (order.destLabel || order.dest || '—')}
              </div>
            )}
          </div>
          <button onClick={() => { location.href = '/track?id=' + orderId; }}
                  className="mr-auto text-xs font-bold text-blue-600">{t.chatTrack}</button>
        </div>
      )}

      {/* Anti-bypass warning banner */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 leading-relaxed">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        <span>{t.chatWarnBanner}</span>
      </div>

      {/* Messages */}
      <div ref={messagesEl} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loaded && !unlocked && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <Lock className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
            <div className="text-base font-bold text-gray-800 mb-2">{t.chatLockedTitle}</div>
            <div className="text-sm text-gray-500 leading-relaxed max-w-xs">{t.chatLockedDesc}</div>
          </div>
        )}
        {loaded && unlocked && msgs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" aria-hidden />
            <div className="text-base font-bold text-gray-800 mb-2">{t.chatEmptyTitle}</div>
            <div className="text-sm text-gray-500 leading-relaxed">{t.chatEmptyDesc}</div>
          </div>
        )}
        {renderMsgs()}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2">
        {!writable && unlocked && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 text-xs font-semibold text-gray-500 text-center mb-2">
            {t.chatClosedNotice}
          </div>
        )}
        {notice && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-xs font-bold text-red-600 text-center mb-2">
            {notice}
          </div>
        )}
        {warnMsg && <div className="text-xs text-red-500 px-2 py-1 mb-1">{warnMsg}</div>}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaEl}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={!writable}
            placeholder={t.chatPlaceholder}
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 placeholder:text-gray-400 leading-relaxed overflow-hidden disabled:opacity-60"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg shadow-sm transition-all disabled:opacity-40 disabled:scale-90 shrink-0"
            aria-label={t.chatPlaceholder}
          ><Send className="w-5 h-5" aria-hidden /></button>
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-1.5 opacity-70">{t.chatWarnBanner}</div>
      </div>
    </div>
  );
}
