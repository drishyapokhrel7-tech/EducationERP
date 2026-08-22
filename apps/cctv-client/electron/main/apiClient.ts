import { app, safeStorage } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createApiClient } from "@education-erp/api-client";

// Unlike apps/exam-client's in-memory-only JWT (justified there by
// "shared exam-lab machine, re-login each session is fine"), this
// client runs unattended at a fixed camera/gate station — requiring a
// human to re-enter credentials after every restart isn't tenable.
// The access token stays in-memory only (short-lived, 15 min), but
// the refresh token (30-day rolling TTL server-side) is persisted to
// disk, encrypted via Electron's own OS-level safeStorage, so the app
// can silently resume a session across restarts.
let accessToken: string | null = null;
let refreshToken: string | null = null;

const baseUrl = process.env.CCTV_CLIENT_API_URL ?? "http://localhost:4000";

export const apiClient = createApiClient({
  baseUrl,
  getAccessToken: () => accessToken,
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

function tokenFilePath(): string {
  return join(app.getPath("userData"), "session.enc");
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
  const path = tokenFilePath();
  if (!token) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  // Fail closed if OS-level encryption isn't available on this
  // machine — never write an unencrypted token to disk. The session
  // simply won't survive a restart there; a human logs in again.
  if (!safeStorage.isEncryptionAvailable()) return;
  writeFileSync(path, safeStorage.encryptString(token));
}

export function loadPersistedRefreshToken(): string | null {
  const path = tokenFilePath();
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(readFileSync(path));
  } catch {
    return null;
  }
}
