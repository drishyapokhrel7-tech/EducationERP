import type { Edition } from "@education-erp/api-client";

// The one shared source of truth for "what does upgrading to this
// edition actually mean" — records and modules both, so every
// edition-related message in the app stays consistent. Moved here
// from edition-upgrade-banner.tsx verbatim (that file now imports it
// instead of defining its own copy).
export const NEXT_EDITION_LABEL: Record<Edition, string> = {
  FREE: "Professional edition (max 500 records)",
  PROFESSIONAL: "Ultra edition",
  ULTRA: "Ultra edition", // unreachable — Ultra has no cap — kept for type completeness
};

// A direct "name this edition" lookup, as opposed to NEXT_EDITION_LABEL's
// "name the edition one step up from here" — FeatureLock needs the
// former: a Free-tier org hitting an Ultra-gated feature must be told
// "Ultra edition," not "Professional edition" (which NEXT_EDITION_LABEL
// keyed off their current Free tier would incorrectly suggest is
// enough). Record-cap wording included for the same consistency
// reasoning as NEXT_EDITION_LABEL.
export const EDITION_DISPLAY_NAME: Record<Edition, string> = {
  FREE: "Free edition",
  PROFESSIONAL: "Professional edition (max 500 records)",
  ULTRA: "Ultra edition",
};

const EDITION_RANK: Record<Edition, number> = { FREE: 0, PROFESSIONAL: 1, ULTRA: 2 };

export function meetsEdition(current: Edition, required: Edition): boolean {
  return EDITION_RANK[current] >= EDITION_RANK[required];
}

// Which minimum edition a given dashboard module needs, and the label
// to show while it's locked. Keyed by a short slug each gated page
// passes explicitly (not sniffed from the URL pathname — decouples
// the gate from Next.js routing internals, and keeps each page's own
// gating an explicit, visible line in that page's own code, matching
// this project's "each page owns its own guard" convention already
// established by dashboard/students/page.tsx's own inline
// editionStatus wiring). A plain exported constant map, same
// "not per-org configurable" precedent as
// services/api/src/modules/organizations/edition-limits.ts's own
// EDITION_LIMITS.
//
// Every dashboard nav item NOT listed here is ungated (available on
// every edition) — either genuinely "core academics," or a structural
// prerequisite gating would break (Org structure must work before
// Students/Academics can; Roles & Permissions is how an org safely
// operates at any tier, not a premium product feature).
export const FEATURE_MIN_EDITION: Record<string, { minEdition: Edition; label: string }> = {
  finance: { minEdition: "PROFESSIONAL", label: "Finance" },
  leave: { minEdition: "PROFESSIONAL", label: "Leave" },
  payroll: { minEdition: "PROFESSIONAL", label: "Payroll" },
  timetable: { minEdition: "PROFESSIONAL", label: "Timetable" },
  syllabus: { minEdition: "PROFESSIONAL", label: "Syllabus" },
  "my-classes-today": { minEdition: "PROFESSIONAL", label: "My Classes Today" },
  assignments: { minEdition: "PROFESSIONAL", label: "Assignments" },
  "knowledge-checks": { minEdition: "PROFESSIONAL", label: "Knowledge Checks" },
  "exam-setup": { minEdition: "PROFESSIONAL", label: "Exam Catalog" },
  exams: { minEdition: "PROFESSIONAL", label: "Exams" },
  "learning-dashboards": { minEdition: "PROFESSIONAL", label: "Learning Dashboards" },
  transport: { minEdition: "ULTRA", label: "Transport" },
  hostel: { minEdition: "ULTRA", label: "Hostel" },
  library: { minEdition: "ULTRA", label: "Library" },
  inventory: { minEdition: "ULTRA", label: "Inventory" },
  communication: { minEdition: "ULTRA", label: "Communication" },
  documents: { minEdition: "ULTRA", label: "Documents" },
  "biometric-policy": { minEdition: "ULTRA", label: "Biometric" },
  cameras: { minEdition: "ULTRA", label: "Cameras" },
  alumni: { minEdition: "ULTRA", label: "Alumni" },
  analytics: { minEdition: "ULTRA", label: "Analytics & Reports" },
  overview: { minEdition: "ULTRA", label: "Highlights" },
};
