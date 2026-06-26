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

/* ---- Procurement (PR / Pembelian) ---- */

export interface PurchaseDoc {
  doc: "po" | "invoice";
  tanggal: string;
  nomor: string;
  pemasok: string;
  kode: string;
  barang: string;
  qty: number;
  satuan: string;
  diskon: number;
  total: number;
  blok: string;
  proyek: string;
  bulan: string;
  tahun: number;
}

export interface PaymentDoc {
  tanggal: string;
  noBukti: string;
  pemasok: string;
  bank: string;
  noFaktur: string;
  totalFaktur: number;
  terutang: number;
  bayar: number;
  bulan: string;
  tahun: number;
}

export interface PurchasingSummary {
  poValue: number;
  poCount: number;
  invoiceValue: number;
  invoiceCount: number;
  paidValue: number;
  paymentCount: number;
  outstanding: number;
  supplierCount: number;
  topSupplier: string;
}

export interface SupplierSpend {
  name: string;
  poValue: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  docs: number;
}

export interface ProjectSpend {
  project: string;
  poValue: number;
  items: number;
}

export interface PurchaseMonth {
  period: string;
  po: number;
  invoice: number;
  paid: number;
}

export interface Purchasing {
  summary: PurchasingSummary;
  bySupplier: SupplierSpend[];
  byProject: ProjectSpend[];
  monthly: PurchaseMonth[];
  orders: PurchaseDoc[];
  invoices: PurchaseDoc[];
  payments: PaymentDoc[];
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
  purchasing: Purchasing;
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
  purchaseValue?: number;
  outstanding?: number;
}

export interface SheetInfo {
  name: string;
  kind: "akad" | "pipeline" | "pr_po" | "pr_invoice" | "pr_payment" | "skipped";
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

/* ---- AR / Piutang (GET /api/ar) — values in full Rupiah ---- */

/** One project's AR input spreadsheet (project code → spreadsheet ID). */
export interface ARSource {
  code: string;
  id: string;
}

export interface ARSummary {
  nilaiKontrak: number;
  totalTerbayar: number;
  sisaPiutang: number;
  progresPct: number;
  unitTotal: number;
  unitLunas: number;
  unitBelumLunas: number;
  cashIn: number;
  pencairanKpr: number;
  dpJatuhTempo: number;
  dpSisa: number;
}

export interface ARTahap {
  key: string;
  label: string;
  count: number;
  nilai: number;
}

export interface ARAging {
  bucket: string;
  count: number;
  nilai: number;
}

export interface ARMonth {
  period: string;
  cashIn: number;
  kpr: number;
}

export interface ARBank {
  name: string;
  count: number;
  nilai: number;
}

export interface ARProject {
  code: string;
  nilaiKontrak: number;
  totalTerbayar: number;
  sisaPiutang: number;
  cashIn: number;
  unit: number;
  lunas: number;
  progresPct: number;
}

export interface ARPiutangRow {
  project: string;
  customer: string;
  blok: string;
  bank: string;
  hargaJual: number;
  terbayar: number;
  sisa: number;
  status: string;
}

export interface ARSheetInfo {
  project: string;
  tab: string;
  kind: "danamasuk" | "dp" | "laporan" | "skipped";
  rows: number;
}

export interface ARData {
  period: string;
  updated: string;
  focusYear: number;
  summary: ARSummary;
  tahapan: ARTahap[];
  aging: ARAging[];
  monthly: ARMonth[];
  banks: ARBank[];
  projects: ARProject[];
  piutang: ARPiutangRow[];
  sheets: ARSheetInfo[];
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
