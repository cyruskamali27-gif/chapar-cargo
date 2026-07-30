// ── CMD-68 — human-test window: escrow ON in TEST mode ────────────────────────
//
// ONE constant governs both payment screens (OwnerPaymentPage, TravelerDepositPage). Flip it to
// false and both screens return to their pre-CMD-68 behaviour — every rail selectable, no banner.
//
// ┌─ WHY THE CRYPTO RAILS ARE CLOSED ──────────────────────────────────────────┐
// CMD-68 turned escrow on in TEST mode so testers could exercise the real chain with Stripe's
// 4242 card, on the stated basis that "no real money is ever possible". That was not true as the
// screens stood. Both offered six selectable rails, and two of them are wired to MAINNET:
//
//   • polygon — POLYGON_CHAIN_ID '0x89' is 137, Polygon MAINNET. POLY_USDC_ADDR
//     0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 is the real Polygon PoS USDC contract, and
//     POLY_ESCROW_ADDR 0x80DD066548dC5A75bfAff19f1303592CE7917B58 is live (/api/polygon/status
//     reported ready:true with the signer holding 3.105 POL). Tapping it asks MetaMask to
//     `approve` REAL USDC to that contract.
//   • tron — TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t is the real TRC-20 USDT mainnet contract.
//
// orders/escrow.js is itself locked to the Stripe rail — it asserts the rail on every call and
// refuses any URL matching /polygon|tron/. But that guard only covers calls THROUGH escrow.js.
// These two screens call /api/polygon/* and /api/tron/* directly from the browser, bypassing it
// entirely. A test-mode banner does not stop a tap, so the banner alone would have left a
// real-money path open for the whole test window.
//
// Closing them here is frontend-only and touches no server contract: /api/polygon/* and
// /api/tron/* keep working exactly as before for anything else that calls them. This removes the
// BUTTON during the test window, not the rail.
//
// The manual `toman` and `usdt` rails are left in place: both show placeholder destinations
// (6037-9975-1234-5678 and TXxxxxxxxx…), so no real value can move through either.
// └────────────────────────────────────────────────────────────────────────────┘
export const TEST_MODE_ESCROW = true;

// Rails a tester may select while TEST_MODE_ESCROW is on. `card` is the one that actually
// exercises escrow, and on Stripe TEST keys a REAL card is declined by Stripe itself — only test
// numbers such as 4242 4242 4242 4242 are accepted, so the charge can never reach real money.
const TEST_MODE_RAILS = ['card', 'toman', 'usdt', 'paypal'];

// Applied to each screen's own method list, so the list stays declared where it is rendered.
export function allowedPayMethods<T extends { key: string }>(methods: T[]): T[] {
  return TEST_MODE_ESCROW ? methods.filter(m => TEST_MODE_RAILS.includes(m.key)) : methods;
}
