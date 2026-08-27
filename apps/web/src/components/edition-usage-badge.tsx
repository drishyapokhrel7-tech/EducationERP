import { Badge } from "@/components/ui/badge";
import type { EditionStatus } from "@education-erp/api-client";

// "N of 50 used" — so an admin sees the licensing wall coming instead
// of just hitting it on the next create attempt.
export function EditionUsageBadge({ status }: { status: EditionStatus | undefined }) {
  if (!status || status.limit === null) return null;
  return (
    <Badge variant={status.atLimit ? "destructive" : "secondary"}>
      {status.studentCount + status.employeeCount} of {status.limit} records used
    </Badge>
  );
}
