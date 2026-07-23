// ── CMD-53 — same-origin auth interceptor (trust unification) ─────────────────────────────────
// The orders service now derives the caller from a VERIFIED token on every mutating/sensitive
// endpoint (it ignores any client-supplied userId). So the SPA must present its Bearer token on
// those calls. Rather than touch ~14 call sites (and risk missing one → silent 401), attach the
// token once here, for same-origin /api/{marketplace,offers,trips,digest} requests only, and never
// override an Authorization header a caller already set. Reads use optional auth, so this is safe
// for them too. The token already travels to /api/auth and /api/kyc — same origin, no new exposure.
(() => {
  const AUTHED = /^\/api\/(marketplace|offers|trips|digest)\b/;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input
                : input instanceof URL ? input.pathname
                : (input as Request).url;
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      if (AUTHED.test(path)) {
        const token = localStorage.getItem('cp_token');
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
            return orig(input, { ...init, headers });
          }
        }
      }
    } catch { /* fall through to a plain fetch */ }
    return orig(input, init);
  };
})();


// Build banner. Reports the bundle version.json CLAIMS is live, and cross-checks it against
// the script tag actually executing — if a deploy copies assets but forgets version.json (or
// vice-versa) the mismatch is printed loudly instead of silently misleading whoever is
// debugging. `window.__chaparVersion` is there so it can be read from a device console.
fetch('/version.json', { cache: 'no-store' })
  .then(r => r.json())
  .then((v: { version: string; builtAt: string; bundle?: string; css?: string }) => {
    const running = (document.querySelector('script[type=module][src*="/assets/index-"]') as HTMLScriptElement | null)
      ?.src.split('/').pop() ?? null;
    (window as unknown as Record<string, unknown>).__chaparVersion = { ...v, running };
    console.log(
      '%cChapar ' + v.version + ' @ ' + v.builtAt + ' · ' + (running ?? v.bundle ?? '?'),
      'background:#111;color:#22d3ee;padding:2px 6px;border-radius:3px',
    );
    if (v.bundle && running && v.bundle !== running) {
      console.warn('[Chapar] version.json is STALE — it claims ' + v.bundle + ' but ' + running + ' is running.');
    }
  })
  .catch(() => {});

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import TrackingPreview from "./pages/TrackingPreview.tsx";
import TrackPage from "./pages/TrackPage.tsx";
import EarthPreview from "./pages/EarthPreview.tsx";
import OwnerPaymentPage from "./pages/OwnerPaymentPage.tsx";
import TravelerDepositPage from "./pages/TravelerDepositPage.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import DisputePage from "./pages/DisputePage.tsx";
import SupportPage from "./pages/SupportPage.tsx";
import HowtoPage from "./pages/HowtoPage.tsx";
import VerifyPage from "./pages/VerifyPage.tsx";
import OrderPage from "./pages/OrderPage.tsx";
import PaymentPage from "./pages/PaymentPage.tsx";
import ConfirmPage from "./pages/ConfirmPage.tsx";
import { SessionProvider } from "./lib/SessionContext.tsx";
import AppErrorBoundary from "./app/AppErrorBoundary.tsx";
import { LangProvider } from "./lib/LangContext.tsx";

const path = window.location.pathname;
const pageParam = new URLSearchParams(window.location.search).get('page');

let element: React.ReactElement;

if (path.startsWith('/google-earth-preview')) {
  window.location.replace('/');
  element = <></>;
} else if (path.startsWith('/earth-preview')) {
  element = <EarthPreview />;
} else if (path.startsWith('/tracking-preview')) {
  element = <TrackingPreview />;
} else if (path.startsWith('/track') || pageParam === 'track') {
  // Extract code from /track/CHP-... or empty for /track
  const code = path.replace(/^\/track\/?/, '');
  element = <TrackPage initialCode={code} />;
} else if (path.startsWith('/owner-payment')) {
  element = <OwnerPaymentPage />;
} else if (path.startsWith('/traveler-deposit')) {
  element = <TravelerDepositPage />;
} else if (path.startsWith('/chat') || pageParam === 'chat') {
  element = <ChatPage />;
} else if (path.startsWith('/dispute')) {
  element = <DisputePage />;
} else if (path.startsWith('/support')) {
  element = <SupportPage />;
} else if (path.startsWith('/howto')) {
  element = <HowtoPage />;
} else if (path.startsWith('/confirm')) {
  element = <ConfirmPage />;
} else if (path.startsWith('/verify') && !path.endsWith('.html')) {
  element = <VerifyPage />;
} else if (path.startsWith('/order') && !path.endsWith('.html')) {
  element = <OrderPage />;
} else if (path === '/payment') {
  element = <PaymentPage />;
} else {
  element = <App />;
}

// AppErrorBoundary is OUTERMOST on purpose: a throw inside LangProvider/SessionProvider
// (or anything they render) must still produce a readable screen, never an empty #root.
createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <LangProvider>
      <SessionProvider>{element}</SessionProvider>
    </LangProvider>
  </AppErrorBoundary>
);
