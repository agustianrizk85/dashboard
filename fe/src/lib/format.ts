import type { Division } from "@/auth/AuthContext";

/** Human label for a department-specific role code. */
export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    ceo: "CEO",
    dirops: "Direktur Operasional",
    kadep: "Kepala Departemen",
    arsitek: "Arsitek",
    drafter: "Drafter",
    legal_permit: "Legal Permit",
    staff: "Tim Marketing",
    viewer: "Viewer",
  };
  return map[role] ?? role;
}

/** Short label for a division/department. */
export function divisionLabel(d: Division): string {
  const map: Record<Division, string> = {
    perencanaan: "Perencanaan",
    permit: "Legal & Perizinan",
    marketing: "Marketing",
    sales: "Sales",
    keuangan: "Keuangan",
  };
  return map[d];
}

/** Full department line shown in headers. */
export function departmentLine(d: Division): string {
  return `Greenpark Group · Departemen ${divisionLabel(d)}`;
}
