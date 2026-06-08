// Fetches a Google Maps Tiles API session token and returns a CesiumJS
// UrlTemplateImageryProvider-compatible URL.
// Session tokens are valid for ~2 weeks; cached in module scope.

interface TileSession { url: string; exp: number }

let _cached: TileSession | null = null;
let _inflight: Promise<string | null> | null = null;

export async function getGoogleSatTileUrl(): Promise<string | null> {
  const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ?? '';
  if (!key) return null;

  // Return cached session if still valid (5-min buffer)
  if (_cached && Date.now() < _cached.exp - 300_000) return _cached.url;

  // Deduplicate concurrent callers
  if (_inflight) return _inflight;

  _inflight = fetch(
    `https://tile.googleapis.com/v1/createSession?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' }),
    }
  )
    .then(r => (r.ok ? r.json() : null))
    .then((data): string | null => {
      if (!data?.session) return null;
      const url =
        `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}` +
        `?session=${data.session}&key=${key}`;
      // expiry is in Unix seconds; default to 14 days if missing
      const exp =
        (parseInt(data.expiry ?? '0', 10) ||
          Math.floor(Date.now() / 1000) + 14 * 24 * 3600) * 1000;
      _cached = { url, exp };
      return url;
    })
    .catch((): null => null)
    .finally(() => { _inflight = null; });

  return _inflight;
}
