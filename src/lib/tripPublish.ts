// ── P2 (CMD-22) — the server trip write ────────────────────────────────────────
//
// THE BUG THIS FIXES: no trip registered through the UI has ever reached the server. The traveler
// form wrote a local `Store` mirror, an approval row and a route — but never called
// /api/trips/publish. So `orders/trips.json` only ever held hand-seeded rows, and every real trip
// was invisible to matcher.match(), to suggest.countries()/forTraveler() (S1/S2) and to the S3
// route digest. This module is the missing call.
//
// Written FRESH rather than restored from stash@{0}. The stashed implementation had two silent
// corruption bugs that this one must not repeat — see the ISO2 notes below.
//
// Shared on purpose: TravelerPage (live flow) calls it today, and TravelerRegisterShell will call
// the SAME function once P3 gives it fields. Two publish paths would eventually disagree about the
// corridor contract, which is precisely the failure mode this file exists to prevent.

export type TripMode = 'air' | 'land' | 'rail' | 'sea';

// ── THE ONE country source ──────────────────────────────────────────────────────
// CMD-23: this canonical list is the single source of truth for corridor countries. The ISO2
// resolver (below) is DERIVED from it, and the P3 country picker (TravelerRegisterShell) imports
// COUNTRIES directly. This is deliberately NOT an 8th copy of the duplicated 7-country tax/currency
// table (CMD-17 ticket 3): it is the ONE place that maps a corridor country to its ISO2 code, and
// everything that needs a country list reads it here.
//
// `en` MUST match the `country` spelling in airports.ts exactly (USA / UAE / United Kingdom /
// South Korea / Saudi Arabia) — air mode resolves a trip via origin.country, so a mismatch would
// silently fail the ISO2 lookup for that country. Verified against all 41 airports.ts values.
export interface Country { iso2: string; en: string; fa: string; flag: string; }

export const COUNTRIES: Country[] = [
  { iso2: 'AF', en: 'Afghanistan',    fa: 'افغانستان',      flag: '🇦🇫' },
  { iso2: 'AM', en: 'Armenia',        fa: 'ارمنستان',       flag: '🇦🇲' },
  { iso2: 'AU', en: 'Australia',      fa: 'استرالیا',       flag: '🇦🇺' },
  { iso2: 'AT', en: 'Austria',        fa: 'اتریش',          flag: '🇦🇹' },
  { iso2: 'AZ', en: 'Azerbaijan',     fa: 'آذربایجان',      flag: '🇦🇿' },
  { iso2: 'BH', en: 'Bahrain',        fa: 'بحرین',          flag: '🇧🇭' },
  { iso2: 'BE', en: 'Belgium',        fa: 'بلژیک',          flag: '🇧🇪' },
  { iso2: 'CA', en: 'Canada',         fa: 'کانادا',         flag: '🇨🇦' },
  { iso2: 'CN', en: 'China',          fa: 'چین',            flag: '🇨🇳' },
  { iso2: 'CZ', en: 'Czechia',        fa: 'جمهوری چک',      flag: '🇨🇿' },
  { iso2: 'DK', en: 'Denmark',        fa: 'دانمارک',        flag: '🇩🇰' },
  { iso2: 'FI', en: 'Finland',        fa: 'فنلاند',         flag: '🇫🇮' },
  { iso2: 'FR', en: 'France',         fa: 'فرانسه',         flag: '🇫🇷' },
  { iso2: 'GE', en: 'Georgia',        fa: 'گرجستان',        flag: '🇬🇪' },
  { iso2: 'DE', en: 'Germany',        fa: 'آلمان',          flag: '🇩🇪' },
  { iso2: 'GR', en: 'Greece',         fa: 'یونان',          flag: '🇬🇷' },
  { iso2: 'HU', en: 'Hungary',        fa: 'مجارستان',       flag: '🇭🇺' },
  { iso2: 'IN', en: 'India',          fa: 'هند',            flag: '🇮🇳' },
  { iso2: 'IR', en: 'Iran',           fa: 'ایران',          flag: '🇮🇷' },
  { iso2: 'IQ', en: 'Iraq',           fa: 'عراق',           flag: '🇮🇶' },
  { iso2: 'IT', en: 'Italy',          fa: 'ایتالیا',        flag: '🇮🇹' },
  { iso2: 'JP', en: 'Japan',          fa: 'ژاپن',           flag: '🇯🇵' },
  { iso2: 'KW', en: 'Kuwait',         fa: 'کویت',           flag: '🇰🇼' },
  { iso2: 'MY', en: 'Malaysia',       fa: 'مالزی',          flag: '🇲🇾' },
  { iso2: 'NL', en: 'Netherlands',    fa: 'هلند',           flag: '🇳🇱' },
  { iso2: 'NO', en: 'Norway',         fa: 'نروژ',           flag: '🇳🇴' },
  { iso2: 'OM', en: 'Oman',           fa: 'عمان',           flag: '🇴🇲' },
  { iso2: 'PK', en: 'Pakistan',       fa: 'پاکستان',        flag: '🇵🇰' },
  { iso2: 'PL', en: 'Poland',         fa: 'لهستان',         flag: '🇵🇱' },
  { iso2: 'PT', en: 'Portugal',       fa: 'پرتغال',         flag: '🇵🇹' },
  { iso2: 'QA', en: 'Qatar',          fa: 'قطر',            flag: '🇶🇦' },
  { iso2: 'SA', en: 'Saudi Arabia',   fa: 'عربستان سعودی',  flag: '🇸🇦' },
  { iso2: 'SG', en: 'Singapore',      fa: 'سنگاپور',        flag: '🇸🇬' },
  { iso2: 'KR', en: 'South Korea',    fa: 'کره جنوبی',      flag: '🇰🇷' },
  { iso2: 'ES', en: 'Spain',          fa: 'اسپانیا',        flag: '🇪🇸' },
  { iso2: 'SE', en: 'Sweden',         fa: 'سوئد',           flag: '🇸🇪' },
  { iso2: 'CH', en: 'Switzerland',    fa: 'سوئیس',          flag: '🇨🇭' },
  { iso2: 'TR', en: 'Turkey',         fa: 'ترکیه',          flag: '🇹🇷' },
  { iso2: 'AE', en: 'UAE',            fa: 'امارات',         flag: '🇦🇪' },
  { iso2: 'US', en: 'USA',            fa: 'ایالات متحده',   flag: '🇺🇸' },
  { iso2: 'GB', en: 'United Kingdom', fa: 'بریتانیا',       flag: '🇬🇧' },
];

// name → ISO2, DERIVED from COUNTRIES (both en and fa resolve) plus free-text aliases. Not a
// second hand-maintained copy — it is generated from the list above every load.
const ISO2: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of COUNTRIES) { m[c.en] = c.iso2; m[c.fa] = c.iso2; }
  // aliases: spellings seen elsewhere in the codebase or likely from free-text entry
  Object.assign(m, {
    'United States': 'US', 'United States of America': 'US', UK: 'GB', 'Great Britain': 'GB',
    'United Arab Emirates': 'AE', 'Korea, South': 'KR', 'South Korea (ROK)': 'KR',
    Russia: 'RU', 'Hong Kong': 'HK', 'Czech Republic': 'CZ', Turkiye: 'TR', Türkiye: 'TR',
  });
  return m;
})();

// Resolve a country to ISO2, or null if we cannot do it HONESTLY.
//
// THE HARD CONTRACT: matcher.destOf(), suggest.corridorStats() and suggest.forTraveler() all
// compare `trip.to` / `trip.from` against two-letter codes. A city name or an unmapped country
// name posted into those fields does not throw and does not warn — it simply matches nothing, so
// the trip is written, looks fine in "my trips", and is silently invisible to the entire
// marketplace. That is the worst failure shape available to us, so this returns null and the
// caller REFUSES TO PUBLISH rather than writing a corridor we know is dead.
export function toISO2(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();   // already ISO2
  return ISO2[raw] ?? ISO2[raw.replace(/\s+/g, ' ')] ?? null;
}

export interface TripPublishInput {
  /** ISO2, or a country NAME this module can resolve. Never a city. */
  fromCountry: string | null | undefined;
  toCountry:   string | null | undefined;
  date:        string;
  capacityKg:  number | null;
  minPricePerKg?: number | null;
  note?: string;
  /** absent ⇒ server treats as 'air' */
  mode?: TripMode;
  userId: string;
  travelerName?: string | null;
}

export interface TripPublishResult {
  ok: boolean;
  tripId?: string;
  offersCreated?: number;
  /** machine-readable; the caller decides what the user sees */
  error?: string;
}

export async function publishTrip(input: TripPublishInput): Promise<TripPublishResult> {
  // Fail early and specifically. The server 401s without a userId anyway, but a local check gives
  // the caller a reason string instead of an opaque status.
  if (!input.userId) return { ok: false, error: 'login_required' };

  const from = toISO2(input.fromCountry);
  const to   = toISO2(input.toCountry);
  if (!from) return { ok: false, error: `iso2_unresolved:from:${input.fromCountry ?? ''}` };
  if (!to)   return { ok: false, error: `iso2_unresolved:to:${input.toCountry ?? ''}` };

  try {
    const res = await fetch('/api/trips/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        date:          input.date || null,
        capacityKg:    input.capacityKg,
        capacityBags:  1,
        minPricePerKg: input.minPricePerKg ?? null,
        note:          input.note || '',
        mode:          input.mode || 'air',
        userId:        input.userId,
        travelerName:  input.travelerName || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d?.ok || !d?.tripId) {
      return { ok: false, error: d?.error || `http_${res.status}` };
    }
    return { ok: true, tripId: d.tripId, offersCreated: d.offersCreated ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'network_error' };
  }
}
