"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";
import { ENV } from "@/config/env";

type User = {
  id: string;
  username: string;
  email: string;
  name: string;
  picture: string | null;
  createdAt?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: { name?: string; username?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

let authCache: { user: User; timestamp: number } | null = null;
const AUTH_CACHE_TTL = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      if (authCache && Date.now() - authCache.timestamp < AUTH_CACHE_TTL) {
        setUser(authCache.user);
        setError(null);
        setLoading(false);
        return;
      }
      const data = await apiFetch<{ user: User }>(API_ENDPOINTS.auth.me);
      setUser(data.user);
      authCache = { user: data.user, timestamp: Date.now() };
      setError(null);
    } catch (err) {
      setUser(null);
      authCache = null;
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Unauthorized") || message.includes("401")) {
        setError(null);
      } else {
        setError(message || "Could not reach auth server");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    window.location.href = `${ENV.serverUrl}${API_ENDPOINTS.auth.google}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch(API_ENDPOINTS.auth.logout, { method: "POST" });
    } catch {
      // Silent fail — user will be logged out locally regardless
    } finally {
      authCache = null;
      setUser(null);
    }
  }, []);

  const updateUser = useCallback(
    async (data: { name?: string; username?: string }) => {
      await apiFetch(API_ENDPOINTS.profile.update, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      authCache = null;
      await fetchUser();
    },
    [fetchUser],
  );

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refreshUser: fetchUser, updateUser }),
    [user, loading, error, login, logout, fetchUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
