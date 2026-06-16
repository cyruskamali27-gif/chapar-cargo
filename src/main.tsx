
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

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    <SessionProvider>{element}</SessionProvider>
  </LangProvider>
);
