import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectDetail, ProjectRollup, Task, TaskStatus } from "../../types";
import { api } from "../../api/client";
import { STATUS_LABELS, STATUS_ORDER, fmtDate, picName, ragTone } from "../../lib/format";
import {
  deadlineSev,
  daysUntil,
  getTaskDates,
  setTaskDates,
  type TaskDates,
} from "../../lib/localStore";
import { ProgressBar, RagDot } from "../ui";
import { ReviewControls } from "../ReviewControls";

/**
 * Proyek view — the PROCESS side: pick a project and advance the status of each
 * deliverable task (the owning PIC or a manager may edit). Creating projects is
 * master data management and lives in the Data Master view, not here.
 */
export function ProjectsView({
  projects,
  canManage,
  canEdit,
  onChanged,
}: {
  projects: ProjectRollup[];
  /** True for CEO / Kadep (may approve reviews). */
  canManage: boolean;
  /** Returns true when the current user may edit a task owned by `pic`. */
  canEdit: (pic: string) => boolean;
  /** Notify the parent that portfolio data changed (re-fetch summary etc.). */
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const [gpFilter, setGpFilter] = useState<string>("");

  const gpList = useMemo(
    () => Array.from(new Set(projects.map((p) => p.gp))).sort(),
    [projects],
  );
  const filtered = gpFilter ? projects.filter((p) => p.gp === gpFilter) : projects;

  // Keep a valid selection when the filter changes.
  useEffect(() => {
    if (!filtered.find((p) => p.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  return (
    <div className="view view-projects">
      <aside className="proj-list">
        <div className="proj-list-hd">
          <div className="seg">
            <button className={gpFilter === "" ? "on" : ""} onClick={() => setGpFilter("")}>
              Semua
            </button>
            {gpList.map((gp) => (
              <button key={gp} className={gpFilter === gp ? "on" : ""} onClick={() => setGpFilter(gp)}>
                {gp}
              </button>
            ))}
          </div>
        </div>
        <div className="proj-list-body">
          {filtered.map((p) => (
            <button
              key={p.id}
              className={`proj-row ${p.id === selectedId ? "on" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="proj-row-top">
                <span className="proj-gp">{p.gp}</span>
                <span className="proj-name">{p.name}</span>
                <span className="proj-pct">{p.progress}%</span>
              </div>
              <ProgressBar value={p.progress} />
              <div className="proj-row-sub">
                {p.lokasi} · {p.units} unit · {p.done}/{p.total} task
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="proj-detail">
        {selectedId ? (
          <ProjectTree projectId={selectedId} canManage={canManage} canEdit={canEdit} onChanged={onChanged} />
        ) : (
          <div className="empty-note">Tidak ada proyek.</div>
        )}
      </section>
    </div>
  );
}

/** The deliverable tree of one project, with inline status editing + review. */
function ProjectTree({
  projectId,
  canManage,
  canEdit,
  onChanged,
}: {
  projectId: string;
  canManage: boolean;
  canEdit: (pic: string) => boolean;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    api
      .project(projectId)
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  useEffect(() => {
    setDetail(null);
    setErr("");
    reload();
  }, [reload]);

  // Refresh after a review action (upload / approve / reject) and bubble up.
  const afterReview = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);

  const setStatus = async (task: Task, status: TaskStatus) => {
    try {
      const updated = await api.updateTask(projectId, task.id, status);
      setDetail(updated);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (err) return <div className="empty-note error">{err}</div>;
  if (!detail) return <div className="empty-note">Memuat deliverable…</div>;

  // Group tasks by category -> group, following the category rollup order.
  const tasksByGroup = (cat: string, group: string) =>
    detail.tasks.filter((t) => t.category === cat && t.group === group);

  return (
    <div className="tree">
      <header className="tree-hd">
        <div>
          <div className="tree-title">
            {detail.gp} · {detail.name}
          </div>
          <div className="tree-sub">
            {detail.lokasi} · {detail.luas} · {detail.units} unit · {detail.types} tipe
          </div>
        </div>
        <div className="tree-prog">
          <div className="tree-prog-num">{detail.progress}%</div>
          <ProgressBar value={detail.progress} />
        </div>
      </header>

      {detail.categories?.map((cat) => (
        <div className="cat" key={cat.category}>
          <div className="cat-hd">
            <span className="cat-name">{cat.category}</span>
            <span className="cat-pct">{cat.progress}%</span>
          </div>
          {cat.groups.map((g) => (
            <div className="grp" key={g.group}>
              <div className="grp-hd">
                <span className="grp-name">{g.group}</span>
                <span className="grp-meta">
                  {g.done}/{g.total} · {g.progress}%
                </span>
              </div>
              <div className="task-rows">
                {tasksByGroup(cat.category, g.group).map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    editable={canEdit(t.pic)}
                    canManage={canManage}
                    projectId={projectId}
                    onSet={setStatus}
                    onReview={afterReview}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  editable,
  canManage,
  projectId,
  onSet,
  onReview,
}: {
  task: Task;
  editable: boolean;
  canManage: boolean;
  projectId: string;
  onSet: (t: Task, s: TaskStatus) => void;
  onReview: () => void;
}) {
  const tone = ragTone(task.status === "done" ? "green" : task.status === "todo" ? "grey" : "amber");

  // Schedule dates (mulai / deadline / selesai) — held client-side until the
  // backend models them. See lib/localStore.ts.
  const [dates, setDates] = useState<TaskDates>(() => getTaskDates(task.id));
  const done = task.status === "done";
  const sev = deadlineSev(dates.deadline, done);

  const update = (key: keyof TaskDates, value: string) => {
    const next = { ...dates, [key]: value };
    setDates(next);
    setTaskDates(task.id, next);
  };

  return (
    <div className="task-row-wrap">
      <div className="task-row">
        <RagDot rag={task.status === "done" ? "green" : task.status === "todo" ? "grey" : "amber"} />
        <span className="task-name">
          {task.name}
          {task.output && <span className="out-tag">{task.output}</span>}
        </span>
        {sev !== "grey" && (
          <span className={`alert-chip ${ragTone(sev)}`} title="Alert deadline deliverable">
            {dates.deadline ? deadlineLabel(dates.deadline) : ""}
          </span>
        )}
        <ReviewControls
          projectId={projectId}
          taskId={task.id}
          status={task.status}
          doc={task.doc}
          approvedBy={task.approvedBy}
          canUpload={editable}
          canApprove={canManage}
          onDone={onReview}
        />
        <span className={`avatar sm pic-${task.pic}`} title={picName(task.pic)}>
          {picName(task.pic).slice(0, 1)}
        </span>
        {editable ? (
          <select
            className={`status-select ${tone}`}
            value={task.status}
            onChange={(e) => onSet(task, e.target.value as TaskStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`pill ${tone}`}>{STATUS_LABELS[task.status]}</span>
        )}
      </div>

      <div className="task-dates">
        <DateCell label="Mulai" value={dates.start} editable={editable} onChange={(v) => update("start", v)} />
        <DateCell
          label="Deadline"
          value={dates.deadline}
          editable={editable}
          tone={ragTone(sev)}
          onChange={(v) => update("deadline", v)}
        />
        <DateCell label="Selesai" value={dates.finish} editable={editable} onChange={(v) => update("finish", v)} />
      </div>
    </div>
  );
}

/** A labelled date cell — an inline date input for editors, plain text otherwise. */
function DateCell({
  label,
  value,
  editable,
  tone,
  onChange,
}: {
  label: string;
  value?: string;
  editable: boolean;
  tone?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={`date-cell ${tone ?? ""}`}>
      <span className="date-cell-label">{label}</span>
      {editable ? (
        <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <span className="date-cell-val">{value ? fmtDate(value) : "—"}</span>
      )}
    </label>
  );
}

/** Short "n hari lagi" / "telat" label for a deadline. */
function deadlineLabel(deadline: string): string {
  const left = daysUntil(deadline);
  if (left < 0) return `Telat ${-left} hari`;
  if (left === 0) return "Jatuh tempo hari ini";
  return `${left} hari lagi`;
}
