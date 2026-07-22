// ── Shared flow iconography (CMD-48 T1) ───────────────────────────────────────
//
// The traveler and cargo flows used to draw their own emoji: 📦 for a package, ✈️ for a route,
// 👗/💻/💊 for categories, ⚖️/📅/💰 for meta rows. Emoji are clip-art — they render as a
// different picture on every OS, they carry no stroke weight, and they cannot inherit a colour
// token, so no amount of CSS made the two flows look like one product.
//
// Everything visual is now a Lucide line icon at a consistent stroke, sized in the caller. One
// map, imported by every flow, so a new category can never quietly become an emoji again.
//
// COUNTRY FLAGS ARE NOT ICONS and are deliberately untouched — a flag is DATA identifying a
// country, not decoration, and no line icon substitutes for it.

import {
  Package, Pill, FileText, Shirt, Laptop, Gift, UtensilsCrossed, Sparkles, ShoppingBag,
  Plane, Bus, TrainFront, Ship, CalendarDays, Weight, DollarSign, Phone, Star,
} from 'lucide-react';

export type IconCmp = typeof Package;

// ── Cargo categories ──────────────────────────────────────────────────────────
const CARGO_ICON_MAP: Record<string, IconCmp> = {
  personal:    Package,
  documents:   FileText,
  medicine:    Pill,
  health:      Pill,
  clothing:    Shirt,
  electronics: Laptop,
  gift:        Gift,
  food:        UtensilsCrossed,
  cosmetics:   Sparkles,
  shopping:    ShoppingBag,
  other:       Package,
};

export function cargoIcon(key?: string | null): IconCmp {
  return CARGO_ICON_MAP[(key ?? '').toLowerCase()] ?? Package;
}

/** Category glyph. `className` carries the size + colour, exactly like any other Lucide icon. */
export function CargoIcon({ type, className = 'w-4 h-4' }: { type?: string | null; className?: string }) {
  const Icon = cargoIcon(type);
  return <Icon className={className} aria-hidden />;
}

// ── Travel modes ──────────────────────────────────────────────────────────────
const MODE_ICON_MAP: Record<string, IconCmp> = {
  air: Plane, land: Bus, rail: TrainFront, sea: Ship,
};
export function modeIcon(mode?: string | null): IconCmp {
  return MODE_ICON_MAP[(mode ?? 'air').toLowerCase()] ?? Plane;
}

/**
 * The origin→destination separator that used to be a bare «✈».
 * Direction-aware so the glyph points along the corridor in RTL as well as LTR.
 */
export function RouteArrow({ mode, isRTL, className = 'w-3.5 h-3.5' }:
  { mode?: string | null; isRTL?: boolean; className?: string }) {
  const Icon = modeIcon(mode);
  return (
    <Icon
      className={`${className} inline-block flex-shrink-0 text-cyan-600 align-middle`}
      style={{ transform: `rotate(${isRTL ? -90 : 90}deg)` }}
      aria-hidden
    />
  );
}

// ── Meta-row icons (date / weight / price / phone / rating) ────────────────────
export const MetaIcons = {
  Date:   CalendarDays,
  Weight: Weight,
  Price:  DollarSign,
  Phone:  Phone,
  Star:   Star,
};

/** A meta chip: line icon + value, used in trip/order cards across both flows. */
export function Meta({ icon: Icon, children, className = '' }:
  { icon: IconCmp; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" aria-hidden />
      {children}
    </span>
  );
}

/** Star rating drawn with filled/outline Lucide stars instead of ⭐/☆ characters. */
export function Stars({ value, className = 'w-3.5 h-3.5' }: { value: number; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} از ۵`}>
      {[0, 1, 2, 3, 4].map(i => (
        <Star key={i} className={`${className} ${i < n ? 'text-amber-400' : 'text-gray-300'}`}
              fill={i < n ? 'currentColor' : 'none'} aria-hidden />
      ))}
    </span>
  );
}
