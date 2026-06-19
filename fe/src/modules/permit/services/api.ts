import axios, { AxiosError } from "axios";

const TOKEN_KEY = "legalpermit_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Shared axios instance. Falls back to the Vite dev proxy when no base URL set.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "/api";
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/** WebSocket URL for realtime push (null when not authenticated). Builds an
 *  absolute ws/wss URL even when the base is the relative "/api" dev proxy. */
export function realtimeURL(): string | null {
  const token = tokenStore.get();
  if (!token) return null;
  const httpBase = BASE_URL.startsWith("http") ? BASE_URL : window.location.origin + BASE_URL;
  return httpBase.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
}

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise API errors into Error messages and handle 401 globally.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      // Also drop the unified dashboard session, otherwise /login bounces us
      // straight back here (session still "in") and we redirect-loop.
      localStorage.removeItem("gp_dashboard_session");
      localStorage.removeItem("gp_dashboard_token");
      if (location.pathname !== "/login") location.assign("/login");
    }
    const message = error.response?.data?.error || error.message || "Request failed";
    return Promise.reject(new Error(message));
  },
);
