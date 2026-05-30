import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken, setToken, removeToken } from "../services/api";
import { login as loginApi } from "../services/dashboard";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const Ctx = createContext<AuthState | undefined>(undefined);

function decodeJwt(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    // Reject expired tokens before any render
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (!payload.sub || !payload.role) return null;
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const t = getToken();
    if (t) {
      const u = decodeJwt(t);
      if (u) setUser(u);
      else { removeToken(); }
    }
    setIsLoading(false);
  }, []);

  // Auto-logout when the server returns 401 (expired or revoked token)
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("agrored:session_expired", handler);
    return () => window.removeEventListener("agrored:session_expired", handler);
  }, [logout]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await loginApi(email, password);
    if (!res.ok) return res.message;
    setToken(res.data.token);
    setUser(decodeJwt(res.data.token));
    return null;
  }, []);

  return <Ctx.Provider value={{ user, isLoading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
