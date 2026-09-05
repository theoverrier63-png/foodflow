import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "lp_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.detail
      ? Array.isArray(data.detail)
        ? data.detail.map((d: any) => d.msg).join(", ")
        : String(data.detail)
      : "Erreur réseau";
    throw new Error(msg);
  }
  return data as T;
}

export type User = {
  id: string;
  company_name: string;
  siret: string;
  email: string;
  phone: string;
  delivery_address: string;
  role?: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  origin: string;
  unit: string;
  sell_unit: "kg" | "piece";
  price: number;
  price_kg?: number | null;
  price_piece?: number | null;
  image_url: string;
  description: string;
};

export type CartItem = {
  product_id: string;
  name: string;
  unit: string;
  sell_unit: "kg" | "piece";
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  user_id: string;
  company_name: string;
  delivery_address: string;
  items: CartItem[];
  total: number;
  status: string;
  notes: string;
  created_at: string;
};

export const api = {
  register: (body: {
    company_name: string;
    siret: string;
    email: string;
    phone: string;
    delivery_address: string;
    password: string;
  }) => request<{ access_token: string; user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  products: (category?: string) =>
    request<Product[]>(`/products${category && category !== "Tous" ? `?category=${encodeURIComponent(category)}` : ""}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  categories: () => request<{ categories: string[] }>("/products/categories"),
  createOrder: (items: CartItem[], notes = "") =>
    request<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({ items, notes }),
    }),
  orders: () => request<Order[]>("/orders"),

  // ============ Admin ============
  adminStatuses: () => request<{ statuses: string[] }>("/admin/statuses"),
  adminCreateProduct: (body: Omit<Product, "id" | "sell_unit" | "price">) =>
    request<Product>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
  adminUpdateProduct: (id: string, body: Omit<Product, "id" | "sell_unit" | "price">) =>
    request<Product>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  adminDeleteProduct: (id: string) =>
    request<void>(`/admin/products/${id}`, { method: "DELETE" }),
  adminOrders: () => request<Order[]>("/admin/orders"),
  adminGetOrder: (id: string) => request<Order>(`/admin/orders/${id}`),
  adminUpdateStatus: (id: string, status: string) =>
    request<Order>(`/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminInvoice: (id: string) =>
    `/admin/orders/${id}/invoice`,
  customerInvoice: (id: string) => `/orders/${id}/invoice-pdf`,
  adminExportAll: () =>
    request<{ filename: string; content: string; count: number }>("/admin/orders/export"),
};
