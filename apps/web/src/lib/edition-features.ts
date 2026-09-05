import type { Edition } from "@education-erp/api-client";

// The one shared source of truth for "what does upgrading to this
// edition actually mean" — records and modules both, so every
// edition-related message in the app stays consistent. Moved here
// from edition-upgrade-banner.tsx verbatim (that file now imports it
// instead of defining its own copy).
export const NEXT_EDITION_LABEL: Record<Edition, string> = {
  FREE: "Professional edition (max 500 records)",
  PROFESSIONAL: "Ultra edition (max 1000 records)",
  ULTRA: "Ultra edition", // unreachable — already at the top tier
};

// Real prices given directly by the user — per month. `null` for FREE
// (nothing to pay). Backend counterpart:
// services/api/src/modules/organizations/edition-limits.ts's own
// EDITION_PRICING_NPR — duplicated, not shared, same precedent as
// EDITION_RANK/meetsEdition immediately below.
export const EDITION_PRICING_NPR: Record<Edition, number | null> = {
  FREE: null,
  PROFESSIONAL: 5000,
  ULTRA: 10000,
};

const EDITION_RANK: Record<Edition, number> = { FREE: 0, PROFESSIONAL: 1, ULTRA: 2 };

export function meetsEdition(current: Edition, required: Edition): boolean {
  return EDITION_RANK[current] >= EDITION_RANK[required];
}
