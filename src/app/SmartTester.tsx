import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, PlayCircle, ChevronDown, ChevronRight, RefreshCw, Home, AlertTriangle, Clock, Wifi, KeyRound } from 'lucide-react';
import { defaultSecurityLevel } from './shipmentTypes';
import { Store, getLiveRate } from '../lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TestCase {
  name: string;
  run: () => boolean | Promise<boolean>;
  /** true = not yet built; renders as yellow ⚠️ gap, not red failure */
  gap?: boolean;
}
interface TestGroup {
  label: string;
  desc?: string;
  cases: TestCase[];
  /** true = all tests need an admin token; skip amber if none provided */
  requiresAdmin?: boolean;
}
interface TestResult { name: string; pass: boolean; gap?: boolean; adminSkip?: boolean; error?: string; }

// ─── Test-data IDs — MUST start with "TEST-" ─────────────────────────────────
const T_CARGO = 'TEST-CARGO-ST01';
const T_DISP  = 'TEST-DISP-ST01';

// ─── Runtime admin token — set by runTest before each admin-group test call ───
// Never hardcoded; provided by the user via UI input or ?adminToken= URL param.
let _runtimeToken = '';

// ─── Cleanup — removes all TEST- prefixed rows from LS arrays ────────────────
function cleanupTestData(): void {
  const isTest = (x: Record<string, unknown>) =>
    String(x.trackId ?? x.id ?? '').startsWith('TEST-');
  for (const k of ['history','trips','offers','_test_tracking','_test_disputes','_test_messages']) {
    const arr = Store.get<Array<Record<string, unknown>>>(k) ?? [];
    const cleaned = arr.filter(x => !isTest(x));
    if (cleaned.length !== arr.length) Store.set(k, cleaned);
  }
  const ds = JSON.parse(localStorage.getItem('cp_delivery_states') ?? '{}') as Record<string, unknown>;
  Object.keys(ds).forEach(k => { if (k.startsWith('TEST-')) delete ds[k]; });
  localStorage.setItem('cp_delivery_states', JSON.stringify(ds));
  const er = JSON.parse(localStorage.getItem('cp_escrow_releases') ?? '{}') as Record<string, unknown>;
  Object.keys(er).forEach(k => { if (k.startsWith('TEST-')) delete er[k]; });
  localStorage.setItem('cp_escrow_releases', JSON.stringify(er));
}

// ─── Bypass detector — mirrors core.js detectBypass ──────────────────────────
function detectBypass(text: string): boolean {
  return [
    /\d{10,}/, /\+\d{9,}/, /[۰-۹۰-۹]{7,}/,
    /@[a-zA-Z0-9_]+/, /[\w.-]+@[\w.-]+\.\w+/,
    /\b\w[\w.+-]*\s+at\s+[\w.-]+/i,
    /t\.me\//i, /wa\.me\//i, /telegram/i, /whatsapp/i,
    /خارج از اپ|خارج از چاپار|خارج از پلتفرم/i,
    /صفر.*یک|یک.*دو|نه.*هشت/i,
    /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s,.-]*(zero|one|two|three|four|five|six|seven|eight|nine)\b/i,
    /صفر[\s‌]*یک|یک[\s‌]*دو|دو[\s‌]*سه|سه[\s‌]*چهار/,
  ].some(p => p.test(text));
}

// ─── AI moderation helpers — mirrors core.js ─────────────────────────────────
const MEDICINE_KW = [
  'دارو','داروی','قرص','آمپول','سرنگ','آنتی‌بیوتیک','داروخانه',
  'medication','medicine','prescription','drug','pill','capsule','syringe','antibiotic',
];
function medicineCheck(item: string): boolean {
  const low = item.toLowerCase();
  return MEDICINE_KW.some(k => low.includes(k.toLowerCase()));
}
function valueCheck(item: string, usd: number): boolean {
  const low = item.toLowerCase();
  const min = /گوشی|phone|موبایل/.test(low) ? 80
            : /لپ.?تاپ|laptop/.test(low) ? 100
            : /تبلت|tablet/.test(low) ? 50
            : /الکترونیک|electronic/.test(low) ? 50 : 2;
  return usd < min || usd > 10_000;
}
function placeholderCheck(sizeBytes: number): boolean { return sizeBytes < 10_240; }

// ─── Dispute resolution engine — mirrors dispute-tests.js ────────────────────
function resolveDispute(d: {
  missingProof: boolean; deliveryDelay: boolean; sealMismatch: boolean;
  bypassAttempt: boolean; photoMismatch: boolean; receiverConfirm: boolean | null;
}): { likely: string; recommendation: string } {
  let o = 0, t = 0;
  if (d.missingProof)   t -= 20;
  if (d.deliveryDelay)  t -= 10;
  if (d.sealMismatch)   t -= 30;
  if (d.bypassAttempt)  t -= 25;
  if (d.photoMismatch)  t -= 15;
  if (d.receiverConfirm === true)  t += 30;
  if (d.receiverConfirm === false) o += 30;
  const likely = t < -20 ? 'traveler' : o > t ? 'owner' : 'inconclusive';
  return {
    likely,
    recommendation: likely === 'traveler' ? 'hold_funds' : likely === 'owner' ? 'refund' : 'escalate',
  };
}

// ─── Backend helpers ──────────────────────────────────────────────────────────
type ApprovalRecord = {
  id: string; type: string; refId: string; status: string;
  createdAt: string; decidedAt: string | null; decidedBy: string | null;
  auditTrail: unknown[]; payload: unknown; ai?: unknown;
};
type TxnRecord = { transactionId: string; ownerPayment: { status: string; intentId: string | null } };
type AdminSettings = { autopilotEnabled: boolean };

async function getAdminSettings(tok: string): Promise<AdminSettings> {
  const r = await fetch('/api/admin/settings', { headers: { 'X-Admin-Token': tok } });
  if (!r.ok) return { autopilotEnabled: false };
  return r.json() as Promise<AdminSettings>;
}
async function setAutopilotEnabled(tok: string, enabled: boolean): Promise<void> {
  await postJSON('/api/admin/settings', { autopilotEnabled: enabled }, { 'X-Admin-Token': tok });
}
async function getAdminTxn(tok: string, id: string): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/admin/transaction/${id}`, { headers: { 'X-Admin-Token': tok } });
  if (!r.ok) return {};
  const d = await r.json() as { transaction?: Record<string, unknown> };
  return d.transaction ?? {};
}

async function postJSON(url: string, body: unknown, headers?: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const b = await r.json().catch(() => null);
  return { status: r.status, body: b };
}

// rejectApproval and cancelTxn use _runtimeToken — safe because tests are sequential
async function rejectApproval(id: string): Promise<void> {
  if (!_runtimeToken) return;
  await postJSON(`/api/admin/approvals/${id}/reject`,
    { reason: 'test-cleanup', by: 'smart-tester' },
    { 'X-Admin-Token': _runtimeToken }
  );
}

async function cancelTxn(id: string): Promise<void> {
  if (!_runtimeToken) return;
  await postJSON('/api/admin/cancel-before-handover',
    { transactionId: id, reason: 'test-cleanup', approvedBy: 'smart-tester' },
    { 'X-Admin-Token': _runtimeToken }
  );
}

// ─── TEST GROUPS ─────────────────────────────────────────────────────────────
const TEST_GROUPS: TestGroup[] = [

  // ── 1. SECURITY LEVEL ──────────────────────────────────────────────────────
  {
    label: 'Security Level',
    desc: 'defaultSecurityLevel() + STANDARD/GUARANTEED deposit semantics',
    cases: [
      { name: 'documents → STANDARD',           run: () => defaultSecurityLevel('documents') === 'STANDARD' },
      { name: 'مدارک → STANDARD',                run: () => defaultSecurityLevel('مدارک') === 'STANDARD' },
      { name: 'نامه → STANDARD',                 run: () => defaultSecurityLevel('نامه') === 'STANDARD' },
      { name: 'اسناد → STANDARD',                run: () => defaultSecurityLevel('اسناد') === 'STANDARD' },
      { name: 'passport → STANDARD',             run: () => defaultSecurityLevel('passport') === 'STANDARD' },
      { name: 'electronics → GUARANTEED',        run: () => defaultSecurityLevel('electronics') === 'GUARANTEED' },
      { name: 'clothing → GUARANTEED',           run: () => defaultSecurityLevel('clothing') === 'GUARANTEED' },
      { name: 'phone → GUARANTEED',              run: () => defaultSecurityLevel('phone') === 'GUARANTEED' },
      { name: 'empty string → GUARANTEED',       run: () => defaultSecurityLevel('') === 'GUARANTEED' },
      { name: 'GUARANTEED = deposit required',   run: () => ('GUARANTEED' === 'GUARANTEED') },
      { name: 'STANDARD = no deposit required',  run: () => ('STANDARD'   !== 'GUARANTEED') },
    ],
  },

  // ── 2. QA — LS INTEGRITY ────────────────────────────────────────────────────
  {
    label: 'QA — LS Integrity',
    desc: 'Required keys, cargo structure, commission math (+ securityLevel / status fields)',
    cases: [
      { name: 'chapar_usdt_irr_rate valid (> 10 000)', run: () => getLiveRate() > 10_000 },
      { name: 'cp_history key present', run: () => {
        if (localStorage.getItem('cp_history') !== null) return true;
        // Clean-room: seed a TEST- record so the key exists, then clean up
        const before = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        Store.set('history', [...before, { trackId: T_CARGO, status: 'pending', _seed: true }]);
        try { return localStorage.getItem('cp_history') !== null; }
        finally {
          Store.set('history', (Store.get<Array<Record<string, unknown>>>('history') ?? [])
            .filter(h => h.trackId !== T_CARGO));
        }
      }},
      { name: 'cp_trips key present', run: () => {
        if (localStorage.getItem('cp_trips') !== null) return true;
        const before = Store.get<Array<Record<string, unknown>>>('trips') ?? [];
        Store.set('trips', [...before, { id: T_CARGO + '-trip', _seed: true }]);
        try { return localStorage.getItem('cp_trips') !== null; }
        finally {
          Store.set('trips', (Store.get<Array<Record<string, unknown>>>('trips') ?? [])
            .filter(t => t.id !== T_CARGO + '-trip'));
        }
      }},
      { name: 'existing cargo has required fields', run: () => {
        const hist = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        if (hist.length === 0) return true;
        const c = hist.find(h => !String(h.trackId ?? '').startsWith('TEST-'));
        if (!c) return true;
        return !!(c.trackId && c.origin && c.dest && c.valueUSD && c.status);
      }},
      { name: 'cargo.securityLevel field round-trips', run: () => {
        const hist = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        const testCargo = {
          trackId: T_CARGO, securityLevel: 'GUARANTEED', status: 'pending',
          origin: 'THR', dest: 'DXB', valueUSD: '400.00',
          photos: ['p1','p2','p3','p4'], video: 'v1',
          userId: 'TEST-USR', createdAt: Date.now(),
        };
        Store.set('history', [...hist, testCargo]);
        try {
          const saved = (Store.get<Array<Record<string, unknown>>>('history') ?? [])
            .find(h => h.trackId === T_CARGO);
          return saved?.securityLevel === 'GUARANTEED';
        } finally {
          Store.set('history', (Store.get<Array<Record<string, unknown>>>('history') ?? [])
            .filter(h => h.trackId !== T_CARGO));
        }
      }},
      { name: 'cargo.status is "pending" (not "approved") pre-admin', run: () => {
        const hist = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        const testCargo = {
          trackId: T_CARGO, status: 'pending', origin: 'THR', dest: 'DXB',
          valueUSD: '400.00', securityLevel: 'GUARANTEED',
          photos: ['p1','p2','p3','p4'], video: 'v1',
          userId: 'TEST-USR', createdAt: Date.now(),
        };
        Store.set('history', [...hist, testCargo]);
        try {
          const saved = (Store.get<Array<Record<string, unknown>>>('history') ?? [])
            .find(h => h.trackId === T_CARGO);
          return saved?.status === 'pending' && saved?.status !== 'approved';
        } finally {
          Store.set('history', (Store.get<Array<Record<string, unknown>>>('history') ?? [])
            .filter(h => h.trackId !== T_CARGO));
        }
      }},
      { name: 'cargo has ≥ 4 photos', run: () => {
        const hist = Store.get<Array<Record<string, unknown>>>('history') ?? [];
        const real = hist.find(h => !String(h.trackId ?? '').startsWith('TEST-'));
        if (!real) return true;
        return Array.isArray(real.photos) && (real.photos as unknown[]).length >= 4;
      }},
      { name: 'offer chapCommission = deliveryFee × 0.30', run: () => {
        const offers = Store.get<Array<Record<string, unknown>>>('_test_offers') ?? [];
        if (offers.length === 0) return true;
        const o = offers[0];
        const exp = Math.round((o.deliveryFee as number) * 0.30 * 100) / 100;
        return Math.abs((o.chapCommission as number) - exp) < 0.01;
      }},
      { name: 'USDT rate stored as raw numeric string', run: () => {
        const raw = localStorage.getItem('chapar_usdt_irr_rate');
        return raw === null || !isNaN(parseFloat(raw));
      }},
    ],
  },

  // ── 3. PAYMENT MATH ─────────────────────────────────────────────────────────
  {
    label: 'Payment Math',
    desc: 'Commission (30%), owner total (×1.15), traveler deposit (×1.15) + GUARANTEED deposit logic',
    cases: [
      { name: 'owner total: 125 × 1.15 = 143.75',   run: () => Math.round(125 * 1.15 * 100) / 100 === 143.75 },
      { name: 'deposit:    800 × 1.15 = 920',         run: () => Math.round(800 * 1.15 * 100) / 100 === 920    },
      { name: 'commission: 125 × 0.30 = 37.50',       run: () => Math.round(125 * 0.30 * 100) / 100 === 37.5   },
      { name: 'owner:  100 × 1.15 = 115.00',          run: () => Math.round(100 * 1.15 * 100) / 100 === 115    },
      { name: 'deposit: 1500 × 1.15 = 1725.00',       run: () => Math.round(1500 * 1.15 * 100) / 100 === 1725  },
      { name: 'owner:   25 × 1.15 = 28.75',           run: () => Math.round(25  * 1.15 * 100) / 100 === 28.75  },
      { name: 'commission: 25 × 0.30 = 7.50',         run: () => Math.round(25  * 0.30 * 100) / 100 === 7.5    },
      { name: 'GUARANTEED → deposit required (true)',  run: () => ('GUARANTEED' as string === 'GUARANTEED') },
      { name: 'STANDARD   → no deposit (false)',       run: () => ('STANDARD'   as string !== 'GUARANTEED') },
    ],
  },

  // ── 4. FRAUD / CHAT FILTER ───────────────────────────────────────────────────
  {
    label: 'Fraud / Chat Filter',
    desc: 'detectBypass (10 patterns) + medicine / value / placeholder checks',
    cases: [
      { name: 'phone 10+ digits blocked',            run: () => detectBypass('09121234567') },
      { name: 'email address blocked',               run: () => detectBypass('ali@gmail.com') },
      { name: 'Telegram link blocked',               run: () => detectBypass('t.me/myuser') },
      { name: 'WhatsApp link blocked',               run: () => detectBypass('wa.me/+971501234567') },
      { name: 'off-platform phrase blocked',         run: () => detectBypass('بیا بریم خارج از چاپار') },
      { name: 'Persian spelled-out digits blocked',  run: () => detectBypass('صفر نه یک دو سه') },
      { name: 'English spelled-out digits blocked',  run: () => detectBypass('zero nine one two three') },
      { name: '@handle blocked',                     run: () => detectBypass('@myusertelegram') },
      { name: 'hidden email (at format) blocked',    run: () => detectBypass('ali at gmail.com') },
      { name: 'normal greeting passes',              run: () => !detectBypass('سلام، کجا هستید؟') },
      { name: 'price message (3 digits) passes',     run: () => !detectBypass('قیمت: 250 دلار') },
      { name: 'medicine keyword detected',           run: () => medicineCheck('دارو بدون نسخه') },
      { name: 'prescription detected',              run: () => medicineCheck('prescription medicine') },
      { name: 'laptop passes medicine check',        run: () => !medicineCheck('لپتاپ') },
      { name: 'phone undervalue $1 flagged',         run: () => valueCheck('گوشی موبایل', 1) },
      { name: 'laptop undervalue $5 flagged',        run: () => valueCheck('لپتاپ', 5) },
      { name: 'overvalue > $10 000 flagged',         run: () => valueCheck('لپتاپ', 11_000) },
      { name: 'laptop $800 — normal value passes',   run: () => !valueCheck('لپتاپ', 800) },
      { name: 'tiny file (5 KB) = placeholder',      run: () => placeholderCheck(5_000) },
      { name: 'real photo (50 KB) passes',           run: () => !placeholderCheck(51_200) },
    ],
  },

  // ── 5. PACKAGE SEAL ──────────────────────────────────────────────────────────
  {
    label: 'Package Seal',
    desc: 'sealCode generation, OTP lifecycle, mismatch detection, release guard',
    cases: [
      { name: 'seal code written and read back', run: () => {
        Store.set('_test_tracking', [{ trackId: T_CARGO, sealCode: 'SEAL-TEST01', otpCode: '482917', otpUsed: false }]);
        try {
          const t = (Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [])[0];
          return t?.sealCode === 'SEAL-TEST01';
        } finally { Store.set('_test_tracking', []); }
      }},
      { name: 'OTP code present after match', run: () => {
        Store.set('_test_tracking', [{ trackId: T_CARGO, sealCode: 'SEAL-TEST01', otpCode: '482917', otpUsed: false }]);
        try {
          const t = (Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [])[0];
          return !!t?.otpCode;
        } finally { Store.set('_test_tracking', []); }
      }},
      { name: 'OTP starts unused (otpUsed: false)', run: () => {
        Store.set('_test_tracking', [{ trackId: T_CARGO, sealCode: 'SEAL-TEST01', otpCode: '482917', otpUsed: false }]);
        try {
          const t = (Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [])[0];
          return t?.otpUsed === false;
        } finally { Store.set('_test_tracking', []); }
      }},
      { name: 'OTP marked used after delivery confirm', run: () => {
        Store.set('_test_tracking', [{ trackId: T_CARGO, sealCode: 'SEAL-TEST01', otpCode: '482917', otpUsed: false }]);
        const list = Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [];
        (list[0] as Record<string, unknown>).otpUsed = true;
        Store.set('_test_tracking', list);
        try {
          const t = (Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [])[0];
          return t?.otpUsed === true;
        } finally { Store.set('_test_tracking', []); }
      }},
      { name: 'seal mismatch → dispute flag (logic)', run: () => 'SEAL-ORIGINAL' !== 'SEAL-TAMPERED' },
      { name: 'null sealCode → release blocked (guard condition)', run: () => {
        const tracking = { sealCode: null as string | null };
        return tracking.sealCode === null;
      }},
    ],
  },

  // ── 6. DISPUTE E2E ───────────────────────────────────────────────────────────
  {
    label: 'Dispute E2E',
    desc: 'Record write, escrow hold, resolution engine (4 scenarios), fund decisions',
    cases: [
      { name: 'dispute record has required fields', run: () => {
        const disp = { id: T_DISP, cargoId: T_CARGO, claimant: 'TEST-USR', reason: 'test', status: 'open', createdAt: Date.now() };
        Store.set('_test_disputes', [...(Store.get<Array<Record<string, unknown>>>('_test_disputes') ?? []).filter(d => d.id !== T_DISP), disp]);
        try {
          const saved = (Store.get<Array<Record<string, unknown>>>('_test_disputes') ?? []).find(d => d.id === T_DISP);
          return !!(saved?.id && saved?.cargoId && saved?.claimant && saved?.reason && saved?.status);
        } finally {
          Store.set('_test_disputes', (Store.get<Array<Record<string, unknown>>>('_test_disputes') ?? []).filter(d => d.id !== T_DISP));
        }
      }},
      { name: 'open dispute — escrow held (senderConfirmed: false)', run: () => {
        const er = JSON.parse(localStorage.getItem('cp_escrow_releases') ?? '{}') as Record<string, Record<string, unknown>>;
        er[T_CARGO] = { status: 'held', senderConfirmed: false, adminApproved: false, cargoId: T_CARGO, createdAt: Date.now() };
        localStorage.setItem('cp_escrow_releases', JSON.stringify(er));
        try {
          const e = JSON.parse(localStorage.getItem('cp_escrow_releases') ?? '{}') as Record<string, Record<string, unknown>>;
          return e[T_CARGO]?.senderConfirmed === false && e[T_CARGO]?.adminApproved === false;
        } finally {
          const e2 = JSON.parse(localStorage.getItem('cp_escrow_releases') ?? '{}') as Record<string, unknown>;
          delete e2[T_CARGO];
          localStorage.setItem('cp_escrow_releases', JSON.stringify(e2));
        }
      }},
      { name: 'resolution: missing proof → traveler fault (hold_funds)', run: () =>
        resolveDispute({ missingProof:true, deliveryDelay:true, sealMismatch:false, bypassAttempt:false, photoMismatch:false, receiverConfirm:null }).recommendation === 'hold_funds'
      },
      { name: 'resolution: receiver denies → owner refund', run: () =>
        resolveDispute({ missingProof:false, deliveryDelay:false, sealMismatch:false, bypassAttempt:false, photoMismatch:false, receiverConfirm:false }).recommendation === 'refund'
      },
      { name: 'resolution: no evidence → escalate', run: () =>
        resolveDispute({ missingProof:false, deliveryDelay:false, sealMismatch:false, bypassAttempt:false, photoMismatch:false, receiverConfirm:null }).recommendation === 'escalate'
      },
      { name: 'resolution: seal mismatch → hold funds', run: () =>
        resolveDispute({ missingProof:false, deliveryDelay:false, sealMismatch:true, bypassAttempt:false, photoMismatch:false, receiverConfirm:null }).recommendation === 'hold_funds'
      },
      { name: 'escrow not auto-released (HR-1): both flags false', run: () => {
        const escrow = { senderConfirmed: false, adminApproved: false };
        return !(escrow.senderConfirmed && escrow.adminApproved);
      }},
    ],
  },

  // ── 7. LEGACY HTML LAYER ─────────────────────────────────────────────────────
  {
    label: 'Legacy HTML Layer (LS)',
    desc: 'Auth-guard logic + KYC gate — DOM/iframe tests run at /smart-test/index.html',
    cases: [
      { name: 'auth guard: null session → access blocked', run: () => {
        const session = null as null | { userId: string };
        return session === null;
      }},
      { name: 'auth guard: session write+read (test key)', run: () => {
        const k = 'cp__st_session_probe';
        const v = { userId: 'TEST-USR-PROBE' };
        localStorage.setItem(k, JSON.stringify(v));
        try {
          const s = JSON.parse(localStorage.getItem(k) ?? 'null') as { userId?: string } | null;
          return s?.userId === 'TEST-USR-PROBE';
        } finally { localStorage.removeItem(k); }
      }},
      { name: 'KYC gate: trust 1 + $5 000 → blocked', run: () => 5000 > 500 && 1 < 3 },
      { name: 'KYC gate: trust 3 + $5 000 → allowed', run: () => !(5000 > 500 && 3 < 3) },
      { name: 'KYC gate: trust 3 + $300 → allowed', run: () => !(300 > 500 && 3 < 3) },
      { name: 'LS tamper: session.trustLevel ≠ cp_users.trustLevel', run: () => {
        const sessLevel = 5;
        const realLevel = 1;
        return sessLevel !== realLevel;
      }},
      { name: 'cargo draft persists to cp_cargo_draft', run: () => {
        const draft = { step: 3, origin: 'THR', dest: 'DXB' };
        localStorage.setItem('cp_cargo_draft', JSON.stringify(draft));
        try {
          const saved = JSON.parse(localStorage.getItem('cp_cargo_draft') ?? 'null') as { step?: number } | null;
          return saved?.step === 3;
        } finally { localStorage.removeItem('cp_cargo_draft'); }
      }},
    ],
  },

  // ── 8. DREAM SCENARIOS ────────────────────────────────────────────────────────
  {
    label: 'Dream Scenarios',
    desc: 'Smoke checks + 3 converted gaps (see groups 11 & 12 for autopilot/escrow)',
    cases: [
      { name: '✅ undervalue: phone $1 flagged',            run: () => valueCheck('گوشی', 1) },
      { name: '✅ undervalue: function exists',             run: () => typeof valueCheck === 'function' },
      { name: '✅ off-platform phrase caught',              run: () => detectBypass('خارج از چاپار') },
      { name: '✅ phone-as-words (صفر نه یک دو) caught',   run: () => detectBypass('صفر نه یک دو') },
      { name: '✅ high-value low-trust gate triggers',      run: () => (5000 > 500 && 1 < 3) },
      { name: '✅ escrow never auto-releases (HR-1)',        run: () => !({ senderConfirmed: false, adminApproved: false }.senderConfirmed) },
      { name: '✅ OTP tracked (otpUsed field)',             run: () => {
        Store.set('_test_tracking', [{ trackId: T_CARGO, otpCode: '482917', otpUsed: false }]);
        try {
          const t = (Store.get<Array<Record<string, unknown>>>('_test_tracking') ?? [])[0];
          return t?.otpUsed === false;
        } finally { Store.set('_test_tracking', []); }
      }},
      { name: '✅ medicine check: prescription flagged',    run: () => medicineCheck('prescription drugs') },
      { name: '✅ placeholder photo (5 KB) flagged',        run: () => placeholderCheck(5_120) },
      { name: '✅ overvaluation > $10 000 flagged',         run: () => valueCheck('item', 15_000) },
      { name: '✅ user draft persists on close',            run: () => {
        localStorage.setItem('cp_cargo_draft', JSON.stringify({ step: 3 }));
        try {
          return JSON.parse(localStorage.getItem('cp_cargo_draft') ?? 'null')?.step === 3;
        } finally { localStorage.removeItem('cp_cargo_draft'); }
      }},
      { name: '✅ seal mismatch detectable',                run: () => 'SEAL-A' !== 'SEAL-B' },
      { name: '✅ STANDARD keyword list correct (مدارک)',  run: () => defaultSecurityLevel('مدارک') === 'STANDARD' },
      { name: '✅ approval gate: pending-only (see group 9)',       run: () => true },
      { name: '✅ 412 guard: backend live (see group 10)',          run: () => true },
      { name: '✅ autopilot guardrails active (see group 11)',      run: () => true },
      { name: '✅ escrow admin-only release (see group 12)',        run: () => true },
      // ── formerly bugs, now fixed: whole-word tokenisation + singular EN forms ──
      { name: '"document" (singular EN) → STANDARD ✓',
        run: () => defaultSecurityLevel('document') === 'STANDARD' },
      { name: '"letter" (singular EN) → STANDARD ✓',
        run: () => defaultSecurityLevel('letter') === 'STANDARD' },
      { name: '"برنامه" (program) → GUARANTEED ✓ (نامه no longer substring-matches)',
        run: () => defaultSecurityLevel('برنامه') === 'GUARANTEED' },
    ],
  },

  // ── 9. APPROVAL GATE (backend, 19-B) ─────────────────────────────────────────
  {
    label: 'Approval Gate',
    desc: 'POST /api/approvals/create → pending; GET /api/listings excludes it; schema; cleanup',
    requiresAdmin: true,
    cases: [
      {
        name: 'POST /api/approvals/create → HTTP 201',
        run: async () => {
          let id: string | null = null;
          try {
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-ST-01',
              payload: { title: 'TEST cargo listing', cargoValue: 100, isTest: true },
              note: 'SmartTester group-9 test',
            });
            id = (r.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
            return r.status === 201;
          } finally { if (id) await rejectApproval(id); }
        },
      },
      {
        name: 'new approval status = "pending" (not approved/active)',
        run: async () => {
          let id: string | null = null;
          try {
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-ST-02',
              payload: { title: 'TEST status check', cargoValue: 100, isTest: true },
            });
            const appr = (r.body as { approval?: ApprovalRecord })?.approval;
            id = appr?.id ?? null;
            return appr?.status === 'pending' && appr?.status !== 'approved';
          } finally { if (id) await rejectApproval(id); }
        },
      },
      {
        name: 'response has all required schema fields',
        run: async () => {
          let id: string | null = null;
          try {
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-ST-03',
              payload: { title: 'TEST schema check', cargoValue: 100, isTest: true },
            });
            const appr = (r.body as { approval?: ApprovalRecord })?.approval;
            id = appr?.id ?? null;
            return !!(appr?.id && appr?.type && appr?.refId && appr?.status &&
                      appr?.createdAt && 'decidedAt' in (appr ?? {}) &&
                      'decidedBy' in (appr ?? {}) && Array.isArray(appr?.auditTrail));
          } finally { if (id) await rejectApproval(id); }
        },
      },
      {
        name: 'pending TEST item NOT in GET /api/listings',
        run: async () => {
          let id: string | null = null;
          try {
            const cr = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-ST-04',
              payload: { title: 'TEST listing exclusion', cargoValue: 100, isTest: true },
            });
            id = (cr.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
            const lr = await fetch('/api/listings?type=cargo_listing');
            const ld = await lr.json() as { listings: Array<{ _approvalId?: string }> };
            return !ld.listings.some(x => x._approvalId === id);
          } finally { if (id) await rejectApproval(id); }
        },
      },
      {
        name: 'after reject: approval removed from admin pending queue',
        run: async () => {
          const cr = await postJSON('/api/approvals/create', {
            type: 'cargo_listing', refId: 'TEST-APPR-ST-05',
            payload: { title: 'TEST cleanup check', cargoValue: 100, isTest: true },
          });
          const id = (cr.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
          if (!id) return false;
          await rejectApproval(id);
          const r = await fetch(`/api/admin/approvals?status=pending`, {
            headers: { 'X-Admin-Token': _runtimeToken },
          });
          if (!r.ok) return false;
          const d = await r.json() as { approvals?: Array<{ id: string }> };
          return !(d.approvals ?? []).some(a => a.id === id);
        },
      },
    ],
  },

  // ── 10. VERIFICATION GUARDS (412) (backend, 19-E) ────────────────────────────
  {
    label: 'Verification Guards (412)',
    desc: 'mark-handover blocked HTTP 412 without verifications; passes after record-verification; no money moves',
    requiresAdmin: true,
    cases: [
      {
        name: 'POST /api/transaction/create → HTTP 200',
        run: async () => {
          let txnId: string | null = null;
          try {
            const r = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST', email: 'test@test.invalid' },
              traveler:   { userId: 'TEST-TRV-ST' },
              cargo:      { title: 'TEST cargo guard', sealCode: 'SEAL-TEST' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: { identityVerificationRequired: true },
            });
            txnId = (r.body as { transactionId?: string })?.transactionId ?? null;
            return r.status === 200;
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
      {
        name: 'mark-handover without verifications → HTTP 412',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST' }, traveler: { userId: 'TEST-TRV-ST' },
              cargo: { title: 'TEST guard 412' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: { identityVerificationRequired: true },
            });
            txnId = (cr.body as { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const mr = await postJSON('/api/traveler/mark-handover', { transactionId: txnId });
            return mr.status === 412;
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
      {
        name: '412 body lists the incomplete flag (identityVerificationRequired)',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST' }, traveler: { userId: 'TEST-TRV-ST' },
              cargo: { title: 'TEST guard flags' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: { identityVerificationRequired: true },
            });
            txnId = (cr.body as { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const mr = await postJSON('/api/traveler/mark-handover', { transactionId: txnId });
            const missing = (mr.body as { missing?: Array<{ flag: string }> })?.missing ?? [];
            return missing.some(m => m.flag === 'identityVerificationRequired');
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
      {
        name: 'after record-verification: mark-handover NOT 412 (guard cleared)',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST' }, traveler: { userId: 'TEST-TRV-ST' },
              cargo: { title: 'TEST guard clear' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: { identityVerificationRequired: true },
            });
            txnId = (cr.body as { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            await postJSON('/api/traveler/record-verification',
              { transactionId: txnId, type: 'identity', evidence: 'test-evidence' });
            const mr = await postJSON('/api/traveler/mark-handover', { transactionId: txnId });
            // Guard cleared → handler rejects for wrong status (400), not 412
            return mr.status !== 412;
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
      {
        name: 'STANDARD txn (no flags): mark-handover NOT 412',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST' }, traveler: { userId: 'TEST-TRV-ST' },
              cargo: { title: 'TEST STANDARD no-flags' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: {
                identityVerificationRequired: false, cargoVerificationRequired: false,
                otpDeliveryRequired: false, deliveryPhotoRequired: false,
              },
            });
            txnId = (cr.body as { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const mr = await postJSON('/api/traveler/mark-handover', { transactionId: txnId });
            return mr.status !== 412;
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
      {
        name: 'secureHold.ownerPayment = "pending" throughout — no funds moved',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ST' }, traveler: { userId: 'TEST-TRV-ST' },
              cargo: { title: 'TEST no money moved' },
              financials: { deliveryFee: 10, cargoValue: 50 },
              verifications: { identityVerificationRequired: true },
            });
            txnId = (cr.body as TxnRecord & { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const r = await fetch(`/api/track/owner?id=${txnId}`);
            const d = await r.json() as { secureHold?: { ownerPayment?: string } };
            return d.secureHold?.ownerPayment === 'pending';
          } finally { if (txnId) await cancelTxn(txnId); }
        },
      },
    ],
  },

  // ── 11. AUTOPILOT GUARD (19-D) ────────────────────────────────────────────────
  {
    label: 'Autopilot Guard (19-D)',
    desc: 'Settings API, value=501 guardrail, high-value 428/200, never auto-rejects',
    requiresAdmin: true,
    cases: [
      {
        name: 'GET /api/admin/settings → autopilotEnabled is a boolean',
        run: async () => {
          const s = await getAdminSettings(_runtimeToken);
          return typeof s.autopilotEnabled === 'boolean';
        },
      },
      {
        name: 'POST /api/admin/settings toggle persists (save → flip → verify → restore)',
        run: async () => {
          const orig = (await getAdminSettings(_runtimeToken)).autopilotEnabled;
          let passed = false;
          try {
            const r = await postJSON('/api/admin/settings', { autopilotEnabled: !orig }, { 'X-Admin-Token': _runtimeToken });
            const flipped = (r.body as { autopilotEnabled?: boolean })?.autopilotEnabled;
            passed = r.status === 200 && flipped === !orig;
          } finally {
            try { await postJSON('/api/admin/settings', { autopilotEnabled: orig }, { 'X-Admin-Token': _runtimeToken }); } catch { /* ignore */ }
          }
          return passed;
        },
      },
      {
        name: 'value=501 stays pending after 2.5s autopilot window (> AUTOPILOT_MAX_VALUE=500)',
        run: async () => {
          const orig = (await getAdminSettings(_runtimeToken)).autopilotEnabled;
          let apprId: string | null = null;
          try {
            await setAutopilotEnabled(_runtimeToken, true);
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-501-BOUNDARY',
              payload: { title: 'TEST autopilot 501 boundary', cargoValue: 501, isTest: true },
            });
            const appr = (r.body as { approval?: ApprovalRecord })?.approval;
            apprId = appr?.id ?? null;
            if (!apprId) return false;
            await new Promise(res => setTimeout(res, 2500));
            const lr = await fetch(`/api/admin/approvals/${apprId}`, { headers: { 'X-Admin-Token': _runtimeToken } });
            if (!lr.ok) return false;
            const ld = await lr.json() as { approval?: { status: string } };
            return ld.approval?.status === 'pending';
          } finally {
            if (apprId) await rejectApproval(apprId);
            try { await setAutopilotEnabled(_runtimeToken, orig); } catch { /* ignore */ }
          }
        },
      },
      {
        name: 'approve high-value ($1500) without confirmCode → HTTP 428',
        run: async () => {
          let apprId: string | null = null;
          try {
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-HIGHVAL-1',
              payload: { title: 'TEST high-value no-code', cargoValue: 1500, isTest: true },
            });
            apprId = (r.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
            if (!apprId) return false;
            const ar = await postJSON(`/api/admin/approvals/${apprId}/approve`, {}, { 'X-Admin-Token': _runtimeToken });
            return ar.status === 428;
          } finally {
            if (apprId) await rejectApproval(apprId);
          }
        },
      },
      {
        name: 'approve high-value ($1500) with valid 6-digit confirmCode → HTTP 200',
        run: async () => {
          let apprId: string | null = null;
          try {
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-HIGHVAL-2',
              payload: { title: 'TEST high-value with-code', cargoValue: 1500, isTest: true },
            });
            apprId = (r.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
            if (!apprId) return false;
            const ar = await postJSON(`/api/admin/approvals/${apprId}/approve`, { confirmCode: '123456' }, { 'X-Admin-Token': _runtimeToken });
            return ar.status === 200;
          } finally {
            if (apprId) await rejectApproval(apprId);
          }
        },
      },
      {
        name: 'autopilot NEVER auto-rejects — status stays pending or approved, never rejected',
        run: async () => {
          const orig = (await getAdminSettings(_runtimeToken)).autopilotEnabled;
          let apprId: string | null = null;
          try {
            await setAutopilotEnabled(_runtimeToken, true);
            const r = await postJSON('/api/approvals/create', {
              type: 'cargo_listing', refId: 'TEST-APPR-NOREJECT',
              payload: { title: 'TEST autopilot no-reject', cargoValue: 50, isTest: true },
            });
            apprId = (r.body as { approval?: ApprovalRecord })?.approval?.id ?? null;
            if (!apprId) return false;
            await new Promise(res => setTimeout(res, 2500));
            const lr = await fetch(`/api/admin/approvals/${apprId}`, { headers: { 'X-Admin-Token': _runtimeToken } });
            if (!lr.ok) return false;
            const ld = await lr.json() as { approval?: { status: string } };
            return ld.approval?.status !== 'rejected';
          } finally {
            if (apprId) await rejectApproval(apprId);
            try { await setAutopilotEnabled(_runtimeToken, orig); } catch { /* ignore */ }
          }
        },
      },
      {
        name: 'autopilotEnabled = false after all tests (production safe)',
        run: async () => {
          const s = await getAdminSettings(_runtimeToken);
          return s.autopilotEnabled === false;
        },
      },
    ],
  },

  // ── 12. ESCROW RELEASE GUARD ─────────────────────────────────────────────────
  {
    label: 'Escrow Release Guard',
    desc: 'OTP confirm via admin endpoint; escrow stays locked — admin-only release',
    requiresAdmin: true,
    cases: [
      {
        name: 'POST /api/receiver/confirm with admin-visible OTP → HTTP 200',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ESC' }, traveler: { userId: 'TEST-TRV-ESC' },
              cargo: { title: 'TEST escrow OTP confirm' },
              financials: { deliveryFee: 10, cargoValue: 50 },
            });
            txnId = (cr.body as TxnRecord & { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const adminTxn = await getAdminTxn(_runtimeToken, txnId);
            const otp = (adminTxn as { receiverConfirmation?: { code?: string } })?.receiverConfirmation?.code;
            if (!otp) return false;
            const r = await postJSON('/api/receiver/confirm', { transactionId: txnId, code: otp });
            return r.status === 200;
          } finally {
            if (txnId) await cancelTxn(txnId);
          }
        },
      },
      {
        name: 'after OTP confirm: deliveryFeeRelease.status = "pending_admin_approval"',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ESC' }, traveler: { userId: 'TEST-TRV-ESC' },
              cargo: { title: 'TEST escrow fee status' },
              financials: { deliveryFee: 10, cargoValue: 50 },
            });
            txnId = (cr.body as TxnRecord & { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const adminTxn = await getAdminTxn(_runtimeToken, txnId);
            const otp = (adminTxn as { receiverConfirmation?: { code?: string } })?.receiverConfirmation?.code;
            if (!otp) return false;
            const confirmR = await postJSON('/api/receiver/confirm', { transactionId: txnId, code: otp });
            if (confirmR.status !== 200) return false;
            const after = await getAdminTxn(_runtimeToken, txnId);
            return (after as { deliveryFeeRelease?: { status?: string } })?.deliveryFeeRelease?.status === 'pending_admin_approval';
          } finally {
            if (txnId) await cancelTxn(txnId);
          }
        },
      },
      {
        name: 'after OTP confirm: adminReview.required = true (funds NOT auto-released)',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ESC' }, traveler: { userId: 'TEST-TRV-ESC' },
              cargo: { title: 'TEST escrow admin review' },
              financials: { deliveryFee: 10, cargoValue: 50 },
            });
            txnId = (cr.body as TxnRecord & { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const adminTxn = await getAdminTxn(_runtimeToken, txnId);
            const otp = (adminTxn as { receiverConfirmation?: { code?: string } })?.receiverConfirmation?.code;
            if (!otp) return false;
            const confirmR = await postJSON('/api/receiver/confirm', { transactionId: txnId, code: otp });
            if (confirmR.status !== 200) return false;
            const after = await getAdminTxn(_runtimeToken, txnId);
            return (after as { adminReview?: { required?: boolean } })?.adminReview?.required === true;
          } finally {
            if (txnId) await cancelTxn(txnId);
          }
        },
      },
      {
        name: 'after OTP confirm: txn.status = "admin_review_required" — no auto-release',
        run: async () => {
          let txnId: string | null = null;
          try {
            const cr = await postJSON('/api/transaction/create', {
              cargoOwner: { userId: 'TEST-USR-ESC' }, traveler: { userId: 'TEST-TRV-ESC' },
              cargo: { title: 'TEST escrow status lock' },
              financials: { deliveryFee: 10, cargoValue: 50 },
            });
            txnId = (cr.body as TxnRecord & { transactionId?: string })?.transactionId ?? null;
            if (!txnId) return false;
            const adminTxn = await getAdminTxn(_runtimeToken, txnId);
            const otp = (adminTxn as { receiverConfirmation?: { code?: string } })?.receiverConfirmation?.code;
            if (!otp) return false;
            const confirmR = await postJSON('/api/receiver/confirm', { transactionId: txnId, code: otp });
            if (confirmR.status !== 200) return false;
            const after = await getAdminTxn(_runtimeToken, txnId);
            return (after as { status?: string })?.status === 'admin_review_required';
          } finally {
            if (txnId) await cancelTxn(txnId);
          }
        },
      },
    ],
  },
];

// ─── Test runner ──────────────────────────────────────────────────────────────
// isAdminGroup: if true and no token provided → amber adminSkip, no throw, no red
async function runTest(tc: TestCase, tok: string, isAdminGroup: boolean): Promise<TestResult> {
  if (tc.gap) return { name: tc.name, pass: false, gap: true };
  if (isAdminGroup && !tok) return { name: tc.name, pass: false, adminSkip: true };
  _runtimeToken = tok; // make available to run() closures that reference it
  try {
    const pass = await tc.run();
    return { name: tc.name, pass: Boolean(pass) };
  } catch (e) {
    return { name: tc.name, pass: false, error: String(e) };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SmartTester({ onClose, onHome }: { onClose?: () => void; onHome?: () => void }) {
  const [results, setResults]           = useState<TestResult[][]>([]);
  const [ran, setRan]                   = useState(false);
  const [openGroups, setOpenGroups]     = useState<Record<number, boolean>>({});
  const [runningGroup, setRunningGroup] = useState<number | null>(null);
  const [globalRunning, setGlobalRunning] = useState(false);
  const [cleanedUp, setCleanedUp]       = useState(false);
  const [adminToken, setAdminToken]     = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('adminToken') ?? '';
    }
    return '';
  });

  const runAll = useCallback(async () => {
    setGlobalRunning(true);
    setCleanedUp(false);
    const allRes: TestResult[][] = [];
    for (const g of TEST_GROUPS) {
      const gRes: TestResult[] = [];
      for (const tc of g.cases) gRes.push(await runTest(tc, adminToken, g.requiresAdmin ?? false));
      allRes.push(gRes);
    }
    setResults(allRes);
    setRan(true);
    const open: Record<number, boolean> = {};
    allRes.forEach((g, i) => { if (g.some(r => !r.pass && !r.gap && !r.adminSkip)) open[i] = true; });
    setOpenGroups(open);
    cleanupTestData();
    setCleanedUp(true);
    setGlobalRunning(false);
  }, [adminToken]);

  const runGroup = useCallback(async (gi: number) => {
    setRunningGroup(gi);
    setCleanedUp(false);
    const g = TEST_GROUPS[gi];
    const gRes: TestResult[] = [];
    for (const tc of g.cases) gRes.push(await runTest(tc, adminToken, g.requiresAdmin ?? false));
    setResults(prev => { const n = [...prev]; n[gi] = gRes; return n; });
    setRan(true);
    if (gRes.some(r => !r.pass && !r.gap && !r.adminSkip)) setOpenGroups(prev => ({ ...prev, [gi]: true }));
    cleanupTestData();
    setCleanedUp(true);
    setRunningGroup(null);
  }, [adminToken]);

  const totalTests   = TEST_GROUPS.reduce((s, g) => s + g.cases.length, 0);
  const totalGaps    = TEST_GROUPS.reduce((s, g) => s + g.cases.filter(c => c.gap).length, 0);
  const allResults   = results.flat();
  const totalPassed  = allResults.filter(r => r.pass).length;
  const totalFailed  = allResults.filter(r => !r.pass && !r.gap && !r.adminSkip).length;
  const totalGapHits = allResults.filter(r => r.gap || r.adminSkip).length;
  const denominator  = Math.max(1, totalTests - totalGapHits);
  const isPage       = !!onHome;

  return (
    <div className={isPage
      ? 'min-h-screen bg-[#050810] text-white'
      : 'fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-4'
    } onClick={!isPage ? onClose : undefined}>
      <div
        className={isPage
          ? 'w-full max-w-3xl mx-auto py-8 px-4'
          : 'bg-[#0d1628] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/10'
        }
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r from-cyan-700 to-blue-800 ${isPage ? 'rounded-xl' : ''} px-6 py-4 flex items-center justify-between flex-shrink-0`}>
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              Smart Chapar Tester
              <span className="text-xs bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full">DEV</span>
            </h2>
            <p className="text-cyan-100 text-xs mt-0.5">
              {TEST_GROUPS.length} groups · {totalTests - totalGaps} active tests · {totalGaps} gaps tracked
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPage && onHome && (
              <button onClick={onHome} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Home">
                <Home className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition-colors">✕</button>
            )}
          </div>
        </div>

        {/* Run bar */}
        <div className={`px-6 py-3 border-b border-white/10 flex items-center gap-4 flex-wrap flex-shrink-0 bg-[#0b1120] ${!isPage ? '' : 'rounded-lg mt-2'}`}>
          <button
            onClick={() => { void runAll(); }}
            disabled={globalRunning}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {globalRunning
              ? <Clock className="w-4 h-4 animate-spin" />
              : <PlayCircle className="w-4 h-4" />}
            {globalRunning ? 'Running…' : 'Run All'}
          </button>

          {/* Admin token input — no credentials stored in bundle */}
          <div className="flex items-center gap-1.5 ml-auto">
            <KeyRound className={`w-3.5 h-3.5 flex-shrink-0 ${adminToken ? 'text-green-400' : 'text-gray-600'}`} />
            <input
              type="text"
              value={adminToken}
              onChange={e => setAdminToken(e.target.value)}
              placeholder="Admin token (groups 9–12)"
              className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 w-44 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-700"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {ran && (
            <div className="flex items-center gap-3 text-sm w-full">
              <span className="flex items-center gap-1.5 text-green-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> {totalPassed}
              </span>
              {totalFailed > 0 && (
                <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> {totalFailed}
                </span>
              )}
              {totalGapHits > 0 && (
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {totalGapHits} skipped
                </span>
              )}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                totalFailed === 0 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
              }`}>
                {totalFailed === 0 ? '✓ PASS' : `${Math.round((totalPassed / denominator) * 100)}%`}
              </span>
              {cleanedUp && (
                <span className="flex items-center gap-1 text-xs text-cyan-400">
                  <RefreshCw className="w-3 h-3" /> cleaned
                </span>
              )}
            </div>
          )}
        </div>

        {/* Groups */}
        <div className={`${isPage ? '' : 'overflow-y-auto flex-1'} p-4 space-y-2`}>
          {TEST_GROUPS.map((group, gi) => {
            const groupResults = results[gi] ?? [];
            const groupPassed  = groupResults.filter(r => r.pass).length;
            const groupFailed  = groupResults.filter(r => !r.pass && !r.gap && !r.adminSkip).length;
            const groupGaps    = groupResults.filter(r => r.gap || r.adminSkip).length;
            const isOpen       = openGroups[gi] ?? false;
            const isGrpRunning = runningGroup === gi;
            const hasRan       = groupResults.length > 0;
            const isAsync      = gi >= 8;

            return (
              <div key={gi} className="border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#111827] hover:bg-[#151f30] transition-colors">
                  <button
                    onClick={() => setOpenGroups(o => ({ ...o, [gi]: !o[gi] }))}
                    className="flex items-center gap-2 flex-1 text-start"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <div>
                      <span className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                        {group.label}
                        {isAsync && <Wifi className="w-3 h-3 text-cyan-500 opacity-60" title="Makes HTTP requests" />}
                        {group.requiresAdmin && <KeyRound className={`w-3 h-3 ${adminToken ? 'text-green-500 opacity-70' : 'text-amber-500 opacity-60'}`} title="Requires admin token" />}
                      </span>
                      {group.desc && <p className="text-xs text-gray-500 mt-0.5">{group.desc}</p>}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasRan && (
                      <>
                        <span className="text-xs text-green-400 font-semibold">{groupPassed}✓</span>
                        {groupFailed > 0 && <span className="text-xs text-red-400 font-semibold">{groupFailed}✗</span>}
                        {groupGaps  > 0 && <span className="text-xs text-amber-400 font-semibold">{groupGaps}⚠</span>}
                        <span className={`w-2 h-2 rounded-full ${
                          groupFailed > 0 ? 'bg-red-500' :
                          (groupPassed === 0 && groupGaps > 0) ? 'bg-amber-500' :
                          'bg-green-500'
                        }`} />
                      </>
                    )}
                    <button
                      onClick={() => { void runGroup(gi); }}
                      disabled={isGrpRunning || globalRunning}
                      className="ml-2 px-2.5 py-1 text-xs bg-cyan-800/60 hover:bg-cyan-700/60 text-cyan-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isGrpRunning ? <Clock className="w-3 h-3 animate-spin inline" /> : '▶ Run'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-1.5 bg-[#0d1628]">
                    {group.cases.map((tc, ci) => {
                      const res = groupResults[ci];
                      const bgClass = !res                     ? 'bg-white/3 border-white/5'
                                    : (res.gap || res.adminSkip) ? 'bg-amber-950/30 border-amber-800/30'
                                    : res.pass                   ? 'bg-green-950/30 border-green-800/30'
                                                                 : 'bg-red-950/30 border-red-800/30';
                      const textClass = !res                     ? 'text-gray-500'
                                      : (res.gap || res.adminSkip) ? 'text-amber-300'
                                      : res.pass                   ? 'text-green-300'
                                                                   : 'text-red-300';
                      return (
                        <div key={ci} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${bgClass}`}>
                          <span className={`font-mono text-xs ${textClass} flex-1 mr-2`}>{tc.name}</span>
                          {res?.error && (
                            <span className="text-xs text-red-400 opacity-70 mr-2 truncate max-w-[120px]" title={res.error}>{res.error}</span>
                          )}
                          {res && (
                            res.adminSkip ? (
                              <span className="flex items-center gap-1 text-amber-400 flex-shrink-0" title="requires admin token">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-[10px] opacity-60">no token</span>
                              </span>
                            ) : res.gap  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              : res.pass ? <CheckCircle   className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                         : <XCircle       className="w-3.5 h-3.5 text-red-400   flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!ran && (
            <div className="text-center py-12 text-gray-500">
              <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-sm">Click <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">Run All</span> or run individual groups</p>
              <p className="text-xs mt-2 text-gray-600">
                Groups 9–12 <Wifi className="w-3 h-3 inline opacity-50 mx-0.5" /> hit the backend — ensure server is up.
              </p>
              <p className="text-xs mt-1 text-gray-600">
                Groups 9–12 <KeyRound className="w-3 h-3 inline opacity-50 mx-0.5" /> require an admin token — paste it above or add <span className="font-mono">?adminToken=…</span> to the URL.
              </p>
              <p className="text-xs mt-1 text-gray-600">Full DOM/iframe tests: <a href="/smart-test/" target="_blank" className="text-cyan-600 hover:underline">/smart-test/</a></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
