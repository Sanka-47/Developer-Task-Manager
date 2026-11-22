"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthUser, LoginInput, RegisterInput } from "@taskapp/shared";

import { authApi } from "@/lib/api/auth.api";
import { onSessionExpired, refreshSession } from "@/lib/api/client";
import { tokenStore } from "./token-store";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const queryClient = useQueryClient();
  const router = useRouter();
  const bootstrapped = useRef(false);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setUser(null);
      setStatus("unauthenticated");
    });

    if (!bootstrapped.current) {
      bootstrapped.current = true;

      void refreshSession()
        .then((session) => {
          if (session) {
            setUser(session.user);
            setStatus("authenticated");
          } else {
            setStatus("unauthenticated");
          }
        })
        .catch(() => setStatus("unauthenticated"));
    }

    return unsubscribe;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await authApi.login(input);
      tokenStore.set(session.accessToken);
      queryClient.clear();
      setUser(session.user);
      setStatus("authenticated");
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await authApi.register(input);
      tokenStore.set(session.accessToken);
      queryClient.clear();
      setUser(session.user);
      setStatus("authenticated");
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The local session is cleared regardless of network state.
    }
    tokenStore.clear();
    queryClient.clear();
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
