import { createApiClient } from "@education-erp/api-client";

// The JWT lives here, in the main process, for the lifetime of the app
// process only — never written to disk, never handed to the renderer.
// This is a shared exam-lab machine, not a personal device: every
// sitting starts with a fresh login and nothing is left behind for the
// next student. Contrast with apps/web's localStorage session, which its
// own code already flags as an insecure Phase-1 shortcut not fit for a
// "secure" client.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

const baseUrl = process.env.EXAM_CLIENT_API_URL ?? "http://localhost:4000";

export const apiClient = createApiClient({
  baseUrl,
  getAccessToken: () => accessToken,
});
