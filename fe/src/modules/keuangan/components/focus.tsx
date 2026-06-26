import type { ReactNode } from "react";
import type { Dashboard, ProjectFin } from "../types";
import { rp, toneClass } from "../lib/status";
import { Pill, Stat } from "./ui";
import { MonthlyChart } from "./CashflowChart";

const num = (n: number) => n.toLocaleString("id-ID");

export interface FocusMeta {
  tag: string;
  title: string;
  sub: string;
  render: (d: Dashboard) => ReactNode;
}

/** Full-detail views for each non-overview tab. */
export const FOCUS_META: Record<string, FocusMeta> = {
  project: {
    tag: "PROYEK",
    title: "Akad per Proyek",
    sub: "nilai plafond, DP, KPR%, status",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr>
            <th>Proyek</th><th>GP</th><th className="num">Akad</th><th className="num">Booking</th>
            <th className="num">Batal</th><th className="num">KPR%</th><th>Bank Utama</th>
            <th className="num">DP</th><th className="num">Nilai Akad</th>
          </tr>
        </thead>
        <tbody>
          {d.projects.map((p) => (
            <tr key={p.code}>
              <td>{p.name}</td><td>{p.gp}</td><td className="num">{p.akad}</td>
              <td className="num">{p.booking}</td><td className="num">{p.batal}</td>
              <td className="num">{p.kprPct}%</td><td>{p.topBank || "—"}</td>
              <td className="num">{rp(p.dp)}</td><td className="num">{rp(p.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  bank: {
    tag: "PENDANAAN",
    title: "Plafond KPR per Bank",
    sub: "distribusi pembiayaan",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr><th>Bank</th><th className="num">Akad</th><th className="num">Share</th><th className="num">Total Plafond</th></tr>
        </thead>
        <tbody>
          {d.banks.map((b) => (
            <tr key={b.name}>
              <td>{b.name}</td><td className="num">{b.akad}</td><td className="num">{b.share}%</td>
              <td className="num">{rp(b.plafon)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  sales: {
    tag: "SALES",
    title: "Kontribusi Akad per Sales",
    sub: "ranking",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr><th>#</th><th>Sales</th><th>Tipe</th><th className="num">Akad</th><th className="num">Nilai</th></tr>
        </thead>
        <tbody>
          {d.sales.map((s, i) => (
            <tr key={s.name + i}>
              <td className="num">{i + 1}</td><td>{s.name}</td>
              <td>{s.isAgent ? <Pill tone="orange" dot={false}>Agent</Pill> : "Sales"}</td>
              <td className="num">{s.akad}</td><td className="num">{rp(s.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  pipeline: {
    tag: "EARLY WARNING",
    title: "Pipeline KPR Tertahan",
    sub: "booking aktif & kendala",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr><th>Tahap</th><th>Konsumen</th><th>Proyek</th><th>Blok</th><th>Sales</th><th>Bank</th><th>Kendala</th></tr>
        </thead>
        <tbody>
          {d.pipeline.map((r, i) => (
            <tr key={r.customer + i}>
              <td><Pill tone={r.sla === "overdue" ? "red" : r.sla === "due" ? "yellow" : "green"} dot>{r.stage}</Pill></td>
              <td>{r.customer}</td><td>{r.project}</td><td>{r.blok}</td><td>{r.sales}</td>
              <td>{r.bank || r.caraBayar}</td><td>{r.kendala || "—"}</td>
            </tr>
          ))}
          {d.pipeline.length === 0 && <tr><td colSpan={7}>Tidak ada booking aktif tertahan.</td></tr>}
        </tbody>
      </table>
    ),
  },
  cashflow: {
    tag: "TREN",
    title: "Tren Akad & Cash-in per Bulan",
    sub: "Plafon (—) vs DP (- -), Rp miliar",
    render: (d) => (
      <>
        <MonthlyChart monthly={d.monthly} />
        <table className="ftable">
          <thead>
            <tr><th>Bulan</th><th className="num">Akad</th><th className="num">Nilai (Plafon)</th><th className="num">Cash-in DP</th></tr>
          </thead>
          <tbody>
            {d.monthly.map((m) => (
              <tr key={m.period}>
                <td>{m.period}</td><td className="num">{m.akad}</td>
                <td className="num">{rp(m.nilai)}</td><td className="num">{rp(m.dp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  ai: {
    tag: "AI",
    title: "AI Insight & Keputusan",
    sub: "ringkasan war-room",
    render: (d) => (
      <div className="focus-ai">
        <div className="ai-list">
          {d.ai.map((a, i) => (
            <div className="ai-item" key={i}>
              <Pill tone={toneClass(a.tone)} dot>{a.type}</Pill>
              <span className="ai-text">{a.text}</span>
            </div>
          ))}
        </div>
        <h4>Keputusan per Peran</h4>
        <table className="ftable">
          <thead><tr><th>Peran</th><th>Aksi</th></tr></thead>
          <tbody>
            {d.decisions.map((x, i) => (
              <tr key={i}><td>{x.role}</td><td>{x.text}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  kpi: {
    tag: "KPI",
    title: "Scorecard KPI Keuangan",
    sub: "indikator & ambang",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr><th>#</th><th>KPI</th><th>Definisi</th><th>PIC</th><th>Hijau</th><th>Kuning</th><th>Merah</th><th>Nilai</th><th>Status</th></tr>
        </thead>
        <tbody>
          {d.kpis.map((k) => (
            <tr key={k.no}>
              <td className="num">{k.no}</td><td>{k.kpi}</td><td>{k.def}</td><td>{k.pic}</td>
              <td>{k.green}</td><td>{k.yellow}</td><td>{k.red}</td>
              <td className="num">{k.val}</td><td><Pill tone={toneClass(k.state)} dot>{k.state}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  purchasing: {
    tag: "PEMBELIAN (PR)",
    title: "Pengadaan & Hutang Pemasok",
    sub: "PO, faktur, pembayaran & hutang",
    render: (d) => {
      const pur = d.purchasing;
      const s = pur.summary;
      return (
        <div className="focus-ai">
          <div className="pd-stats" style={{ marginBottom: 14 }}>
            <Stat label="Nilai PO" value={rp(s.poValue)} />
            <Stat label="Total Faktur" value={rp(s.invoiceValue)} />
            <Stat label="Dibayar" value={rp(s.paidValue)} tone="ok" />
            <Stat label="Hutang (Terutang)" value={rp(s.outstanding)} tone={s.outstanding > 0 ? "bad" : "ok"} />
            <Stat label="Jumlah PO" value={num(s.poCount)} />
            <Stat label="Pemasok" value={num(s.supplierCount)} />
          </div>

          <h4>Pemasok</h4>
          <table className="ftable">
            <thead>
              <tr><th>Pemasok</th><th className="num">Item PO</th><th className="num">Nilai PO</th><th className="num">Faktur</th><th className="num">Dibayar</th><th className="num">Hutang</th></tr>
            </thead>
            <tbody>
              {pur.bySupplier.map((sup, i) => (
                <tr key={sup.name + i}>
                  <td>{sup.name}</td><td className="num">{sup.docs}</td>
                  <td className="num">{rp(sup.poValue)}</td><td className="num">{rp(sup.invoiced)}</td>
                  <td className="num">{rp(sup.paid)}</td>
                  <td className="num">{sup.outstanding > 0 ? <Pill tone="orange" dot={false}>{rp(sup.outstanding)}</Pill> : "—"}</td>
                </tr>
              ))}
              {pur.bySupplier.length === 0 && <tr><td colSpan={6}>Belum ada data.</td></tr>}
            </tbody>
          </table>

          <h4>Pesanan Pembelian (PO) Terbaru</h4>
          <table className="ftable">
            <thead>
              <tr><th>Tanggal</th><th>No PO</th><th>Pemasok</th><th>Barang</th><th className="num">Qty</th><th>Proyek</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {pur.orders.slice(0, 30).map((o, i) => (
                <tr key={o.nomor + i}>
                  <td>{o.tanggal}</td><td>{o.nomor}</td><td>{o.pemasok}</td><td>{o.barang}</td>
                  <td className="num">{num(o.qty)}{o.satuan ? ` ${o.satuan}` : ""}</td><td>{o.proyek || "—"}</td>
                  <td className="num">{rp(o.total)}</td>
                </tr>
              ))}
              {pur.orders.length === 0 && <tr><td colSpan={7}>Belum ada PO.</td></tr>}
            </tbody>
          </table>

          <h4>Pembayaran & Hutang</h4>
          <table className="ftable">
            <thead>
              <tr><th>Tgl Bayar</th><th>No Bukti</th><th>Pemasok</th><th>Bank</th><th>No Faktur</th><th className="num">Total Faktur</th><th className="num">Dibayar</th><th className="num">Terutang</th></tr>
            </thead>
            <tbody>
              {pur.payments.slice(0, 30).map((p, i) => (
                <tr key={p.noBukti + i}>
                  <td>{p.tanggal}</td><td>{p.noBukti}</td><td>{p.pemasok}</td><td>{p.bank || "—"}</td>
                  <td>{p.noFaktur}</td><td className="num">{rp(p.totalFaktur)}</td><td className="num">{rp(p.bayar)}</td>
                  <td className="num">{p.terutang > 0 ? <Pill tone="orange" dot={false}>{rp(p.terutang)}</Pill> : "—"}</td>
                </tr>
              ))}
              {pur.payments.length === 0 && <tr><td colSpan={8}>Belum ada pembayaran.</td></tr>}
            </tbody>
          </table>
        </div>
      );
    },
  },
  triggers: {
    tag: "EARLY WARNING",
    title: "Trigger & Eskalasi",
    sub: "aturan peringatan dini",
    render: (d) => (
      <table className="ftable">
        <thead>
          <tr><th>Kondisi</th><th>Ambang</th><th>Status</th><th>PIC</th><th>Aksi</th><th>Eskalasi</th></tr>
        </thead>
        <tbody>
          {d.triggers.map((t, i) => (
            <tr key={i}>
              <td>{t.cond}</td><td>{t.thr}</td>
              <td><Pill tone={toneClass(t.status)} dot>{t.status}</Pill></td>
              <td>{t.pic}</td><td>{t.act}</td><td>{t.esc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
};

/** Project deep-dive shown in the modal when a project row is clicked. */
export function ProjectDetail({ p }: { p: ProjectFin }) {
  return (
    <div className="pd">
      <div className="pd-stats">
        <Stat label="Akad" value={num(p.akad)} tone="ok" />
        <Stat label="Booking Aktif" value={num(p.booking)} tone="warn" />
        <Stat label="Batal" value={num(p.batal)} tone={p.batal > 0 ? "bad" : "ok"} />
        <Stat label="KPR Share" value={`${p.kprPct}%`} />
        <Stat label="Nilai Akad" value={rp(p.nilai)} />
        <Stat label="Cash-in DP" value={rp(p.dp)} />
      </div>
      <div className="pd-meta">
        <div>GP: <b>{p.gp}</b></div>
        <div>Bank utama: <b>{p.topBank || "—"}</b></div>
      </div>
      <p className="pd-note">{p.note}</p>
    </div>
  );
}
