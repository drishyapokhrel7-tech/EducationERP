import { createApiClient } from "@education-erp/api-client";
import { applyRefreshedTokens, getAccessToken, getRefreshToken, setStoredSession } from "./auth-storage";

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getAccessToken,
  getRefreshToken,
  onTokensRefreshed: applyRefreshedTokens,
  // Refresh failed / refresh token itself expired — drop the session
  // so the dashboard layout's auth gate redirects to /login instead of
  // the app sitting on repeated 401s.
  onAuthLost: () => setStoredSession(null),
});
