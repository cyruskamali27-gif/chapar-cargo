/**
 * Chat page — ports chat.html exactly.
 * localStorage keys: cp_chat_<chatId> (read/write), cp_chat_blocked_log (write), cp_history (read)
 * URL params: ?order= | ?id=, ?peer=, ?name=, ?role=
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Store, getSession, genId } from '../lib/store';

// ── Content filter (exact from chat.html) ─────────────────────────────────────
const BLOCK_PATTERNS = [
  { re: /(\+?[0-9][\s\-.]?){9,13}[0-9]/g,                                                                                                                         msg: 'شماره تلفن' },
  { re: /@[A-Za-z0-9_]{4,}/g,                                                                                                                                      msg: 'آیدی تلگرام/کاربری' },
  { re: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,                                                                                                     msg: 'ایمیل' },
  { re: /(https?:\/\/|www\.)[^\s]+/gi,                                                                                                                              msg: 'لینک خارجی' },
  { re: /wa\.me\/[0-9]+/gi,                                                                                                                                         msg: 'واتساپ' },
  { re: /t\.me\/[A-Za-z0-9_]+/gi,                                                                                                                                   msg: 'لینک تلگرام' },
  { re: /صفر[\s‌]*[نیهدسچپش]|[نیهدسچپش][\s‌]*صفر|یک[\s‌]*دو|دو[\s‌]*سه|سه[\s‌]*چهار|چهار[\s‌]*پنج|نه[\s‌]*هشت/g,            msg: 'اعداد به حروف فارسی' },
  { re: /\b(zero|one|two|three|four|five|six|seven|eight|nine)[\s,.-]+(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi,                                    msg: 'اعداد به حروف انگلیسی' },
  { re: /خارج از (چاپار|اپ|پلتفرم)|بیا بریم خارج/gi,                                                                                                             msg: 'تبانی خارج از پلتفرم' },
];

const MOD_PATTERNS = [
  /\d[\d\s\-]{6,}\d/,
  /(?:^|[\s,،])09\d{9}(?=$|[\s,،])/,
  /\+98\d{10}/,
  /@[a-zA-Z0-9_]{4,}/,
  /wa\.me\//i, /wa\.link\//i,
  /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/,
  /https?:\/\//i, /t\.me\//i, /telegram\.me\//i,
  /whatsapp\.com/i, /instagram\.com/i, /telegram\.org/i,
  /تلگرام/, /واتساپ/, /ایمیل من/, /شماره من/, /با من تماس/, /contact me/i,
];

const AUTO_REPLIES = [
  'ممنون از پیامتون. بزودی بررسی می‌کنم.',
  'باشه، متوجه شدم.',
  'مشخصات کالا را دقیق‌تر توضیح دهید.',
  'چه وزن و ابعادی داره؟',
  'تاریخ ارسال مشخص شده؟',
  'هزینه پیشنهادی من معقوله.',
  'وضعیت تحویل رو از پیگیری ببینید.',
  'پرداخت از طریق چاپار انجام می‌شه، نگران نباشید.',
  'اگه سوالی دارید اینجا بپرسید.',
];

// ── Types ─────────────────────────────────────────────────────────────────────
type MsgType = 'system' | 'ai' | 'me' | 'them' | 'blocked' | 'scan';

interface Msg {
  id: string;
  type: MsgType;
  text?: string;
  blockedPreview?: string;
  at: number;
}

interface Order {
  trackId?: string;
  origin?: string; dest?: string;
  originLabel?: string; destLabel?: string;
}

function scanMessage(text: string): string[] {
  const blocked: string[] = [];
  BLOCK_PATTERNS.forEach(p => {
    p.re.lastIndex = 0;
    if (p.re.test(text)) blocked.push(p.msg);
  });
  return blocked;
}

function checkMessageAllowed(text: string): boolean {
  return !MOD_PATTERNS.some(p => p.test(text));
}

function maskBlockedContent(text: string): string {
  let out = text;
  BLOCK_PATTERNS.forEach(p => {
    p.re.lastIndex = 0;
    out = out.replace(p.re, m => '[' + '★'.repeat(Math.min(m.length, 8)) + ']');
  });
  return out;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fa-IR', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const session  = getSession();
  const params   = new URLSearchParams(location.search);
  const orderId  = (params.get('order') || params.get('id') || '').toUpperCase();
  const peerId   = params.get('peer') || '';
  const peerName = params.get('name') || 'طرف مقابل';
  const peerRole = params.get('role') || '';
  const chatId   = 'chat_' + (orderId || peerId || 'general');

  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const [modErr, setModErr]   = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const msgsRef       = useRef<Msg[]>([]);
  const modErrTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEl    = useRef<HTMLDivElement>(null);
  const textareaEl    = useRef<HTMLTextAreaElement>(null);

  const order: Order | null = (() => {
    const hist = Store.get<Order[]>('history') ?? [];
    return orderId ? (hist.find(o => o.trackId === orderId) ?? null) : null;
  })();

  // Seed & load messages
  useEffect(() => {
    if (!session) return;
    let stored = Store.get<Msg[]>(chatId) ?? [];
    if (!stored.length) {
      const now = Date.now();
      stored = [
        { id: 'sys-0', type: 'system', text: 'گفتگو با ' + peerName + ' شروع شد. این مکالمه توسط هوش مصنوعی چاپار مدیریت می‌شود.', at: now - 2000 },
        { id: 'sys-1', type: 'system', text: '🔒 این گفتگو رمزنگاری شده است. اشتراک‌گذاری اطلاعات تماس در اینجا ممنوع است.', at: now - 1000 },
        { id: 'ai-greet', type: 'ai', text: 'سلام! من مدیر هوشمند چاپار هستم. این گفتگو را نظارت می‌کنم تا تجربه‌ای امن برای هر دو طرف فراهم شود. چطور می‌توانم کمک کنم؟', at: now },
      ];
      Store.set(chatId, stored);
    }
    msgsRef.current = stored;
    setMsgs([...stored]);
    setTimeout(() => scrollToBottom(false), 50);
  }, []);

  // Scroll on msgs change
  useEffect(() => {
    scrollToBottom(true);
  }, [msgs]);

  function scrollToBottom(smooth: boolean) {
    const el = messagesEl.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }

  function addMsg(m: Msg) {
    msgsRef.current = [...msgsRef.current, m];
    Store.set(chatId, msgsRef.current);
    setMsgs([...msgsRef.current]);
  }

  function removeMsg(id: string) {
    msgsRef.current = msgsRef.current.filter(m => m.id !== id);
    setMsgs([...msgsRef.current]);
  }

  function logBlocked(text: string, reasons: string[]) {
    const log = Store.get<unknown[]>('chat_blocked_log') ?? [];
    log.push({ orderId, userId: session?.userId, text: maskBlockedContent(text), reasons, at: Date.now() });
    Store.set('chat_blocked_log', log.slice(0, 200));
  }

  function showModError() {
    if (modErrTimer.current) clearTimeout(modErrTimer.current);
    setModErr(true);
    modErrTimer.current = setTimeout(() => setModErr(false), 4000);
  }

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    // Auto-resize
    const ta = textareaEl.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; }
    if (!val.trim()) { setWarnMsg(''); return; }
    const blocked = scanMessage(val);
    if (blocked.length) {
      setWarnMsg('⛔ پیام حاوی ' + blocked.join('، ') + ' است — ارسال مسدود شد');
    } else {
      setWarnMsg('');
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;

    const blocked = scanMessage(text);
    if (blocked.length) {
      logBlocked(text, blocked);
      showModError();
      setInput(''); setWarnMsg('');
      if (textareaEl.current) textareaEl.current.style.height = 'auto';
      return;
    }
    if (!checkMessageAllowed(text)) {
      logBlocked(text, ['moderation']);
      showModError();
      setInput(''); setWarnMsg('');
      if (textareaEl.current) textareaEl.current.style.height = 'auto';
      return;
    }

    const msg: Msg = { id: genId('MSG'), type: 'me', text, at: Date.now() };
    addMsg(msg);
    setInput(''); setWarnMsg('');
    if (textareaEl.current) textareaEl.current.style.height = 'auto';

    // Moderation scan animation
    const scanId = 'scan-' + msg.id;
    const scanMsg: Msg = { id: scanId, type: 'scan', at: Date.now() };
    setTimeout(() => {
      msgsRef.current = [...msgsRef.current, scanMsg];
      setMsgs([...msgsRef.current]);
    }, 100);
    setTimeout(() => removeMsg(scanId), 1500);

    // Peer typing + reply
    setTimeout(() => setIsTyping(true), 1200);
    setTimeout(() => {
      setIsTyping(false);
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      addMsg({ id: genId('MSG'), type: 'them', text: reply, at: Date.now() });
    }, 2800 + Math.random() * 1400);
  }

  const avatarLetter = () => (session?.firstName || session?.name || '؟')[0] ?? '؟';
  const canSend = input.trim().length > 0 && !warnMsg && input.length <= 500;

  const peerRoleLabel = peerRole === 'traveler' ? '✈️ مسافر' : peerRole === 'sender' ? '📦 فرستنده' : peerRole;

  // ── No auth ──────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center" dir="rtl">
        <div className="text-6xl mb-4">🔐</div>
        <div className="text-xl font-bold text-gray-900 mb-2">ورود لازم است</div>
        <div className="text-sm text-gray-500 mb-6">برای استفاده از پیام‌رسان، وارد شوید</div>
        <a href={'/?page=auth&return=' + encodeURIComponent(location.href)}
           className="inline-flex items-center justify-center h-12 px-6 bg-blue-600 text-white rounded-xl font-bold text-sm">
          ورود / ثبت نام ←
        </a>
      </div>
    );
  }

  // ── Render messages ───────────────────────────────────────────────────────────
  function renderMsgs() {
    const nodes: React.ReactNode[] = [];
    let lastDate = '';
    msgs.forEach(m => {
      const dStr = fmtDate(m.at);
      if (dStr !== lastDate) {
        lastDate = dStr;
        nodes.push(
          <div key={'d-' + m.id} className="flex items-center gap-2 my-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200" />
            {dStr}
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        );
      }
      const ts = fmtTime(m.at);

      if (m.type === 'scan') {
        nodes.push(
          <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-500 self-stretch mx-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            🤖 هوش مصنوعی در حال بررسی پیام...
          </div>
        );
        return;
      }

      if (m.type === 'system') {
        nodes.push(
          <div key={m.id} className="self-center max-w-xs text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-700">{m.text}</div>
          </div>
        );
        return;
      }

      if (m.type === 'ai') {
        nodes.push(
          <div key={m.id} className="flex items-end gap-2 max-w-[86%] self-end">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-xs shrink-0 shadow">🤖</div>
            <div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl rounded-br-sm px-3 py-2.5 text-sm text-gray-800 leading-relaxed">{m.text}</div>
              <div className="text-[10px] text-gray-400 mt-1 pr-1">{ts} · هوش مصنوعی چاپار</div>
            </div>
          </div>
        );
        return;
      }

      if (m.type === 'blocked') {
        nodes.push(
          <div key={m.id} className="flex items-end gap-2 max-w-[86%] self-start flex-row-reverse">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">{avatarLetter()}</div>
            <div>
              <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm px-3 py-2.5 text-sm text-red-600 italic leading-relaxed">
                ⛔ {m.blockedPreview || 'پیام مسدود شد'}
                <div className="inline-block bg-red-100 rounded-md px-2 py-0.5 text-[10px] text-red-500 font-bold mr-2 mt-1">🤖 مسدود توسط AI</div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 pl-1 text-left">{ts}</div>
            </div>
          </div>
        );
        return;
      }

      if (m.type === 'me') {
        nodes.push(
          <div key={m.id} className="flex items-end gap-2 max-w-[86%] self-start flex-row-reverse">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">{avatarLetter()}</div>
            <div>
              <div className="bg-blue-600 text-white rounded-2xl rounded-bl-sm px-3 py-2.5 text-sm leading-relaxed shadow-sm">{m.text}</div>
              <div className="text-[10px] text-gray-400 mt-1 pl-1 text-left">{ts} ✓✓</div>
            </div>
          </div>
        );
        return;
      }

      // them
      nodes.push(
        <div key={m.id} className="flex items-end gap-2 max-w-[86%] self-end">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">؟</div>
          <div>
            <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-br-sm px-3 py-2.5 text-sm text-gray-800 leading-relaxed shadow-sm">{m.text}</div>
            <div className="text-[10px] text-gray-400 mt-1 pr-1">{ts}</div>
          </div>
        </div>
      );
    });
    return nodes;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden" dir="rtl">

      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
        <button onClick={() => history.back()}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-lg shrink-0">←</button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-base font-bold text-white shrink-0">
          {peerName[0] ?? '؟'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 truncate">{peerName}</div>
          {peerRoleLabel && <div className="text-xs text-gray-400">{peerRoleLabel}</div>}
          <div className="text-xs text-green-600 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />آنلاین
          </div>
        </div>
        <div className="text-xs text-green-600 border border-green-200 bg-green-50 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">🔒 امن</div>
      </div>

      {/* Order chip */}
      {order && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <span className="text-lg">📦</span>
          <div>
            <div className="text-xs font-bold text-blue-600 tracking-wide">{orderId}</div>
            <div className="text-xs text-gray-500">
              {(order.originLabel || order.origin || '—') + ' → ' + (order.destLabel || order.dest || '—')}
            </div>
          </div>
          <button onClick={() => { location.href = '/track?id=' + orderId; }}
                  className="mr-auto text-xs font-bold text-blue-600">پیگیری ←</button>
        </div>
      )}

      {/* Warning banner */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 leading-relaxed">
        <span className="shrink-0">⚠️</span>
        <span>اشتراک‌گذاری شماره تلفن، ایمیل، لینک‌های خارجی یا آیدی‌های شبکه‌های اجتماعی در این چت <strong>ممنوع</strong> است. پیام‌های حاوی این اطلاعات خودکار مسدود می‌شوند.</span>
      </div>

      {/* Messages area */}
      <div ref={messagesEl} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {msgs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="text-5xl mb-3">💬</div>
            <div className="text-base font-bold text-gray-800 mb-2">گفتگو را شروع کنید</div>
            <div className="text-sm text-gray-400 leading-relaxed">پیام امن خود را بنویسید.<br />هوش مصنوعی چاپار اطلاعات تماس را فیلتر می‌کند.</div>
          </div>
        )}
        {renderMsgs()}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 max-w-[86%] self-end">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">؟</div>
            <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-br-sm px-4 py-3 flex gap-1 items-center shadow-sm">
              {[0, 200, 400].map(delay => (
                <div key={delay} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                     style={{ animationDelay: delay + 'ms' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2">
        {modErr && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-xs font-bold text-red-600 text-center mb-2">
            این پیام شامل اطلاعات تماس یا تلاش برای دور زدن سیستم است و ارسال نشد.
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
            placeholder="پیام بنویسید..."
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 placeholder:text-gray-400 leading-relaxed overflow-hidden"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg shadow-sm transition-all disabled:opacity-40 disabled:scale-90 shrink-0"
          >➤</button>
        </div>
        <div className="text-center text-[10px] text-gray-400 mt-1.5 opacity-70">
          🤖 مدیریت هوش مصنوعی فعال — تمام پیام‌ها بررسی می‌شوند
        </div>
      </div>
    </div>
  );
}
