import { Fragment, useState } from "react";
import type { Agent, Channel, Dashboard, KPI, Project, Reason, SaleRow } from "../types";
import { Pill } from "./ui";
import { CAT, CH_C, LAYER_C, SEV, STATUS, convColor, effClass, funnelConv, num, pct, rpShort, statusFor } from "../lib/format";

/* ---------- DATA PENJUALAN transaction drill-down ----------
 * The dashboard payload carries the raw DATA PENJUALAN rows (small set), so the
 * Panel-8 (Booking→Akad→Cash-In) and funnel-Purchaser drill-downs can list the
 * actual deals behind the counts. SaleTable renders that list with a status
 * filter; callers pass an already-scoped `rows` slice (e.g. Sumber=LEADS for
 * Purchaser). */
const SALE_STATUS: Record<SaleRow["status"], { label: string; c: string; bg: string }> = {
  akad: { label: "Akad", c: "#1F9D54", bg: "#E8F6ED" },
  proses: { label: "Proses/KPR", c: "#B97F09", bg: "#FCF4E2" },
  batal: { label: "Batal", c: "#D6453A", bg: "#FBEAE8" },
};
const SALE_ORDER: SaleRow["status"][] = ["akad", "proses", "batal"];

/** SaleTable lists DATA PENJUALAN records with a clickable status filter. */
function SaleTable({ rows, initial = null }: { rows: SaleRow[]; initial?: SaleRow["status"] | null }) {
  const [filter, setFilter] = useState<SaleRow["status"] | null>(initial);
  if (!rows || rows.length === 0)
    return <p className="md-foot muted">Belum ada baris transaksi pada data ini — jalankan ulang Upload Excel / sinkron Sheets untuk memuat rincian DATA PENJUALAN.</p>;

  const present = SALE_ORDER.filter((s) => rows.some((r) => r.status === s));
  const shown = filter ? rows.filter((r) => r.status === filter) : rows;
  const total = shown.reduce((a, r) => a + (r.status === "akad" ? r.revenue : 0), 0);

  return (
    <div className="sale-drill">
      <div className="sale-filter">
        <button className={"sf-chip" + (filter === null ? " active" : "")} onClick={() => setFilter(null)}>
          Semua <b>{rows.length}</b>
        </button>
        {present.map((s) => (
          <button
            key={s}
            className={"sf-chip" + (filter === s ? " active" : "")}
            style={filter === s ? { borderColor: SALE_STATUS[s].c, color: SALE_STATUS[s].c } : undefined}
            onClick={() => setFilter(filter === s ? null : s)}
          >
            {SALE_STATUS[s].label} <b>{rows.filter((r) => r.status === s).length}</b>
          </button>
        ))}
      </div>
      <div className="sale-scroll">
        <table className="dtable sale-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tgl Booking</th>
              <th>Tgl Akad</th>
              <th>Project</th>
              <th>Unit</th>
              <th>Nama</th>
              <th>Sales</th>
              <th>Sumber</th>
              <th>Status</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                <td className="muted" data-label="#">{i + 1}</td>
                <td className="muted small" data-label="Tgl Booking">{r.booking || "—"}</td>
                <td className="muted small" data-label="Tgl Akad">{r.akad || "—"}</td>
                <td data-label="Project">
                  <b>{r.project}</b>
                </td>
                <td data-label="Unit">{r.unit || "—"}</td>
                <td data-label="Nama">{r.name}</td>
                <td className="muted small" data-label="Sales">{r.closer || "—"}</td>
                <td className="muted small" data-label="Sumber">{r.sumber || "—"}</td>
                <td data-label="Status">
                  <Pill color={SALE_STATUS[r.status].c} bg={SALE_STATUS[r.status].bg}>
                    {SALE_STATUS[r.status].label}
                  </Pill>
                </td>
                <td className="num" data-label="Revenue">{r.revenue ? rpShort(r.revenue) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="sale-total">
              <td colSpan={9}>
                {shown.length} transaksi{filter ? ` · ${SALE_STATUS[filter].label}` : ""} · Cash-In (akad)
              </td>
              <td className="num">
                <b>{rpShort(total)}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Purchaser = DATA PENJUALAN dengan Sumber=LEADS & status bukan Batal (BRD). */
function leadsPurchaserRows(d: Dashboard): SaleRow[] {
  return (d.saleRows ?? []).filter((r) => (r.sumber ?? "").trim().toUpperCase() === "LEADS" && r.status !== "batal");
}

/* ---------- KPI drill-down breakdown ----------
 * Each scorecard KPI can be expanded into the raw numbers behind it. KPI 1–4
 * are the leads funnel (MASTER DATA_LEADS), KPI 5–8 the sales/cash figures
 * (DATA PENJUALAN). All inputs already live in the dashboard payload — the
 * leads stages on `d.funnel`, the rest on `d.exec`/`d.agents` — so the
 * breakdown is derived client-side, no extra request needed. */
const SHEET_LEADS = "MASTER DATA_LEADS";
const SHEET_SALES = "DATA PENJUALAN";

interface KpiBreakdown {
  source: string;
  formula: string;
  rows: { label: string; value: string; hint?: string }[];
}

function kpiBreakdown(k: KPI, d: Dashboard): KpiBreakdown {
  const fv = (key: string) => d.funnel.find((s) => s.key === key)?.value ?? 0;
  const e = d.exec;
  const agentAkad = d.agents.reduce((s, a) => s + a.akad, 0);
  const rate = pct(k.value, 1);
  switch (k.no) {
    case 1:
      return {
        source: SHEET_LEADS,
        formula: "Valid Leads ÷ Total Leads × 100",
        rows: [
          { label: "Total Leads (bersih)", value: num(Number(fv("Leads"))) },
          { label: "Valid Leads", value: num(Number(fv("Valid Leads"))) },
          { label: "Valid Leads Rate", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 2:
      return {
        source: SHEET_LEADS,
        formula: "Confirmed Visit ÷ Valid Leads × 100",
        rows: [
          { label: "Valid Leads", value: num(Number(fv("Valid Leads"))) },
          { label: "Confirmed Visit (CV)", value: num(Number(fv("Confirmed Visit"))) },
          { label: "Leads → CV Rate", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 3:
      return {
        source: SHEET_LEADS,
        formula: "Project Visitor ÷ Confirmed Visit × 100",
        rows: [
          { label: "Confirmed Visit (CV)", value: num(Number(fv("Confirmed Visit"))) },
          { label: "Project Visitor (PV)", value: num(Number(fv("Project Visitor"))) },
          { label: "CV → PV Rate", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 4:
      return {
        source: `${SHEET_LEADS} × ${SHEET_SALES} (Sumber=LEADS)`,
        formula: "Purchaser ÷ Project Visitor × 100",
        rows: [
          { label: "Project Visitor (PV)", value: num(Number(fv("Project Visitor"))) },
          { label: "Purchaser (Sumber LEADS)", value: num(Number(fv("Purchaser"))) },
          { label: "PV → Purchaser Rate", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 5:
      return {
        source: SHEET_SALES,
        formula: "Akad ÷ Total Booking × 100",
        rows: [
          { label: "Total Booking", value: num(e.booking) },
          { label: "Akad Selesai", value: num(e.akad) },
          { label: "Booking → Akad Rate", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 6:
      return {
        source: SHEET_SALES,
        formula: "Akad ÷ Booking (proxy cash-in) × 100",
        rows: [
          { label: "Akad Selesai", value: num(e.akad) },
          { label: "Total Booking", value: num(e.booking) },
          { label: "Cash-In (revenue akad)", value: rpShort(e.revenueAkad) },
          { label: "Cash-In Achievement", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 7:
      return {
        source: SHEET_SALES,
        formula: "Akad oleh Agent ÷ Total Akad × 100",
        rows: [
          { label: "Akad oleh Agent", value: num(agentAkad) },
          { label: "Total Akad", value: num(e.akad) },
          { label: "Agent Booking Contrib.", value: rate, hint: `target ${k.target}%` },
        ],
      };
    case 8:
      return {
        source: `${SHEET_SALES} × Meta Ads`,
        formula: "Total Ads Spent ÷ Total Booking",
        rows: [
          { label: "Total Ads Spent", value: rpShort(e.adsSpent) },
          { label: "Total Booking", value: num(e.booking) },
          { label: "Cost / Booking (avg)", value: k.value.toString().replace(".", ",") + " Jt", hint: `target ≤${k.target} Jt` },
        ],
      };
    default:
      return { source: "—", formula: "—", rows: [] };
  }
}

/** KPI Scorecard with click-to-expand drill-down per indicator. */
function KpiScorecard({ d }: { d: Dashboard }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <table className="dtable kpi-scorecard">
      <thead>
        <tr>
          <th>#</th>
          <th>KPI</th>
          <th>Aktual</th>
          <th>Target</th>
          <th>Owner</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {d.kpis.map((k) => {
          const s = statusFor(k.value, k.target, k.lowerBetter);
          const isOpen = open === k.no;
          const bd = isOpen ? kpiBreakdown(k, d) : null;
          return (
            <Fragment key={k.no}>
              <tr
                className={"kpi-row" + (isOpen ? " open" : "")}
                onClick={() => setOpen(isOpen ? null : k.no)}
                title="Klik untuk rincian sumber data"
              >
                <td className="muted" data-label="#">
                  <span className="kpi-caret">{isOpen ? "▾" : "▸"}</span>
                  {k.no}
                </td>
                <td data-label="KPI">{k.name}</td>
                <td className="num" data-label="Aktual">
                  <b>
                    {k.value.toString().replace(".", ",")}
                    {k.unit}
                  </b>
                </td>
                <td className="num muted" data-label="Target">
                  {k.target}
                  {k.unit}
                </td>
                <td className="muted" data-label="Owner">{k.owner}</td>
                <td data-label="Status">
                  <Pill color={STATUS[s].c} bg={STATUS[s].bg}>
                    {STATUS[s].label}
                  </Pill>
                </td>
              </tr>
              {isOpen && bd && (
                <tr className="kpi-detail-row">
                  <td />
                  <td colSpan={5}>
                    <div className="kpi-detail">
                      <div className="kpi-detail-meta">
                        <span className="kpi-detail-tag">Sumber: {bd.source}</span>
                        <span className="kpi-detail-formula">{bd.formula}</span>
                      </div>
                      <table className="kpi-detail-table">
                        <tbody>
                          {bd.rows.map((r, i) => (
                            <tr key={i} className={i === bd.rows.length - 1 ? "kpi-detail-total" : ""}>
                              <td>{r.label}</td>
                              <td className="num">
                                <b>{r.value}</b>
                              </td>
                              <td className="muted">{r.hint || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------- Panel 1 — Executive ---------- */
export function ExecutiveDetail({ d }: { d: Dashboard }) {
  const e = d.exec;
  const rows: [string, string, string][] = [
    ["Target 2026", e.target2026 + " unit", "Komitmen tahunan"],
    ["Realisasi Akad (YTD)", e.akad + " unit", pct((e.akad / e.target2026) * 100, 1) + " dari target"],
    ["Total Booking", e.booking + " unit", "Termasuk pipeline aktif"],
    ["Menuju Akad / Proses", e.proses + " unit", "On KPR / dokumen"],
    ["Batal / Gugur", e.batal + " unit", pct((e.batal / e.booking) * 100, 1) + " dari booking"],
    ["Gap ke Target", e.target2026 - e.akad + " unit", "Sisa menuju 500"],
    ["Revenue Akad (Cash-In)", rpShort(e.revenueAkad), "Terkonfirmasi"],
    ["Potensi Revenue Pipeline", rpShort(e.potentialRevenue), "Dari proses menuju akad"],
    ["Total Ads Spent", rpShort(e.adsSpent), `Q1 ${rpShort(e.adsSpentQ1)} · Q2 ${rpShort(e.adsSpentQ2)}`],
  ];
  return (
    <div>
      <p className="md-lead">
        Posisi pencapaian menuju target <b>500 unit</b>. Realisasi akad <b>{e.akad}</b> ({pct((e.akad / e.target2026) * 100, 1)}) — status{" "}
        <b style={{ color: d.summary.status === "on-track" ? STATUS.hijau.c : d.summary.status === "risk" ? STATUS.kuning.c : STATUS.merah.c }}>
          {d.summary.status}
        </b>
        , butuh akselerasi pipeline & cash-in.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Item</th>
            <th>Nilai</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td data-label="Item">{r[0]}</td>
              <td className="num" data-label="Nilai">
                <b>{r[1]}</b>
              </td>
              <td className="muted" data-label="Keterangan">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="md-sub">KPI Scorecard</h4>
      <p className="md-foot muted">
        KPI 1–4 bersumber dari <b>{SHEET_LEADS}</b>, KPI 5–8 dari <b>{SHEET_SALES}</b>. Klik baris untuk melihat rincian angka & rumusnya.
      </p>
      <KpiScorecard d={d} />
    </div>
  );
}

/* ---------- Panel 2 — Funnel ---------- */
export function FunnelDetail({ d }: { d: Dashboard }) {
  const f = d.funnel;
  const [openPurchaser, setOpenPurchaser] = useState(false);
  const purchaserRows = leadsPurchaserRows(d);
  return (
    <div>
      <p className="md-lead">
        Full funnel <b>{f.length > 0 ? f[0].key : "Impression"} → {f.length > 0 ? f[f.length - 1].key : "Cash-In"}</b>: dari{" "}
        <b>{num(f.length > 0 ? f[0].value : 0)}</b> hingga <b>{num(f.length > 0 ? f[f.length - 1].value : 0)}</b>. Konversi tiap tahap
        dihitung terhadap tahap sebelumnya; yang di bawah standar GP ditandai merah/kuning. Penjualan total <b>semua sumber</b>:
        Booking <b>{d.exec.booking}</b> · Akad <b>{d.exec.akad}</b> · Cash-In <b>{rpShort(d.exec.revenueAkad)}</b>.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Tahap</th>
            <th>Aktual</th>
            <th>Target Ideal</th>
            <th>Konversi</th>
            <th>Std</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {f.map((s, i) => {
            const conv = funnelConv(f, i);
            let st: keyof typeof STATUS = "hijau";
            if (s.std && conv != null) st = statusFor(conv, s.std);
            else if (s.std && i === 1) st = statusFor((s.value / f[0].value) * 100, s.std);
            // The Purchaser stage drills into DATA PENJUALAN (Sumber=LEADS); the
            // leads stages (Leads…PV) are aggregates from MASTER DATA_LEADS only.
            const isPurchaser = s.key === "Purchaser" && purchaserRows.length > 0;
            return (
              <Fragment key={i}>
                <tr
                  className={isPurchaser ? "funnel-row clickable" + (openPurchaser ? " open" : "") : undefined}
                  onClick={isPurchaser ? () => setOpenPurchaser((o) => !o) : undefined}
                  title={isPurchaser ? "Klik untuk daftar transaksi (Sumber LEADS)" : undefined}
                >
                  <td data-label="Tahap">
                    {isPurchaser && <span className="kpi-caret">{openPurchaser ? "▾" : "▸"}</span>}
                    <b>{s.key}</b>
                  </td>
                  <td className="num" data-label="Aktual">{s.isMoney ? rpShort(s.value) : num(s.value)}</td>
                  <td className="num muted" data-label="Target Ideal">{s.isMoney ? rpShort(s.target) : num(s.target)}</td>
                  <td className="num" data-label="Konversi">{conv != null ? pct(conv, 1) : i === 1 ? pct((s.value / f[0].value) * 100, 1) : "—"}</td>
                  <td className="num muted" data-label="Std">{s.std ? "≥" + s.std + "%" : "—"}</td>
                  <td className="muted" data-label="Owner">{s.owner}</td>
                  <td data-label="Status">
                    <Pill color={STATUS[st].c} bg={STATUS[st].bg}>
                      {STATUS[st].label}
                    </Pill>
                  </td>
                </tr>
                {isPurchaser && openPurchaser && (
                  <tr className="funnel-detail-row">
                    <td />
                    <td colSpan={6}>
                      <div className="kpi-detail">
                        <div className="kpi-detail-meta">
                          <span className="kpi-detail-tag">Sumber: DATA PENJUALAN (Sumber=LEADS, non-batal)</span>
                          <span className="kpi-detail-formula">Purchaser = transaksi yang sumbernya LEADS</span>
                        </div>
                        <SaleTable rows={purchaserRows} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="callout merah">
        <b>Cara baca:</b> setiap tahap menampilkan konversi terhadap tahap sebelumnya. Tahap dengan konversi di bawah standar (Std) adalah
        titik kebocoran utama — prioritaskan perbaikan di sana. Standar tiap tahap diatur lewat <b>Master Data → Full Funnel</b>. Tahap{" "}
        <b>Leads–Project Visitor</b> bersumber dari <b>MASTER DATA_LEADS</b>; <b>Purchaser</b> dari <b>DATA PENJUALAN</b> (Sumber=LEADS) — klik
        barisnya untuk rincian transaksi.
      </div>
    </div>
  );
}

/* ---------- Panel 5 — Project ---------- */
export function ProjectDetail({ d }: { d: Dashboard }) {
  const ps = [...d.projects].sort((a, b) => b.rev - a.rev);
  // Project code whose identitas (DATA PENJUALAN rows) table is shown; null = none.
  const [sel, setSel] = useState<string | null>(null);
  const selProject = sel ? ps.find((p) => p.code === sel) ?? null : null;
  return (
    <div>
      <p className="md-lead">
        Prioritaskan energi: dorong <b>Mesin Utama</b>, dampingi <b>Pendukung</b>, bereskan bottleneck <b>Pembenahan</b> sebelum push besar.{" "}
        <span className="muted">Klik baris project untuk lihat identitas penjualannya.</span>
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Project</th>
            <th>Kategori</th>
            <th>Total</th>
            <th>Akad</th>
            <th>Proses</th>
            <th>Batal</th>
            <th>Revenue Akad</th>
            <th>Cost/Akad</th>
            <th>Efisiensi</th>
            <th>Stok Sisa</th>
          </tr>
        </thead>
        <tbody>
          {ps.map((p) => {
            const isOpen = sel === p.code;
            return (
              <tr
                key={p.code}
                className={"row-click" + (isOpen ? " row-open" : "")}
                onClick={() => setSel(isOpen ? null : p.code)}
                title={`Klik untuk ${isOpen ? "tutup" : "lihat"} identitas penjualan ${p.code}`}
              >
                <td data-label="Project">
                  <b>{p.code}</b>
                  <div className="muted small">{p.name}</div>
                </td>
                <td data-label="Kategori">
                  <Pill color={CAT[p.cat].c} bg={CAT[p.cat].bg}>
                    {CAT[p.cat].label}
                  </Pill>
                </td>
                <td className="num" data-label="Total">{p.total}</td>
                <td className="num" data-label="Akad">
                  <b>{p.akad}</b>
                </td>
                <td className="num" data-label="Proses">{p.proses}</td>
                <td className="num" data-label="Batal">{p.batal}</td>
                <td className="num" data-label="Revenue Akad">{p.rev ? rpShort(p.rev) : "—"}</td>
                <td className="num" data-label="Cost/Akad">{p.cpa ? "Rp" + p.cpa.toString().replace(".", ",") + " Jt" : "—"}</td>
                <td data-label="Efisiensi">
                  <span className={"eff " + effClass(p.eff)}>{p.eff}</span>
                </td>
                <td className="num" data-label="Stok Sisa">
                  {p.stock.avail}
                  <span className="muted">/{p.stock.total}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selProject && <ProjectIdentityTable d={d} p={selProject} onClose={() => setSel(null)} />}
    </div>
  );
}

/** ProjectIdentityTable lists the deals (identitas penjualan) behind a selected
 * project, scoped from the raw DATA PENJUALAN rows embedded in the payload. */
function ProjectIdentityTable({ d, p, onClose }: { d: Dashboard; p: Project; onClose: () => void }) {
  const rows = (d.saleRows ?? []).filter((r) => r.project === p.code);
  return (
    <div className="rd-detail" style={{ borderColor: CAT[p.cat].c }}>
      <div className="rd-detail-head">
        <div>
          <span className="rd-code" style={{ color: CAT[p.cat].c, marginRight: 6 }}>
            {p.code}
          </span>
          <b>{p.name}</b> <span className="muted">· {CAT[p.cat].label} · {p.total} transaksi</span>
        </div>
        <button className="rd-detail-close" onClick={onClose} title="Tutup tabel identitas" aria-label="Tutup">
          ✕
        </button>
      </div>
      <SaleTable rows={rows} />
    </div>
  );
}

/* ---------- Panel 4 — Sales ---------- */
export function SalesDetail({ d }: { d: Dashboard }) {
  const ranked = [...d.sales].sort((a, b) => b.akad - a.akad || b.conv - a.conv);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <p className="md-lead">
        Ranking objektif berdasar akad & konversi. <b>Top 5</b> layak apresiasi; <b>conv &lt; 33%</b> perlu coaching SPV.
        Klik nama sales untuk melihat <b>tabel identitas</b> transaksinya (DATA PENJUALAN).
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>#</th>
            <th>Sales</th>
            <th>Role</th>
            <th>Project</th>
            <th>Akad</th>
            <th>Proses</th>
            <th>Batal</th>
            <th>Total</th>
            <th>Conv %</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, i) => {
            const isOpen = open === s.name;
            // Identity rows for this rep: every DATA PENJUALAN transaction closed
            // by them. Matched on `closer`, the same field that built this ranking.
            const rows = (d.saleRows ?? []).filter((r) => (r.closer ?? "").trim() === s.name);
            return (
              <Fragment key={s.name}>
                <tr
                  className={"kpi-row" + (isOpen ? " open" : "") + (i < 5 ? " row-top" : s.conv < 33 ? " row-low" : "")}
                  onClick={() => setOpen(isOpen ? null : s.name)}
                  title="Klik untuk tabel identitas transaksi"
                >
                  <td className="muted" data-label="#">{i + 1}</td>
                  <td data-label="Sales">
                    <span className="kpi-caret">{isOpen ? "▾" : "▸"}</span>
                    <b>{s.name}</b>
                  </td>
                  <td data-label="Role">
                    <span className={"role role-" + s.role.toLowerCase()}>{s.role}</span>
                  </td>
                  <td className="muted small" data-label="Project">{s.project}</td>
                  <td className="num" data-label="Akad">
                    <b>{s.akad}</b>
                  </td>
                  <td className="num" data-label="Proses">{s.proses}</td>
                  <td className="num" data-label="Batal">{s.batal}</td>
                  <td className="num" data-label="Total">{s.total}</td>
                  <td className="num" style={{ color: convColor(s.conv) }} data-label="Conv %">
                    <b>{s.conv}%</b>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="kpi-detail-row">
                    <td colSpan={9}>
                      <div className="kpi-detail">
                        <div className="kpi-detail-meta">
                          <span className="kpi-detail-tag">Identitas transaksi · {s.name}</span>
                          <span className="kpi-detail-formula">
                            Sumber: DATA PENJUALAN · {rows.length} baris (deal closer = {s.name})
                          </span>
                        </div>
                        <SaleTable rows={rows} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Per-project Cost/Akad drill-down. Spend comes from the Meta Ads input
 * sheet; akad/booking/proses/batal/revenue/stock from DATA PENJUALAN. Cost per
 * akad is recomputed from the raw spend ÷ akad so the rating is auditable. */
function projectAdsBreakdown(p: Project): KpiBreakdown {
  const cpaReal = p.akad ? p.ads / p.akad : 0;
  return {
    source: `META ADS INPUT × ${SHEET_SALES}`,
    formula: "Cost / Akad = Total Spend ÷ Jumlah Akad",
    rows: [
      { label: "Total Spend (Meta Ads)", value: rpShort(p.ads), hint: "input Meta Ads" },
      { label: "Akad", value: p.akad + " unit", hint: SHEET_SALES },
      { label: "Total Penjualan", value: p.total + " unit", hint: "Akad + Proses + Batal" },
      { label: "Proses menuju akad", value: p.proses + " unit" },
      { label: "Batal / gugur", value: p.batal + " unit" },
      { label: "Revenue Akad", value: p.rev ? rpShort(p.rev) : "—", hint: "cash-in terkonfirmasi" },
      { label: "Stok tersisa", value: p.stock.avail + " / " + p.stock.total + " unit" },
      { label: "Cost / Akad", value: p.akad ? rpShort(cpaReal) : "—", hint: "Spend ÷ Akad · rating " + p.eff },
    ],
  };
}

/* ---------- Panel 3 — Lead Quality ---------- */
export function LeadQualityDetail({ d }: { d: Dashboard }) {
  const ps = [...d.projects].sort((a, b) => (a.cpa || 999) - (b.cpa || 999));
  const [openP, setOpenP] = useState<string | null>(null);
  return (
    <div className="md-grid2">
      <div>
        <h4 className="md-sub">Kualitas leads</h4>
        <p className="md-lead">
          Volume besar, konversi rendah → fokus <b>kualitas</b> & <b>kecepatan follow-up</b>, bukan menambah leads.
        </p>
        <table className="dtable">
          <tbody>
            <tr>
              <td>Total Leads</td>
              <td className="num">
                <b>20.291</b>
              </td>
            </tr>
            <tr>
              <td>Valid Leads</td>
              <td className="num">
                <b>13.255</b> <span className="muted">(65%)</span>
              </td>
            </tr>
            <tr>
              <td>Confirmed Visit</td>
              <td className="num">
                <b>711</b>
              </td>
            </tr>
            <tr className="row-low">
              <td>Lead → CV Rate</td>
              <td className="num">
                <b style={{ color: "#D6453A" }}>5,4%</b> <span className="muted">min 20%</span>
              </td>
            </tr>
            <tr>
              <td>Unreachable</td>
              <td className="num">1.376</td>
            </tr>
            <tr>
              <td>Not Engaged</td>
              <td className="num">1.326</td>
            </tr>
            <tr>
              <td>Not Qualified</td>
              <td className="num">420</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="md-sub">Efisiensi Meta Ads per project (Cost / Akad)</h4>
        <table className="dtable">
          <thead>
            <tr>
              <th>Project</th>
              <th>Spend</th>
              <th>Akad</th>
              <th>Cost/Akad</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {ps.map((p) => {
              const isOpen = openP === p.code;
              const bd = isOpen ? projectAdsBreakdown(p) : null;
              return (
                <Fragment key={p.code}>
                  <tr
                    className={"kpi-row" + (isOpen ? " open" : "")}
                    onClick={() => setOpenP(isOpen ? null : p.code)}
                    title="Klik untuk rincian Meta Ads & penjualan"
                  >
                    <td data-label="Project">
                      <span className="kpi-caret">{isOpen ? "▾" : "▸"}</span>
                      <b>{p.code}</b>
                    </td>
                    <td className="num muted" data-label="Spend">{rpShort(p.ads)}</td>
                    <td className="num" data-label="Akad">{p.akad}</td>
                    <td className="num" data-label="Cost/Akad">
                      <b>{p.cpa ? "Rp" + p.cpa.toString().replace(".", ",") + "Jt" : "—"}</b>
                    </td>
                    <td data-label="Rating">
                      <span className={"eff " + effClass(p.eff)}>{p.eff}</span>
                    </td>
                  </tr>
                  {isOpen && bd && (
                    <tr className="kpi-detail-row">
                      <td colSpan={5}>
                        <div className="kpi-detail">
                          <div className="kpi-detail-meta">
                            <span className="kpi-detail-tag">Sumber: {bd.source}</span>
                            <span className="kpi-detail-formula">{bd.formula}</span>
                          </div>
                          <table className="kpi-detail-table">
                            <tbody>
                              {bd.rows.map((r, i) => (
                                <tr key={i} className={i === bd.rows.length - 1 ? "kpi-detail-total" : ""}>
                                  <td>{r.label}</td>
                                  <td className="num">
                                    <b>{r.value}</b>
                                  </td>
                                  <td className="muted">{r.hint || ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="md-foot muted">
          Total Ads Spent {rpShort(d.exec.adsSpent)} · {d.projects.reduce((a, p) => a + p.akad, 0)} akad. Klik kode project untuk rincian.
        </p>
      </div>
    </div>
  );
}

/* ---------- Panel 7 — Reason Code ---------- */
export function ReasonDetail({ d }: { d: Dashboard }) {
  const layers: Array<"L1" | "L2" | "L3"> = ["L1", "L2", "L3"];
  const total = d.reasons.reduce((a, r) => a + r.count, 0);
  // Selected (layer, code) reason whose identity table is shown; null = none.
  const [sel, setSel] = useState<Reason | null>(null);
  const selKey = sel ? sel.layer + sel.code : null;
  return (
    <div>
      <p className="md-lead">
        Total <b>{num(total)}</b> prospek hilang terklasifikasi. Dominasi di <b style={{ color: LAYER_C.L1 }}>Layer-1</b> menegaskan masalah
        follow-up awal. <span className="muted">Klik baris reason untuk lihat identitas prospek.</span>
      </p>
      <div className="md-grid3">
        {layers.map((L) => {
          const list = d.reasons.filter((r) => r.layer === L).sort((a, b) => b.count - a.count);
          const max = Math.max(...list.map((r) => r.count), 1);
          const sum = list.reduce((a, r) => a + r.count, 0);
          return (
            <div className="rd-col" key={L}>
              <div className="rd-h" style={{ borderColor: LAYER_C[L] }} title={`${d.reasonMeta[L].stage} · target ${d.reasonMeta[L].target}`}>
                <b style={{ color: LAYER_C[L] }}>{d.reasonMeta[L].stage}</b>
                <span className="muted">
                  {d.reasonMeta[L].target} · {num(sum)} loss
                </span>
              </div>
              {list.length === 0 && <div className="rd-empty muted">Tidak ada loss terklasifikasi pada layer ini.</div>}
              {list.map((r) => {
                const isOpen = selKey === L + r.code;
                const n = r.leads?.length ?? 0;
                return (
                  <div
                    className={"rd-row rd-click" + (isOpen ? " open" : "")}
                    key={r.code}
                    onClick={() => setSel(isOpen ? null : r)}
                    title={`${r.id} — ${num(r.count)} prospek. Klik untuk ${isOpen ? "tutup" : "lihat"} identitas${n ? ` (${n} contoh)` : ""}.`}
                  >
                    <span className="rd-code" style={{ color: LAYER_C[L] }}>
                      {r.code}
                    </span>
                    <div className="rd-info">
                      <b>{r.name}</b>
                      <span className="muted">{r.id}</span>
                    </div>
                    <div className="rd-bar">
                      <div style={{ width: (r.count / max) * 100 + "%", background: LAYER_C[L] }} />
                    </div>
                    <span className="rd-n">{num(r.count)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {sel && <ReasonIdentityTable d={d} r={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

/** ReasonIdentityTable lists the prospects (identitas) behind a selected reason
 * code, sourced from the capped MASTER DATA_LEADS sample embedded in the payload. */
function ReasonIdentityTable({ d, r, onClose }: { d: Dashboard; r: Reason; onClose: () => void }) {
  const rows = r.leads ?? [];
  const stage = d.reasonMeta[r.layer]?.stage ?? r.layer;
  const capped = r.count > rows.length;
  return (
    <div className="rd-detail" style={{ borderColor: LAYER_C[r.layer] }}>
      <div className="rd-detail-head">
        <div>
          <span className="rd-code" style={{ color: LAYER_C[r.layer], marginRight: 6 }}>
            {r.code}
          </span>
          <b>{r.name}</b> <span className="muted">· {stage} · {r.id}</span>
        </div>
        <button className="rd-detail-close" onClick={onClose} title="Tutup tabel identitas" aria-label="Tutup">
          ✕
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="md-foot muted">
          Identitas belum tersedia pada data ini — jalankan ulang Upload Excel / sinkron Sheets untuk memuat detail MASTER DATA_LEADS.
        </p>
      ) : (
        <>
          <div className="rd-detail-scroll">
            <table className="dtable rd-idtable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th>No. HP</th>
                  <th>Project</th>
                  <th>Tanggal</th>
                  <th>Status Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, i) => (
                  <tr key={i}>
                    <td className="muted" data-label="#">{i + 1}</td>
                    <td data-label="Nama">
                      <b>{l.name || "—"}</b>
                    </td>
                    <td className="num" title={l.phone} data-label="No. HP">
                      {l.phone || "—"}
                    </td>
                    <td data-label="Project">{l.project || "—"}</td>
                    <td className="num muted" data-label="Tanggal">{l.date || "—"}</td>
                    <td data-label="Status Terakhir">{l.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="md-foot muted">
            Menampilkan <b>{num(rows.length)}</b> identitas{capped ? <> dari <b>{num(r.count)}</b> total (sampel dibatasi)</> : ""}. Sumber: MASTER DATA_LEADS.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Panel 8 — Cash ---------- */
export function CashDetail({
  d,
  initial = null,
  bookingOnly = false,
}: {
  d: Dashboard;
  initial?: SaleRow["status"] | null;
  // bookingOnly scopes the transaction list to active bookings (akad+proses),
  // excluding Batal/Gugur — so the count ties to the "Total Booking" KPI.
  bookingOnly?: boolean;
}) {
  const e = d.exec;
  const saleRows = bookingOnly ? (d.saleRows ?? []).filter((r) => r.status !== "batal") : d.saleRows ?? [];
  return (
    <div>
      <p className="md-lead">
        Dari <b>{e.booking} booking</b>, baru <b>{e.akad} akad</b> ({pct((e.akad / e.booking) * 100, 0)}). <b>{e.proses}</b> tertahan di proses (potensi{" "}
        {rpShort(e.potentialRevenue)}), <b style={{ color: "#D6453A" }}>{e.batal} batal</b> = kebocoran cash.
      </p>
      <table className="dtable">
        <tbody>
          <tr>
            <td>Total Booking Aktif</td>
            <td className="num">
              <b>{e.booking}</b>
            </td>
            <td className="muted">unit</td>
          </tr>
          <tr>
            <td>Menuju Akad (proses/KPR)</td>
            <td className="num">
              <b style={{ color: "#D9930B" }}>{e.proses}</b>
            </td>
            <td className="muted">potensi {rpShort(e.potentialRevenue)}</td>
          </tr>
          <tr>
            <td>Akad Selesai</td>
            <td className="num">
              <b style={{ color: "#1F9D54" }}>{e.akad}</b>
            </td>
            <td className="muted">cash-in {rpShort(e.revenueAkad)}</td>
          </tr>
          <tr className="row-low">
            <td>Batal / Gugur</td>
            <td className="num">
              <b style={{ color: "#D6453A" }}>{e.batal}</b>
            </td>
            <td className="muted">{pct((e.batal / e.booking) * 100, 1)} dari booking</td>
          </tr>
          <tr>
            <td>Booking → Akad Rate</td>
            <td className="num">
              <b>{pct((e.akad / e.booking) * 100, 1)}</b>
            </td>
            <td className="muted">target ≥70%</td>
          </tr>
        </tbody>
      </table>
      <div className="callout kuning">
        <b>Aksi cash:</b> eskalasi {e.proses} pipeline proses untuk akad bulan ini (≈{rpShort(e.potentialRevenue)}). Audit {e.batal} batal untuk
        reason code & pencegahan.
      </div>
      <h4 className="md-sub">Rincian Transaksi · DATA PENJUALAN</h4>
      <p className="md-foot muted">
        {bookingOnly ? (
          <>
            <b>{saleRows.length} booking aktif</b> (akad + proses, tanpa Batal/Gugur) dari <b>DATA PENJUALAN</b>. Klik tab status untuk memfilter.
          </>
        ) : (
          <>
            Daftar transaksi per deal dari <b>DATA PENJUALAN</b>. Klik tab status untuk memfilter (Akad / Proses / Batal).
          </>
        )}
      </p>
      <SaleTable rows={saleRows} initial={initial} />
    </div>
  );
}

/* ---------- Panel 6 — Channels ---------- */
export function ChannelDetail({ d }: { d: Dashboard }) {
  const max = Math.max(...d.channels.map((c) => c.total), 1);
  // Selected source (channel.code) whose buyer-identity table is expanded.
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div>
      <p className="md-lead">
        WhatsApp, Walkin, dan Instagram (Meta Ads) jadi tiga mesin booking utama.{" "}
        <span className="muted">Klik baris sumber untuk lihat detail identitas pembeli.</span>
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Sumber</th>
            <th>Distribusi</th>
            <th>Booking</th>
            <th>Akad</th>
            <th>Konversi</th>
          </tr>
        </thead>
        <tbody>
          {d.channels.map((c, i) => {
            const open = sel === c.code;
            const color = CH_C[i % CH_C.length];
            return (
              <Fragment key={c.code}>
                <tr
                  className={"cdr-row" + (open ? " open" : "")}
                  onClick={() => setSel(open ? null : c.code)}
                  title={`Klik untuk ${open ? "tutup" : "lihat"} identitas ${c.name}`}
                >
                  <td data-label="Sumber">
                    <span className="cdr-caret" style={{ color }}>
                      {open ? "▾" : "▸"}
                    </span>
                    <b>{c.name}</b>
                  </td>
                  <td data-label="Distribusi">
                    <div className="tbar">
                      <div style={{ width: (c.total / max) * 100 + "%", background: color }} />
                    </div>
                  </td>
                  <td className="num" data-label="Booking">{c.total}</td>
                  <td className="num" data-label="Akad">
                    <b>{c.akad}</b>
                  </td>
                  <td className="num" style={{ color: c.conv >= 50 ? "#1F9D54" : "#D9930B" }} data-label="Konversi">
                    <b>{c.conv}%</b>
                  </td>
                </tr>
                {open && (
                  <tr className="cdr-detail-row">
                    <td colSpan={5}>
                      <ChannelIdentityTable d={d} channel={c} color={color} onClose={() => setSel(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** ChannelIdentityTable lists the buyers (identitas) behind a selected source,
 * from the DATA PENJUALAN rows tagged with that Platform category. */
function ChannelIdentityTable({ d, channel, color, onClose }: { d: Dashboard; channel: Channel; color: string; onClose: () => void }) {
  const rows = (d.saleRows ?? []).filter((r) => (r.channel ?? "") === channel.code);
  return (
    <div className="cdr-detail" style={{ borderColor: color }}>
      <div className="cdr-detail-head">
        <div>
          <b>{channel.name}</b>{" "}
          <span className="muted">
            · {channel.total} transaksi · {channel.akad} akad · konversi {channel.conv}%
          </span>
        </div>
        <button className="cdr-detail-close" onClick={onClose} title="Tutup tabel identitas" aria-label="Tutup">
          ✕
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="md-foot muted">
          Identitas belum tersedia pada data ini — jalankan ulang Upload Excel / sinkron Sheets untuk memuat detail DATA PENJUALAN.
        </p>
      ) : (
        <>
          <div className="cdr-detail-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th>Project</th>
                  <th>Unit</th>
                  <th>Sales</th>
                  <th>No. HP</th>
                  <th>Tgl Booking</th>
                  <th>Tgl Akad</th>
                  <th>Status</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="muted" data-label="#">{i + 1}</td>
                    <td data-label="Nama">
                      <b>{r.name || "—"}</b>
                    </td>
                    <td data-label="Project">{r.project || "—"}</td>
                    <td data-label="Unit">{r.unit || "—"}</td>
                    <td className="muted small" data-label="Sales">{r.closer || "—"}</td>
                    <td className="num" title={r.phone} data-label="No. HP">
                      {r.phone || "—"}
                    </td>
                    <td className="muted small" data-label="Tgl Booking">{r.booking || "—"}</td>
                    <td className="muted small" data-label="Tgl Akad">{r.akad || "—"}</td>
                    <td data-label="Status">
                      <Pill color={SALE_STATUS[r.status].c} bg={SALE_STATUS[r.status].bg}>
                        {SALE_STATUS[r.status].label}
                      </Pill>
                    </td>
                    <td className="num" data-label="Revenue">{r.revenue ? rpShort(r.revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="md-foot muted">
            Menampilkan <b>{num(rows.length)}</b> identitas dari sumber <b>{channel.name}</b>. Sumber: DATA PENJUALAN.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Panel 9 — Agent & Event ---------- */
export function AgentEventDetail({ d }: { d: Dashboard }) {
  const ev = d.events.attributed;
  const agentAkad = d.agents.reduce((s, a) => s + a.akad, 0);
  const contrib = d.exec.akad > 0 ? Math.round((agentAkad / d.exec.akad) * 1000) / 10 : 0;
  const top = [...d.agents].sort((a, b) => b.akad - a.akad)[0];
  const idle = d.agents.filter((a) => a.akad === 0);
  // Agent name whose identitas (DATA PENJUALAN rows) table is shown; null = none.
  const [sel, setSel] = useState<string | null>(null);
  const selAgent = sel ? d.agents.find((a) => a.name === sel) ?? null : null;

  // Auto-generated ("AI") insights from the agent + event data.
  const insights: string[] = [];
  if (top && top.akad > 0) insights.push(`Agent terbaik: ${top.name} (${top.akad} akad · ${top.conv}% konversi).`);
  insights.push(
    `Kontribusi agent ${contrib}% dari total akad` +
      (contrib < 15 ? " — di bawah target 15%, dorong rekrut & aktivasi agent produktif." : " — sudah memenuhi target 15%."),
  );
  if (idle.length) insights.push(`${idle.length} agent perlu reaktivasi (0 akad): ${idle.map((a) => a.name).join(", ")}.`);
  if (ev.booking > 0)
    insights.push(
      `Event/Walk-in: ${ev.akad} akad dari ${ev.booking} booking (${ev.conv}%)` +
        (ev.conv >= 50 ? " — konversi sehat, perbanyak undangan/open house." : " — konversi rendah, perbaiki follow-up pasca-event."),
    );

  return (
    <div className="md-grid2">
      <div>
        <h4 className="md-sub">Agent & Broker</h4>
        <table className="dtable">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Project</th>
              <th>Akad</th>
              <th>Total</th>
              <th>Conv</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.agents.map((a) => {
              const isOpen = sel === a.name;
              return (
                <tr
                  key={a.name}
                  className={"row-click" + (isOpen ? " row-open" : "")}
                  onClick={() => setSel(isOpen ? null : a.name)}
                  title={`Klik untuk ${isOpen ? "tutup" : "lihat"} identitas penjualan ${a.name}`}
                >
                  <td data-label="Agent">
                    <b>{a.name}</b>
                  </td>
                  <td className="muted" data-label="Project">{a.project}</td>
                  <td className="num" data-label="Akad">
                    <b>{a.akad}</b>
                  </td>
                  <td className="num" data-label="Total">{a.total}</td>
                  <td className="num" data-label="Conv">{a.conv}%</td>
                  <td data-label="Status">
                    <Pill
                      color={a.status.includes("Need") ? "#D6453A" : a.status.includes("Low") ? "#D9930B" : "#1F9D54"}
                      bg={a.status.includes("Need") ? "#FBEAE8" : a.status.includes("Low") ? "#FCF4E2" : "#E8F6ED"}
                    >
                      {a.status}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="md-foot muted">
          Kontribusi agent: {agentAkad} akad ({contrib}% dari total). Target ≥15%.{" "}
          <span className="muted">Klik baris agent untuk lihat identitas penjualannya.</span>
        </p>
        {selAgent && <AgentIdentityTable d={d} a={selAgent} onClose={() => setSel(null)} />}
      </div>
      <div>
        <h4 className="md-sub">🤖 AI Insight — Agent Performance</h4>
        <div className="callout">
          <b>{ev.name}</b>
          <br />
          {ev.booking} booking · {ev.akad} akad · konversi {ev.conv}%
        </div>
        <ul className="md-insight">
          {insights.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** AgentIdentityTable lists the deals (identitas penjualan) behind a selected
 * agent/broker, scoped from the raw DATA PENJUALAN rows: Sumber=Agent rows whose
 * deal closer matches the agent name (same linkage the backend uses for Panel 9). */
function AgentIdentityTable({ d, a, onClose }: { d: Dashboard; a: Agent; onClose: () => void }) {
  const rows = (d.saleRows ?? []).filter((r) => r.closer === a.name && (r.sumber ?? "").toLowerCase().includes("agent"));
  const c = a.status.includes("Need") ? "#D6453A" : a.status.includes("Low") ? "#D9930B" : "#1F9D54";
  return (
    <div className="rd-detail" style={{ borderColor: c }}>
      <div className="rd-detail-head">
        <div>
          <span className="rd-code" style={{ color: c, marginRight: 6 }}>
            {a.name}
          </span>
          <span className="muted">
            · {a.project} · {a.akad} akad / {a.total} transaksi · konversi {a.conv}% · {a.status}
          </span>
        </div>
        <button className="rd-detail-close" onClick={onClose} title="Tutup tabel identitas" aria-label="Tutup">
          ✕
        </button>
      </div>
      <SaleTable rows={rows} />
    </div>
  );
}

/* ---------- Panel 10 — AI Alert ---------- */
const ORDER: Record<string, number> = { merah: 0, kuning: 1, hijau: 2 };
export function AlertDetail({ d }: { d: Dashboard }) {
  const sorted = [...d.alerts].sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  return (
    <div>
      <p className="md-lead">
        Prioritas eksekusi otomatis dari status data. Mulai dari <b style={{ color: "#D6453A" }}>KRITIS</b>, lalu{" "}
        <b style={{ color: "#B97F09" }}>RISIKO</b>, dan amankan <b style={{ color: "#1F9D54" }}>PELUANG</b>.
      </p>
      <table className="dtable">
        <thead>
          <tr>
            <th>Prioritas</th>
            <th>Issue</th>
            <th>Command</th>
            <th>PIC</th>
            <th>Deadline</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a, i) => (
            <tr key={i}>
              <td data-label="Prioritas">
                <Pill color={SEV[a.sev].c} bg={SEV[a.sev].bg}>
                  {SEV[a.sev].label}
                </Pill>
              </td>
              <td data-label="Issue">
                <b>{a.title}</b>
                <div className="muted small">{a.detail}</div>
              </td>
              <td data-label="Command">{a.action}</td>
              <td className="muted" data-label="PIC">{a.pic}</td>
              <td data-label="Deadline">
                <b>{a.deadline}</b>
              </td>
              <td className="muted" data-label="Impact">{a.impact || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
