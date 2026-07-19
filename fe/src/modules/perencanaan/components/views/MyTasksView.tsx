import { useEffect, useMemo, useState } from "react";
import type { AssignedTask, StaffMember, TaskStatus } from "../../types";
import { api } from "../../api/client";
import { STATUS_LABELS, STATUS_ORDER, picName, ragTone } from "../../lib/format";
import { ReviewControls } from "../ReviewControls";

/**
 * Tugas Saya view — the "flow membagi tugas": every deliverable assigned to one
 * author across the whole portfolio, grouped as a kanban by status. Managers can
 * switch between authors (roster from the SSO sync); an author sees only their
 * own board.
 */
export function MyTasksView({
  username,
  canManage,
  canEdit,
  pics,
  onChanged,
}: {
  username: string;
  canManage: boolean;
  canEdit: (pic: string) => boolean;
  pics: StaffMember[];
  onChanged: () => void;
}) {
  const [pic, setPic] = useState(username);
  const [picTouched, setPicTouched] = useState(false);
  const [projFilter, setProjFilter] = useState("");
  const [tasks, setTasks] = useState<AssignedTask[] | null>(null);
  const [err, setErr] = useState("");

  // Default a manager to the first author's board once the roster loads (unless
  // they've picked one). A non-manager always sees their own board.
  useEffect(() => {
    if (canManage && !picTouched && pics.length) setPic(pics[0].username);
  }, [canManage, picTouched, pics]);

  const load = (who: string) => {
    setTasks(null);
    setErr("");
    api
      .myTasks(canManage ? who : undefined)
      .then(setTasks)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => load(pic), [pic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Project options, derived from the loaded tasks — lets the user narrow the
  // board to a single project so the columns are not too long.
  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    (tasks ?? []).forEach((t) => seen.set(t.projectId, `${t.gp} · ${t.projectName}`));
    return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [tasks]);

  // Reset a stale project filter when switching PIC changes the project set.
  useEffect(() => {
    if (projFilter && !projects.some((p) => p.id === projFilter)) setProjFilter("");
  }, [projects, projFilter]);

  const columns = useMemo(() => {
    const by: Record<TaskStatus, AssignedTask[]> = { todo: [], progress: [], review: [], done: [] };
    (tasks ?? [])
      .filter((t) => !projFilter || t.projectId === projFilter)
      .forEach((t) => by[t.status].push(t));
    return by;
  }, [tasks, projFilter]);

  const setStatus = async (t: AssignedTask, status: TaskStatus) => {
    try {
      await api.updateTask(t.projectId, t.id, status);
      load(pic);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const editable = canEdit(pic);

  return (
    <div className="view view-tasks">
      <div className="tasks-hd">
        <h2 className="panel-title">Papan Tugas — {picName(pic)}</h2>
        <div className="tasks-hd-controls">
          <label className="filter-select">
            <span>Proyek</span>
            <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)}>
              <option value="">Semua proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {canManage && (
            <div className="seg">
              {pics.map((p) => (
                <button
                  key={p.username}
                  className={pic === p.username ? "on" : ""}
                  onClick={() => {
                    setPicTouched(true);
                    setPic(p.username);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {err && <div className="empty-note error">{err}</div>}
      {!tasks ? (
        <div className="empty-note">Memuat tugas…</div>
      ) : (
        <div className="kanban">
          {STATUS_ORDER.map((col) => (
            <div className="kan-col" key={col}>
              <div className={`kan-col-hd ${ragTone(col === "done" ? "green" : col === "todo" ? "grey" : "amber")}`}>
                {STATUS_LABELS[col]}
                <span className="kan-count">{columns[col].length}</span>
              </div>
              <div className="kan-cards">
                {columns[col].map((t) => (
                  <div className="kan-card" key={t.projectId + t.id}>
                    <div className="kan-card-name">{t.name}</div>
                    <div className="kan-card-meta">
                      {t.gp} · {t.projectName}
                    </div>
                    <div className="kan-card-foot">
                      <span className="kan-cat">{t.group}</span>
                      {t.output && <span className="out-tag">{t.output}</span>}
                    </div>
                    {editable && (
                      <select
                        className="status-select sm"
                        value={t.status}
                        disabled={t.aiStatus === "running"}
                        onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    )}
                    <ReviewControls
                      projectId={t.projectId}
                      taskId={t.id}
                      status={t.status}
                      doc={t.doc}
                      approvedBy={t.approvedBy}
                      revisiNote={t.revisiNote}
                      canUpload={editable}
                      canApprove={canManage}
                      aiRunning={t.aiStatus === "running"}
                      onDone={() => {
                        load(pic);
                        onChanged();
                      }}
                    />
                  </div>
                ))}
                {columns[col].length === 0 && <div className="kan-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
