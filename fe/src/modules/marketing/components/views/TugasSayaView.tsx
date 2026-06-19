import { useEffect, useMemo, useState } from "react";
import type { User, MineStep, StepStatus } from "../../models";
import { stepService } from "../../services/step.service";
import { alurShort } from "../../lib/alurCatalog";

const COLS: { key: StepStatus; label: string; tone: string }[] = [
  { key: "pending", label: "Belum", tone: "grey" },
  { key: "in_progress", label: "Proses", tone: "warn" },
  { key: "done", label: "Selesai", tone: "ok" },
];
const statusLabel: Record<StepStatus, string> = { pending: "Belum", in_progress: "Proses", done: "Selesai" };

// PIC positions a manager can switch between (each owns steps in the catalog).
const POSITIONS = [
  "Copywriter",
  "Design Grafis",
  "Video Editor",
  "Social Media Specialist",
  "Digital Marketing",
  "Talent",
  "Videografer",
  "Kepala Departemen Marketing",
];
const short = (p: string) => (p === "Kepala Departemen Marketing" ? "Kadep" : p);

export function TugasSayaView({ user, canEdit, onChanged }: { user: User; canEdit: boolean; onChanged: () => void }) {
  const canManage = user.role === "kadep";
  const [pic, setPic] = useState(canManage ? POSITIONS[0] : user.position);
  const [steps, setSteps] = useState<MineStep[] | null>(null);
  const [err, setErr] = useState("");

  const load = (who: string) => {
    setSteps(null);
    setErr("");
    stepService
      .mine(who)
      .then(setSteps)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => load(pic), [pic]);

  const columns = useMemo(() => {
    const by: Record<StepStatus, MineStep[]> = { pending: [], in_progress: [], done: [] };
    (steps ?? []).forEach((s) => by[s.status].push(s));
    return by;
  }, [steps]);

  const setStatus = async (s: MineStep, status: StepStatus) => {
    setErr("");
    try {
      await stepService.update(s.id, { status });
      load(pic);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="view view-tasks">
      <div className="tasks-hd">
        <h2 className="panel-title">Papan Tugas — {short(pic)}</h2>
        {canManage && (
          <div className="seg">
            {POSITIONS.map((p) => (
              <button key={p} className={pic === p ? "on" : ""} onClick={() => setPic(p)}>
                {short(p)}
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <div className="empty-note error">{err}</div>}
      {!steps ? (
        <div className="empty-note">
          <div className="spinner" /> Memuat tugas…
        </div>
      ) : steps.length === 0 ? (
        <div className="empty-note">Tidak ada langkah untuk {short(pic)}.</div>
      ) : (
        <div className="kanban" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {COLS.map((col) => (
            <div className="kan-col" key={col.key}>
              <div className={`kan-col-hd ${col.tone}`}>
                {col.label}
                <span className="kan-count">{columns[col.key].length}</span>
              </div>
              <div className="kan-cards">
                {columns[col.key].map((s) => (
                  <div className="kan-card" key={s.id}>
                    <div className="kan-card-name">{s.name}</div>
                    <div className="kan-card-meta">
                      {s.code} · {s.work_item_title}
                    </div>
                    <div className="kan-card-foot">
                      <span className="kan-cat">{alurShort[s.work_item_alur]}</span>
                      {s.is_approval && <span className="out-tag">Approval</span>}
                      {s.requires_budget && <span className="out-tag">{s.budget_label}</span>}
                    </div>
                    {canEdit && (
                      <select
                        className="status-select sm"
                        value={s.status}
                        onChange={(e) => setStatus(s, e.target.value as StepStatus)}
                      >
                        {COLS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {statusLabel[c.key]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {columns[col.key].length === 0 && <div className="kan-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
