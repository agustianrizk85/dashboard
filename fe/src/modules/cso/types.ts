/** Types mirroring the CSO backend (greenparkcsobe) JSON contract. */

export interface AuthUser {
  username: string;
  name: string;
  role: string;
  division: string;
}

export interface Metrics {
  total: number;
  complete: number;
  afterBast: number;
  inProgress: number;
  notDone: number;
  slaPct: number;
  lateT1: number;
  lateT2: number;
}

export interface KurvaWeek {
  week: number;
  total2025: number;
  total2026: number;
  late2025: number;
  late2026: number;
  totalIni: number;
  totalLalu: number;
  lateIni: number;
  lateLalu: number;
}

export interface CategoryRank {
  kategori: string;
  kataKunci: string;
  jumlah: number;
  rank: number;
}

export interface NameCount {
  rank: number;
  nama: string;
  jumlah: number;
}

export interface Ticket {
  id: string;
  tanggal: string;
  nama: string;
  unit: string;
  proyek: string;
  kategori: string;
  deskripsi: string;
  klasifikasi: string;
  status: string;
  sla: string;
  source: string;
  createdAt: string;
}

export interface Dashboard {
  yearNow: number;
  yearLast: number;
  ini: Metrics;
  lalu: Metrics;
  kurva: KurvaWeek[];
  kategori: CategoryRank[] | null;
  proyek: NameCount[] | null;
  vendor: NameCount[] | null;
  dateRange: { awal: string; akhir: string };
  tickets: Ticket[] | null;
  source: string;
  updatedAt: string;
}

export interface Alert {
  generatedAt: string;
  headline: string;
  lines: string[];
  message: string;
  slaBelow: boolean;
}

export interface ImportSummary {
  totalIni: number;
  selesaiIni: number;
  belumIni: number;
  slaIni: number;
  totalLalu: number;
  slaLalu: number;
  kategori: number;
  proyek: number;
  vendor: number;
  minggu: number;
}

export interface ImportIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface ImportPreview {
  summary: ImportSummary;
  issues: ImportIssue[] | null;
  source: string;
}

export interface ImportRecord {
  id: string;
  time: string;
  source: string;
  by: string;
  updated: string;
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

export type Tone = "ok" | "warn" | "bad" | "neutral";
