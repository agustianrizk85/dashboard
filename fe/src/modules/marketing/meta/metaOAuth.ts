// Meta (Facebook) OAuth — multi-account connection management for the unified
// dashboard's Marketing module. The Meta App credentials and per-account access
// tokens live server-side (marketing backend :8086); the browser only ever sees
// metadata. The active connection drives every /meta/* data endpoint, so the
// Ads / WhatsApp / Instagram tabs follow whichever account is switched on here.
import { api, tokenStore } from "../services/api";

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

// Absolute marketing-backend origin. The OAuth login is a top-level popup
// navigation, so it can't ride the axios relative base — it needs the full URL
// and carries the bearer as ?token= (a popup can't set an Authorization header,
// same pattern as the realtime /ws endpoint).
const MARKETING_ORIGIN = (
  (import.meta.env.VITE_MARKETING_API as string | undefined) ?? "http://localhost:8086"
).replace(/\/$/, "");

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
    `${MARKETING_ORIGIN}/api/meta/oauth/login?token=${encodeURIComponent(tokenStore.get() ?? "")}`,
};
