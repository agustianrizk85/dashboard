// Shared data-loading plumbing for the Purchasing views. Same self-relogin
// pattern as KeuanganView / ARView: the finance backend is reached through a
// shared service account, and a 401 (AuthError) triggers one transparent
// re-login before surfacing the error.

import { api, AuthError } from "../api/client";

/** Shared service account — identical to the akad dashboard / AR view. */
export const FIN_USER = { user: "admin", pass: "admin123" };

/** Run an authenticated call, logging in first if needed and retrying once on 401. */
export async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  if (!api.hasToken()) await api.login(FIN_USER.user, FIN_USER.pass);
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) {
      await api.login(FIN_USER.user, FIN_USER.pass);
      return await fn();
    }
    throw e;
  }
}

export type LoadState<T> =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: T; error: "" }
  | { status: "error"; data: null; error: string };

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
