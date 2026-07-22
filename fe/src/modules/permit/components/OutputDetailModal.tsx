import type { XdivDeliverable } from "@/modules/permit/services/perencanaan.service";

/* Read-only detail popup for one cross-division deliverable routed to Legal
 * Permit (opened from the Output Divisi page). Mirrors the board card modal's
 * layout — header + labelled meta blocks — but never edits: the deliverable is
 * owned by the source division (Perencanaan), managed there. */

const statusMeta: Record<string, { label: string; cls: string }> = {
  todo: { label: "Belum", cls: "od-st-todo" },
  progress: { label: "Proses", cls: "od-st-prog" },
  review: { label: "Review", cls: "od-st-review" },
  done: { label: "Selesai", cls: "od-st-done" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return s.toUpperCase();
}

function fmtDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function OutputDetailModal({
  d,
  docUrl,
  onClose,
}: {
  d: XdivDeliverable;
  docUrl: (projectId: string, taskId: string) => string;
  onClose: () => void;
}) {
  const st = statusMeta[d.status] ?? statusMeta.todo;
  return (
    <div
      className="odm-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="odm-modal">
        <button className="odm-x" onClick={onClose} aria-label="Tutup">
          ×
        </button>

        <div className="odm-head">
          <h2 className="odm-title">{d.deliverable}</h2>
          <div className="odm-subrow">
            <span className="odm-sub">
              di Papan Tugas · Departemen <b>Perencanaan</b>
            </span>
            <span className="odm-spacer" />
            <span className={`od-badge ${st.cls}`}>{st.label}</span>
            <span className="odm-chip">Output → Legal Permit</span>
          </div>
        </div>

        <div className="odm-grid">
          <div className="odm-block">
            <span className="odm-label">PIC</span>
            <span className="odm-pic">
              <span className="odm-avatar">{initials(d.pic || "?")}</span>
              {d.pic || "—"}
            </span>
          </div>
          <div className="odm-block">
            <span className="odm-label">Divisi Asal</span>
            <span className="odm-value">Perencanaan</span>
          </div>
          <div className="odm-block">
            <span className="odm-label">Proyek</span>
            <span className="odm-value">
              {d.gp ? `${d.gp} · ` : ""}
              {d.projectName}
            </span>
          </div>
          <div className="odm-block">
            <span className="odm-label">Kategori</span>
            <span className="odm-value">
              {d.category || "—"}
              {d.group && d.group !== d.category ? ` · ${d.group}` : ""}
            </span>
          </div>
          <div className="odm-block">
            <span className="odm-label">Diperbarui</span>
            <span className="odm-value">{fmtDate(d.updatedAt)}</span>
          </div>
          {d.approvedBy && (
            <div className="odm-block">
              <span className="odm-label">Disetujui oleh</span>
              <span className="odm-value">{d.approvedBy}</span>
            </div>
          )}
        </div>

        <div className="odm-section">
          <span className="odm-label">Dokumen</span>
          {d.hasDoc ? (
            <a
              className="od-doc-link odm-doc"
              href={docUrl(d.projectId, d.taskId)}
              target="_blank"
              rel="noreferrer"
            >
              Lihat / Unduh dokumen
            </a>
          ) : (
            <span className="od-nodoc">Belum ada dokumen</span>
          )}
        </div>

        <div className="odm-note">
          Tampilan baca-saja — deliverable ini dikelola di modul Perencanaan.
        </div>
      </div>
    </div>
  );
}
