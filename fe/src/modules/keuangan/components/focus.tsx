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
