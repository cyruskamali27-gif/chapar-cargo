# src/ai/tracking — Tracking & Status
**Purpose:** Clear shipment/order status and journey timeline for all parties.
**Future APIs:** status feed per order/shipment; delivery verification (OTP/QR) hooks.
**Safety:** Funds release only after verified delivery (OTP+QR+ID). Show who holds the item and what's next. Never expose another user's private data.
**Data:** order/shipment id, current state, party ids, timestamps.
**Outputs:** state (created/open/escrow-locked/in-transit/delivered/completed/disputed), readable timeline, next action.
