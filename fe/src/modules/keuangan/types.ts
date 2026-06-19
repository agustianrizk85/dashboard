// Domain types mirroring the Go backend JSON contract (greenparkkeuanganbe).
// The dashboard is driven by the akad/KPR closing pipeline. All monetary values
// are in millions of Rupiah (Rp juta).

/** Traffic-light health indicator. */
export type Status = "green" | "yellow" | "red";

/** Pill / chip colour tones supported by the stylesheet. */
export type Tone = "green" | "yellow" | "orange" | "red" | "neutral" | "crisis" | "navy";

export interface Summary {
  nilaiAkad: number;
  cashIn: number;
  pipelineValue: number;
  akadCount: number;
  bookingCount: number;
  prosesCount: number;
  batalCount: number;
  cancelRate: number;
  avgDurasi: number;
  kprShare: number;
  targetAkad: number;
  achievement: number;
  topProject: string;
  topBank: string;
  bankCount: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface MonthPoint {
  period: string;
  akad: number;
  nilai: number;
  dp: number;
}

export interface ProjectFin {
  code: string;
  name: string;
  gp: string;
  akad: number;
  booking: number;
  batal: number;
  nilai: number;
  dp: number;
  kprPct: number;
  topBank: string;
  status: Status;
  note: string;
}

export interface BankFin {
  name: string;
  akad: number;
  plafon: number;
  share: number;
  status: Status;
}

export interface SalesRank {
  name: string;
  akad: number;
  nilai: number;
  isAgent: boolean;
}

export interface PayMethod {
  type: string;
  count: number;
  value: number;
}

export interface PipelineRow {
  project: string;
  customer: string;
  blok: string;
  sales: string;
  bank: string;
  caraBayar: string;
  stage: string;
  stageKey: string;
  plafon: number;
  sla: "ok" | "due" | "overdue";
  kendala: string;
}

export interface AkadRow {
  gp: string;
  project: string;
  customer: string;
  blok: string;
  sales: string;
  bank: string;
  caraBayar: string;
  dp: number;
  plafon: number;
  tglAkad: string;
  bulan: string;
  tahun: number;
  durasi: number;
}

export interface Alert {
  tone: string;
  title: string;
  detail: string;
  action: string;
}

export interface AIInsight {
  type: string;
  tone: string;
  text: string;
  icon: string;
}

export interface Decision {
  role: string;
  tone: string;
  text: string;
}

export interface KPI {
  no: number;
  kpi: string;
  def: string;
  pic: string;
  green: string;
  yellow: string;
  red: string;
  val: string;
  state: string;
}

export interface Trigger {
  cond: string;
  thr: string;
  status: string;
  pic: string;
  act: string;
  esc: string;
}

/** Full payload returned by GET /api/dashboard. */
export interface Dashboard {
  period: string;
  updated: string;
  focusYear: number;
  years: number[];
  summary: Summary;
  funnel: FunnelStage[];
  monthly: MonthPoint[];
  projects: ProjectFin[];
  banks: BankFin[];
  sales: SalesRank[];
  payMix: PayMethod[];
  pipeline: PipelineRow[];
  akads: AkadRow[];
  alerts: Alert[];
  ai: AIInsight[];
  decisions: Decision[];
  kpis: KPI[];
  triggers: Trigger[];
}

/* ---- ingest (async) types ---- */

export interface ImportSummary {
  akadCount: number;
  nilaiAkad: number;
  cashIn: number;
  bookingCount: number;
  prosesCount: number;
  batalCount: number;
  kprShare: number;
  issues: number;
}

export interface SheetInfo {
  name: string;
  kind: "akad" | "pipeline" | "skipped";
  rows: number;
}

export interface ImportResult {
  preview: Dashboard;
  headline: ImportSummary;
  issues: string[];
  sheets: SheetInfo[];
}

export interface ImportRecord {
  id: string;
  time: string;
  filename: string;
  by: string;
  summary: ImportSummary;
}

export interface AutoSyncStatus {
  enabled: boolean;
  intervalSec: number;
  configured: boolean;
  lastSync: string;
  lastError: string;
  lastSummary: ImportSummary;
}

/** Authenticated account (mirrors backend domain.User, no password material). */
export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "viewer";
}

/** Response of POST /api/auth/login. */
export interface LoginResponse {
  token: string;
  user: User;
}
