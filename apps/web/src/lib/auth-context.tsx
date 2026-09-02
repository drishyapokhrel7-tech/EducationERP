"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { mutate as mutateGlobalSwrCache } from "swr";
import type {
  EmailVerificationChallenge,
  LoginInput,
  RegisterOrganizationInput,
  SafeUser,
} from "@education-erp/api-client";
import { api } from "./api";
import {
  getStoredSession,
  getUserServerSnapshot,
  getUserSnapshot,
  setStoredSession,
  subscribeToSession,
} from "./auth-storage";

// Every page in this app calls useSWR directly with plain string keys
// and no shared SWRConfig, so this is SWR's own default global cache.
// Neither login() nor logout() used to touch it, which meant
// switching accounts in the same browser tab (no full page reload —
// this app navigates with next/navigation throughout) could flash a
// previous session's cached data — a different organization's
// numbers/rows — for a moment before each query naturally
// revalidated under the new session. `revalidate: false` just drops
// the stale data immediately; the next mount of each page's own
// useSWR call is what re-fetches it fresh.
function clearSwrCache() {
  return mutateGlobalSwrCache(() => true, undefined, { revalidate: false });
}

interface AuthContextValue {
  user: SafeUser | null;
  login: (input: LoginInput) => Promise<void>;
  // Account is fully active + logged-in as soon as this resolves — the
  // returned challenge is only for the caller to optionally show a
  // "verify your email" prompt, not a login gate.
  registerOrganization: (input: RegisterOrganizationInput) => Promise<EmailVerificationChallenge>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribeToSession, getUserSnapshot, getUserServerSnapshot);

  async function login(input: LoginInput) {
    const result = await api.login(input);
    await clearSwrCache();
    setStoredSession({ tokens: result, user: result.user });
  }

  async function registerOrganization(input: RegisterOrganizationInput) {
    const result = await api.registerOrganization(input);
    await clearSwrCache();
    setStoredSession({ tokens: result, user: result.user });
    return result.emailVerification;
  }

  async function logout() {
    const refreshToken = getStoredSession()?.tokens.refreshToken;
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    setStoredSession(null);
    await clearSwrCache();
  }

  return (
    <AuthContext.Provider value={{ user, login, registerOrganization, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
