import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabs } from "@/components/DivisionTabs";
import { sheetsApi, field } from "./api";
import type { Row, SheetData, TabInfo } from "./api";
import "./rekap.css";

/** Columns shown in the table (subset of the sheet's ~31 columns). */
const COLUMNS: { key: string; label: string }[] = [
  { key: "No", label: "No" },
  { key: "Nama Konsumen", label: "Konsumen" },
  { key: "Nama Proyek", label: "Proyek" },
  { key: "Blok", label: "Blok" },
  { key: "Nama Sales", label: "Sales" },
  { key: "Cara Bayar", label: "Cara Bayar" },
  { key: "Status", label: "Status" },
  { key: "Tgl Booking", label: "Tgl Booking" },
  { key: "Status DP", label: "DP" },
  { key: "Tahap Proses KPR", label: "Tahap KPR" },
];

/** Coarse status → visual tone. */
function statusTone(v: string): string {
  const s = v.toUpperCase();
  if (s.includes("CLOSED") || s.includes("AKAD")) return "ok";
  if (s.includes("BATAL") || s.includes("CANCEL")) return "bad";
  if (s.includes("PROSES") || s.includes("PENDING")) return "warn";
  return "";
}

function countBy(rows: Row[], key: string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = field(r, key).trim() || "—";
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default function RekapApp() {
  const { user, logout } = useAuth();

  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [spreadsheet, setSpreadsheet] = useState("");
  const [active, setActive] = useState<string>("");
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fSales, setFSales] = useState("");
  const [fBayar, setFBayar] = useState("");

  // 1) discover visible tabs
  useEffect(() => {
    sheetsApi
      .tabs()
      .then((r) => {
        setTabs(r.tabs);
        setSpreadsheet(r.spreadsheet);
        setHiddenCount(r.hiddenCount);
        if (r.tabs.length) setActive(r.tabs[0].title);
        else setError("Tidak ada tab yang bisa ditampilkan.");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (!active) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) load the active tab's data
  const load = useCallback((tab: string) => {
    if (!tab) return;
    setLoading(true);
    setError("");
    sheetsApi
      .data(tab)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  const rows = data?.rows ?? [];

  const statusOpts = useMemo(() => countBy(rows, "Status").map(([v]) => v), [rows]);
  const salesOpts = useMemo(() => countBy(rows, "Nama Sales").map(([v]) => v), [rows]);
  const bayarOpts = useMemo(() => countBy(rows, "Cara Bayar").map(([v]) => v), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus && field(r, "Status").trim() !== fStatus) return false;
      if (fSales && field(r, "Nama Sales").trim() !== fSales) return false;
      if (fBayar && field(r, "Cara Bayar").trim() !== fBayar) return false;
      if (needle) {
        const hay = [
          field(r, "Nama Konsumen"),
          field(r, "Nama Proyek"),
          field(r, "Blok"),
          field(r, "Nama Sales"),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, fStatus, fSales, fBayar]);

  // summary metrics (computed over the FILTERED set so cards track the view)
  const total = filtered.length;
  const dpSudah = filtered.filter((r) => field(r, "Status DP").toUpperCase().includes("SUDAH")).length;
  const kpr = filtered.filter((r) => field(r, "Cara Bayar").toUpperCase().includes("KPR")).length;
  const cash = filtered.filter((r) => field(r, "Cara Bayar").toUpperCase().includes("CASH")).length;
  const byStatus = useMemo(() => countBy(filtered, "Status"), [filtered]);
  const bySales = useMemo(() => countBy(filtered, "Nama Sales").slice(0, 8), [filtered]);

  const resetFilters = () => {
    setQ("");
    setFStatus("");
    setFSales("");
    setFBayar("");
  };
  const hasFilter = q || fStatus || fSales || fBayar;

  return (
    <div className="rk-stage">
      <header className="rk-hdr">
        <div className="rk-hdr-logo">
          <img src="/brand/logo-mark.png" alt="Greenpark Group" onError={(e) => (e.currentTarget.style.display = "none")} />
        </div>
        <div className="rk-hdr-titles">
          <h1>Rekap Penjualan</h1>
          <div className="rk-sub">{spreadsheet || "Greenpark Group · data dari Google Sheets"}</div>
        </div>
        <div className="rk-hdr-spacer" />
        <div className="rk-hdr-meta">
          <div className="rk-hdr-user">
            <div className="hu-name">{user?.name}</div>
            <div className="hu-role">Rekap lintas divisi</div>
          </div>
          <button className="rk-logout" onClick={logout} title="Keluar">
            ✕
          </button>
        </div>
      </header>

      <nav className="rk-nav">
        <DivisionTabs />
      </nav>

      <main className="rk-content">
        {/* tab selector (only if more than one visible tab) + refresh */}
        <div className="rk-toolbar">
          <div className="rk-tabs">
            {tabs.map((t) => (
              <button
                key={t.title}
                className={`rk-tabchip ${active === t.title ? "on" : ""}`}
                onClick={() => setActive(t.title)}
              >
                {t.title}
              </button>
            ))}
            {hiddenCount > 0 && (
              <span className="rk-hidden-note" title="Tab yang di-hide di Google Sheets diblokir oleh server dan tidak ditampilkan.">
                🔒 {hiddenCount} tab tersembunyi disembunyikan
              </span>
            )}
          </div>
          <button className="rk-refresh" onClick={() => load(active)} disabled={loading || !active}>
            {loading ? "Memuat…" : "↻ Muat ulang"}
          </button>
        </div>

        {error && <div className="rk-error">Gagal memuat: {error}</div>}

        {loading && !data ? (
          <div className="rk-empty">Memuat data dari spreadsheet…</div>
        ) : (
          <>
            {/* summary cards */}
            <section className="rk-cards">
              <div className="rk-card">
                <div className="rk-card-val">{total}</div>
                <div className="rk-card-lbl">Total Booking{hasFilter ? " (terfilter)" : ""}</div>
              </div>
              <div className="rk-card">
                <div className="rk-card-val">{kpr}</div>
                <div className="rk-card-lbl">KPR</div>
              </div>
              <div className="rk-card">
                <div className="rk-card-val">{cash}</div>
                <div className="rk-card-lbl">Cash</div>
              </div>
              <div className="rk-card">
                <div className="rk-card-val">{dpSudah}</div>
                <div className="rk-card-lbl">Sudah DP</div>
              </div>
            </section>

            {/* status + sales breakdown */}
            <section className="rk-breakdown">
              <div className="rk-panel">
                <h3>Per Status</h3>
                <div className="rk-chips">
                  {byStatus.map(([v, n]) => (
                    <button
                      key={v}
                      className={`rk-chip ${statusTone(v)} ${fStatus === v ? "sel" : ""}`}
                      onClick={() => setFStatus(fStatus === v ? "" : v)}
                    >
                      {v} <b>{n}</b>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rk-panel">
                <h3>Top Sales</h3>
                <ul className="rk-leader">
                  {bySales.map(([v, n]) => (
                    <li key={v}>
                      <button
                        className={fSales === v ? "sel" : ""}
                        onClick={() => setFSales(fSales === v ? "" : v)}
                      >
                        <span>{v}</span>
                        <b>{n}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* filters */}
            <section className="rk-filters">
              <input
                className="rk-search"
                placeholder="Cari konsumen / proyek / blok / sales…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">Semua Status</option>
                {statusOpts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={fBayar} onChange={(e) => setFBayar(e.target.value)}>
                <option value="">Semua Cara Bayar</option>
                {bayarOpts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={fSales} onChange={(e) => setFSales(e.target.value)}>
                <option value="">Semua Sales</option>
                {salesOpts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {hasFilter && (
                <button className="rk-clear" onClick={resetFilters}>
                  Reset
                </button>
              )}
            </section>

            {/* table */}
            <div className="rk-tablewrap">
              <table className="rk-table">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i}>
                      {COLUMNS.map((c) => {
                        const v = field(r, c.key);
                        if (c.key === "Status") {
                          return (
                            <td key={c.key}>
                              <span className={`rk-badge ${statusTone(v)}`}>{v || "—"}</span>
                            </td>
                          );
                        }
                        return <td key={c.key}>{v || "—"}</td>;
                      })}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="rk-noresult" colSpan={COLUMNS.length}>
                        Tidak ada baris yang cocok dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rk-footnote">
              Menampilkan {filtered.length} dari {rows.length} baris · sumber: {data?.tab}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
