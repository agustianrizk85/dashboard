import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { StaffMember } from "../../types";
import { ProgressBar, Tooltip } from "../ui";

/** Tim / Staff — the department roster with per-author workload. */
export function StaffView() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .staff()
      .then(setStaff)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!staff.length) {
    return (
      <div className="empty-note">
        <div className="spinner" /> Memuat…
      </div>
    );
  }

  const pics = staff.filter((s) => s.isPic);

  return (
    <div className="view view-staff">
      <section className="panel">
        <h2 className="panel-title">Tim Perencanaan · {staff.length} akun</h2>
        <div className="staff-grid">
          {staff.map((m) => (
            <div key={m.username} className={`staff-card ${m.isPic ? "pic" : "mgr"}`}>
              <span className={`avatar lg pic-${m.username}`}>
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="staff-body">
                <div className="staff-name">{m.name}</div>
                <div className="staff-role">{m.roleLabel}</div>
                {m.isPic ? (
                  <div className="staff-meta">
                    {m.done}/{m.total} tugas · {m.progress}%
                  </div>
                ) : (
                  <div className="staff-meta muted">Manajemen · overview</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Beban Kerja Author (PIC)</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Author</th>
              <th>Peran</th>
              <th className="num">
                <Tooltip tip="Total tugas deliverable tanggung jawab author ini di seluruh proyek.">
                  Total
                </Tooltip>
              </th>
              <th className="num">
                <Tooltip tip="Tugas berstatus Selesai.">Selesai</Tooltip>
              </th>
              <th className="num">
                <Tooltip tip="Tugas yang sedang Proses atau menunggu Review.">Berjalan</Tooltip>
              </th>
              <th className="num">
                <Tooltip tip="Flow gambar kerja yang masih aktif (belum selesai).">Gbr. Kerja</Tooltip>
              </th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {pics.map((m) => (
              <tr key={m.username}>
                <td>
                  <span className={`avatar pic-${m.username}`}>{m.name.slice(0, 1)}</span>
                  {m.name}
                </td>
                <td>{m.roleLabel}</td>
                <td className="num">{m.total}</td>
                <td className="num">{m.done}</td>
                <td className="num">{m.inProgress}</td>
                <td className="num">{m.activeDrawings || "—"}</td>
                <td>
                  <div className="cell-progress">
                    <ProgressBar value={m.progress} />
                    <span className="cell-progress-num">{m.progress}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="panel-foot">
          CEO &amp; Kepala Departemen mengelola portfolio dan tidak memegang tugas deliverable
          langsung, sehingga tidak tampil pada tabel beban kerja.
        </p>
      </section>
    </div>
  );
}
