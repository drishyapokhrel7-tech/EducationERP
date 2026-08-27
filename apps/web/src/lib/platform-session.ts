import type { PlatformAdminUser } from "@education-erp/api-client";

// A genuinely separate session shape from education-erp.session (see
// auth-storage.ts) — a PlatformAdmin is a different kind of identity
// entirely (cross-org, no organizationId), never mixed with the
// tenant session, same "don't let two session shapes collide"
// reasoning as the library-SSO Member/Librarian bug this project
// already fixed once.
const STORAGE_KEY = "education-erp.platform-session";

interface StoredPlatformSession {
  accessToken: string;
  admin: PlatformAdminUser;
}

export function getStoredPlatformSession(): StoredPlatformSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlatformSession;
  } catch {
    return null;
  }
}

export function setStoredPlatformSession(session: StoredPlatformSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getPlatformAccessToken(): string | null {
  return getStoredPlatformSession()?.accessToken ?? null;
}
