const TOKEN_KEY = "agrored_jwt";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export interface ApiOk<T> { ok: true; status: number; data: T }
export interface ApiErr { ok: false; status: number; code: string; message: string }
export type ApiResult<T> = ApiOk<T> | ApiErr;

// VITE_API_BASE_URL = "" means requests go to the same origin (Vite dev proxy handles /api → gateway).
// In production set VITE_API_BASE_URL to the gateway URL, e.g. https://gateway.agrored.co
const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE_URL ?? "";

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = API_BASE ? API_BASE.replace(/\/$/, "") : window.location.origin;
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, params } = opts;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(tid);
    const json = await res.json();
    if (!res.ok) {
      // Emit session-expired event so AuthProvider can auto-logout
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("agrored:session_expired"));
      }
      return { ok: false, status: res.status, code: json.error?.code ?? "UNKNOWN", message: json.error?.message ?? "Error" };
    }
    return { ok: true, status: res.status, data: (json.data ?? json) as T };
  } catch {
    clearTimeout(tid);
    return { ok: false, status: 0, code: "NETWORK_ERROR", message: "Error de conexión" };
  }
}
