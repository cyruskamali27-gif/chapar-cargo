import { useState, useCallback } from 'react';
import type { ShipmentRoute } from '../types/tracking';

export function useTrackingRoute() {
  const [route, setRoute]   = useState<ShipmentRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  /* Look up a route by tracking code via the API */
  const findRoute = useCallback(async (code: string): Promise<ShipmentRoute | null> => {
    if (!code.trim()) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/${encodeURIComponent(code.trim().toUpperCase())}`);
      if (res.status === 404) {
        setRoute(null);
        setError('Tracking code not found. Try one of the demo codes below.');
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ShipmentRoute = await res.json();
      setRoute(data);
      return data;
    } catch (err) {
      setRoute(null);
      setError('Could not reach the tracking server. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Create a new route via the API (geocoding happens server-side) */
  const createRoute = useCallback(async (input: {
    senderStreet: string;
    senderCity: string;
    senderCountry: string;
    receiverStreet: string;
    receiverCity: string;
    receiverCountry: string;
    routeType?: ShipmentRoute['routeType'];
  }): Promise<ShipmentRoute | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCity:      input.senderCity,
          originCountry:   input.senderCountry,
          destinationCity: input.receiverCity,
          destinationCountry: input.receiverCountry,
          routeType:       input.routeType ?? 'shipment',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: ShipmentRoute = await res.json();
      setRoute(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create route. Check addresses and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Update route status via the API */
  const updateStatus = useCallback(async (
    code: string,
    status: ShipmentRoute['status'],
    escrowStatus?: ShipmentRoute['escrowStatus'],
  ): Promise<ShipmentRoute | null> => {
    try {
      const res = await fetch(`/api/routes/${encodeURIComponent(code)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(escrowStatus && { escrowStatus }) }),
      });
      if (!res.ok) return null;
      const data: ShipmentRoute = await res.json();
      setRoute(data);
      return data;
    } catch { return null; }
  }, []);

  const reset = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  return { route, loading, error, findRoute, createRoute, updateStatus, reset };
}
