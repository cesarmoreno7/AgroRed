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

  useEffect(() => {
    const t = getToken();
    if (t) {
      const u = decodeJwt(t);
      if (u) setUser(u);
      else removeToken();
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await loginApi(email, password);
    if (!res.ok) return res.message;
    setToken(res.data.token);
    setUser(res.data.user);
    return null;
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, isLoading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
