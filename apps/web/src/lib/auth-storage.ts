import type { AuthTokens, SafeUser } from "@education-erp/api-client";

// localStorage is a deliberate Phase-1 shortcut, not a production
// pattern: it's readable by any script on the page, so an XSS bug here
// is a session-theft bug. Production should move token storage behind
// an httpOnly-cookie session (e.g. a Next.js route-handler BFF in front
// of services/api) before this app handles real student/staff data.
const STORAGE_KEY = "education-erp.session";

interface StoredSession {
  tokens: AuthTokens;
  user: SafeUser;
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStoredSession()?.tokens.accessToken ?? null;
}

// useSyncExternalStore plumbing: localStorage is external state, so
// React reads it through a cached snapshot + subscription rather than
// a useEffect-triggered setState (which the react-hooks lint rule
// correctly flags as a cascading-render hazard).
type Listener = () => void;
const listeners = new Set<Listener>();
let cachedUser: SafeUser | null = getStoredSession()?.user ?? null;

function refreshCache() {
  cachedUser = getStoredSession()?.user ?? null;
  for (const listener of listeners) listener();
}

export function setStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  refreshCache();
}

export function subscribeToSession(listener: Listener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) refreshCache();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getUserSnapshot(): SafeUser | null {
  return cachedUser;
}

export function getUserServerSnapshot(): SafeUser | null {
  return null;
}
