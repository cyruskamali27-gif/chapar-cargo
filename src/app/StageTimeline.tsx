import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Circle, Loader2, Upload, ArrowLeft, MapPin, FileText, ShieldAlert } from 'lucide-react';
import { useLang } from '../lib/LangContext';

// ── CMD-54 (3d) — live purchase-tracking timeline ─────────────────────────────
//
// ONE component, two roles. The buyer sees it read-only and live-polling; the accepted traveler
// gets a next-stage control + receipt attach at the receipt stage. Stages only — the declared
// corridor is shown as STATIC context, explicitly not the traveler's live location. 'delivered' is
// labelled the traveler's claim; escrow release still runs through the OTP path elsewhere.
//
// Data: GET /api/marketplace/events/:orderId (party-gated, polled) and
// POST /api/marketplace/events/:orderId { stage, mediaKey? }. Receipt upload tries the presigned
// PUT straight to Spaces (bytes never touch the droplet); if the bucket CORS blocks the browser PUT
// it falls back to the server proxy. Auto-switches to direct-PUT once an operator adds bucket CORS.

const STAGE_KEYS = ['purchased', 'receipt_uploaded', 'in_transit', 'arrived', 'delivered'] as const;
type Stage = typeof STAGE_KEYS[number];

interface Ev { seq: number; stage: Stage; at: string; by: string; receipt?: { uploadedByTraveler: boolean; url: string | null }; }

const POLL_FOCUS = 5000, POLL_HIDDEN = 25000;

export default function StageTimeline({ orderId, control = false }: { orderId: string; control?: boolean }) {
  const { t, isRTL } = useLang();
  const token = (() => { try { return localStorage.getItem('cp_token') || ''; } catch { return ''; } })();

  const [events, setEvents]   = useState<Ev[]>([]);
  const [current, setCurrent] = useState<Stage | null>(null);
  const [role, setRole]       = useState<'buyer' | 'traveler' | ''>('');
  const [corridor, setCorridor] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [status, setStatus]   = useState('');
  const [loaded, setLoaded]   = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const LABEL: Record<Stage, string> = {
    purchased: t.tkPurchased, receipt_uploaded: t.tkReceipt, in_transit: t.tkInTransit,
    arrived: t.tkArrived, delivered: t.tkDelivered,
  };

  const poll = useCallback(async () => {
    if (!orderId || !token) return;
    try {
      const r = await fetch(`/api/marketplace/events/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setEvents(d.events || []);
        setCurrent(d.currentStage || null);
        setRole(d.role || '');
        setCorridor(d.corridor || { from: null, to: null });
        setStatus(d.status || '');
      }
    } catch { /* transient */ } finally { setLoaded(true); }
  }, [orderId, token]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      await poll();
      if (!alive) return;
      pollTimer.current = setTimeout(tick, document.hidden ? POLL_HIDDEN : POLL_FOCUS);
    };
    tick();
    const onVis = () => { if (!document.hidden) { if (pollTimer.current) clearTimeout(pollTimer.current); tick(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; if (pollTimer.current) clearTimeout(pollTimer.current); document.removeEventListener('visibilitychange', onVis); };
  }, [poll]);

  const curIdx  = current ? STAGE_KEYS.indexOf(current) : -1;
  const nextIdx = curIdx + 1;
  const nextStage = nextIdx < STAGE_KEYS.length ? STAGE_KEYS[nextIdx] : null;
  const isTraveler = control && role === 'traveler';
  const receiptEvent = events.find(e => e.stage === 'receipt_uploaded');
  // Tracking is live only while the deal is active; closed at terminal.
  const closed = status === 'escrow_released' || status === 'deleted';

  async function advance(stage: Stage, mediaKey?: string) {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/marketplace/events/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage, ...(mediaKey ? { mediaKey } : {}) }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'error'); }
      await poll();
    } catch { setErr('error'); } finally { setBusy(false); }
  }

  async function onReceiptPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || busy) return;
    setBusy(true); setErr('');
    try {
      // Preferred: presigned PUT straight to Spaces (bytes never touch the droplet). If the bucket
      // CORS blocks the browser PUT (currently the case — operator must add a CORS rule), fall back
      // to the server proxy so the upload still works. Auto-switches to direct-PUT once CORS is set.
      let mediaKey: string | null = null;
      try {
        const u = await fetch(`/api/marketplace/receipt-upload-url?orderId=${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const ud = await u.json().catch(() => null);
        if (u.ok && ud?.uploadUrl) {
          const put = await fetch(ud.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
          if (put.ok) mediaKey = ud.mediaKey;
        }
      } catch { /* CORS/network — fall through to the proxy */ }
      if (!mediaKey) {
        const pr = await fetch(`/api/marketplace/receipt/${encodeURIComponent(orderId)}`, {
          method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg', Authorization: `Bearer ${token}` }, body: file,
        });
        const pd = await pr.json().catch(() => null);
        if (!pr.ok || !pd?.mediaKey) { setErr(pd?.error || 'upload_failed'); setBusy(false); return; }
        mediaKey = pd.mediaKey;
      }
      await advance('receipt_uploaded', mediaKey);
    } catch { setErr('error'); setBusy(false); }
  }

  return (
    <div className="ds-card p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-cyan-600" aria-hidden />
        <h3 className="text-sm font-extrabold text-gray-900">{t.tkTitle}</h3>
      </div>
      {/* declared corridor — STATIC context, not live location */}
      {(corridor.from || corridor.to) && (
        <div className="text-[11px] text-gray-500 mb-4 flex items-center gap-1">
          <span className="font-mono font-bold text-gray-700">{corridor.from || '—'} → {corridor.to || '—'}</span>
          <span>·</span><span>{t.tkCorridorNote}</span>
        </div>
      )}

      {loaded && events.length === 0 && (
        <div className="text-sm text-gray-500 py-4 text-center">{t.tkNoEvents}</div>
      )}

      {/* stage rail */}
      <ol className="space-y-0">
        {STAGE_KEYS.map((st, i) => {
          const done   = i <= curIdx;
          const active = i === curIdx;
          const ev     = events.find(e => e.stage === st);
          return (
            <li key={st} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                {done
                  ? <CheckCircle2 className={`w-6 h-6 ${active ? 'text-cyan-600' : 'text-green-600'}`} aria-hidden />
                  : <Circle className="w-6 h-6 text-gray-300" aria-hidden />}
                {i < STAGE_KEYS.length - 1 && <div className={`w-0.5 h-8 ${i < curIdx ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <div className={`text-sm font-bold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{LABEL[st]}</div>
                {ev && <div className="text-[11px] text-gray-500 mt-0.5">{new Date(ev.at).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                {/* receipt row */}
                {st === 'receipt_uploaded' && ev?.receipt && (
                  <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                    <FileText className="w-4 h-4 text-gray-500" aria-hidden />
                    {ev.receipt.url
                      ? <a href={ev.receipt.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-cyan-700">{t.tkViewReceipt}</a>
                      : <span className="text-[12px] text-gray-500">{t.tkReceiptUploaded}</span>}
                    <span className="text-[10px] text-amber-600 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" aria-hidden />{t.tkReceiptByTraveler}</span>
                  </div>
                )}
                {st === 'delivered' && done && (
                  <div className="mt-1 text-[11px] text-amber-700">{t.tkDeliveredNote}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* traveler control */}
      {isTraveler && !closed && nextStage && (
        <div className="mt-2 pt-3 border-t border-gray-100">
          {nextStage === 'receipt_uploaded' ? (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="ds-btn-primary w-full disabled:opacity-60" style={{ height: 42 }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}
                {t.tkAttachReceipt}
              </button>
              {/* CMD-65 (A): a purchase receipt is a PHYSICAL item the traveler is holding when
                  they hit this button, so the phone should open the rear camera rather than the
                  gallery. Desktop ignores `capture` and keeps the file dialog. */}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onReceiptPicked} />
              {/* allow skipping the optional receipt straight to in_transit */}
              <button onClick={() => advance('in_transit')} disabled={busy}
                className="mt-2 text-[12px] font-semibold text-gray-500 w-full text-center">
                {t.tkInTransit} ←
              </button>
            </>
          ) : (
            <button onClick={() => advance(nextStage)} disabled={busy}
              className="ds-btn-primary w-full disabled:opacity-60" style={{ height: 42 }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ArrowLeft className="w-4 h-4" aria-hidden />}
              {busy ? t.tkAdvancing : `${t.tkNextBtn}: ${LABEL[nextStage]}`}
            </button>
          )}
          {err && <p className="mt-2 text-[11px] text-red-600 text-center">{err}</p>}
        </div>
      )}
    </div>
  );
}
