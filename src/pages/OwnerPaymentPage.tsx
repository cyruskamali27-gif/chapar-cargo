/**
 * Owner payment page — ports owner-payment.html exactly.
 * Endpoints called: /config, /api/transaction/create, /api/owner/payment-intent,
 *   /api/owner/payment-confirm, /api/polygon/register-wallet, /api/polygon/escrow/:id,
 *   /api/polygon/owner-deposit-confirm, /api/tron/create-owner-payment,
 *   /api/tron/verify-owner-payment, /api/tron/payment-status/:id
 * localStorage keys written: cp_offers, cp_admin_statuses, cp_status_history, cp_notifications
 */
import { useState, useEffect, useRef } from 'react';
import { Store, getLiveRate, getSession, genId } from '../lib/store';

/* ── Window globals declared by CDN scripts ───────────────────────────────── */
declare global {
  interface Window {
    ethers: {
      BrowserProvider: new (p: unknown) => { getSigner: () => Promise<{ getAddress: () => Promise<string> }> };
      Contract: new (addr: string, abi: unknown, signerOrProvider: unknown) => Record<string, (...a: unknown[]) => { wait: (n: number) => Promise<{ hash: string }> } & Promise<unknown>>;
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
      contract: (abi: unknown, addr: string) => { balanceOf: (a: string) => { call: () => Promise<unknown> }; transfer: (to: string, v: unknown) => { send: (o: unknown) => Promise<string> } };
    };
  }
}

/* ── Constants (exact from owner-payment.html) ────────────────────────────── */
const POLYGON_CHAIN_ID = '0x89';
const POLY_USDC_ADDR   = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const POLY_ESCROW_ADDR = '0x80DD066548dC5A75bfAff19f1303592CE7917B58';
const POLY_USDC_ABI    = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];
const POLY_ESCROW_ABI  = ['function ownerDeposit(bytes32 txnId) external'];
const TRON_USDT_ADDR   = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_USDT_ABI    = [
  { constant: false, inputs: [{ name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], payable: false, stateMutability: 'nonpayable', type: 'function' },
  { constant: true,  inputs: [{ name: '_owner', type: 'address' }], name: 'balanceOf', outputs: [{ name: 'balance', type: 'uint256' }], payable: false, stateMutability: 'view', type: 'function' },
];

type PayMethod = 'card' | 'toman' | 'usdt' | 'paypal' | 'polygon' | 'tron' | 'wallet';
type State = 'notfound' | 'already' | 'processing' | 'polywaiting' | 'tronwaiting' | 'main' | 'success';

interface Offer {
  id?: string; offerId?: string;
  price?: number; travelerName?: string; travelerId?: string;
  travelerPhone?: string; travelerStripeAcct?: string;
  orderId?: string; trackId?: string;
  ownerPaid?: boolean; ownerTxnId?: string;
}
interface Order {
  trackId?: string; origin?: string; dest?: string;
  originLabel?: string; destLabel?: string;
  originFlag?: string; destFlag?: string;
  detectedItem?: string; cargoType?: string;
  valueUSD?: number | string;
  recFirstName?: string; recLastName?: string;
  recPhone?: string; recAddress?: string;
}

function fmtUsd(v: number) { return '$ ' + Number(v).toFixed(2); }

export default function OwnerPaymentPage() {
  const [state,     setState]     = useState<State>('main');
  const [offer,     setOffer]     = useState<Offer | null>(null);
  const [order,     setOrder]     = useState<Order>({});
  const [feeUSD,    setFeeUSD]    = useState(0);
  const [totalUSD,  setTotalUSD]  = useState(0);
  const [method,    setMethod]    = useState<PayMethod | null>(null);
  const [err,       setErr]       = useState('');
  const [toast,     setToast]     = useState('');

  // Success state
  const [txnId,     setTxnId]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [alreadyLink, setAlreadyLink] = useState('');

  // Stripe
  const stripeRef  = useRef<ReturnType<typeof window.Stripe> | null>(null);
  const cardElRef  = useRef<unknown>(null);
  const stripeReady = useRef(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [simMode,   setSimMode]   = useState(false);

  // Polygon
  const [polyWallet,   setPolyWallet]   = useState('');
  const [polyUsdcBal,  setPolyUsdcBal]  = useState('—');
  const [polyStep,     setPolyStep]     = useState<'connect' | 'connected'>('connect');
  const [polyWaiting,  setPolyWaiting]  = useState('');
  const [polyDepReady, setPolyDepReady] = useState(false);
  const [polyErr,      setPolyErr]      = useState('');
  const ethersProvRef = useRef<unknown>(null);
  const ethersSignRef = useRef<unknown>(null);
  const polyWalletRef = useRef('');
  const polyIntervalRef = useRef<number | null>(null);

  // Tron
  const [tronWallet,   setTronWallet]   = useState('');
  const [tronUsdtBal,  setTronUsdtBal]  = useState('—');
  const [tronStep,     setTronStep]     = useState<'detect' | 'connected'>('detect');
  const [tronDetectMsg,setTronDetectMsg]= useState('در حال شناسایی کیف پول Tron...');
  const [twTxId,       setTwTxId]       = useState('');
  const [twErr,        setTwErr]        = useState('');
  const tronPollRef = useRef<number | null>(null);
  const txnIdRef    = useRef('');
  const offerIdRef  = useRef('');
  const offerRef    = useRef<Offer | null>(null);
  const orderRef    = useRef<Order>({});
  const methodRef   = useRef<PayMethod | null>(null);
  const feeUSDRef   = useRef(0);
  const totalUSDRef = useRef(0);
  const otpRef      = useRef('');
  const stripeCardWrapRef = useRef<HTMLDivElement>(null);

  // Wallet balance display
  const [walletBal, setWalletBal]       = useState('در حال بارگذاری...');
  const [walletDisabled, setWalletDisabled] = useState(false);

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

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p      = new URLSearchParams(location.search);
    const id     = p.get('offerId') || '';
    offerIdRef.current = id;
    if (!id) { setState('notfound'); return; }
    loadOffer(id);
    initStripe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadOffer(id: string) {
    const offers = Store.get<Offer[]>('offers') ?? [];
    let found = offers.find(o => o.id === id || o.offerId === id) ?? null;

    // URL fallback
    if (!found) {
      const p = new URLSearchParams(location.search);
      const urlFee = p.get('fee');
      if (urlFee) {
        found = {
          id, offerId: id,
          price:        parseFloat(urlFee),
          travelerName: p.get('traveler') || 'مسافر',
          travelerId:   null as unknown as undefined,
          travelerPhone: p.get('phone') || '',
          orderId: id, trackId: id,
        };
        orderRef.current = { valueUSD: parseFloat(p.get('cargo') || '0'), detectedItem: p.get('item') || '' };
        setOrder(orderRef.current);
      }
    }
    if (!found) { setState('notfound'); return; }

    offerRef.current = found;
    setOffer(found);

    if (found.ownerPaid && found.ownerTxnId) {
      setAlreadyLink('/track?id=' + found.ownerTxnId + '&role=owner');
      setState('already'); return;
    }

    const hist = Store.get<Order[]>('history') ?? [];
    const ord  = hist.find(o => o.trackId === found!.orderId || o.trackId === found!.trackId) ?? {};
    orderRef.current = ord;
    setOrder(ord);

    const fee  = parseFloat(String(found.price ?? 0));
    const comm = fee * 0.15;
    const tot  = +(fee + comm).toFixed(2);
    feeUSDRef.current   = fee;
    totalUSDRef.current = tot;
    setFeeUSD(fee);
    setTotalUSD(tot);

    const sess = getSession();
    if (sess) {
      const wallets = Store.get<Record<string, { balance?: number }>>('wallets') ?? {};
      const wbal = wallets[sess.phone]?.balance ?? 0;
      const rate = getLiveRate();
      const enough = wbal >= tot * rate;
      setWalletBal('موجودی: ' + Math.round(wbal).toLocaleString('fa-IR') + ' ت' + (enough ? '' : ' — ناکافی'));
      setWalletDisabled(!enough);
    } else {
      setWalletBal('ابتدا وارد شوید');
      setWalletDisabled(true);
    }

    setState('main');
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
            setStripeLoaded(true);
            if (methodRef.current === 'card') mountCard();
          };
          document.head.appendChild(s);
        } else {
          setSimMode(true);
        }
      })
      .catch(() => { setSimMode(true); });
  }

  function mountCard() {
    if (!stripeCardWrapRef.current) return;
    stripeCardWrapRef.current.style.display = 'block';
    if (stripeReady.current && stripeRef.current && !cardElRef.current) {
      setSimMode(false);
      const els = stripeRef.current.elements({ locale: 'auto' });
      const card = els.create('card', {
        style: {
          base: { color: '#111827', fontSize: '15px', fontFamily: 'inherit', '::placeholder': { color: '#9ca3af' } },
          invalid: { color: '#ef4444' },
        },
      }) as { mount: (el: string) => void; on: (ev: string, cb: (e: unknown) => void) => void };
      cardElRef.current = card;
      card.mount('#ownerCardEl');
      card.on('change', (e: unknown) => {
        const ev = e as { error?: { message: string } };
        setErr(ev.error ? ev.error.message : '');
      });
    } else if (!stripeReady.current) {
      setSimMode(true);
    }
  }

  // ── Method select ──────────────────────────────────────────────────────────
  function selectMethod(m: PayMethod) {
    setMethod(m);
    methodRef.current = m;
    setErr('');
    if (stripeCardWrapRef.current) stripeCardWrapRef.current.style.display = 'none';
    if (m === 'card') mountCard();
    if (m === 'tron') detectTronWallet();
  }

  // ── KYC name check (from owner-payment.html doPayment) ────────────────────
  function kycCheck(): boolean {
    const sess    = getSession() ?? {};
    const users   = Store.get<Array<{ userId?: string; kycFirstName?: string; kycLastName?: string; firstName?: string; lastName?: string }>>('users') ?? [];
    const kycUser = users.find(u => u.userId === sess.userId) ?? sess as typeof users[0];
    const kycName = ((kycUser.kycFirstName || kycUser.firstName || '') + ' ' + (kycUser.kycLastName || kycUser.lastName || '')).trim().toLowerCase();
    const payName = ((sess.firstName || '') + ' ' + (sess.lastName || '')).trim().toLowerCase();
    if (kycName && payName && kycName !== payName) {
      setErr('نام پرداخت با هویت تأیید شده مطابقت ندارد — پرداخت مسدود شد');
      return false;
    }
    return true;
  }

  // ── Build base transaction body ────────────────────────────────────────────
  function buildTxnBody(rail: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const sess = getSession() ?? {};
    const ord  = orderRef.current;
    const offr = offerRef.current ?? {};
    const cargoVal = parseFloat(String(ord.valueUSD ?? 0)) || (totalUSDRef.current * 5);
    return {
      offerId: offerIdRef.current,
      cargoOwner: {
        userId: sess.userId ?? null,
        name: ((sess.firstName || '') + ' ' + (sess.lastName || '')).trim() || 'سفارش‌دهنده',
        email: sess.email || '', phone: sess.phone || '',
        ...extra.cargoOwnerExtra,
      },
      traveler: {
        name:  offr.travelerName || '', userId: offr.travelerId ?? null,
        phone: offr.travelerPhone || '',
        stripeConnectedAccountId: offr.travelerStripeAcct || '',
      },
      receiver: {
        name:    ((ord.recFirstName || '') + ' ' + (ord.recLastName || '')).trim() || '',
        phone:   ord.recPhone || '', address: ord.recAddress || '',
      },
      cargo: {
        description: ord.detectedItem || ord.cargoType || '',
        origin: ord.origin || '', destination: ord.dest || '',
        valueUSD: cargoVal,
      },
      financials: {
        deliveryFee: feeUSDRef.current, cargoValue: cargoVal, paymentRail: rail,
      },
    };
  }

  async function fetchJson<T>(url: string, opts: RequestInit): Promise<T> {
    const r = await fetch(url, opts);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    return d as T;
  }

  // ── Finalize ────────────────────────────────────────────────────────────────
  function finalize() {
    const m     = methodRef.current!;
    const tid   = txnIdRef.current;
    const offId = offerIdRef.current;
    const offr  = offerRef.current ?? {};

    const offers = Store.get<Offer[]>('offers') ?? [];
    const idx = offers.findIndex(o => o.id === offId || o.offerId === offId);
    if (idx !== -1) {
      offers[idx] = { ...offers[idx], ownerPaid: true, ownerPaidAt: Date.now() as unknown as boolean, ownerPayMethod: m as unknown as boolean, ownerTxnId: tid || null as unknown as boolean, status: 'owner_paid' as unknown as boolean };
      Store.set('offers', offers);
    }

    const orderId = offr.orderId || offr.trackId;
    if (orderId) {
      const statuses = Store.get<Record<string, string>>('admin_statuses') ?? {};
      statuses[orderId] = 'matched';
      Store.set('admin_statuses', statuses);

      const hist = Store.get<Record<string, Array<{ status: string; at: number; note: string }>>>('status_history') ?? {};
      const oh = hist[orderId] ?? [];
      oh.push({ status: 'matched', at: Date.now(), note: 'پرداخت سفارش‌دهنده تأیید شد' });
      hist[orderId] = oh;
      Store.set('status_history', hist);
    }

    const notifs = Store.get<unknown[]>('notifications') ?? [];
    notifs.unshift({
      id: genId('N'), type: 'offer_accepted',
      title: 'پیشنهاد شما پذیرفته شد ✅',
      body: 'سفارش‌دهنده هزینه حمل را پرداخت کرد. لطفاً ودیعه امنیتی را واریز کنید.',
      orderId: orderId ?? null, offerId: offId, txnId: tid ?? null, at: Date.now(), read: false,
    });
    Store.set('notifications', (notifs as unknown[]).slice(0, 200));

    // Wallet deduction
    if (m === 'wallet') {
      const sess = getSession();
      if (sess) {
        const wallets = Store.get<Record<string, { balance?: number }>>('wallets') ?? {};
        const w = wallets[sess.phone] ?? { balance: 0 };
        w.balance = (w.balance ?? 0) - Math.round(totalUSDRef.current * getLiveRate());
        wallets[sess.phone] = w;
        Store.set('wallets', wallets);
      }
    }

    setTxnId(tid || offr.orderId || 'در انتظار');
    setState('success');
    showToast('✅ پرداخت با موفقیت انجام شد');
  }

  // ── Pay button click ───────────────────────────────────────────────────────
  async function doPayment() {
    setErr('');
    if (!method) { setErr('لطفاً روش پرداخت را انتخاب کنید'); return; }
    if (!kycCheck()) return;

    if (method === 'paypal') { setErr('PayPal در این مرحله فعال نیست'); return; }

    if (method === 'wallet') {
      const sess = getSession();
      if (!sess) { setErr('ابتدا وارد شوید'); return; }
      const wallets = Store.get<Record<string, { balance?: number }>>('wallets') ?? {};
      const wbal = wallets[sess.phone]?.balance ?? 0;
      if (wbal < totalUSDRef.current * getLiveRate()) {
        setErr('موجودی کیف پول کافی نیست — ابتدا شارژ کنید'); return;
      }
    }

    // ── Stripe card ────────────────────────────────────────────────────────
    if (method === 'card' && stripeReady.current && stripeRef.current && cardElRef.current) {
      setState('processing');
      try {
        const txn = await fetchJson<{ transactionId?: string; error?: string }>(
          '/api/transaction/create',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildTxnBody('stripe')) }
        );
        if (!txn.transactionId) throw new Error(txn.error || 'خطا در ایجاد تراکنش');
        txnIdRef.current = txn.transactionId;

        const intent = await fetchJson<{ clientSecret?: string; error?: string }>(
          '/api/owner/payment-intent',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txn.transactionId }) }
        );
        if (!intent.clientSecret) throw new Error(intent.error || 'خطای سرور');

        const sess = getSession() ?? {};
        const result = await stripeRef.current.confirmCardPayment(intent.clientSecret, {
          payment_method: {
            card: cardElRef.current,
            billing_details: {
              name:  ((sess.firstName || '') + ' ' + (sess.lastName || '')).trim() || undefined,
              email: sess.email || undefined,
            },
          },
        });
        if (result.error) throw new Error(result.error.message);

        const confirm = await fetchJson<{ receiverOTP?: string }>(
          '/api/owner/payment-confirm',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txn.transactionId, intentId: result.paymentIntent.id }) }
        );
        if (confirm.receiverOTP) { otpRef.current = confirm.receiverOTP; setOtp(confirm.receiverOTP); }
        finalize();
      } catch (e: unknown) {
        setState('main'); setErr((e as Error).message || 'خطا در پرداخت');
      }
      return;
    }

    // ── Polygon ────────────────────────────────────────────────────────────
    if (method === 'polygon') {
      if (!polyWalletRef.current || !ethersSignRef.current) {
        setErr('ابتدا MetaMask را متصل کنید — دکمه اتصال را بزنید'); return;
      }
      setState('processing');
      try {
        const cargoValP = parseFloat(String(orderRef.current.valueUSD ?? 0)) || 0;
        const txnBody   = buildTxnBody('polygon');
        (txnBody.cargoOwner as Record<string, unknown>).walletAddress = polyWalletRef.current;
        const txnRes = await fetchJson<{ transactionId?: string; error?: string }>(
          '/api/transaction/create',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txnBody) }
        );
        if (!txnRes.transactionId) throw new Error(txnRes.error || 'خطا در ایجاد تراکنش');
        txnIdRef.current = txnRes.transactionId;

        const regRes = await fetchJson<{ escrowCreated?: boolean }>(
          '/api/polygon/register-wallet',
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: txnRes.transactionId, walletAddress: polyWalletRef.current, role: 'owner' }) }
        );

        const eth = window.ethers;
        const usdcSigned = new eth.Contract(POLY_USDC_ADDR, POLY_USDC_ABI, ethersSignRef.current);
        const amountRaw  = BigInt(Math.round(totalUSDRef.current * 1_000_000));
        showToast('🦊 تأیید USDC در MetaMask...');
        const approveTx = usdcSigned.approve(POLY_ESCROW_ADDR, amountRaw) as unknown as Promise<{ wait: (n: number) => Promise<unknown> }>;
        await (await approveTx).wait(1);

        setPolyWaiting('');
        setPolyDepReady(false);
        setState('polywaiting');

        if (regRes.escrowCreated) {
          setOwnerPolyReady();
        } else {
          startOwnerPolyPoll(txnRes.transactionId);
        }
      } catch (e: unknown) {
        setState('main'); setErr((e as Error).message || 'خطا در پرداخت Polygon');
      }
      return;
    }

    // ── Tron ────────────────────────────────────────────────────────────────
    if (method === 'tron') {
      doTronPayment(); return;
    }

    // ── Simulation ─────────────────────────────────────────────────────────
    setState('processing');
    try {
      const txn = await fetch('/api/transaction/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTxnBody(method)),
      }).then(r => r.json()).catch(() => ({})) as { transactionId?: string };
      if (txn.transactionId) txnIdRef.current = txn.transactionId;
      finalize();
    } catch {
      finalize(); // offline — still finalize locally
    }
  }

  // ── Polygon wallet connect ─────────────────────────────────────────────────
  async function connectPolygonWallet() {
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

  function setOwnerPolyReady() {
    setPolyWaiting('✅ قرارداد آماده است — ودیعه خود را واریز کنید');
    setPolyDepReady(true);
  }

  function startOwnerPolyPoll(tid: string) {
    setPolyWaiting('در انتظار ثبت کیف پول مسافر...');
    if (polyIntervalRef.current) clearInterval(polyIntervalRef.current);
    polyIntervalRef.current = window.setInterval(() => {
      fetch('/api/polygon/escrow/' + encodeURIComponent(tid))
        .then(r => r.json())
        .then((r: { ok?: boolean; onChain?: unknown }) => {
          if (r.ok && r.onChain) { clearInterval(polyIntervalRef.current!); setOwnerPolyReady(); }
        }).catch(() => {});
    }, 8000);
  }

  async function doOwnerDeposit() {
    setPolyErr('');
    try {
      const eth  = window.ethers;
      const escrow = new eth.Contract(POLY_ESCROW_ADDR, POLY_ESCROW_ABI, ethersSignRef.current);
      const txnKey = eth.keccak256(eth.toUtf8Bytes(txnIdRef.current));
      showToast('🦊 واریز USDC به قرارداد در MetaMask...');
      const depositTx = (escrow.ownerDeposit as unknown as (k: string) => Promise<{ wait: (n: number) => Promise<{ hash: string }> }>)(txnKey);
      const receipt   = await (await depositTx).wait(1);
      const conf = await fetchJson<{ receiverOTP?: string }>('/api/polygon/owner-deposit-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnIdRef.current, txHash: receipt.hash }),
      });
      if (conf.receiverOTP) { otpRef.current = conf.receiverOTP; setOtp(conf.receiverOTP); }
      finalize();
    } catch (e: unknown) { setPolyErr((e as Error).message || 'خطا در واریز'); }
  }

  // ── Tron wallet ────────────────────────────────────────────────────────────
  function detectTronWallet() {
    const tw = window.tronWeb;
    if (!tw) {
      setTronDetectMsg('Trust Wallet شناسایی نشد. این صفحه را در مرورگر داخلی Trust Wallet باز کنید.');
      return;
    }
    const addr = tw.defaultAddress?.base58 || '';
    if (!addr) { setTronDetectMsg('Trust Wallet یافت شد — لطفاً دکمه اتصال را بزنید.'); return; }
    setTronWallet(addr);
    setTronStep('connected');
    tw.contract(TRON_USDT_ABI, TRON_USDT_ADDR).balanceOf(addr).call()
      .then(bal => setTronUsdtBal((Number(bal) / 1e6).toFixed(2) + ' USDT'))
      .catch(() => {});
  }

  async function connectTronWallet() {
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

  async function doTronPayment() {
    const tw = window.tronWeb;
    if (!tronWallet || !tw) { setErr('ابتدا Trust Wallet را متصل کنید'); return; }
    setState('processing');
    try {
      const txnBody = buildTxnBody('tron');
      (txnBody.cargoOwner as Record<string, unknown>).walletAddress = tronWallet;
      const txnRes = await fetchJson<{ transactionId?: string; error?: string }>(
        '/api/transaction/create',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txnBody) }
      );
      if (!txnRes.transactionId) throw new Error(txnRes.error || 'خطا در ایجاد تراکنش');
      txnIdRef.current = txnRes.transactionId;

      const intentRes = await fetchJson<{ ok?: boolean; adminWallet?: string; expectedRaw?: unknown; expectedHuman?: string; error?: string }>(
        '/api/tron/create-owner-payment',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txnRes.transactionId, ownerWalletAddress: tronWallet }) }
      );
      if (!intentRes.ok) throw new Error(intentRes.error || 'خطا در ایجاد قصد پرداخت');

      showToast('🔴 انتقال ' + intentRes.expectedHuman + ' USDT در Trust Wallet...');
      const contract = tw.contract(TRON_USDT_ABI, TRON_USDT_ADDR);
      const txId = await contract.transfer(intentRes.adminWallet!, intentRes.expectedRaw).send({
        feeLimit: 40_000_000, callValue: 0, shouldPollResponse: false,
      });
      if (!txId) throw new Error('تراکنش ایجاد نشد — لطفاً دوباره امتحان کنید');

      setTwTxId(txId);
      setState('tronwaiting');

      const verRes = await fetch('/api/tron/verify-owner-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnRes.transactionId, txId }),
      }).then(r => r.json()) as { ok?: boolean };

      if (verRes.ok) { finalize(); return; }
      startTronOwnerPoll(txnRes.transactionId);
    } catch (e: unknown) { setState('main'); setErr((e as Error).message || 'خطا در پرداخت Tron USDT'); }
  }

  function startTronOwnerPoll(tid: string) {
    if (tronPollRef.current) clearInterval(tronPollRef.current);
    let attempts = 0;
    tronPollRef.current = window.setInterval(() => {
      attempts++;
      fetch('/api/tron/payment-status/' + encodeURIComponent(tid))
        .then(r => r.json())
        .then((st: { ownerPayment?: string }) => {
          if (st.ownerPayment === 'secured') { clearInterval(tronPollRef.current!); finalize(); }
          else if (attempts >= 40) { clearInterval(tronPollRef.current!); setTwErr('تأیید تراکنش بیش از حد طول کشید. با پشتیبانی تماس بگیرید. شناسه: ' + tid); }
        }).catch(() => {});
    }, 15000);
  }

  function sendDepositLink() {
    const tid = txnIdRef.current;
    const link = tid
      ? (location.origin + '/traveler-deposit?txnId=' + encodeURIComponent(tid))
      : (location.origin + '/traveler-deposit?offerId=' + encodeURIComponent(offerIdRef.current));
    if (navigator.share) {
      navigator.share({ title: 'چاپار — ودیعه مسافر', text: 'لطفاً ودیعه امنیتی را واریز کنید:', url: link }).catch(() => copyText(link));
    } else { copyText(link); showToast('🔗 لینک کپی شد — آن را برای مسافر ارسال کنید'); }
  }

  function copyText(t: string) {
    try { navigator.clipboard.writeText(t); } catch { /* ignore */ }
  }

  // ── Cleanup intervals ──────────────────────────────────────────────────────
  useEffect(() => () => {
    if (polyIntervalRef.current) clearInterval(polyIntervalRef.current);
    if (tronPollRef.current)    clearInterval(tronPollRef.current);
  }, []);

  const rate = getLiveRate();
  const offr = offer;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">← بازگشت</button>
        <span className="text-sm font-bold text-gray-900">پرداخت سفارش‌دهنده</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* ── Not Found ─────────────────────────────────────────────── */}
        {state === 'notfound' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl font-bold text-gray-900 mb-2">پیشنهاد یافت نشد</div>
            <div className="text-sm text-gray-500 mb-6">لینک پرداخت معتبر نیست یا منقضی شده</div>
            <a href="/marketplace/" className="inline-flex items-center justify-center h-12 px-6 bg-blue-600 text-white rounded-xl font-bold text-sm">بازگشت به بازارچه ←</a>
          </div>
        )}

        {/* ── Already Paid ───────────────────────────────────────────── */}
        {state === 'already' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-xl font-bold text-gray-900 mb-2">پرداخت قبلاً انجام شد</div>
            <div className="text-sm text-gray-500 mb-6">این سفارش پرداخت شده است</div>
            <a href={alreadyLink || '/track?role=owner'} className="inline-flex items-center justify-center h-12 px-6 bg-blue-600 text-white rounded-xl font-bold text-sm">🔍 پیگیری سفارش</a>
          </div>
        )}

        {/* ── Processing ─────────────────────────────────────────────── */}
        {state === 'processing' && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4" />
            <div className="text-base font-bold text-gray-800 mb-1">در حال پردازش پرداخت...</div>
            <div className="text-sm text-gray-500">لطفاً صفحه را نبندید</div>
          </div>
        )}

        {/* ── Polygon Waiting ───────────────────────────────────────── */}
        {state === 'polywaiting' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">⬡</div>
            <div className="text-base font-bold text-gray-900 mb-4">پرداخت USDC — Polygon</div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-right">
              <div className="text-xs text-gray-500 mb-1">کیف پول متصل</div>
              <div className="text-xs font-bold text-green-700 font-mono break-all mb-1">{polyWallet}</div>
              <div className="text-xs text-green-600">✅ USDC تأیید شد — آماده واریز به قرارداد</div>
            </div>
            <div className="text-xs text-gray-500 mb-4 leading-relaxed">
              {polyWaiting || 'در حال آماده‌سازی...'}
              {!polyDepReady && <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto mt-2" />}
            </div>
            {polyDepReady && (
              <button onClick={doOwnerDeposit} className="w-full h-12 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}>
                ⬡ واریز USDC به قرارداد ←
              </button>
            )}
            {polyErr && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{polyErr}</div>}
          </div>
        )}

        {/* ── Tron Waiting ─────────────────────────────────────────── */}
        {state === 'tronwaiting' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🔴</div>
            <div className="text-base font-bold text-gray-900 mb-4">پرداخت USDT Tron — در انتظار تأیید</div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-right">
              <div className="text-xs text-gray-500 mb-1">کیف پول شما</div>
              <div className="text-xs font-bold text-green-700 font-mono break-all mb-1">{tronWallet}</div>
              <div className="text-xs text-green-600">✅ تراکنش USDT ارسال شد</div>
            </div>
            {twTxId && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-4 text-xs text-gray-500 text-left font-mono break-all" style={{ direction: 'ltr' }}>TX: {twTxId}</div>
            )}
            <div className="text-xs text-gray-500 mb-4 leading-relaxed">
              در انتظار تأیید تراکنش روی شبکه Tron...
              <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto mt-2" />
            </div>
            {twErr && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{twErr}</div>}
          </div>
        )}

        {/* ── Main ─────────────────────────────────────────────────── */}
        {state === 'main' && offr && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">پرداخت سفارش‌دهنده</h2>
              <p className="text-sm text-gray-500 mt-1">هزینه حمل + کارمزد چاپار — نگهداری در پرداخت امن</p>
            </div>

            {/* Order chip */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">📦</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-blue-600 tracking-wider" style={{ direction: 'ltr' }}>{offr.orderId || offerIdRef.current}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {(order.originFlag || '') + ' ' + (order.originLabel || order.origin || '—') + ' ← ' + (order.destFlag || '') + ' ' + (order.destLabel || order.dest || '—')}
                </div>
                {order.detectedItem && <div className="text-xs text-gray-400 mt-0.5">📦 {order.detectedItem}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-gray-400">مسافر</div>
                <div className="text-sm font-bold text-green-600">{offr.travelerName || 'مسافر'}</div>
              </div>
            </div>

            {/* Secure hold notice */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <span className="text-xl flex-shrink-0 mt-0.5">🔒</span>
              <div className="text-xs text-gray-600 leading-relaxed">
                مبلغ پرداختی در <strong className="text-green-700">پرداخت امن چاپار</strong> نگه‌داری می‌شود.
                پس از تأیید تحویل توسط گیرنده و <strong className="text-green-700">تأیید ادمین چاپار</strong>، هزینه حمل به مسافر منتقل می‌شود.
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">خلاصه پرداخت</div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">هزینه حمل توافقی</span>
                  <span className="text-sm font-extrabold text-gray-900" style={{ direction: 'ltr' }}>{fmtUsd(feeUSD)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">کارمزد چاپار (۱۵٪)</span>
                  <span className="text-sm font-extrabold text-gray-900" style={{ direction: 'ltr' }}>{fmtUsd(feeUSD * 0.15)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">مبلغ قابل پرداخت</span>
                    <span className="text-2xl font-extrabold text-amber-500" style={{ direction: 'ltr' }}>{fmtUsd(totalUSD)}</span>
                  </div>
                  <div className="text-xs text-gray-400 text-left mt-0.5" style={{ direction: 'ltr' }}>≈ {Math.round(totalUSD * rate).toLocaleString('fa-IR')} تومان</div>
                </div>
              </div>
            </div>

            {/* Method picker */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">روش پرداخت</div>
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
                {/* Wallet — full row */}
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
            <div ref={stripeCardWrapRef} style={{ display: 'none' }} className="space-y-2">
              <div className="text-xs font-bold text-gray-500">اطلاعات کارت بانکی</div>
              <div id="ownerCardEl" className="bg-white border border-gray-300 rounded-xl p-3.5" style={{ direction: 'ltr' }} />
              {simMode && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                  ⚠️ حالت شبیه‌سازی — Stripe تنظیم نشده. برای پرداخت واقعی، <code className="bg-black/10 px-1 rounded">STRIPE_SECRET_KEY</code> را در <code className="bg-black/10 px-1 rounded">payment/.env</code> تنظیم کنید.
                </div>
              )}
              {/* stripeLoaded is read to suppress unused warning */}
              {stripeLoaded && null}
            </div>

            {/* Polygon notice */}
            {method === 'polygon' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-gray-600">
                <div className="font-bold text-indigo-700 mb-2">⬡ اسکرو هوشمند USDC — Polygon</div>
                <div className="text-xs leading-relaxed mb-3">مبلغ در قرارداد هوشمند چاپار روی شبکه <strong className="text-indigo-700">Polygon</strong> قفل می‌شود.</div>
                {polyStep === 'connect' ? (
                  <button onClick={connectPolygonWallet} className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}>
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
                <div className="text-xs leading-relaxed mb-3">مبلغ در کیف پول امن چاپار روی شبکه <strong className="text-red-600">Tron</strong> نگه‌داری می‌شود.</div>
                {tronStep === 'detect' ? (
                  <div>
                    <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">{tronDetectMsg}</div>
                    <button onClick={connectTronWallet} className="w-full h-11 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
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

            {/* Toman/USDT/PayPal/Wallet notices */}
            {method === 'toman' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed">
                <div className="font-bold text-amber-700 mb-1.5">🏦 واریز تومانی</div>
                لطفاً مبلغ <strong>{Math.round(totalUSD * rate).toLocaleString('fa-IR')}</strong> تومان را به شماره کارت زیر واریز کنید:<br />
                <code className="text-cyan-700 bg-cyan-50 px-1 rounded text-[11px]">6037-9975-1234-5678 — علی چاپاری</code><br />
                پس از واریز، شماره پیگیری را از طریق پشتیبانی ارسال کنید. تأیید توسط ادمین انجام می‌شود.
              </div>
            )}
            {method === 'usdt' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed">
                <div className="font-bold text-amber-700 mb-1.5">₮ پرداخت USDT (TRC-20)</div>
                لطفاً مبلغ <strong>{totalUSD.toFixed(2)}</strong> USDT را به آدرس زیر ارسال کنید:<br />
                <code className="text-cyan-700 bg-cyan-50 px-1 rounded text-[11px] break-all">TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code><br />
                پس از تأیید شبکه (۱۵ دقیقه)، تراکنش به‌صورت خودکار تأیید می‌شود.
              </div>
            )}
            {method === 'paypal' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-gray-600">
                <div className="font-bold text-amber-700 mb-1.5">🅿️ پرداخت PayPal</div>
                PayPal در این مرحله فعال نیست. لطفاً از روش کارت بانکی یا تومان استفاده کنید.
              </div>
            )}
            {method === 'wallet' && !walletDisabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-gray-600">
                <div className="font-bold text-blue-700 mb-1.5">👛 کیف پول چاپار</div>
                مبلغ <strong>{Math.round(totalUSD * rate).toLocaleString('fa-IR')}</strong> تومان از موجودی کیف پول شما کسر خواهد شد.
              </div>
            )}

            {/* Error */}
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{err}</div>}

            {/* Pay button */}
            <button
              onClick={doPayment}
              className="w-full h-13 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-extrabold text-sm shadow-lg hover:opacity-90 transition-all"
            >
              🔒 پرداخت و رزرو مسافر ←
            </button>
          </div>
        )}

        {/* ── Success ────────────────────────────────────────────────── */}
        {state === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-6xl mb-3 animate-bounce" style={{ animationDuration: '0.4s', animationIterationCount: 1 }}>✅</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-2">پرداخت موفق!</div>
              <div className="text-sm text-gray-500 leading-relaxed">هزینه حمل با موفقیت در پرداخت امن چاپار ثبت شد.</div>
            </div>

            {/* TXN ID */}
            <button
              onClick={() => { copyText(txnId); showToast('📋 شناسه تراکنش کپی شد'); }}
              className="w-full text-right bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors"
            >
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">شناسه تراکنش</div>
              <div className="text-base font-extrabold text-blue-700 font-mono tracking-wider" style={{ direction: 'ltr' }}>{txnId}</div>
              <div className="text-[10px] text-gray-400 mt-1">📋 برای کپی کلیک کنید</div>
            </button>

            {/* Amount locked */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">مبلغ قفل‌شده در پرداخت امن چاپار</div>
              <div className="text-3xl font-extrabold text-green-600" style={{ direction: 'ltr' }}>{fmtUsd(totalUSD)} USD</div>
            </div>

            {/* OTP box */}
            {otp && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-2">کد تحویل گیرنده</div>
                <div className="text-4xl font-extrabold text-amber-600 tracking-[10px] font-mono" style={{ direction: 'ltr' }}>{otp}</div>
                <div className="text-xs text-gray-500 mt-2 leading-relaxed">این کد را به گیرنده بدهید. گیرنده هنگام دریافت کالا این کد را وارد می‌کند.</div>
              </div>
            )}

            {/* Admin notice */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
              <strong className="text-orange-700">بازگشت هزینه نیاز به تأیید ادمین دارد</strong><br />
              پس از تأیید تحویل توسط گیرنده، آزادسازی هزینه حمل <strong className="text-orange-700">تنها پس از تأیید ادمین چاپار</strong> انجام می‌شود.
            </div>

            {/* Actions */}
            <button onClick={sendDepositLink} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-green-50 border border-green-300 text-green-700 font-bold text-sm hover:bg-green-100 transition-colors">
              📩 ارسال لینک ودیعه به مسافر
            </button>
            <a href={txnId ? '/track?id=' + txnId + '&role=owner' : '/track?id=' + (offr?.orderId || '')}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-sm hover:opacity-90 transition-all">
              🔍 پیگیری سفارش
            </a>
            <a href="/" className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors">خانه</a>
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
