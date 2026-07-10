# src/ai/logistics — Logistics & Matching
**Purpose:** Match orders (demand) to trips (supply), route by priority, (future) optimize capacity/part-packing and delivery handoff.
**Future APIs:** matching engine (route/date/capacity), routing (fast vs cheapest by bids), part-packing optimizer (bin-packing), OTP/QR delivery verification.
**Safety:** Match honestly on real data. Don't fake capacity packing before real capacity exists. Funds release only after OTP/QR/ID delivery verification.
**Data:** orders (country/priority), trips (route/date/capacity), bids.
**Outputs:** matched pairs, route recommendation, assigned bundles (planned), verified delivery records.
