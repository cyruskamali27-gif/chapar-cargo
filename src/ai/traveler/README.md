# src/ai/traveler — Traveler Intelligence
**Purpose:** Help travelers publish trips, see matching orders, price capacity, (future) optimize which orders to carry.
**Future APIs:** /api/trips/* (publish, listings, match, update, delete); future bid endpoints; future capacity/part-packing optimizer.
**Safety:** Owner-guard every mutation (403). Stable userId + display name separate. Don't fake capacity packing before real data.
**Data:** origin, destination, date, capacity (kg/bags), min price per kg, userId.
**Outputs:** trip records; matched open orders by route.
