
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import TrackingPreview from "./pages/TrackingPreview.tsx";
import TrackPage from "./pages/TrackPage.tsx";
import EarthPreview from "./pages/EarthPreview.tsx";

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
} else {
  element = <App />;
}

createRoot(document.getElementById("root")!).render(element);
