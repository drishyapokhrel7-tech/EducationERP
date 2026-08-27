import { createApiClient } from "@education-erp/api-client";
import { getPlatformAccessToken } from "./platform-session";

// A second createApiClient instance whose token accessor reads the
// platform session's own storage key — never education-erp.session.
// The same factory as the tenant `api` (@/lib/api.ts), just pointed
// at a different token source, since the underlying HTTP client logic
// (attach Bearer token, parse JSON, throw ApiError on !ok) is
// identical regardless of which kind of session is active.
export const platformApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getAccessToken: getPlatformAccessToken,
});
