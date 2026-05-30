import { api } from "./api";
import type { User } from "../types";

export function fetchUsers() {
  return api<User[]>("/api/v1/users", { params: { limit: 200 } });
}
export function registerUser(data: { email: string; fullName: string; role: string; password: string; tenantId: string }) {
  return api<User>("/api/v1/users/register", { method: "POST", body: data });
}
export function updateUser(id: string, data: { fullName?: string; role?: string; status?: string }) {
  return api<User>(`/api/v1/users/${id}`, { method: "PATCH", body: data });
}
