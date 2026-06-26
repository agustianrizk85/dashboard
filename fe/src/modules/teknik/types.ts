// Domain types mirroring the Go backend JSON contract (see backend/teknik).
// The model is relational (docs/DATA_MODEL.md): Cluster → Proyek → Unit, with
// SPK + Progres Mingguan transactions. The dashboard is derived analytics.

/** Traffic-light health indicator (used by shared UI primitives). */
export type Status = "green" | "yellow" | "red";

/** Pill / chip colour tones supported by the stylesheet. */
export type Tone = "green" | "yellow" | "orange" | "red" | "neutral" | "crisis";

/* ---- Construction masters + checklist ---------------------------------- */

export interface ConstructionStage {
  id: string;
  no: number;
  name: string;
  weight: number;
  termin: string; // T1 | T2 | T3 | T4
}

export interface ProgressUnit {
  id: string;
  noInduk: string;
  project: string;
  blok: string;
  tglSpk: string;
  tglSpkFinish: string;
  status: string;
  keterangan: string;
  stages: Record<string, boolean>;
}

export interface WorkItem {
  id: string;
  no: number;
  name: string;
  weight: number;
}

export interface KurvaWeek {
  id: string;
  week: number;
  weight: number;
  cumulative: number;
}

/* ---- Relational model -------------------------------------------------- */

export interface Cluster {
  id: string;
  kode: string;
  nama: string;
}

export interface Proyek {
  id: string;
  clusterId: string;
  nama: string;
  kode: string;
  spv: string;
}

export interface Unit {
  id: string;
  proyekId: string;
  blok: string;
  type: string;
  luasBangunan: number;
  luasTanah: number;
  statusKavling: string;
}

export interface Kontraktor {
  id: string;
  nama: string;
}

export interface Termin {
  id: string;
  no: number;
  kode: string;
  nama: string;
  bobotProgres: number;
  persenBayar: number;
  keterangan: string;
}

export interface SPK {
  id: string;
  nomorSpk: string;
  unitId: string;
  kontraktorId: string;
  tglTerbit: string;
  tglMulai: string;
  tglSelesaiTarget: string;
  lbSpk: number;
  hargaPerM2: number;
  nilaiKontrak: number;
  layout: string;
  nominalAddendum: number;
  totalNilai: number;
}

export interface ProgresMingguan {
  id: string;
  unitId: string;
  mingguKe: number;
  aktual: number;
  target: number;
  linkFoto: string;
  updatedBy: string;
  tglUpdate: string;
}

export interface Akad {
  id: string;
  unitId: string;
  tglAkad: string;
}

export interface TtdGambarKerja {
  id: string;
  unitId: string;
  tglAcc: string;
  tglTerbitSpk: string;
  lampiran: string;
  keterangan: string;
}

export interface BastKontraktor {
  id: string;
  spkId: string;
  tglSerahTerima: string;
  linkFoto: string;
  linkBapp: string;
  linkCeklis: string;
}

export interface BastKonsumen {
  id: string;
  unitId: string;
  tglBast: string;
  status: string;
  lampiranFoto: string;
  scanBerkas: string;
}

export interface Komplain {
  id: string;
  unitId: string;
  tgl: string;
  keterangan: string;
  status: string;
  aging: number;
  link: string;
}

export interface Defect {
  id: string;
  unitId: string;
  kategori: string;
  status: string;
  aging: number;
  repeat: string;
}

export interface RecoveryPlan {
  id: string;
  unitId: string;
  rootCause: string;
  targetPercepatan: string;
  status: string;
}

/* ---- Derived dashboard (computed by backend) --------------------------- */

export interface ProyekMetric {
  id: string;
  nama: string;
  clusterKode: string;
  spv: string;
  units: number;
  week: number;
  aktual: number;
  target: number;
  deviasi: number;
  spi: number;
  lateWeeks: number;
  status: string; // Sangat Cepat..Critical Delay
  kontraktor: string;
}

export interface KontraktorMetric {
  id: string;
  nama: string;
  units: number;
  nilai: number;
}

export interface ClusterMetric {
  kode: string;
  nama: string;
  proyek: number;
  units: number;
  aktual: number;
  target: number;
  deviasi: number;
  status: string;
}

export interface KontraktorDeviasi {
  id: string;
  nama: string;
  units: number;
  aktual: number;
  target: number;
  deviasi: number;
  spi: number;
  status: string;
}

export interface QualitySummary {
  komplainOpen: number;
  komplainTotal: number;
  defectOpen: number;
  defectTotal: number;
  defectRepeat: number;
}

export interface KPIDireksi {
  onTimeCompletion: number;
  proyekOnTime: number;
  proyekTotal: number;
  overall: number;
  avgSpi: number;
  avgDeviasi: number;
}

export interface Summary {
  totalProyek: number;
  totalUnits: number;
  totalSpk: number;
  overall: number;
  onSchedule: number;
  warning: number;
  critical: number;
  avgDeviasi: number;
  avgSpi: number;
}

/** Full payload returned by GET /api/dashboard. */
export interface Dashboard {
  summary: Summary;
  proyek: ProyekMetric[];
  kontraktor: KontraktorMetric[];
  kurvaBaseline: KurvaWeek[];
  overallActual: number;
  overallWeek: number;
  constructionStages: ConstructionStage[];
  progressUnits: ProgressUnit[];
  kpi: KPIDireksi;
  clusterMetrics: ClusterMetric[];
  kontraktorDeviasi: KontraktorDeviasi[];
  quality: QualitySummary;
}

/** Alias kept for components that took the enriched dashboard. */
export type DashboardData = Dashboard;

/** Authenticated operator (no password material). */
export interface AuthUser {
  username: string;
  name: string;
  role: string;
}
