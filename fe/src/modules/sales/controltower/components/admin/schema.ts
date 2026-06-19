import type { Dashboard } from "../../types";

export type FieldType = "text" | "number" | "select" | "checkbox";

export interface Field {
  key: string; // supports dotted paths e.g. "stock.total"
  label: string;
  type: FieldType;
  options?: string[]; // for select
  step?: number; // for number
  full?: boolean; // span full width in the form grid
}

export type Section =
  | { kind: "crud"; id: string; label: string; collection: string; fields: Field[]; columns: string[]; pick: (d: Dashboard) => Record<string, unknown>[] }
  | { kind: "single"; id: string; label: string; path: string; fields: Field[]; pick: (d: Dashboard) => Record<string, unknown> }
  | { kind: "array"; id: string; label: string; path: string; fields: Field[]; pick: (d: Dashboard) => Record<string, unknown>[]; addable: boolean; nullableKeys?: string[] };

const num = (key: string, label: string, step = 1): Field => ({ key, label, type: "number", step });
const txt = (key: string, label: string, full = false): Field => ({ key, label, type: "text", full });

const projectFields: Field[] = [
  txt("code", "Kode"),
  txt("name", "Nama Project", true),
  num("total", "Total"),
  num("akad", "Akad"),
  num("proses", "Proses"),
  num("batal", "Batal"),
  num("rev", "Revenue Akad (Rp)"),
  num("ads", "Ads Spend (Rp)"),
  num("cpa", "Cost/Akad (Jt)", 0.01),
  { key: "eff", label: "Efisiensi", type: "select", options: ["Excellent", "Good", "Fair", "No Akad"] },
  { key: "cat", label: "Kategori", type: "select", options: ["utama", "pendukung", "pembenahan"] },
  num("stock.total", "Stok Total"),
  num("stock.closed", "Stok Closed"),
  num("stock.booking", "Stok Booking"),
  num("stock.avail", "Stok Tersedia"),
];

const salesFields: Field[] = [
  txt("name", "Nama"),
  { key: "role", label: "Role", type: "select", options: ["Internal", "Agent"] },
  txt("project", "Project", true),
  num("akad", "Akad"),
  num("proses", "Proses"),
  num("batal", "Batal"),
  num("total", "Total"),
  num("conv", "Konversi (%)"),
  num("rev", "Revenue (Rp)"),
];

const channelFields: Field[] = [
  txt("code", "Kode"),
  txt("name", "Nama", true),
  num("total", "Booking"),
  num("akad", "Akad"),
  num("conv", "Konversi (%)"),
];

const reasonFields: Field[] = [
  txt("code", "Kode"),
  txt("name", "Nama (EN)", true),
  txt("id", "Label (ID)", true),
  { key: "layer", label: "Layer", type: "select", options: ["L1", "L2", "L3"] },
  num("count", "Jumlah"),
];

const agentFields: Field[] = [
  txt("name", "Nama"),
  txt("project", "Project"),
  txt("leads", "Leads"),
  num("akad", "Akad"),
  num("total", "Total"),
  num("conv", "Konversi (%)"),
  txt("status", "Status", true),
];

const alertFields: Field[] = [
  { key: "sev", label: "Severity", type: "select", options: ["merah", "kuning", "hijau"] },
  txt("title", "Judul", true),
  txt("detail", "Detail", true),
  txt("pic", "PIC"),
  txt("deadline", "Deadline"),
  txt("action", "Command / Rekomendasi Aksi", true),
  txt("impact", "Impact / Dampak"),
];

const kpiFields: Field[] = [
  num("no", "No"),
  txt("name", "KPI", true),
  num("value", "Aktual", 0.1),
  num("target", "Target", 0.1),
  txt("unit", "Satuan"),
  txt("owner", "Owner"),
  { key: "good", label: "Tercapai?", type: "checkbox" },
  { key: "lowerBetter", label: "Lebih kecil lebih baik?", type: "checkbox" },
];

const execFields: Field[] = [
  num("target2026", "Target 2026 (unit)"),
  num("booking", "Total Booking"),
  num("akad", "Akad"),
  num("proses", "Proses / Menuju Akad"),
  num("batal", "Batal / Gugur"),
  num("totalPenjualan", "Total Penjualan"),
  num("revenueAkad", "Revenue Akad (Rp)"),
  num("potentialRevenue", "Potensi Pipeline (Rp)"),
  num("adsSpent", "Total Ads Spent (Rp)"),
  num("adsSpentQ1", "Ads Spent Q1 (Rp)"),
  num("adsSpentQ2", "Ads Spent Q2 (Rp)"),
];

const stockFields: Field[] = [
  num("total", "Total Unit"),
  num("closed", "Closed"),
  num("booking", "Booking"),
  num("hold", "Hold"),
  num("avail", "Tersedia"),
  num("pctSold", "% Terjual", 0.1),
];

const eventsFields: Field[] = [
  txt("attributed.name", "Nama Event", true),
  num("attributed.booking", "Booking"),
  num("attributed.akad", "Akad"),
  num("attributed.conv", "Konversi (%)"),
  txt("note", "Catatan", true),
];

const metaFields: Field[] = [
  txt("period", "Periode", true),
  txt("updated", "Tanggal Update", true),
];

const reasonMetaFields: Field[] = [
  txt("L1.stage", "L1 · Stage"),
  txt("L1.target", "L1 · Target"),
  txt("L2.stage", "L2 · Stage"),
  txt("L2.target", "L2 · Target"),
  txt("L3.stage", "L3 · Stage"),
  txt("L3.target", "L3 · Target"),
];

const funnelFields: Field[] = [
  txt("key", "Tahap"),
  num("value", "Nilai"),
  num("target", "Target Ideal"),
  txt("owner", "Owner"),
  num("std", "Std (%)"),
  { key: "isMoney", label: "Nilai uang?", type: "checkbox" },
];

const monthlyFields: Field[] = [txt("m", "Bulan"), num("akad", "Akad"), num("booking", "Booking")];

/** All master-data sections, grouped for the admin sidebar. */
export const SECTIONS: Section[] = [
  { kind: "single", id: "exec", label: "Executive Snapshot", path: "exec", fields: execFields, pick: (d) => ({ ...d.exec }) },
  { kind: "crud", id: "projects", label: "Project", collection: "projects", fields: projectFields, columns: ["code", "name", "total", "akad", "proses", "batal", "cat", "eff"], pick: (d) => d.projects as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "sales", label: "Sales", collection: "sales", fields: salesFields, columns: ["name", "role", "project", "akad", "total", "conv"], pick: (d) => d.sales as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "channels", label: "Channel / Sumber", collection: "channels", fields: channelFields, columns: ["code", "name", "total", "akad", "conv"], pick: (d) => d.channels as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "reasons", label: "Reason Code", collection: "reasons", fields: reasonFields, columns: ["code", "name", "layer", "count"], pick: (d) => d.reasons as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "agents", label: "Agent", collection: "agents", fields: agentFields, columns: ["name", "project", "akad", "total", "conv", "status"], pick: (d) => d.agents as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "alerts", label: "CEO Command Panel", collection: "alerts", fields: alertFields, columns: ["sev", "title", "pic", "deadline", "impact"], pick: (d) => d.alerts as unknown as Record<string, unknown>[] },
  { kind: "crud", id: "kpis", label: "KPI Scorecard", collection: "kpis", fields: kpiFields, columns: ["no", "name", "value", "target", "owner"], pick: (d) => d.kpis as unknown as Record<string, unknown>[] },
  { kind: "array", id: "funnel", label: "Full Funnel (Impression → Cash-In)", path: "funnel", fields: funnelFields, addable: true, nullableKeys: ["std"], pick: (d) => d.funnel as unknown as Record<string, unknown>[] },
  { kind: "array", id: "monthly", label: "Tren Bulanan", path: "monthly", fields: monthlyFields, addable: true, pick: (d) => d.monthly as unknown as Record<string, unknown>[] },
  { kind: "single", id: "stock", label: "Master Stock", path: "stock", fields: stockFields, pick: (d) => ({ ...d.stock }) },
  { kind: "single", id: "events", label: "Event / Walk-in", path: "events", fields: eventsFields, pick: (d) => JSON.parse(JSON.stringify(d.events)) },
  { kind: "single", id: "reason-meta", label: "Reason Meta (Layer)", path: "reason-meta", fields: reasonMetaFields, pick: (d) => JSON.parse(JSON.stringify(d.reasonMeta)) },
  { kind: "single", id: "meta", label: "Periode & Update", path: "meta", fields: metaFields, pick: (d) => ({ period: d.period, updated: d.updated }) },
];
