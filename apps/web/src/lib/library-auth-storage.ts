"use client";

import { useSyncExternalStore } from "react";

// Two independent sessions alongside the ERP's own (`auth-storage.ts`) —
// one for staff (dashboard, LIBRARIAN/ADMINISTRATOR) and one for members
// (portal, MEMBER). Deliberately separate storage keys, not one shared
// session: a browser that's ever held a staff login must never have the
// portal page silently reuse it and render staff-wide data as if it were
// "my own" loans/fines/reservations — a real bug caught in this slice's
// own browser verification pass, not a hypothetical. Same Phase-1
// localStorage shortcut as the ERP session; see that file's comment on
// why this isn't production-grade token storage.

export interface LibrarySessionUser {
  id: number;
  name: string;
  role: "MEMBER" | "LIBRARIAN" | "ADMINISTRATOR";
}

export interface StoredLibrarySession {
  accessToken: string;
  user: LibrarySessionUser;
}

function createSessionStore(storageKey: string) {
  function getStoredSession(): StoredLibrarySession | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredLibrarySession;
    } catch {
      return null;
    }
  }

  function getAccessToken(): string | null {
    return getStoredSession()?.accessToken ?? null;
  }

  type Listener = () => void;
  const listeners = new Set<Listener>();
  let cachedSession: StoredLibrarySession | null = getStoredSession();

  function refreshCache() {
    cachedSession = getStoredSession();
    for (const listener of listeners) listener();
  }

  function setStoredSession(session: StoredLibrarySession | null) {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(storageKey);
    }
    refreshCache();
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) refreshCache();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function getSnapshot() {
    return cachedSession;
  }

  function getServerSnapshot() {
    return null;
  }

  function useSession(): StoredLibrarySession | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  return { getStoredSession, getAccessToken, setStoredSession, useSession };
}

// Staff (dashboard) session — Librarian/Administrator.
const staffStore = createSessionStore("education-erp.library-staff-session");
export const getLibraryStaffAccessToken = staffStore.getAccessToken;
export const setStoredLibraryStaffSession = staffStore.setStoredSession;
export const useLibraryStaffSession = staffStore.useSession;

// Member (portal) session — the student's own erp-login result.
const memberStore = createSessionStore("education-erp.library-member-session");
export const getLibraryMemberAccessToken = memberStore.getAccessToken;
export const setStoredLibraryMemberSession = memberStore.setStoredSession;
export const useLibraryMemberSession = memberStore.useSession;
