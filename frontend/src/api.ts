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
  account_type?: "business" | "personal";
  status?: "pending" | "approved" | "rejected";
};

export type Product = {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  origin: string;
  unit: string;
  sell_unit: "kg" | "piece";
  price: number;
  price_kg?: number | null;
  price_piece?: number | null;
  price_kg_ttc?: number | null;
  price_piece_ttc?: number | null;
  cagette_content_pieces?: number | null;
  cagette_content_kg?: number | null;
  season?: "summer" | "winter" | "all";
  image_url: string;
  description: string;
};

export type CartItem = {
  product_id: string;
  name: string;
  unit: string;
  sell_unit: "kg" | "piece" | "cagette";
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
  registerPersonal: (body: {
    full_name: string;
    email: string;
    phone: string;
    delivery_address: string;
    password: string;
  }) => request<{ access_token: string; user: User }>("/auth/register-personal", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  deleteMe: () => request<void>("/auth/me", { method: "DELETE" }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  products: (category?: string) =>
    request<Product[]>(`/products${category && category !== "Tous" ? `?category=${encodeURIComponent(category)}` : ""}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  categories: () => request<{ categories: string[] }>("/products/categories"),
  subcategories: (category?: string) =>
    request<{ by_category: Record<string, string[]> }>(
      `/products/subcategories${category && category !== "Tous" ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),
  createOrder: (items: CartItem[], notes = "") =>
    request<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({ items, notes }),
    }),
  orders: () => request<Order[]>("/orders"),
  orderHabits: (limit = 8) => request<Product[]>(`/orders/habits?limit=${limit}`),

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
  adminPending: () => request<User[]>("/admin/pending"),
  adminApprove: (id: string) =>
    request<User>(`/admin/pending/${id}/approve`, { method: "POST" }),
  adminReject: (id: string) =>
    request<User>(`/admin/pending/${id}/reject`, { method: "POST" }),
  getBanner: () => request<{ image_url: string | null }>("/banner"),
  setBanner: (image_url: string) =>
    request<{ image_url: string }>("/admin/banner", {
      method: "PUT",
      body: JSON.stringify({ image_url }),
    }),
  deleteBanner: () => request<void>("/admin/banner", { method: "DELETE" }),

  // ============ Login cover image ============
  getLoginCover: () => request<{ image_url: string | null }>("/login-cover"),
  setLoginCover: (image_url: string) =>
    request<{ image_url: string }>("/admin/login-cover", {
      method: "PUT",
      body: JSON.stringify({ image_url }),
    }),
  deleteLoginCover: () => request<void>("/admin/login-cover", { method: "DELETE" }),

  // ============ Catalog watermark ============
  getWatermark: () => request<{ image_url: string | null }>("/watermark"),
  setWatermark: (image_url: string) =>
    request<{ image_url: string }>("/admin/watermark", {
      method: "PUT",
      body: JSON.stringify({ image_url }),
    }),
  deleteWatermark: () => request<void>("/admin/watermark", { method: "DELETE" }),

  // ============ Our Story ============
  getOurStory: () =>
    request<{ title: string; body: string; images: string[] }>("/our-story"),
  setOurStory: (title: string, body: string, images: string[]) =>
    request<{ title: string; body: string; images: string[] }>("/admin/our-story", {
      method: "PUT",
      body: JSON.stringify({ title, body, images }),
    }),

  // ============ Season (global) ============
  getSeason: () => request<{ season: "summer" | "winter" | "all" }>("/settings/season"),
  setSeason: (season: "summer" | "winter" | "all") =>
    request<{ season: string }>("/admin/settings/season", {
      method: "PUT",
      body: JSON.stringify({ season }),
    }),
};
