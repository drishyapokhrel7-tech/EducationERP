import type { Edition } from "@education-erp/api-client";

interface EditionLimitBody {
  error: "EDITION_LIMIT_EXCEEDED";
  edition: Edition;
  limit: number;
}

// Type guard for ApiError.body — see EditionLimitExceededException on
// the backend for the exact shape thrown. Shared by the Students and
// Staff create forms, the two places this can actually happen.
export function isEditionLimitError(body: unknown): body is EditionLimitBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    (body as { error: unknown }).error === "EDITION_LIMIT_EXCEEDED"
  );
}
