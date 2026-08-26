import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const SUCCESS = ["ACTIVE", "PRESENT", "IDENTIFIED", "APPROVED", "CONFIRMED", "PUBLISHED", "COMPLETED", "GRADUATED", "ENROLLED", "FINALIZED"];
const WARNING = ["LATE", "POSSIBLE_MATCH", "PENDING", "HALF_DAY", "ON_LEAVE", "SUBMITTED", "DRAFT", "IN_PROGRESS"];
const DESTRUCTIVE = ["ABSENT", "WITHDRAWN", "REJECTED", "INACTIVE", "UNKNOWN", "TRANSFERRED", "CANCELLED", "FAILED"];

/**
 * Maps a status/result string from any of this app's many status enums
 * (StudentStatus, AttendanceStatus, FaceMatchResult, admission review
 * status, etc.) to a Badge variant, by substring rather than a
 * per-enum switch — status vocabularies vary across domains, but the
 * "good / needs attention / bad" grouping they map onto is consistent.
 */
export function statusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase();
  if (SUCCESS.some((k) => s.includes(k))) return "success";
  if (WARNING.some((k) => s.includes(k))) return "warning";
  if (DESTRUCTIVE.some((k) => s.includes(k))) return "destructive";
  return "secondary";
}
