import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getToken, removeToken } from "../services/api";
import { login as loginApi } from "../services/auth.service";
import type { User, LoginRequest } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function userFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: payload.sub as string,
    tenantId: payload.tenantId as string,
    email: payload.email as string,
    fullName: payload.fullName as string,
    role: payload.role as string,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const decoded = userFromToken(token);
        if (decoded) {
          setUser(decoded);
        } else {
          await removeToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await loginApi(credentials);
    if (result.ok) {
      setUser(result.data.user);
      return { ok: true };
    }
    return { ok: false, message: "message" in result ? result.message : "Error de autenticación" };
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
