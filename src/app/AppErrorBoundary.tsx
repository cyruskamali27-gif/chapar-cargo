import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * App-wide error boundary.
 *
 * Until now the ONLY boundary in the app was GlobeErrorBoundary, scoped to the WebGL
 * globe. Anything that threw during render anywhere else unmounted the whole tree and
 * left `#root` empty — which is exactly what users reported as "the page goes
 * white/black". A blank screen gives them nothing to act on and gives us no signal.
 *
 * This catches those throws and shows a readable Persian message with a reload button,
 * so the worst case is a recoverable error screen instead of a void.
 */
export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(e: Error) {
    return { hasError: true, message: e?.message || 'unknown error' };
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    // Keep the real stack in the console — a user-visible message must never be the
    // only record of a crash.
    console.error('[Chapar] uncaught render error:', e, info?.componentStack);
  }

  componentDidMount() {
    // React boundaries only catch throws during RENDER. An error inside an effect, an
    // event handler, or a rejected promise escapes them entirely — and if it happens to
    // leave the tree unmounted, the user gets a blank screen with no explanation. Record
    // those, then let the watchdog below decide whether the page actually died.
    window.addEventListener('error', this.onGlobalError);
    window.addEventListener('unhandledrejection', this.onGlobalRejection);

    // Blank watchdog. Whatever the cause — an escaped async error, a bad redirect, a route
    // that renders nothing — an EMPTY #root is never a valid end state. If the app has
    // painted nothing by the time this fires, show the error screen instead of a void.
    // Deliberately conservative: it only fires when the root is genuinely empty, so a
    // working page can never be replaced by this.
    this.watchdog = window.setTimeout(() => {
      const root = document.getElementById('root');
      if (root && root.innerHTML.trim().length === 0) {
        console.error('[Chapar] blank-screen watchdog fired; last global error:', this.lastGlobalError);
        this.setState({ hasError: true, message: this.lastGlobalError || 'blank screen watchdog' });
      }
    }, 8000);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onGlobalError);
    window.removeEventListener('unhandledrejection', this.onGlobalRejection);
    if (this.watchdog) window.clearTimeout(this.watchdog);
  }

  watchdog: number | undefined;
  lastGlobalError = '';
  onGlobalError = (e: ErrorEvent) => {
    // Resource load failures (img/video/script) also raise 'error' but carry no message —
    // those must NOT be treated as app crashes.
    if (!e?.message) return;
    this.lastGlobalError = e.message;
    console.error('[Chapar] uncaught async error:', e.message, e.filename + ':' + e.lineno);
  };
  onGlobalRejection = (e: PromiseRejectionEvent) => {
    const r = e?.reason;
    this.lastGlobalError = (r && (r.message || String(r))) || 'unhandled rejection';
    console.error('[Chapar] unhandled promise rejection:', r);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1.25rem',
          background: '#04070f', color: '#fff', padding: '2rem',
          fontFamily: "'Vazirmatn', Tahoma, Arial, sans-serif", textAlign: 'center',
        }}
      >
        <div aria-hidden="true"><AlertTriangle style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto' }} /></div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          مشکلی پیش آمد
        </h1>
        <p style={{ margin: 0, opacity: 0.75, fontSize: '.95rem', maxWidth: '22rem', lineHeight: 1.8 }}>
          صفحه به‌درستی بارگذاری نشد. لطفاً دوباره تلاش کنید.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '.75rem 1.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: '#3b82f6', color: '#fff', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            بارگذاری مجدد
          </button>
          <button
            onClick={() => { window.location.href = 'https://chaparcargo.com/'; }}
            style={{
              padding: '.75rem 1.75rem', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', color: '#fff', fontSize: '1rem',
              border: '1px solid rgba(255,255,255,.25)', fontFamily: 'inherit',
            }}
          >
            صفحهٔ اصلی
          </button>
        </div>
      </div>
    );
  }
}
