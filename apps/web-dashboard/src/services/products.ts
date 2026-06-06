import { api } from "./api";

export interface ProductCatalogItem {
  id: string;
  tenantId: string | null;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  inSeason: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function fetchProducts(tenantId?: string, category?: string) {
  const params: Record<string, string | undefined> = {};
  if (tenantId) params.tenantId = tenantId;
  if (category) params.category = category;
  return api<ProductCatalogItem[]>("/api/v1/products/catalog", { params });
}

export function createProduct(data: Partial<ProductCatalogItem> & { name: string; category: string }) {
  return api<ProductCatalogItem>("/api/v1/products/catalog", { method: "POST", body: data });
}

export function updateProduct(id: string, data: Partial<ProductCatalogItem>) {
  return api<ProductCatalogItem>(`/api/v1/products/catalog/${id}`, { method: "PATCH", body: data });
}

export function deleteProduct(id: string) {
  return api(`/api/v1/products/catalog/${id}`, { method: "DELETE" });
}
