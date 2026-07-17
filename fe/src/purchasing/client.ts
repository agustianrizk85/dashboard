import type { ApproverBody, PurchaseRequest } from "./types";

/**
 * Minimal, self-contained client for the cross-division Purchase Request (PR)
 * widget. Hits the SAME finance Go backend as Keuangan's own Purchasing module
 * (port 8084) but is a fresh, independent implementation — it does NOT import
 * `src/modules/keuangan/api/client.ts` to avoid cross-module coupling, since
 * this widget is dropped into 6 other division dashboards.
 *
 * Auth: every logged-in dashboard user already has a valid SSO-bridged token
 * stashed at `gp_keuangan_token` (see `src/auth/AuthContext.tsx`'s
 * `SSO_DIVISIONS` list, which includes "keuangan") — so no login/service-
 * account bridge is needed here, just read that token on every request.
 */

const ORIGIN = import.meta.env.VITE_KEUANGAN_API ?? "http://localhost:8084";
const BASE = ORIGIN + "/api";
const TOKEN_KEY = "gp_keuangan_token";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    throw new Error("Sesi tidak ditemukan — silakan login ulang.");
  }
  const headers: Record<string, string> = { Authorization: "Bearer " + token };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* body wasn't JSON — fall back below */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const purchasingApi = {
  list: (status?: string) =>
    req<PurchaseRequest[]>("GET", `/pr${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  create: (body: Partial<PurchaseRequest> & { submit: boolean }) =>
    req<PurchaseRequest>("POST", "/pr", body),
  submit: (id: string) => req<PurchaseRequest>("POST", `/pr/${encodeURIComponent(id)}/submit`),
  approve: (id: string, body: { approver: ApproverBody; note: string }) =>
    req<PurchaseRequest>("POST", `/pr/${encodeURIComponent(id)}/approve`, body),
  reject: (id: string, body: { approver: ApproverBody; note: string }) =>
    req<PurchaseRequest>("POST", `/pr/${encodeURIComponent(id)}/reject`, body),
};
