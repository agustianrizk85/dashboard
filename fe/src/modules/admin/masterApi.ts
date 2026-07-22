/* Master-data API helpers for the Admin panel — Master Divisi (departments) and
 * Master Role. These drive the dynamic dropdowns in the account-creation form and
 * the two management tabs. All endpoints are super-only and live under the same
 * `AUTH` base used by the rest of the admin panel. */

import { AUTH, authHeaders } from "./adminApi";

/** A division / department. Mirrors auth `config.Departments`. */
export interface Dept {
  code: string;
  name: string;
}

/** A role definition in the shared catalogue. `sort` orders the list (optional). */
export interface RoleDef {
  value: string;
  label: string;
  sort?: number;
}

async function readJson(r: Response): Promise<unknown> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = (j as { error?: string }).error;
    throw new Error(err || `HTTP ${r.status}`);
  }
  return j;
}

/** GET all departments. Returns `[{code, name}]`. */
export async function getDepartments(): Promise<Dept[]> {
  const r = await fetch(`${AUTH}/admin/departments`, { headers: authHeaders() });
  const j = await readJson(r);
  return Array.isArray(j) ? (j as Dept[]) : [];
}

/** POST upsert a department. */
export async function saveDepartment(code: string, name: string): Promise<void> {
  const r = await fetch(`${AUTH}/admin/departments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code, name }),
  });
  await readJson(r);
}

/** DELETE a department by code. */
export async function deleteDepartment(code: string): Promise<void> {
  const r = await fetch(`${AUTH}/admin/departments/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok && r.status !== 204) await readJson(r);
}

/** GET all roles. Returns `[{value, label, sort}]`. */
export async function getRoles(): Promise<RoleDef[]> {
  const r = await fetch(`${AUTH}/admin/roles`, { headers: authHeaders() });
  const j = await readJson(r);
  return Array.isArray(j) ? (j as RoleDef[]) : [];
}

/** POST upsert a role. */
export async function saveRole(value: string, label: string): Promise<void> {
  const r = await fetch(`${AUTH}/admin/roles`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ value, label }),
  });
  await readJson(r);
}

/** DELETE a role by value. */
export async function deleteRole(value: string): Promise<void> {
  const r = await fetch(`${AUTH}/admin/roles/${encodeURIComponent(value)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok && r.status !== 204) await readJson(r);
}

/* ---- Katalog Model AI (nama · kepintaran · kegunaan · score) ---------------- */

/** One curated AI model. Mirrors auth `ai.AIModel`. */
export interface AIModel {
  name: string;
  intelligence: string; // kepintaran
  useCase: string; // kegunaan
  score: number; // 0..100
}

/** GET the model catalogue (sorted by score desc on the server). */
export async function getModels(): Promise<AIModel[]> {
  const r = await fetch(`${AUTH}/admin/models`, { headers: authHeaders() });
  const j = await readJson(r);
  return Array.isArray(j) ? (j as AIModel[]) : [];
}

/** POST upsert one model (matched by name). Returns the updated catalogue. */
export async function saveModel(m: AIModel): Promise<AIModel[]> {
  const r = await fetch(`${AUTH}/admin/models`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(m),
  });
  const j = await readJson(r);
  return Array.isArray(j) ? (j as AIModel[]) : [];
}

/** DELETE a model by name. */
export async function deleteModel(name: string): Promise<void> {
  const r = await fetch(`${AUTH}/admin/models/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok && r.status !== 204) await readJson(r);
}
