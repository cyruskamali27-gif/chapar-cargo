# src/ai/escrow — Escrow Intelligence
**Purpose:** Explain and (future) orchestrate escrow for Buy For Me and insured Send.
**Future APIs:** escrow lock/release via payment service (sandbox/testnet first), ChaparEscrow.sol (Polygon/TRON); dispute-driven refund.
**Safety:** NEVER touch payment/server.js or contracts/. Dev = testnet/sandbox only. Explain honestly; store choice/value now, wire live lock later.
**Data:** order/value, ship mode, party ids, delivery verification result.
**Outputs:** escrow state (planned), refund eligibility (insured, 7 business days).
