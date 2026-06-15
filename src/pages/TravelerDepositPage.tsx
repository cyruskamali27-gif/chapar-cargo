/**
 * Traveler deposit page — ports traveler-deposit.html exactly.
 * Endpoints called: /config, /api/transaction/create, /api/traveler/deposit-intent,
 *   /api/traveler/deposit-confirm, /api/polygon/register-wallet, /api/polygon/escrow/:id,
 *   /api/polygon/traveler-deposit-confirm, /api/tron/create-traveler-deposit,
 *   /api/tron/verify-traveler-deposit, /api/tron/payment-status/:id
 * localStorage keys written: cp_offers, cp_admin_statuses, cp_status_history, cp_notifications, cp_wallets
 */
import { useState, useEffect, useRef } from 'react';
import { Store, getLiveRate, getSession, genId } from '../lib/store';
import { useLang } from '../lib/LangContext';

declare global {
  interface Window {
    ethers: {
      BrowserProvider: new (p: unknown) => { getSigner: () => Promise<{ getAddress: () => Promise<string> }> };
      Contract: new (addr: string, abi: unknown, signerOrProvider: unknown) => Record<string, (...a: unknown[]) => Promise<unknown>>;
      keccak256: (bytes: Uint8Array) => string;
      toUtf8Bytes: (s: string) => Uint8Array;
    };
    Stripe: ((k: string) => {
      elements: (o?: unknown) => { create: (type: string, o?: unknown) => unknown };
      confirmCardPayment: (secret: string, o: unknown) => Promise<{ error?: { message: string }; paymentIntent: { id: string } }>;
    });
    tronWeb?: {
      defaultAddress?: { base58?: string };
      request?: (o: { method: string }) => Promise<unknown>;
      contract: (abi: unknown, addr: string) => {
        balanceOf: (a: string) => { call: () => Promise<unknown> };
        transfer: (to: string, v: unknown) => { send: (o: unknown) => Promise<string> };
      };
    };
  }
}

/* ── Constants (exact from traveler-deposit.html) ─────────────────────────── */
const POLYGON_CHAIN_ID = '0x89';
const POLY_USDC_ADDR   = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const POLY_ESCROW_ADDR = '0x80DD066548dC5A75bfAff19f1303592CE7917B58';
const POLY_USDC_ABI    = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];
const POLY_ESCROW_ABI  = ['function travelerDeposit(bytes32 txnId) external'];
const TRON_USDT_ADDR   = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_USDT_ABI    = [
  { constant: false, inputs: [{ name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], payable: false, stateMutability: 'nonpayable', type: 'function' },
  { constant: true,  inputs: [{ name: '_owner', type: 'address' }], name: 'balanceOf', outputs: [{ name: 'balance', type: 'uint256' }], payable: false, stateMutability: 'view', type: 'function' },
];

type PayMethod = 'card' | 'toman' | 'usdt' | 'paypal' | 'polygon' | 'tron' | 'wallet';
type ViewState = 'notfound' | 'already' | 'waiting' | 'processing' | 'polywaiting' | 'tronwaiting' | 'main' | 'success';

interface Offer {
  id?: string; offerId?: string;
  price?: number; orderId?: string; trackId?: string;
  ownerPaid?: boolean; ownerTxnId?: string;
  travelerDeposited?: boolean; travelerDepositTxnId?: string;
  travelerDepositAt?: number; travelerDepositMethod?: string;
  status?: string;
}
interface Order {
  trackId?: string; origin?: string; dest?: string;
  originLabel?: string; destLabel?: string;
  originFlag?: string; destFlag?: string;
  detectedItem?: string; valueToman?: number;
}

/* ── Wallet helper (mirrors traveler-deposit.html WL) ─────────────────────── */
function wlGet(phone: string) {
  const all = Store.get<Record<string, { balance?: number; held?: number; transactions?: unknown[] }>>('wallets') ?? {};
  return all[phone] ?? { balance: 0, held: 0, transactions: [] };
}
function wlHold(phone: string, amount: number, desc: string, orderId: string | null) {
  const w = wlGet(phone);
  w.balance = (w.balance ?? 0) - amount;
  w.held    = (w.held ?? 0) + amount;
  if (!w.transactions) w.transactions = [];
  w.transactions.unshift({ id: 'TX-' + Date.now(), type: 'hold', amount, desc, at: Date.now(), orderId });
  const all = Store.get<Record<string, unknown>>('wallets') ?? {};
  all[phone] = w;
  Store.set('wallets', all);
}

export default function TravelerDepositPage() {
  const { t, isRTL } = useLang();
  const [viewState,  setViewState]  = useState<ViewState>('main');
  const [offer,      setOffer]      = useState<Offer | null>(null);
  const [order,      setOrder]      = useState<Order>({});
  const [totalToman, setTotalToman] = useState(0);
  const [totalUSD,   setTotalUSD]   = useState(0);
  const [cargoT,     setCargoT]     = useState(0);
  const [feeT,       setFeeT]       = useState(0);
  const [method,     setMethod]     = useState<PayMethod | null>(null);
  const [err,        setErr]        = useState('');
  const [toast,      setToast]      = useState('');

  // Success
  const [depositAmt,   setDepositAmt]   = useState('');
  const [successTxnId, setSuccessTxnId] = useState('');
  const [alreadyLink,  setAlreadyLink]  = useState('');

  // Reference strings for manual-payment notices
  const [refToman,  setRefToman]  = useState('—');
  const [refUsdt,   setRefUsdt]   = useState('—');
  const [refPaypal, setRefPaypal] = useState('—');
  const [refPaypalNote, setRefPaypalNote] = useState('—');

  // Wallet display
  const [walletBal,      setWalletBal]      = useState(t.tdepWalletLoading);
  const [walletDisabled, setWalletDisabled] = useState(false);

  // Stripe
  const stripeRef   = useRef<ReturnType<typeof window.Stripe> | null>(null);
  const cardElRef   = useRef<unknown>(null);
  const stripeReady = useRef(false);
  const [simMode,   setSimMode] = useState(false);
  const cardWrapRef = useRef<HTMLDivElement>(null);

  // Polygon
  const [polyWallet,   setPolyWallet]   = useState('');
  const [polyUsdcBal,  setPolyUsdcBal]  = useState('—');
  const [polyStep,     setPolyStep]     = useState<'connect' | 'connected'>('connect');
  const [polyStatus,   setPolyStatus]   = useState<'waiting_escrow' | 'waiting_owner_deposit' | 'ready'>('waiting_escrow');
  const [polyDepReady, setPolyDepReady] = useState(false);
  const [polyErr,      setPolyErr]      = useState('');
  const ethersProvRef = useRef<unknown>(null);
  const ethersSignRef = useRef<unknown>(null);
  const polyWalletRef = useRef('');
  const polyIntervalRef = useRef<number | null>(null);

  // Tron
  const [tronWallet,    setTronWallet]    = useState('');
  const [tronUsdtBal,   setTronUsdtBal]   = useState('—');
  const [tronStep,      setTronStep]      = useState<'detect' | 'connected'>('detect');
  const [tronDetectMsg, setTronDetectMsg] = useState(t.tdepTronNoDetect);
  const [tdtwTxId,      setTdtwTxId]      = useState('');
  const [tdtwErr,       setTdtwErr]       = useState('');
  const tronPollRef = useRef<number | null>(null);

  // Refs shared between async flows
  const txnIdRef     = useRef('');
  const offerIdRef   = useRef('');
  const offerRef     = useRef<Offer | null>(null);
  const orderRef     = useRef<Order>({});
  const methodRef    = useRef<PayMethod | null>(null);
  const totalTomanRef = useRef(0);
  const totalUSDRef  = useRef(0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  // ── Load ethers CDN ────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.ethers) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.umd.min.js';
    document.head.appendChild(s);
  }, []);

  // ── Init (mirrors traveler-deposit.html init()) ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const byTxn  = params.get('txnId');
    const offId  = params.get('offerId') || '';
    offerIdRef.current = offId;

    if (byTxn) {
      const allOffers = Store.get<Offer[]>('offers') ?? [];
      const found = allOffers.find(o => o.ownerTxnId === byTxn);
      if (!found) { setViewState('notfound'); return; }
      txnIdRef.current   = byTxn;
      offerIdRef.current = found.id || found.offerId || '';
    }

    if (!offerIdRef.current) { setViewState('notfound'); return; }
    loadOffer(offerIdRef.current);
    initStripe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadOffer(id: string) {
    const offers  = Store.get<Offer[]>('offers') ?? [];
    const history = Store.get<Order[]>('history') ?? [];
    const found   = offers.find(o => o.id === id || o.offerId === id) ?? null;
    if (!found) { setViewState('notfound'); return; }

    offerRef.current = found;
    setOffer(found);

    if (found.travelerDeposited) {
      const atxn = found.travelerDepositTxnId || txnIdRef.current || '';
      setAlreadyLink(atxn ? '/track?id=' + encodeURIComponent(atxn) + '&role=traveler' : '/track?role=traveler');
      setViewState('already'); return;
    }

    if (!found.ownerPaid && !txnIdRef.current) { setViewState('waiting'); return; }

    const orderKey = found.orderId || found.trackId;
    const ord = history.find(o => o.trackId === orderKey) ?? {};
    orderRef.current = ord;
    setOrder(ord);

    const offerUSD = parseFloat(String(found.price ?? 0));
    const rate     = getLiveRate();
    const cT       = parseFloat(String(ord.valueToman ?? 0));
    const fT       = offerUSD * 0.15 * rate;
    const totT     = cT + fT;
    const totUSD   = totT / rate;

    totalTomanRef.current = totT;
    totalUSDRef.current   = totUSD;
    setCargoT(cT); setFeeT(fT); setTotalToman(totT); setTotalUSD(totUSD);

    const ordRef = found.orderId || txnIdRef.current || '—';
    setRefToman(ordRef);
    setRefUsdt(totUSD.toFixed(2));
    setRefPaypal(totUSD.toFixed(2));
    setRefPaypalNote('Deposit ' + ordRef);

    const sess = getSession();
    if (sess) {
      const wbal   = wlGet(sess.phone).balance ?? 0;
      const enough = wbal >= totT;
      setWalletBal(t.tdepWalletBal + Math.round(wbal).toLocaleString('fa-IR') + ' ت' + (enough ? '' : t.tdepWalletInsufLabel));
      setWalletDisabled(!enough);
    }

    setViewState('main');
  }

  // ── Stripe init ────────────────────────────────────────────────────────────
  function initStripe() {
    fetch('/config', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then((cfg: { publishableKey?: string }) => {
        if (cfg?.publishableKey) {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = () => {
            stripeRef.current  = window.Stripe(cfg.publishableKey!);
            stripeReady.current = true;
            if (methodRef.current === 'card') mountCard();
          };
          document.head.appendChild(s);
        } else { setSimMode(true); }
      })
      .catch(() => { setSimMode(true); });
  }

  function mountCard() {
    if (!cardWrapRef.current) return;
    cardWrapRef.current.style.display = 'block';
    if (stripeReady.current && stripeRef.current && !cardElRef.current) {
      setSimMode(false);
      const els  = stripeRef.current.elements({ locale: 'auto' });
      const card = els.create('card', {
        style: {
          base: { color: '#111827', fontSize: '15px', fontFamily: 'inherit', '::placeholder': { color: '#9ca3af' } },
          invalid: { color: '#ef4444' },
        },
      }) as { mount: (el: string) => void; on: (ev: string, cb: (e: unknown) => void) => void };
      cardElRef.current = card;
      card.mount('#travCardEl');
      card.on('change', (e: unknown) => {
        const ev = e as { error?: { message: string } };
        setErr(ev.error ? ev.error.message : '');
      });
      card.on('focus', () => cardWrapRef.current?.classList.add('focused'));
      card.on('blur',  () => cardWrapRef.current?.classList.remove('focused'));
    } else if (!stripeReady.current) {
      setSimMode(true);
    }
  }

  // ── Method select ──────────────────────────────────────────────────────────
  function selectMethod(m: PayMethod) {
    setMethod(m);
    methodRef.current = m;
    setErr('');
    if (cardWrapRef.current) cardWrapRef.current.style.display = 'none';
    if (m === 'card') mountCard();
    if (m === 'tron') detectTravelerTronWallet();
  }

  // ── Step1: create transaction or reuse existing txnId ─────────────────────
  function step1(): Promise<{ transactionId?: string }> {
    if (txnIdRef.current) return Promise.resolve({ transactionId: txnIdRef.current });
    const sess2 = getSession() ?? {};
    return fetch('/api/transaction/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId: offerIdRef.current,
        cargoOwner: { name: '' },
        traveler: {
          userId: sess2.userId || sess2.phone || '',
          name:   ((sess2.firstName || '') + ' ' + (sess2.lastName || '')).trim(),
          email:  sess2.email || '', phone: sess2.phone || '',
        },
        financials: {
          deliveryFee: parseFloat(String(offerRef.current?.price ?? 0)),
          cargoValue:  totalUSDRef.current,
          paymentRail: 'stripe',
        },
      }),
    }).then(r => r.json()).catch(() => ({}));
  }

  // ── Finalize deposit ──────────────────────────────────────────────────────
  function finalizeDeposit() {
    const m      = methodRef.current!;
    const offId  = offerIdRef.current;
    const tid    = txnIdRef.current;
    const off    = offerRef.current ?? {};
    const orderId = off.orderId || off.trackId;

    if (m === 'wallet') {
      const sess = getSession();
      if (sess) wlHold(sess.phone, Math.round(totalTomanRef.current), 'ودیعه پرداخت امن سفارش ' + (orderId || ''), orderId ?? null);
    }

    const offers = Store.get<Offer[]>('offers') ?? [];
    const idx    = offers.findIndex(o => o.id === offId || o.offerId === offId);
    if (idx !== -1) {
      offers[idx] = { ...offers[idx], travelerDeposited: true, travelerDepositAt: Date.now(), travelerDepositMethod: m, travelerDepositTxnId: tid || null as unknown as string, status: 'in_transit' };
      Store.set('offers', offers);
    }

    if (orderId) {
      const statuses = Store.get<Record<string, string>>('admin_statuses') ?? {};
      statuses[orderId] = 'in_transit';
      Store.set('admin_statuses', statuses);

      const hist = Store.get<Record<string, Array<{ status: string; at: number; note: string }>>>('status_history') ?? {};
      const oh   = hist[orderId] ?? [];
      oh.push({ status: 'in_transit', at: Date.now(), note: 'ودیعه مسافر تودیع شد — مسیر شروع شد — بازگشت منوط به تأیید ادمین' });
      hist[orderId] = oh;
      Store.set('status_history', hist);

      const notifs = Store.get<unknown[]>('notifications') ?? [];
      notifs.unshift({
        id: genId('N'), type: 'deposit_secured',
        title: 'مسافر ودیعه را تودیع کرد — ارسال شروع شد ✅',
        body:  'ودیعه امنیتی مسافر دریافت شد. کالا در مسیر است.',
        orderId, at: Date.now(), read: false,
      });
      Store.set('notifications', (notifs as unknown[]).slice(0, 200));
    }

    setDepositAmt(Math.round(totalTomanRef.current).toLocaleString('fa-IR') + ' تومان');
    setSuccessTxnId(tid || '');
    setViewState('success');
    showToast('✅ ودیعه تودیع شد — سفارش در مسیر است');
  }

  // ── Deposit button ─────────────────────────────────────────────────────────
  async function doDeposit() {
    setErr('');
    if (!method) { setErr(t.tdepMethodLabel); return; }

    if (method === 'wallet') {
      const sess = getSession();
      if (!sess) { setErr(t.tdepErrNoSession); return; }
      if ((wlGet(sess.phone).balance ?? 0) < totalTomanRef.current) {
        setErr(t.tdepErrWalletLow); return;
      }
    }

    setViewState('processing');

    // ── Stripe card ──────────────────────────────────────────────────────────
    if (method === 'card' && stripeReady.current && stripeRef.current && cardElRef.current) {
      try {
        const txn = await step1();
        if (!txn.transactionId) throw new Error('خطا در ایجاد تراکنش');
        txnIdRef.current = txn.transactionId;

        const intent = await fetch('/api/traveler/deposit-intent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txn.transactionId }),
        }).then(r => r.json()) as { clientSecret?: string; error?: string };
        if (!intent.clientSecret) throw new Error(intent.error || 'خطای سرور');

        const sess2 = getSession() ?? {};
        const result = await stripeRef.current.confirmCardPayment(intent.clientSecret, {
          payment_method: {
            card: cardElRef.current,
            billing_details: { name: ((sess2.firstName || '') + ' ' + (sess2.lastName || '')).trim(), email: sess2.email || undefined },
          },
        });
        if (result.error) throw new Error(result.error.message);

        await fetch('/api/traveler/deposit-confirm', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txn.transactionId, intentId: result.paymentIntent.id, rail: 'stripe' }),
        }).then(r => r.json());

        finalizeDeposit();
      } catch (e: unknown) {
        setViewState('main'); setErr((e as Error).message || 'خطا در پرداخت');
      }
      return;
    }

    // ── Polygon ──────────────────────────────────────────────────────────────
    if (method === 'polygon') {
      if (!polyWalletRef.current || !ethersSignRef.current) {
        setViewState('main'); setErr('ابتدا MetaMask را متصل کنید — دکمه اتصال را بزنید'); return;
      }
      try {
        const txn = await step1();
        if (txn?.transactionId) txnIdRef.current = txn.transactionId;
        if (!txnIdRef.current) throw new Error('شناسه تراکنش یافت نشد');

        const regRes = await fetch('/api/polygon/register-wallet', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txnIdRef.current, walletAddress: polyWalletRef.current, role: 'traveler' }),
        }).then(r => r.json()) as { escrowCreated?: boolean };

        setViewState('polywaiting');
        if (regRes.escrowCreated) {
          setPolyStatus('waiting_owner_deposit'); setPolyDepReady(false);
        } else {
          setPolyStatus('waiting_escrow'); setPolyDepReady(false);
        }
        startTravPolyPoll(txnIdRef.current);
      } catch (e: unknown) {
        setViewState('main'); setErr((e as Error).message || 'خطا در ثبت کیف پول');
      }
      return;
    }

    // ── Tron ─────────────────────────────────────────────────────────────────
    if (method === 'tron') {
      try {
        const txn = await step1();
        if (txn?.transactionId) txnIdRef.current = txn.transactionId;
        await doTronDeposit();
      } catch (e: unknown) {
        setViewState('main'); setErr((e as Error).message || 'خطا در ایجاد تراکنش');
      }
      return;
    }

    // ── Non-Stripe simulation ────────────────────────────────────────────────
    try {
      const txn = await step1();
      if (txn?.transactionId) txnIdRef.current = txn.transactionId;
      await fetch('/api/traveler/deposit-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnIdRef.current || 'local', intentId: 'manual_' + method, rail: method }),
      }).then(r => r.json()).catch(() => ({}));
      finalizeDeposit();
    } catch {
      finalizeDeposit(); // offline — finalize locally
    }
  }

  // ── Polygon wallet connect ─────────────────────────────────────────────────
  async function connectTravelerWallet() {
    if (typeof window.ethereum === 'undefined') { setErr('MetaMask نصب نیست. لطفاً افزونه MetaMask را نصب کنید.'); return; }
    try {
      await (window.ethereum as { request: (o: unknown) => Promise<unknown> }).request({ method: 'eth_requestAccounts' });
      const chainId = await (window.ethereum as { request: (o: unknown) => Promise<string> }).request({ method: 'eth_chainId' });
      if (chainId !== POLYGON_CHAIN_ID) {
        try {
          await (window.ethereum as { request: (o: unknown) => Promise<unknown> }).request({ method: 'wallet_switchEthereumChain', params: [{ chainId: POLYGON_CHAIN_ID }] });
        } catch (swErr: unknown) {
          if ((swErr as { code?: number }).code === 4902) {
            await (window.ethereum as { request: (o: unknown) => Promise<unknown> }).request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: POLYGON_CHAIN_ID, chainName: 'Polygon Mainnet', nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com'], blockExplorerUrls: ['https://polygonscan.com'] }],
            });
          } else { throw swErr; }
        }
      }
      const eth = window.ethers;
      const provider = new eth.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const addr     = await signer.getAddress();
      ethersProvRef.current = provider;
      ethersSignRef.current = signer;
      polyWalletRef.current = addr;
      setPolyWallet(addr);
      setPolyStep('connected');

      const usdcRo = new eth.Contract(POLY_USDC_ADDR, POLY_USDC_ABI, provider);
      const bal = await (usdcRo.balanceOf as unknown as (a: string) => Promise<bigint>)(addr);
      setPolyUsdcBal((Number(bal) / 1e6).toFixed(2) + ' USDC');
      showToast('✅ MetaMask متصل شد');
    } catch (e: unknown) { setErr('خطا در اتصال کیف پول: ' + ((e as Error).message || String(e))); }
  }

  function startTravPolyPoll(tid: string) {
    if (polyIntervalRef.current) clearInterval(polyIntervalRef.current);
    polyIntervalRef.current = window.setInterval(() => {
      fetch('/api/polygon/escrow/' + encodeURIComponent(tid))
        .then(r => r.json())
        .then((r: { ok?: boolean; onChain?: { statusCode?: number } }) => {
          if (!r.ok) { setPolyStatus('waiting_escrow'); setPolyDepReady(false); return; }
          const code = r.onChain && typeof r.onChain.statusCode === 'number' ? r.onChain.statusCode : -1;
          if (code === 0) {
            setPolyStatus('waiting_owner_deposit'); setPolyDepReady(false);
          } else if (code >= 1) {
            clearInterval(polyIntervalRef.current!);
            setPolyStatus('ready'); setPolyDepReady(true);
          }
        }).catch(() => {});
    }, 8000);
  }

  async function doTravelerDeposit() {
    setPolyErr('');
    try {
      const eth  = window.ethers;
      const usdc = new eth.Contract(POLY_USDC_ADDR, POLY_USDC_ABI, ethersSignRef.current);
      const amountRaw = BigInt(Math.round(totalUSDRef.current * 1_000_000));
      showToast('🦊 تأیید USDC در MetaMask...');
      const approveTx = (usdc.approve as unknown as (a: string, v: bigint) => Promise<{ wait: (n: number) => Promise<unknown> }>)(POLY_ESCROW_ADDR, amountRaw);
      await (await approveTx).wait(1);

      const escrow = new eth.Contract(POLY_ESCROW_ADDR, POLY_ESCROW_ABI, ethersSignRef.current);
      const txnKey = eth.keccak256(eth.toUtf8Bytes(txnIdRef.current));
      showToast('🦊 تودیع ودیعه در MetaMask...');
      const depositTx = (escrow.travelerDeposit as unknown as (k: string) => Promise<{ wait: (n: number) => Promise<{ hash: string }> }>)(txnKey);
      const receipt   = await (await depositTx).wait(1);

      await fetch('/api/polygon/traveler-deposit-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnIdRef.current, txHash: receipt.hash, travelerWalletAddress: polyWalletRef.current }),
      }).then(r => r.json());

      finalizeDeposit();
    } catch (e: unknown) { setPolyErr((e as Error).message || 'خطا در واریز ودیعه'); }
  }

  // ── Tron wallet ────────────────────────────────────────────────────────────
  function detectTravelerTronWallet() {
    const tw = window.tronWeb;
    if (!tw) { setTronDetectMsg('Trust Wallet شناسایی نشد. این صفحه را در مرورگر داخلی Trust Wallet باز کنید.'); return; }
    const addr = tw.defaultAddress?.base58 || '';
    if (!addr) { setTronDetectMsg('Trust Wallet یافت شد — لطفاً دکمه اتصال را بزنید.'); return; }
    setTronWallet(addr);
    setTronStep('connected');
    tw.contract(TRON_USDT_ABI, TRON_USDT_ADDR).balanceOf(addr).call()
      .then(bal => setTronUsdtBal((Number(bal) / 1e6).toFixed(2) + ' USDT'))
      .catch(() => {});
  }

  async function connectTravelerTronWallet() {
    const tw = window.tronWeb;
    if (!tw) { setTronDetectMsg('Trust Wallet یافت نشد. این صفحه را در مرورگر داخلی Trust Wallet باز کنید.'); return; }
    try {
      if (typeof tw.request === 'function') await tw.request({ method: 'tron_requestAccounts' });
      const addr = tw.defaultAddress?.base58 || '';
      if (!addr) throw new Error('آدرس دریافت نشد — کیف پول را باز کنید');
      setTronWallet(addr);
      setTronStep('connected');
      try {
        const bal = await tw.contract(TRON_USDT_ABI, TRON_USDT_ADDR).balanceOf(addr).call();
        setTronUsdtBal((Number(bal) / 1e6).toFixed(2) + ' USDT');
      } catch { setTronUsdtBal('—'); }
      showToast('✅ Trust Wallet متصل شد');
    } catch (e: unknown) { setErr('خطا در اتصال: ' + ((e as Error).message || String(e))); }
  }

  async function doTronDeposit() {
    const tw = window.tronWeb;
    const errSet = setErr;
    if (!tronWallet || !tw) { setViewState('main'); errSet('ابتدا Trust Wallet را متصل کنید'); return; }
    setViewState('processing');
    try {
      if (!txnIdRef.current) throw new Error('شناسه تراکنش یافت نشد');

      const intentRes = await fetch('/api/tron/create-traveler-deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnIdRef.current, travelerWalletAddress: tronWallet }),
      }).then(r => r.json()) as { ok?: boolean; adminWallet?: string; expectedRaw?: unknown; expectedHuman?: string; error?: string };
      if (!intentRes.ok) throw new Error(intentRes.error || 'خطا در ایجاد قصد تودیع');

      showToast('🔴 انتقال ' + intentRes.expectedHuman + ' USDT در Trust Wallet...');
      const contract = tw.contract(TRON_USDT_ABI, TRON_USDT_ADDR);
      const txId = await contract.transfer(intentRes.adminWallet!, intentRes.expectedRaw).send({
        feeLimit: 40_000_000, callValue: 0, shouldPollResponse: false,
      });
      if (!txId) throw new Error('تراکنش ایجاد نشد — لطفاً دوباره امتحان کنید');

      setTdtwTxId(txId);
      setViewState('tronwaiting');

      const verRes = await fetch('/api/tron/verify-traveler-deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnIdRef.current, txId }),
      }).then(r => r.json()) as { ok?: boolean };

      if (verRes.ok) { finalizeDeposit(); return; }
      startTronTravelerPoll(txnIdRef.current);
    } catch (e: unknown) {
      setViewState('main'); setErr((e as Error).message || 'خطا در تودیع ودیعه Tron');
    }
  }

  function startTronTravelerPoll(tid: string) {
    if (tronPollRef.current) clearInterval(tronPollRef.current);
    let attempts = 0;
    tronPollRef.current = window.setInterval(() => {
      attempts++;
      fetch('/api/tron/payment-status/' + encodeURIComponent(tid))
        .then(r => r.json())
        .then((st: { travelerDeposit?: string }) => {
          if (st.travelerDeposit === 'secured') { clearInterval(tronPollRef.current!); finalizeDeposit(); }
          else if (attempts >= 40) { clearInterval(tronPollRef.current!); setTdtwErr('تأیید تراکنش بیش از حد طول کشید. با پشتیبانی تماس بگیرید. شناسه: ' + tid); }
        }).catch(() => {});
    }, 15000);
  }

  function copyTxn() {
    const v = successTxnId;
    if (!v || v === '—') return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(v).then(() => showToast('📋 شناسه کپی شد'));
    } else {
      const ta = document.createElement('textarea'); ta.value = v;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); showToast('📋 شناسه کپی شد');
    }
  }

  useEffect(() => () => {
    if (polyIntervalRef.current) clearInterval(polyIntervalRef.current);
    if (tronPollRef.current)    clearInterval(tronPollRef.current);
  }, []);

  const rate = getLiveRate();
  const off  = offer;

  const polyStatusLabel = polyStatus === 'waiting_escrow'
    ? t.tdepPolyWaitingEscrow
    : polyStatus === 'waiting_owner_deposit'
    ? t.tdepPolyWaitingOwner
    : t.tdepPolyReady;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← {t.tdepBack}</button>
        <span className="text-sm font-bold text-gray-900">{t.tdepTitle}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* ── Not Found ──────────────────────────────────────────────── */}
        {viewState === 'notfound' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl font-bold text-gray-900 mb-2">لینک نامعتبر</div>
            <div className="text-sm text-gray-500 leading-relaxed">لینک ودیعه معتبر نیست یا منقضی شده است.<br />با سفارش‌دهنده تماس بگیرید.</div>
          </div>
        )}

        {/* ── Already ───────────────────────────────────────────────── */}
        {viewState === 'already' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-xl font-bold text-gray-900 mb-2">ودیعه قبلاً تودیع شد</div>
            <div className="text-sm text-gray-500 mb-6 leading-relaxed">ودیعه این سفارش قبلاً در پرداخت امن چاپار ثبت شده است.</div>
            <a href={alreadyLink || '/track?role=traveler'} className="inline-flex items-center justify-center h-12 px-6 bg-blue-600 text-white rounded-xl font-bold text-sm">🔍 پیگیری سفارش</a>
          </div>
        )}

        {/* ── Waiting for owner ──────────────────────────────────────── */}
        {viewState === 'waiting' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⏳</div>
            <div className="text-xl font-bold text-gray-900 mb-2">در انتظار پرداخت سفارش‌دهنده</div>
            <div className="text-sm text-gray-500 leading-relaxed">ابتدا سفارش‌دهنده باید هزینه حمل را پرداخت کند.<br />پس از پرداخت، لینک ودیعه برای شما فعال می‌شود.</div>
          </div>
        )}

        {/* ── Processing ─────────────────────────────────────────────── */}
        {viewState === 'processing' && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4" />
            <div className="text-base font-bold text-gray-800 mb-1">در حال پردازش ودیعه...</div>
            <div className="text-sm text-gray-500">لطفاً صفحه را نبندید</div>
          </div>
        )}

        {/* ── Polygon Waiting ───────────────────────────────────────── */}
        {viewState === 'polywaiting' && (
          <div className="text-center py-8 space-y-4">
            <div className="text-5xl">⬡</div>
            <div className="text-base font-bold text-gray-900">ودیعه USDC — Polygon</div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-right">
              <div className="text-xs text-gray-500 mb-1">کیف پول متصل</div>
              <div className="text-xs font-bold text-green-700 font-mono break-all mb-2">{polyWallet}</div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">ودیعه لازم:</span><span className="font-bold text-amber-600">{totalUSD.toFixed(2)} USDC</span></div>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">
              {polyStatusLabel}
              {!polyDepReady && <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto mt-2" />}
            </div>
            {polyDepReady && (
              <button onClick={doTravelerDeposit} className="w-full h-12 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}>
                ⬡ واریز ودیعه به قرارداد ←
              </button>
            )}
            {polyErr && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{polyErr}</div>}
          </div>
        )}

        {/* ── Tron Waiting ─────────────────────────────────────────── */}
        {viewState === 'tronwaiting' && (
          <div className="text-center py-8 space-y-4">
            <div className="text-5xl">🔴</div>
            <div className="text-base font-bold text-gray-900">ودیعه USDT Tron — در انتظار تأیید</div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-right">
              <div className="text-xs text-gray-500 mb-1">کیف پول شما</div>
              <div className="text-xs font-bold text-green-700 font-mono break-all mb-1">{tronWallet}</div>
              <div className="text-xs text-green-600">✅ تراکنش USDT ارسال شد</div>
            </div>
            {tdtwTxId && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-500 text-left font-mono break-all" style={{ direction: 'ltr' }}>TX: {tdtwTxId}</div>
            )}
            <div className="text-xs text-gray-500 leading-relaxed">
              در انتظار تأیید تراکنش روی شبکه Tron...
              <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto mt-2" />
            </div>
            {tdtwErr && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{tdtwErr}</div>}
          </div>
        )}

        {/* ── Main ─────────────────────────────────────────────────── */}
        {viewState === 'main' && off && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">{t.tdepTitle}</h2>
              <p className="text-sm text-gray-500 mt-1">{t.tdepEscrowTitle}</p>
            </div>

            {/* Chip */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">✈️</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-blue-600 tracking-wider" style={{ direction: 'ltr' }}>{off.orderId || (txnIdRef.current ? txnIdRef.current.slice(0,12) : '—')}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {(order.originFlag || '') + ' ' + (order.originLabel || order.origin || '—') + ' ← ' + (order.destFlag || '') + ' ' + (order.destLabel || order.dest || '—')}
                </div>
                {order.detectedItem && <div className="text-xs text-gray-400 mt-0.5">📦 {order.detectedItem}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-gray-400">هزینه حمل شما</div>
                <div className="text-sm font-bold text-blue-600" style={{ direction: 'ltr' }}>$ {parseFloat(String(off.price ?? 0)).toFixed(2)}</div>
              </div>
            </div>

            {/* Security notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0 mt-0.5">🛡️</span>
              <div className="text-xs text-gray-600 leading-relaxed">
                ودیعه معادل <strong className="text-amber-700">ارزش کالا</strong> است. در صورت آسیب یا مفقودی، از آن برای جبران خسارت استفاده می‌شود. اصل ودیعه پس از تحویل موفق به گیرنده بازگردانده می‌شود.
              </div>
            </div>

            {/* Admin notice */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
              <div className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-orange-700 block mb-1">بازگشت ودیعه نیاز به تأیید ادمین دارد</strong>
                ودیعه شما در <strong className="text-amber-700">پرداخت امن چاپار</strong> نگهداری می‌شود و <strong className="text-orange-700">تنها پس از تأیید ادمین چاپار</strong> بازگردانده می‌شود.
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">خلاصه ودیعه</div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">ارزش کالا <span className="text-green-600 text-[10px]">✅ برگشت‌پذیر</span></span>
                  <span className="text-sm font-extrabold text-gray-900">{Math.round(cargoT).toLocaleString('fa-IR')} ت</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">کارمزد چاپار (۱۵٪) <span className="text-red-500 text-[10px]">✗ غیرقابل بازگشت</span></span>
                  <span className="text-sm font-extrabold text-gray-900">{Math.round(feeT).toLocaleString('fa-IR')} ت</span>
                </div>
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">مجموع ودیعه</span>
                    <span className="text-xl font-extrabold text-amber-500">{Math.round(totalToman).toLocaleString('fa-IR')} ت</span>
                  </div>
                  <div className="text-xs text-gray-400 text-left mt-0.5" style={{ direction: 'ltr' }}>≈ $ {totalUSD.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Method picker */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.tdepMethodLabel}</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'card',    icon: '💳', label: 'کارت بانکی' },
                  { key: 'toman',   icon: '🏦', label: 'واریز تومانی' },
                  { key: 'usdt',    icon: '₮',  label: 'USDT' },
                  { key: 'paypal',  icon: '🅿️', label: 'PayPal' },
                  { key: 'polygon', icon: '⬡',  label: 'USDC Polygon' },
                  { key: 'tron',    icon: '🔴', label: 'USDT Tron' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => selectMethod(m.key as PayMethod)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                      method === m.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-[10px] font-bold text-center leading-tight">{m.label}</span>
                  </button>
                ))}
                {/* Wallet full row */}
                <button
                  onClick={() => !walletDisabled && selectMethod('wallet')}
                  className={`col-span-3 flex items-center gap-3 py-3 px-4 rounded-xl border-2 transition-all ${
                    method === 'wallet' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${walletDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-xl">👛</span>
                  <div className="flex-1 text-right">
                    <div className="text-sm font-bold text-gray-900">کیف پول چاپار</div>
                    <div className="text-xs text-gray-500">{walletBal}</div>
                  </div>
                  <a href="/?page=wallet" onClick={e => e.stopPropagation()} className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 flex-shrink-0">شارژ</a>
                </button>
              </div>
            </div>

            {/* Stripe card element */}
            <div ref={cardWrapRef} style={{ display: 'none' }} className="space-y-2">
              <div className="text-xs font-bold text-gray-500">اطلاعات کارت</div>
              <div id="travCardEl" className="bg-white border border-gray-300 rounded-xl p-3.5 transition-all" style={{ direction: 'ltr' }} />
              {simMode && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                  ⚠️ حالت شبیه‌سازی — کلیدهای Stripe تنظیم نشده. برای پرداخت کارت واقعی کلیدهای Stripe را در <code className="bg-black/10 px-1 rounded">payment/.env</code> تنظیم کنید.
                </div>
              )}
            </div>

            {/* Polygon notice */}
            {method === 'polygon' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-gray-600">
                <div className="font-bold text-indigo-700 mb-2">⬡ اسکرو هوشمند USDC — Polygon</div>
                <div className="text-xs leading-relaxed mb-3">ودیعه شما در قرارداد هوشمند چاپار روی شبکه <strong className="text-indigo-700">Polygon</strong> قفل می‌شود.</div>
                {polyStep === 'connect' ? (
                  <button onClick={connectTravelerWallet} className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}>
                    🦊 اتصال MetaMask / کیف پول Web3
                  </button>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                    <div className="text-[10px] text-gray-500 mb-1">کیف پول متصل</div>
                    <div className="text-xs font-bold text-green-700 font-mono break-all mb-1">{polyWallet.slice(0,6)}...{polyWallet.slice(-4)} ({polyWallet})</div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">موجودی USDC:</span><span className="font-bold text-amber-600">{polyUsdcBal}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Tron notice */}
            {method === 'tron' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-gray-600">
                <div className="font-bold text-red-600 mb-2">🔴 USDT TRC-20 — Tron (Trust Wallet)</div>
                <div className="text-xs leading-relaxed mb-3">ودیعه در کیف پول امن چاپار روی شبکه <strong className="text-red-600">Tron</strong> نگه‌داری می‌شود.</div>
                {tronStep === 'detect' ? (
                  <div>
                    <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">{tronDetectMsg}</div>
                    <button onClick={connectTravelerTronWallet} className="w-full h-11 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                      🔴 اتصال Trust Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                    <div className="text-[10px] text-gray-500 mb-1">کیف پول Tron متصل</div>
                    <div className="text-xs font-bold text-green-700 font-mono break-all mb-1">{tronWallet}</div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">موجودی USDT:</span><span className="font-bold text-amber-600">{tronUsdtBal}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Toman / USDT / PayPal notices */}
            {method === 'toman' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-blue-700">🏦 واریز تومانی</div>
                <div><strong>شماره شبا:</strong> IR12 0560 0000 0000 1234 5678 90</div>
                <div><strong>بانک:</strong> ملت — به نام چاپار</div>
                <div><strong>شناسه واریز:</strong> {refToman}</div>
                <div className="text-orange-700">⚠️ پس از واریز، رسید را برای ادمین ارسال کنید تا ودیعه تأیید شود.</div>
              </div>
            )}
            {method === 'usdt' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-blue-700">₮ USDT (TRC-20)</div>
                <div><strong>آدرس کیف پول:</strong></div>
                <div className="font-mono text-blue-600 break-all" style={{ direction: 'ltr' }}>TRx9abcCHAPAR1234567890USDT</div>
                <div><strong>مقدار:</strong> {refUsdt} USDT</div>
                <div className="text-orange-700">⚠️ پس از ارسال، TXID تراکنش را به ادمین اطلاع دهید.</div>
              </div>
            )}
            {method === 'paypal' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-blue-700">🅿️ PayPal</div>
                <div><strong>ایمیل:</strong> deposit@chapar.app</div>
                <div><strong>مقدار:</strong> {refPaypal} USD</div>
                <div><strong>یادداشت:</strong> {refPaypalNote}</div>
                <div className="text-orange-700">⚠️ پس از ارسال، اسکرین‌شات را برای ادمین ارسال کنید.</div>
              </div>
            )}
            {method === 'wallet' && !walletDisabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-gray-600">
                <div className="font-bold text-blue-700 mb-1">👛 کیف پول چاپار</div>
                مبلغ <strong>{Math.round(totalToman).toLocaleString('fa-IR')}</strong> تومان از موجودی کیف پول شما کسر خواهد شد.
              </div>
            )}

            {/* unused ref vars used to avoid lint warning */}
            <div className="hidden">{rate}</div>

            {/* Error */}
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{err}</div>}

            {/* Deposit button */}
            <button
              onClick={doDeposit}
              className="w-full h-13 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-extrabold text-sm shadow-lg hover:opacity-90 transition-all"
            >
              🛡️ تودیع ودیعه و شروع مسیر ←
            </button>
          </div>
        )}

        {/* ── Success ────────────────────────────────────────────────── */}
        {viewState === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-6xl mb-3">🎉</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-2">{t.tdepSuccessTitle}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{t.tdepSuccessDesc}</div>
            </div>

            {/* TXN box */}
            {successTxnId && (
              <button onClick={copyTxn} className="w-full text-right bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">شناسه تراکنش</div>
                <div className="text-sm font-extrabold text-blue-700 font-mono tracking-wider" style={{ direction: 'ltr' }}>{successTxnId}</div>
                <div className="text-[10px] text-gray-400 mt-1">👆 لمس کنید تا کپی شود</div>
              </button>
            )}

            {/* Locked amount */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ودیعه در پرداخت امن چاپار</span>
                <span className="text-xl font-extrabold text-green-600">{depositAmt}</span>
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                ⚠️ بازگشت ودیعه پس از تأیید تحویل توسط گیرنده و <strong className="text-orange-700">تأیید ادمین چاپار</strong> انجام می‌شود.
              </div>
            </div>

            {/* Next steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm font-bold text-gray-900 mb-2">مراحل بعدی:</div>
              <div className="text-xs text-gray-500 leading-loose">
                ۱. 📦 کالا را از سفارش‌دهنده تحویل بگیرید<br />
                ۲. ✈️ به مقصد برسانید<br />
                ۳. 🔑 کد OTP را از گیرنده دریافت کنید<br />
                ۴. ✅ تحویل را در صفحه پیگیری تأیید کنید<br />
                ۵. 🔍 ادمین چاپار بازگشت ودیعه را تأیید می‌کند<br />
                ۶. 💰 ودیعه + هزینه حمل آزاد می‌شود
              </div>
            </div>

            {/* CTA buttons */}
            <a
              href={successTxnId
                ? '/track?id=' + encodeURIComponent(successTxnId) + '&role=traveler'
                : '/track?role=traveler' + (off?.orderId ? '&id=' + encodeURIComponent(off.orderId) : '')}
              className="flex items-center justify-center gap-2 h-13 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-sm shadow-lg hover:opacity-90 transition-all"
            >
              {t.tdepSuccessTrackBtn}
            </a>
            <a href="/?page=traveler-dashboard" className="flex items-center justify-center gap-2 h-11 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors">
              ✈️ {t.tdepHome}
            </a>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-5 py-3 rounded-2xl text-sm font-bold z-50 shadow-2xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
