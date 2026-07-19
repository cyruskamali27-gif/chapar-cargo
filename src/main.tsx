
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

let element: React.ReactElement;

if (path.startsWith('/google-earth-preview')) {
  window.location.replace('/');
  element = <></>;
} else if (path.startsWith('/earth-preview')) {
  element = <EarthPreview />;
} else if (path.startsWith('/tracking-preview')) {
  element = <TrackingPreview />;
} else if (path.startsWith('/track')) {
  // Extract code from /track/CHP-... or empty for /track
  const code = path.replace(/^\/track\/?/, '');
  element = <TrackPage initialCode={code} />;
} else if (path.startsWith('/owner-payment')) {
  element = <OwnerPaymentPage />;
} else if (path.startsWith('/traveler-deposit')) {
  element = <TravelerDepositPage />;
} else if (path.startsWith('/chat')) {
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
