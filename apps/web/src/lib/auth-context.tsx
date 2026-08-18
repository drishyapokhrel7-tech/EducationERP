"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { LoginInput, RegisterOrganizationInput, SafeUser } from "@education-erp/api-client";
import { api } from "./api";
import {
  getStoredSession,
  getUserServerSnapshot,
  getUserSnapshot,
  setStoredSession,
  subscribeToSession,
} from "./auth-storage";

interface AuthContextValue {
  user: SafeUser | null;
  login: (input: LoginInput) => Promise<void>;
  registerOrganization: (input: RegisterOrganizationInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribeToSession, getUserSnapshot, getUserServerSnapshot);

  async function login(input: LoginInput) {
    const result = await api.login(input);
    setStoredSession({ tokens: result, user: result.user });
  }

  async function registerOrganization(input: RegisterOrganizationInput) {
    const result = await api.registerOrganization(input);
    setStoredSession({ tokens: result, user: result.user });
  }

  async function logout() {
    const refreshToken = getStoredSession()?.tokens.refreshToken;
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    setStoredSession(null);
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
