import { apiRequest } from "./api";
import { setToken } from "./api";
import { ENDPOINTS } from "../config/api";
import type { LoginRequest, LoginResponse } from "../types";

export async function login(credentials: LoginRequest) {
  const result = await apiRequest<LoginResponse>(ENDPOINTS.login, {
    method: "POST",
    body: credentials,
    skipAuth: true,
  });

  if (result.ok) {
    await setToken(result.data.token);
  }

  return result;
}

export async function registerUser(data: {
  tenantId: string;
  email: string;
  password: string;
  fullName: string;
  role?: string;
}) {
  return apiRequest(ENDPOINTS.register, {
    method: "POST",
    body: data,
    skipAuth: true,
  });
}
