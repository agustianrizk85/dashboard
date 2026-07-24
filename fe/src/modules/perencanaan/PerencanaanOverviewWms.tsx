import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard, AreaSpark } from "@/components/wms/widgets";
import { api } from "./api/client";
import { Modal } from "./components/Modal";
import { picName } from "./lib/format";
import type { Rag } from "./types";
import { usePerencanaanData } from "./PerencanaanWmsData";

/** Map a project RAG status to the WMS notification tone. */
function ragTone(status: Rag): "green" | "warn" | "danger" {
  if (status === "red") return "danger";
  if (status === "amber") return "warn";
  return "green";
}

/** WMS-style Perencanaan overview (staff / kadep view). Real portfolio data from
 *  the perencanaan API (`summary` + `projects`) laid out in the shared Ops-Console
 *  cards — a project list, KPI stat cards, the author-load table and division
 *  readiness. Kadep also gets the admin data actions preserved from the classic UI. */
export function PerencanaanOverviewWms() {
  const nav = useNavigate();
  const { summary, projects, reload, canManage } = usePerencanaanData();

  // Admin data actions (seed / reset) — preserved for managers (Kadep).
  const [confirm, setConfirm] = useState<null | "proses" | "master" | "kosong">(null);
  const [busy, setBusy] = useState<"" | "seed" | "proses" | "master" | "kosong">("");
  const [adminErr, setAdminErr] = useState("");

  const runSeed = async () => {
    setBusy("seed");
    setAdminErr("");
    try {
      await api.seed();
      reload();
    } catch (e) {
      setAdminErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const runReset = async (kind: "proses" | "master" | "kosong") => {
    setBusy(kind);
    setAdminErr("");
    try {
      await (kind === "proses" ? api.resetProses() : kind === "master" ? api.resetMaster() : api.emptyAll());
      setConfirm(null);
      reload();
    } catch (e) {
      setAdminErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const pics = summary?.pics ?? [];
  const divisions = summary?.divisions ?? [];
  const alerts = summary?.alerts ?? { red: 0, amber: 0, green: 0 };
  const avgProgress = summary?.avgProgress ?? 0;
  const tasks = summary?.tasks ?? 0;
  const tasksDone = summary?.tasksDone ?? 0;

  // Derived (non-fabricated) numeric series for the sparklines.
  const progressSeries = useMemo(() => {
    const arr = pics.length ? pics.map((p) => p.progress) : projects.map((p) => p.progress);
    return arr.length ? arr : [0, 0];
  }, [pics, projects]);
  const divisionSeries = useMemo(() => {
    const arr = divisions.map((d) => (d.total > 0 ? Math.round((d.ready / d.total) * 100) : 0));
    return arr.length ? arr : [0, 0];
  }, [divisions]);

  const donePct = tasks > 0 ? Math.round((tasksDone / tasks) * 100) : 0;
  const readyDivs = divisions.filter((d) => d.total > 0 && d.ready >= d.total).length;

  return (
    <div className="wms-grid">
      {/* Left: project portfolio list */}
      <div className="wms-card wms-col-5" style={{ display: "flex", flexDirection: "column" }}>
        <div className="wms-noti-h">
          <h2>{projects.length} Proyek</h2>
        </div>
        <div className="wms-noti-list">
          {!summary ? (
            <div className="wms-empty">Memuat…</div>
          ) : projects.length === 0 ? (
            <div className="wms-empty">Belum ada proyek.</div>
          ) : (
            projects.map((p) => {
              const tone = ragTone(p.status);
              return (
                <div key={p.id} className={`wms-noti ${tone === "green" ? "" : tone}`}>
                  <div className="wms-noti-body">
                    <div className="wms-noti-top">
                      <span className="wms-noti-type">
                        {p.gp} · {p.name}
                      </span>
                      <span className="wms-noti-time">{p.progress}%</span>
                    </div>
                    <div className="wms-noti-msg">
                      {p.lokasi || "Lokasi belum diisi"} · {p.done}/{p.total} deliverable
                    </div>
                  </div>
                  <button className="wms-noti-go" onClick={() => nav("/perencanaan/projects")} type="button" aria-label="Buka">
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
        title="Progress Portofolio"
        value={`${avgProgress}%`}
        data={progressSeries}
        delta="rata-rata"
        subtitle={`${projects.length} proyek aktif`}
        className="wms-col-4"
      />
      <StatCard
        title="Alert SLA"
        value={alerts.red + alerts.amber}
        data={[alerts.green, alerts.amber, alerts.red]}
        deltaUp={alerts.red === 0}
        delta={alerts.red > 0 ? `${alerts.red} telat` : "aman"}
        subtitle={`${alerts.red} telat · ${alerts.amber} mendekati`}
        className="wms-col-3"
      />

      {/* Author workload table */}
      <div className="wms-card wms-col-7">
        <div className="wms-card-h">
          <h3>Beban Author (PIC)</h3>
        </div>
        <table className="wms-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Task</th>
              <th>Selesai</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {pics.map((p) => (
              <tr key={p.pic}>
                <td>{picName(p.pic)}</td>
                <td>{p.total}</td>
                <td>{p.done}</td>
                <td>{p.progress}%</td>
              </tr>
            ))}
            {pics.length === 0 && (
              <tr>
                <td className="wms-empty" colSpan={4}>
                  {summary ? "Belum ada data." : "Memuat…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Deliverable completion + division readiness */}
      <div className="wms-card wms-col-5">
        <div className="wms-card-h">
          <h3>Deliverable Selesai</h3>
        </div>
        <AreaSpark data={divisionSeries} />
        <div className="wms-stat-val">
          {tasksDone}/{tasks}
          <span className={`wms-delta ${donePct >= 50 ? "up" : "down"}`}>
            {donePct >= 50 ? "▲" : "▼"} {donePct}%
          </span>
        </div>
        <div className="wms-card-sub">Kesiapan output {readyDivs}/{divisions.length} divisi</div>
      </div>

      {/* Admin data actions (Kadep only) — preserved from the classic dashboard. */}
      {canManage && (
        <div className="wms-card wms-col-12">
          <div className="wms-card-h">
            <h3>Admin Data</h3>
          </div>
          {adminErr && <div className="wms-card-sub" style={{ color: "var(--wms-danger)" }}>{adminErr}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <button className="wms-btn ghost" onClick={runSeed} disabled={busy !== ""} type="button">
              {busy === "seed" ? "Mengisi…" : "Isi Contoh"}
            </button>
            <button className="wms-btn ghost" onClick={() => setConfirm("proses")} disabled={busy !== ""} type="button">
              Reset Proses
            </button>
            <button className="wms-btn" onClick={() => setConfirm("master")} disabled={busy !== ""} type="button" style={{ background: "var(--wms-danger)", borderColor: "var(--wms-danger)" }}>
              Reset Master
            </button>
            <button className="wms-btn" onClick={() => setConfirm("kosong")} disabled={busy !== ""} type="button" style={{ background: "#7f1d1d", borderColor: "#7f1d1d" }}>
              Kosongkan Semua
            </button>
          </div>
        </div>
      )}

      {confirm === "proses" && (
        <Modal title="Reset Data Proses" sub="Master tetap" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Mengosongkan <b>data proses</b>: seluruh progress tugas kembali ke status <b>Belum</b> dan{" "}
            <b>semua flow gambar kerja dihapus</b>. Data <b>master tetap utuh</b>. Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-primary" onClick={() => runReset("proses")} disabled={busy !== ""}>
              {busy === "proses" ? "Mereset…" : "Reset Proses"}
            </button>
          </div>
        </Modal>
      )}

      {confirm === "master" && (
        <Modal title="Reset Data Master" sub="Mengembalikan portfolio bawaan" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Mengembalikan portfolio ke <b>32 proyek bawaan</b>. <b>Proyek yang ditambah manual akan terhapus</b>, dan
            seluruh data proses ikut dikosongkan. Tindakan ini tidak dapat dibatalkan. Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-danger" onClick={() => runReset("master")} disabled={busy !== ""}>
              {busy === "master" ? "Mereset…" : "Ya, Reset Master"}
            </button>
          </div>
        </Modal>
      )}

      {confirm === "kosong" && (
        <Modal title="Kosongkan Semua Data" sub="Benar-benar kosong — tidak ada sama sekali" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Menghapus <b>SEMUA</b> data secara permanen dan <b>tidak dapat dibatalkan</b>:
            seluruh <b>proyek &amp; deliverable</b>, semua <b>master</b> (GP, Tipe Bangunan),
            serta <b>Blok &amp; Kavling</b> dan file lampiran. Portfolio jadi <b>benar-benar kosong</b> —
            tanpa data contoh apa pun (tidak ikut di-isi ulang). Roster tim &amp; papan tugas tidak terpengaruh.
            Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-danger" onClick={() => runReset("kosong")} disabled={busy !== ""}>
              {busy === "kosong" ? "Mengosongkan…" : "Ya, Kosongkan Semua"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
