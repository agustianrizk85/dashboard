/* Shared auth-admin API helpers for the Admin panel (accounts + AI key). */

/** Auth base — prod serves auth at "/api" (Apache proxies to auth-be). */
export const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "gp_dashboard_token";

export function authHeaders(): HeadersInit {
  return {
    Authorization: "Bearer " + (localStorage.getItem(TOKEN_KEY) ?? ""),
    "Content-Type": "application/json",
  };
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  super: boolean;
  roles?: Record<string, string>;
}
