import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../config/api";

const TOKEN_KEY = "agrored_jwt";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export interface ApiError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, params, headers = {}, skipAuth = false } = options;

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: json.error?.code ?? "UNKNOWN_ERROR",
        message: json.error?.message ?? "Error desconocido",
      };
    }

    return { ok: true, status: response.status, data: json.data ?? json };
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      message: isAbort
        ? "La solicitud ha excedido el tiempo de espera."
        : "No se pudo conectar al servidor.",
    };
  }
}
