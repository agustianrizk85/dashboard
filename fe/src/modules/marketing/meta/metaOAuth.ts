// Meta (Facebook) connection management for the unified dashboard's Marketing
// module. Accounts (System User tokens / OAuth) live server-side in metaapi —
// the SAME service that serves Ads / WhatsApp / Instagram data — so managing
// connections here directly affects what those tabs aggregate. The browser only
// ever sees metadata; tokens stay on the backend. Base via VITE_META_API (same
// as metaApi.ts) so connection + data calls hit one backend.
import axios from "axios";
import { tokenStore } from "../services/api";

const META_ORIGIN = ((import.meta.env.VITE_META_API as string | undefined) ?? "http://localhost:8097").replace(/\/$/, "");
const api = axios.create({ baseURL: `${META_ORIGIN}/api`, headers: { "Content-Type": "application/json" } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gp_dashboard_token") || tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token for the OAuth popup (top-level nav can't set a header) — SSO token first.
const popupToken = () => localStorage.getItem("gp_dashboard_token") || tokenStore.get() || "";

// OAuth app config. The secret is write-only — set once, never returned.
export interface MetaOAuthConfig {
  app_id: string;
  redirect_uri: string;
  api_version: string;
  scopes: string;
  has_secret: boolean;
  configured: boolean;
  connections: number;
}

// One connected Meta account. The access token stays on the backend.
export interface MetaConnection {
  id: number;
  label: string;
  meta_user_id: string;
  meta_user_name: string;
  token_expires_at: string | null;
  business_id: string;
  ad_account_id: string;
  scopes: string;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface SaveConfigInput {
  app_id?: string;
  app_secret?: string;
  redirect_uri?: string;
  api_version?: string;
  scopes?: string;
}

export interface UpdateConnectionInput {
  label?: string;
  ad_account_id?: string;
  business_id?: string;
}

export const metaOAuth = {
  getConfig: () => api.get<MetaOAuthConfig>("/meta/oauth/config").then((r) => r.data),

  saveConfig: (body: SaveConfigInput) =>
    api.put<MetaOAuthConfig>("/meta/oauth/config", body).then((r) => r.data),

  listConnections: () =>
    api
      .get<{ connections: MetaConnection[]; count: number }>("/meta/connections")
      .then((r) => r.data.connections),

  activate: (id: number) =>
    api
      .post<{ connections: MetaConnection[] }>(`/meta/connections/${id}/activate`)
      .then((r) => r.data.connections),

  update: (id: number, body: UpdateConnectionInput) =>
    api
      .patch<{ connections: MetaConnection[] }>(`/meta/connections/${id}`, body)
      .then((r) => r.data.connections),

  disconnect: (id: number) =>
    api
      .delete<{ connections: MetaConnection[] }>(`/meta/connections/${id}`)
      .then((r) => r.data.connections),

  // Tempel token manual (mis. System User token) — tanpa popup OAuth / redirect
  // URI. Backend memvalidasi token, menyimpannya, dan menjadikannya akun aktif.
  connectManual: (accessToken: string, label?: string) =>
    api
      .post<{ connections: MetaConnection[] }>("/meta/connections/manual", {
        access_token: accessToken,
        label,
      })
      .then((r) => r.data.connections),

  loginUrl: () =>
    `${META_ORIGIN}/api/meta/oauth/login?token=${encodeURIComponent(popupToken())}`,
};
