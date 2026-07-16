/* Master data for account creation — the official departments (auth
 * `config.Departments`) and the REAL role vocabulary each division uses, with
 * friendly Indonesian labels. The auth backend accepts any non-empty role, so we
 * surface the actual roles seen in the roster (kadep = Kepala Divisi, arsitek,
 * drafter, staff, legal_permit, purchasing) instead of just admin/viewer. */

export interface Dept {
  code: string;
  name: string;
}

/** Official departments (order: operational divisions first). */
export const DEPARTMENTS: Dept[] = [
  { code: "perencanaan", name: "Perencanaan" },
  { code: "legalpermit", name: "Legal & Perizinan" },
  { code: "marketing", name: "Marketing" },
  { code: "digitalmarketing", name: "Digital Marketing" },
  { code: "sales", name: "Sales" },
  { code: "finance", name: "Keuangan" },
  { code: "teknik", name: "Teknik" },
  { code: "cso", name: "CSO / Customer Complaint" },
  { code: "sdm", name: "SDM / HR" },
  { code: "departemen", name: "Departemen (umum)" },
];

export interface RoleOpt {
  value: string;
  label: string;
}

/** Roles offered to every department. `kadep` first — it's the common pick. */
const KADEP: RoleOpt = { value: "kadep", label: "Kepala Divisi" };
const ADMIN: RoleOpt = { value: "admin", label: "Admin" };
const VIEWER: RoleOpt = { value: "viewer", label: "Viewer (lihat saja)" };

/** Extra, division-specific roles (from the real roster). */
const EXTRA: Record<string, RoleOpt[]> = {
  perencanaan: [
    { value: "arsitek", label: "Arsitek" },
    { value: "drafter", label: "Drafter" },
  ],
  legalpermit: [{ value: "legal_permit", label: "Staf Legal Permit" }],
  marketing: [{ value: "staff", label: "Staff" }],
  finance: [{ value: "purchasing", label: "Purchasing" }],
};

/** Role options for a department: Kepala Divisi · (division-specific) · Admin · Viewer. */
export function rolesFor(deptCode: string): RoleOpt[] {
  return [KADEP, ...(EXTRA[deptCode] ?? []), ADMIN, VIEWER];
}

/** Friendly label for a stored role value in a given department. */
export function roleLabel(deptCode: string, value: string): string {
  return rolesFor(deptCode).find((r) => r.value === value)?.label ?? value;
}

/** Friendly department name from its code. */
export function deptName(code: string): string {
  return DEPARTMENTS.find((d) => d.code === code)?.name ?? code;
}
