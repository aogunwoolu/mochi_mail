// Mochi Plus — the single source of truth for "free vs Plus".
//
// CARDINAL RULE: free limits/content must NEVER shrink below what's free today.
// `FREE` is pinned to today's actual values; `PLUS` only raises ceilings. We
// deliberately do NOT invent brand-new restrictions on free users just so we
// have something to gate — that would be taking away, not adding.

import type { Database } from "@/types/database";

export type SupporterRow = Database["public"]["Tables"]["supporters"]["Row"];

// Today's real, in-code cap is the 5-layer studio limit (see LayerPanel /
// app/page.tsx). It's the one existing limit we can safely raise, so it's the
// only "higher limit" perk for now. Free stays at 5.
export interface Perks {
  maxLayers: number;
}

export const FREE: Perks = {
  maxLayers: 5,
};

export const PLUS: Perks = {
  maxLayers: 8,
};

/** Absolute ceiling used for restoring/rendering existing content, so a lapsed
 *  member's extra layers are never destroyed — only new layers beyond the
 *  entitlement are blocked. Always >= PLUS.maxLayers. */
export const LAYER_CEILING = PLUS.maxLayers;

export function perksFor(isPlus: boolean): Perks {
  return isPlus ? PLUS : FREE;
}

/** A membership counts as active while paid-through, including the grace state
 *  Stripe reports as `trialing`. `past_due`/`canceled` do not grant perks. */
export function isPlusActive(s?: Pick<SupporterRow, "status" | "current_period_end"> | null): boolean {
  if (!s) return false;
  const live = s.status === "active" || s.status === "trialing";
  if (!live) return false;
  if (!s.current_period_end) return true;
  return new Date(s.current_period_end).getTime() > Date.now();
}

// ── Pricing surface (display only; real charges come from Stripe Price IDs) ─────
export const PLUS_PRICING = {
  monthly: { label: "$4 / month", priceEnv: "STRIPE_PRICE_PLUS_MONTHLY" },
  yearly: { label: "$36 / year", priceEnv: "STRIPE_PRICE_PLUS_YEARLY", note: "save ~25%" },
} as const;

export type PlusPlan = keyof typeof PLUS_PRICING;

/** Suggested one-time tip amounts, in cents. */
export const TIP_AMOUNTS_CENTS = [300, 500, 1000] as const;
