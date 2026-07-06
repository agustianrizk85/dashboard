// Domain types mirroring the Go backend JSON contract (see backend/sales).
// Monetary values are in full Rupiah.

/** Status keys used by the sales status palette. */
export type StatusKey = "hijau" | "kuning" | "merah" | "hitam";

/** Alert severity keys. */
export type Sev = "merah" | "kuning" | "hijau";

/** Project category. */
export type Cat = "utama" | "pendukung" | "pembenahan";

export interface Exec {
  target2026: number;
  booking: number;
  akad: number;
  proses: number;
  batal: number;
  bookingNoBatal?: number; // Panel 1: booking 2026 di luar Batal (snapshot donut)
  prosesCash?: number; // Panel 1: proses belum akad, sumber dana Cash Keras/Bertahap
  prosesKpr?: number; // Panel 1: proses belum akad, sumber dana KPR
  totalPenjualan: number;
  revenueAkad: number;
  potentialRevenue: number;
  adsSpent: number;
  adsSpentQ1: number;
  adsSpentQ2: number;
}

export interface MonthPoint {
  m: string;
  akad: number;
  booking: number;
}

export interface FunnelStage {
  key: string;
  value: number;
  target: number;
  owner: string;
  std: number | null;
  isMoney?: boolean;
}

export interface Stock {
  total: number;
  closed: number;
  booking: number;
  avail: number;
}

export interface Project {
  _id?: string;
  code: string;
  name: string;
  total: number;
  akad: number;
  proses: number;
  batal: number;
  rev: number;
  ads: number;
  cpa: number;
  eff: string;
  cat: Cat;
  stock: Stock;
}

export interface Channel {
  _id?: string;
  code: string;
  name: string;
  total: number;
  akad: number;
  conv: number;
}

export interface SalesRep {
  _id?: string;
  name: string;
  role: string;
  project: string;
  akad: number;
  proses: number;
  batal: number;
  total: number;
  conv: number;
  rev?: number;
}

export interface ReasonMetaItem {
  stage: string;
  target: string;
}

/** One lost prospect's identity behind a reason code (from MASTER DATA_LEADS). */
export interface ReasonLead {
  name: string;
  phone: string;
  project: string;
  date: string;
  status: string;
}

export interface Reason {
  _id?: string;
  code: string;
  name: string;
  id: string;
  layer: "L1" | "L2" | "L3";
  count: number;
  /** Capped identity sample backing the drill-down table. */
  leads?: ReasonLead[];
}

export interface Agent {
  _id?: string;
  name: string;
  project: string;
  leads: string;
  akad: number;
  total: number;
  conv: number;
  status: string;
}

export interface MasterStock {
  total: number;
  closed: number;
  booking: number;
  hold: number;
  avail: number;
  pctSold: number;
}

export interface Events {
  attributed: { name: string; booking: number; akad: number; conv: number };
  note: string;
}

export interface Alert {
  _id?: string;
  sev: Sev;
  title: string;
  detail: string;
  pic: string;
  deadline: string;
  action: string;
  impact?: string;
}

export interface KPI {
  _id?: string;
  no: number;
  name: string;
  value: number;
  target: number;
  unit: string;
  owner: string;
  good: boolean;
  lowerBetter?: boolean;
}

export interface Summary {
  target2026: number;
  akad: number;
  booking: number;
  proses: number;
  batal: number;
  achievement: number;
  gapToTarget: number;
  pipelineActive: number;
  cancelRate: number;
  bookingToAkad: number;
  cashIn: number;
  potentialRevenue: number;
  adsSpent: number;
  avgCostPerAkad: number;
  totalProjects: number;
  totalSalesReps: number;
  stockSold: number;
  status: string;
}

/** One transaction record from DATA PENJUALAN (drill-down for Panel 8 & Purchaser). */
export interface SaleRow {
  project: string;
  unit?: string;
  name: string;
  phone?: string;
  closer?: string;
  status: "akad" | "proses" | "batal";
  rawStatus?: string;
  booking?: string;
  akad?: string;
  revenue: number;
  sumber?: string;
  channel?: string; // cleaned Platform category (matches the Sumber Penjualan panel)
  funding?: string; // raw Sumber Dana (Cash Keras/Bertahap/KPR)
}

/** Per-project slice of the dashboard, used by the project filter. */
export interface ProjectView {
  exec: Exec;
  funnel: FunnelStage[];
  channels: Channel[];
  sales: SalesRep[];
  reasons: Reason[];
  agents: Agent[];
  monthly: MonthPoint[];
  events: Events;
}

/** Full payload returned by GET /api/dashboard. */
export interface Dashboard {
  period: string;
  updated: string;
  exec: Exec;
  monthly: MonthPoint[];
  funnel: FunnelStage[];
  projects: Project[];
  channels: Channel[];
  sales: SalesRep[];
  reasonMeta: Record<string, ReasonMetaItem>;
  reasons: Reason[];
  agents: Agent[];
  stock: MasterStock;
  events: Events;
  alerts: Alert[];
  kpis: KPI[];
  summary: Summary;
  byProject?: Record<string, ProjectView>;
  saleRows?: SaleRow[];
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

/** Severity of an import validation issue. */
export type IssueSeverity = "error" | "warning" | "info";

/** One validation finding from an upload. */
export interface ImportIssue {
  check: string;
  severity: IssueSeverity;
  sheet: string;
  row?: number;
  message: string;
}

/** Headline figures of an upload preview. */
export interface ImportHeadline {
  leads: number;
  validLeads: number;
  cv: number;
  pv: number;
  purchaser: number;
  booking: number;
  akad: number;
  proses: number;
  batal: number;
  cashIn: number;
  leadsRaw: number;
  droppedWrong: number;
  droppedDup: number;
  droppedPeriod: number;
  visitorWalkIns: number;
}

/** One MASTER DATA_LEADS row discarded during cleaning. */
export interface DroppedRow {
  row: number;
  reason: "wrong" | "duplikat" | "periode";
  name: string;
  phone: string;
  project: string;
  date: string;
  detail: string;
}

/** Result of POST /api/import/preview. */
export interface ImportResult {
  headline: ImportHeadline;
  issues: ImportIssue[];
  rowsRead: Record<string, number>;
  dropped: DroppedRow[];
  preview: Dashboard;
}

/** Summary stored per approved import. */
export interface ImportSummary {
  leads: number;
  validLeads: number;
  cv: number;
  pv: number;
  booking: number;
  akad: number;
  proses: number;
  batal: number;
  cashIn: number;
  issues: number;
}

/** Auto-sync scheduler status. */
export interface AutoSyncStatus {
  enabled: boolean;
  intervalSec: number;
  configured: boolean;
  lastSync: string;
  lastError: string;
  lastSummary: ImportSummary;
}

/** One row in the import history. */
export interface ImportRecord {
  id: string;
  time: string;
  filename: string;
  by: string;
  summary: ImportSummary;
  rolledBack: boolean;
  canRollback: boolean;
}
