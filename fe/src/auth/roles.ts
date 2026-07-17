// Katalog role & departemen — SUMBER TUNGGAL yang dipakai Panel Admin (Master
// Akun Karyawan) dan AuthContext. Dibuat supaya pemisahan role konsisten:
//   - super           : pengelola AKUN (superadmin) — satu-satunya yang boleh
//                        buka Master & kelola user. BUKAN sekadar "akses semua".
//   - ceo             : Direktur Utama — role `ceo` di SEMUA divisi (baca lintas
//                        divisi). Terintegrasi, tapi bukan super.
//   - dirops          : Direktur Operasional — role `dirops` di SEMUA divisi
//                        (bisa menyetujui/tulis lintas divisi). Terintegrasi,
//                        tapi BUKAN admin akun / super.
//   - kadep/admin/... : role spesifik satu divisi.
//
// Kode departemen HARUS sama dgn auth (internal/config Departments) & backend
// tiap divisi. Role string bebas (backend memakai kosakatanya sendiri); daftar
// di bawah hanya membatasi pilihan di UI.

export interface Dept {
  code: string;
  name: string;
}

// Katalog departemen kanonik (fallback bila GET /admin/departments gagal).
export const DEPARTMENTS: Dept[] = [
  { code: "finance", name: "Keuangan" },
  { code: "marketing", name: "Marketing" },
  { code: "digitalmarketing", name: "Digital Marketing" },
  { code: "sales", name: "Sales" },
  { code: "sdm", name: "SDM / HR" },
  { code: "perencanaan", name: "Perencanaan" },
  { code: "teknik", name: "Teknik" },
  { code: "legalpermit", name: "Legal & Perizinan" },
  { code: "cso", name: "CSO / Customer Complaint" },
  { code: "departemen", name: "Departemen" },
];

// Role dasar yang berlaku di semua divisi.
const BASE_ROLES = ["admin", "kadep", "staff", "viewer"] as const;

// Kosakata role tambahan yang khas per divisi (di luar BASE_ROLES).
const EXTRA_ROLES: Record<string, string[]> = {
  perencanaan: ["arsitek", "drafter", "pic", "tim"],
  legalpermit: ["legal_permit", "dirops", "ceo"],
  finance: ["purchasing", "dirops"],
  sales: ["pic", "tim"],
};

// rolesForDept: daftar pilihan role untuk satu divisi (dedup, urut stabil).
export function rolesForDept(code: string): string[] {
  const extra = EXTRA_ROLES[code] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...BASE_ROLES, ...extra]) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

// Role yang dianggap "level direksi/lintas divisi" (bisa menyetujui, akses semua).
export const DIRECTOR_ROLES = ["ceo", "dirops"] as const;

export function isDirectorRole(role: string): boolean {
  return (DIRECTOR_ROLES as readonly string[]).includes(role);
}

// Role yang punya wewenang tulis/approve di dashboard divisi (selaras gating
// backend: super/admin/kadep/dirops/ceo). viewer = hanya baca.
const WRITE_ROLES = new Set(["admin", "kadep", "dirops", "ceo", "purchasing"]);
export function isWriteRole(role: string): boolean {
  return WRITE_ROLES.has(role);
}

// ---- Preset / arketipe akun karyawan --------------------------------------
// Setiap preset membangun peta roles (kode divisi -> role) dari daftar dept.
// `super` true HANYA untuk pengelola akun.

export type PresetId =
  | "super"
  | "ceo"
  | "dirops"
  | "kadep"
  | "admin"
  | "staff"
  | "viewer"
  | "custom";

export interface Preset {
  id: PresetId;
  label: string;
  desc: string;
  super: boolean;
  // scope: 'all' = isi role ke SEMUA divisi; 'one' = pilih satu divisi;
  //        'none' = super (tak perlu role); 'custom' = matriks manual.
  scope: "all" | "one" | "none" | "custom";
  role?: string; // role yang dipakai saat scope 'all'/'one'
}

export const PRESETS: Preset[] = [
  {
    id: "super",
    label: "Super Admin (pengelola akun)",
    desc: "Kelola semua akun & kunci AI. Berikan hanya ke admin sistem.",
    super: true,
    scope: "none",
  },
  {
    id: "ceo",
    label: "Direktur Utama (CEO)",
    desc: "Akses baca ke SEMUA divisi. Bukan pengelola akun.",
    super: false,
    scope: "all",
    role: "ceo",
  },
  {
    id: "dirops",
    label: "Direktur Operasional (Dirops)",
    desc: "Akses & persetujuan lintas SEMUA divisi. Terpisah dari admin akun.",
    super: false,
    scope: "all",
    role: "dirops",
  },
  {
    id: "kadep",
    label: "Kepala Departemen",
    desc: "Pimpinan satu divisi (bisa menyetujui di divisinya).",
    super: false,
    scope: "one",
    role: "kadep",
  },
  {
    id: "admin",
    label: "Admin Divisi",
    desc: "Kelola data master satu divisi.",
    super: false,
    scope: "one",
    role: "admin",
  },
  {
    id: "staff",
    label: "Staff / Karyawan",
    desc: "Anggota satu divisi (role bisa disesuaikan).",
    super: false,
    scope: "one",
    role: "staff",
  },
  {
    id: "viewer",
    label: "Viewer",
    desc: "Hanya melihat satu divisi.",
    super: false,
    scope: "one",
    role: "viewer",
  },
  {
    id: "custom",
    label: "Custom (atur manual)",
    desc: "Tentukan role per divisi sendiri.",
    super: false,
    scope: "custom",
  },
];

export function presetById(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
}

// buildRolesForPreset: hasilkan peta roles untuk preset 'all' (semua divisi).
export function buildAllRoles(depts: Dept[], role: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of depts) out[d.code] = role;
  return out;
}
