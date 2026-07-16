import { useMemo } from "react";
import type { Dashboard } from "./types";
import { StatCard, AreaSpark } from "@/components/wms/widgets";

/** WMS-style CSO overview (staff/kadep view). Real data from the CSO dashboard
 *  hook, laid out in the shared Ops-Console cards: open-complaint notification
 *  list, KPI stat cards, a defect-category table and a completion card. */
const pct = (v: number) => `${(v ?? 0).toFixed(1)}%`;

function isOpen(status: string): boolean {
  const s = (status || "").toUpperCase();
  return s !== "COMPLETE" && s !== "SELESAI" && s !== "DONE" && s !== "CLOSED";
}

export function CsoOverviewWms({ D, setTab }: { D: Dashboard; setTab: (t: string) => void }) {
  const s = D.ini;
  const l = D.lalu;
  const tickets = D.tickets ?? [];
  const kategori = D.kategori ?? [];

  // Weekly complaint series for the sparklines — real values from the S-curve.
  const series = useMemo(() => {
    const w = [...(D.kurva ?? [])].sort((a, b) => a.week - b.week).map((x) => x.totalIni);
    return w.length ? w : [0, 0];
  }, [D.kurva]);

  const open = useMemo(() => tickets.filter((t) => isOpen(t.status)), [tickets]);
  const totalDelta = s.total - l.total;
  const slaDelta = s.slaPct - l.slaPct;
  const maxCat = Math.max(1, ...kategori.map((c) => c.jumlah));

  return (
    <div className="wms-grid">
      {/* Notification/list card: open complaints needing follow-up */}
      <div className="wms-card wms-col-5" style={{ display: "flex", flexDirection: "column" }}>
        <div className="wms-noti-h">
          <h2>{open.length} Perlu Tindak Lanjut</h2>
        </div>
        <div className="wms-noti-list">
          {open.length === 0 ? (
            <div className="wms-empty">Tidak ada komplain terbuka.</div>
          ) : (
            open.slice(0, 12).map((t) => {
              const kls = (t.klasifikasi || "").toUpperCase();
              const tone = kls === "CRITICAL" ? "danger" : kls === "MAJOR" ? "warn" : "";
              return (
                <div key={t.id} className={`wms-noti ${tone}`}>
                  <div className="wms-noti-body">
                    <div className="wms-noti-top">
                      <span className="wms-noti-type">{t.proyek || t.kategori || "Komplain"}</span>
                      <span className="wms-noti-time">{t.tanggal || "—"}</span>
                    </div>
                    <div className="wms-noti-msg">
                      {t.deskripsi || t.kategori || "—"} · {t.klasifikasi || "—"} · SLA {t.sla || "—"}
                    </div>
                  </div>
                  <button className="wms-noti-go" onClick={() => setTab("tiket")} type="button" aria-label="Buka tiket">
                    →
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* KPI stat cards */}
      <StatCard
        title={`Total Komplain ${D.yearNow || ""}`}
        value={s.total}
        data={series}
        delta={totalDelta === 0 ? `sama vs ${D.yearLast || "thn lalu"}` : `${totalDelta > 0 ? `naik ${totalDelta}` : `turun ${Math.abs(totalDelta)}`} vs ${D.yearLast || "thn lalu"}`}
        deltaUp={totalDelta <= 0}
        subtitle={`${s.complete} selesai · ${s.notDone} belum`}
        className="wms-col-4"
      />
      <StatCard
        title="SLA Tepat Waktu"
        value={pct(s.slaPct)}
        data={series}
        delta={`${Math.abs(slaDelta).toFixed(1)} poin`}
        deltaUp={slaDelta >= 0}
        subtitle="Target ≥ 90%"
        className="wms-col-3"
      />

      {/* wms-table of complaints: top defect categories */}
      <div className="wms-card wms-col-7">
        <div className="wms-card-h">
          <h3>Kategori Defect Teratas</h3>
          <button className="wms-btn ghost" onClick={() => setTab("ranking")} type="button">
            Ranking →
          </button>
        </div>
        <table className="wms-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Kategori</th>
              <th>Kata Kunci</th>
              <th>Jumlah</th>
              <th>Porsi</th>
            </tr>
          </thead>
          <tbody>
            {[...kategori]
              .sort((a, b) => b.jumlah - a.jumlah)
              .slice(0, 8)
              .map((c, i) => (
                <tr key={c.kategori}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{c.kategori}</b>
                  </td>
                  <td>{c.kataKunci || "—"}</td>
                  <td>{c.jumlah}</td>
                  <td>
                    <span className={`wms-badge ${i === 0 ? "danger" : ""}`}>{Math.round((c.jumlah / maxCat) * 100)}%</span>
                  </td>
                </tr>
              ))}
            {kategori.length === 0 && (
              <tr>
                <td className="wms-empty" colSpan={5}>
                  Belum ada data kategori.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Completion card */}
      <div className="wms-card wms-col-5">
        <div className="wms-card-h">
          <h3>Penyelesaian {D.yearNow || ""}</h3>
        </div>
        <AreaSpark data={series} />
        <div className="wms-stat-val">
          {s.complete}
          <span className={`wms-delta ${s.notDone > 0 ? "down" : "up"}`}>{s.notDone} belum</span>
        </div>
        <div className="wms-card-sub">
          {s.afterBast} sudah BAST · {s.inProgress} in-progress · terlambat {s.lateT1 + s.lateT2}
        </div>
      </div>

      {/* Source footer */}
      <div className="wms-card wms-col-12">
        <div className="wms-card-sub">
          Sumber: {D.source || "—"} · diperbarui {D.updatedAt ? new Date(D.updatedAt).toLocaleString("id-ID") : "—"} · rentang {D.dateRange?.awal || "—"} s/d {D.dateRange?.akhir || "—"}
        </div>
      </div>
    </div>
  );
}
