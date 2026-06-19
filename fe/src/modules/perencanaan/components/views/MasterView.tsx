import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { AccountInfo, Division, DivisionInfo, MasterData, ProjectDetail, Task } from "../../types";
import { picName } from "../../lib/format";
import { InfoTip } from "../ui";
import { Modal } from "../Modal";
import { AddProjectModal } from "../AddProjectModal";

const CATEGORIES = ["Site Plan", "Desain Unit Hunian", "Desain Kawasan"];

/** Output division options for a task (excludes CEO; adds a "none" option). */
function outputOptions(divisions: DivisionInfo[]): { value: Division; label: string }[] {
  const opts: { value: Division; label: string }[] = [{ value: "", label: "— Tidak ke divisi" }];
  for (const d of divisions) {
    if (d.division && d.division !== "ceo") opts.push({ value: d.division, label: d.label });
  }
  return opts;
}

/**
 * Data Master — the structural reference data, editable by CEO / Kadep. The
 * project portfolio (add new projects, pick how many Site Plans) and a
 * per-project deliverable editor where each task's PIC and output division are
 * assigned dynamically. Day-to-day status lives in the process tabs.
 */
export function MasterView({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged: () => void;
}) {
  const [data, setData] = useState<MasterData | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .master()
      .then((d) => {
        setData(d);
        setSelectedId((cur) => cur ?? d.projects[0]?.id ?? null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(load, [load]);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!data) {
    return (
      <div className="empty-note">
        <div className="spinner" /> Memuat data master…
      </div>
    );
  }

  const picAccounts = data.accounts.filter((a) => a.isPic);

  return (
    <div className="view view-master">
      <div className="master-note">
        <span className="master-badge">DATA MASTER</span>
        <span className="master-note-text">
          Struktur acuan: portfolio proyek &amp; pohon deliverable (siapa PIC-nya, output ke divisi
          mana). Status pengerjaan/progress adalah <b>data proses</b> — ada di tab lain.
        </span>
        {canManage && (
          <button className="btn-primary master-note-btn" onClick={() => setAdding(true)}>
            + Proyek
          </button>
        )}
      </div>

      <div className="master-grid">
        {/* Projects — master identity, selectable */}
        <section className="panel master-projects">
          <h2 className="panel-title">
            Proyek Master · {data.projects.length}
            <InfoTip tip="Klik satu proyek untuk membuka editor deliverable di bawah. Kolom Tugas = jumlah deliverable." />
          </h2>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">No</th>
                  <th>GP</th>
                  <th>Nama</th>
                  <th>Lokasi</th>
                  <th className="num">Unit</th>
                  <th className="num">Tugas</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => (
                  <tr
                    key={p.id}
                    className={`selectable ${p.id === selectedId ? "on" : ""}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td className="num">{p.no}</td>
                    <td>{p.gp}</td>
                    <td>
                      {p.name}
                      {p.added && <span className="tag-added">tambahan</span>}
                    </td>
                    <td>{p.lokasi}</td>
                    <td className="num">{p.units}</td>
                    <td className="num">{p.tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="master-side">
          <section className="panel">
            <h2 className="panel-title">Akun &amp; Peran · {data.accounts.length}</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Peran</th>
                  <th>PIC</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.username}>
                    <td>
                      <span className={`avatar pic-${a.username}`}>{a.name.slice(0, 1)}</span>
                      {a.name}
                    </td>
                    <td>{a.roleLabel}</td>
                    <td>{a.isPic ? "Ya" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2 className="panel-title">
              Divisi Output · {data.divisions.length}
              <InfoTip tip="Tujuan hilir tiap deliverable. Dipilih per deliverable di editor." />
            </h2>
            <div className="div-chips">
              {data.divisions.map((d) => (
                <span key={d.division || d.label} className={`div-chip out-${d.division || "ceo"}`}>
                  {d.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      {selectedId && (
        <DeliverableEditor
          key={selectedId}
          projectId={selectedId}
          canManage={canManage}
          picAccounts={picAccounts}
          divisions={data.divisions}
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      )}

      {adding && (
        <AddProjectModal
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            setSelectedId(id);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function DeliverableEditor({
  projectId,
  canManage,
  picAccounts,
  divisions,
  onChanged,
}: {
  projectId: string;
  canManage: boolean;
  picAccounts: AccountInfo[];
  divisions: DivisionInfo[];
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");

  const reload = useCallback(() => {
    api
      .project(projectId)
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  useEffect(reload, [reload]);

  const cats = detail?.categories ?? [];
  const active = activeCat && cats.some((c) => c.category === activeCat) ? activeCat : cats[0]?.category ?? "";
  const activeCatObj = cats.find((c) => c.category === active);
  const outOpts = useMemo(() => outputOptions(divisions), [divisions]);

  const apply = (p: Promise<ProjectDetail>) =>
    p
      .then((d) => {
        setDetail(d);
        onChanged();
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

  const catCount = (cat: string) => (detail?.tasks.filter((t) => t.category === cat).length ?? 0);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!detail) return <div className="empty-note">Memuat deliverable…</div>;

  return (
    <section className="panel deliverable-editor">
      <div className="ed-head">
        <div>
          <h2 className="panel-title ed-title">
            Editor Deliverable
            <InfoTip tip="Tambah/hapus deliverable dan tentukan PIC + output divisi. Ini struktur (master), bukan status pengerjaan." />
          </h2>
          <div className="ed-sub">
            {detail.gp} · {detail.name} · <b>{detail.total} tugas</b>
          </div>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Tambah Deliverable
          </button>
        )}
      </div>

      <div className="ed-tabs">
        {cats.map((c) => (
          <button
            key={c.category}
            className={`ed-tab ${c.category === active ? "on" : ""}`}
            onClick={() => setActiveCat(c.category)}
          >
            {c.category}
            <span className="ed-tab-count">{catCount(c.category)}</span>
          </button>
        ))}
      </div>

      <div className="ed-body">
        {activeCatObj?.groups.map((g) => {
          const rows = detail.tasks.filter((t) => t.category === active && t.group === g.group);
          return (
            <div className="ed-group" key={g.group}>
              <div className="ed-group-head">
                <span className="ed-group-name">{g.group}</span>
                <span className="ed-group-meta">{rows.length} tugas</span>
              </div>
              <div className="ed-rows">
                {rows.map((t) => (
                  <TaskEditRow
                    key={t.id}
                    task={t}
                    canManage={canManage}
                    picAccounts={picAccounts}
                    outOpts={outOpts}
                    onReassign={(pic, output) => apply(api.reassignTask(projectId, t.id, pic, output))}
                    onRemove={() => apply(api.removeTask(projectId, t.id))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddDeliverableModal
          defaultCategory={active || CATEGORIES[0]}
          picAccounts={picAccounts}
          outOpts={outOpts}
          onClose={() => setAdding(false)}
          onAdd={(input) => apply(api.addTask(projectId, input)).then(() => setAdding(false))}
        />
      )}
    </section>
  );
}

function TaskEditRow({
  task,
  canManage,
  picAccounts,
  outOpts,
  onReassign,
  onRemove,
}: {
  task: Task;
  canManage: boolean;
  picAccounts: AccountInfo[];
  outOpts: { value: Division; label: string }[];
  onReassign: (pic: string, output: Division) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ed-row">
      <div className="ed-row-name">
        {task.name}
        {task.weighted && <span className="tag-100">100%</span>}
      </div>

      {canManage ? (
        <div className="ed-row-controls">
          <div className="ed-field">
            <span className="ed-field-label">PIC</span>
            <div className="ed-pic-pick">
              <span className={`avatar sm pic-${task.pic}`}>{picName(task.pic).slice(0, 1)}</span>
              <select value={task.pic} onChange={(e) => onReassign(e.target.value, task.output)}>
                {picAccounts.map((a) => (
                  <option key={a.username} value={a.username}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ed-field">
            <span className="ed-field-label">Output ke</span>
            <select
              className={`ed-out out-sel-${task.output || "none"}`}
              value={task.output}
              onChange={(e) => onReassign(task.pic, e.target.value as Division)}
            >
              {outOpts.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button className="ed-del" title="Hapus deliverable" onClick={onRemove}>
            Hapus
          </button>
        </div>
      ) : (
        <div className="ed-row-controls">
          <span className={`avatar sm pic-${task.pic}`} title={picName(task.pic)}>
            {picName(task.pic).slice(0, 1)}
          </span>
          {task.output ? (
            <span className={`div-chip sm out-${task.output}`}>{task.output}</span>
          ) : (
            <span className="ed-row-none">—</span>
          )}
        </div>
      )}
    </div>
  );
}

function AddDeliverableModal({
  defaultCategory,
  picAccounts,
  outOpts,
  onClose,
  onAdd,
}: {
  defaultCategory: string;
  picAccounts: AccountInfo[];
  outOpts: { value: Division; label: string }[];
  onClose: () => void;
  onAdd: (input: {
    category: string;
    group: string;
    name: string;
    pic: string;
    output: Division;
    weighted: boolean;
  }) => void;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [pic, setPic] = useState(picAccounts[0]?.username ?? "");
  const [output, setOutput] = useState<Division>("");
  const [weighted, setWeighted] = useState(false);

  const valid = name.trim() && group.trim() && pic;

  return (
    <Modal title="Tambah Deliverable" sub="Tentukan PIC & output divisi" onClose={onClose} width={620}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onAdd({ category, group: group.trim(), name: name.trim(), pic, output, weighted });
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span>Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Sub-deliverable</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="mis. Site Plan 2 / Denah" />
          </label>
        </div>
        <label className="form-field">
          <span>Nama tugas</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Siteplan teknis" />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>PIC (penugasan)</span>
            <select value={pic} onChange={(e) => setPic(e.target.value)}>
              {picAccounts.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.name} · {a.roleLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Output ke divisi</span>
            <select value={output} onChange={(e) => setOutput(e.target.value as Division)}>
              {outOpts.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="chk">
          <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
          Bagian dari milestone 100% (deliverable berbobot)
        </label>
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={!valid}>
            Tambah Deliverable
          </button>
        </div>
      </form>
    </Modal>
  );
}
