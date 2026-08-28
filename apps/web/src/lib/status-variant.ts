import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Exact-match sets, not substring checks — the previous substring
// version (`s.includes("ACTIVE")`) matched "INACTIVE" as a false
// positive (checked before "DESTRUCTIVE" ever got a turn), rendering
// inactive students/vehicles as a green "success" badge. Built from
// every distinct value across every *Status/*Result/*Decision enum in
// schema.prisma (33 enums, 61 distinct values) — a status this
// project adds later that isn't in any set below just falls through
// to "secondary" (the existing default), same as before.
const SUCCESS = new Set([
  "ACTIVE", "ACCEPTED", "APPROVED", "AVAILABLE", "COMPLETE", "COMPLETED",
  "CONFIRMED", "EMPLOYED", "ENROLLED", "FINALIZED", "GRADED", "GRADUATED",
  "IDENTIFIED", "ISSUED", "PAID", "PRESENT", "PUBLISHED", "RECEIVED",
  "RESOLVED", "SELF_EMPLOYED", "SENT", "SHORTLISTED", "VERIFIED",
]);

const WARNING = new Set([
  "DRAFT", "HALF_DAY", "INITIATED", "INTERVIEW_SCHEDULED", "INVITED",
  "IN_PROGRESS", "LATE", "MAINTENANCE", "ON_LEAVE", "OPEN", "ORDERED",
  "PARTIALLY_PAID", "PENDING", "POSSIBLE_MATCH", "REQUESTED", "SCHEDULED",
  "SUBMITTED", "UNDER_REVIEW", "UNEMPLOYED_SEEKING",
]);

const DESTRUCTIVE = new Set([
  "ABSENT", "CANCELED", "CANCELLED", "DEACTIVATED", "DECLINED", "FAILED",
  "INACTIVE", "REJECTED", "REVOKED", "SUSPENDED", "TERMINATED",
  "TRANSFERRED", "UNKNOWN", "WITHDRAWN",
]);

/**
 * Maps a status/result string from any of this app's many status enums
 * (StudentStatus, AttendanceStatus, FaceMatchResult, admission review
 * status, etc.) to a Badge variant. Status vocabularies vary across
 * domains, but the "good / needs attention / bad" grouping they map
 * onto is consistent — so this is one shared exact-match lookup rather
 * than a per-enum switch repeated at every call site.
 */
export function statusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase();
  if (SUCCESS.has(s)) return "success";
  if (WARNING.has(s)) return "warning";
  if (DESTRUCTIVE.has(s)) return "destructive";
  return "secondary";
}
