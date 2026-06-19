import { useEffect, useMemo, useState } from "react";
import type { Alur, WorkItem, WorkStep, StepStatus, UpdateStepInput } from "../../models";
import { workItemService } from "../../services/workitem.service";
import { stepService } from "../../services/step.service";
import { alurLabels, alurShort, phaseLabels, metadataFor } from "../../lib/alurCatalog";

const PHASE_ORDER = ["brief", "produksi", "review", "approval", "distribusi"];
const statusTone: Record<StepStatus, string> = { pending: "grey", in_progress: "warn", done: "ok" };
const statusLabel: Record<StepStatus, string> = { pending: "Belum", in_progress: "Proses", done: "Selesai" };

export function AlurKerjaView({
  items,
  canEdit,
  onChanged,
}: {
  items: WorkItem[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [selId, setSelId] = useState<number | null>(items[0]?.id ?? null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (selId === null && items.length) setSelId(items[0].id);
  }, [items, selId]);

  return (
    <div className="view view-projects">
      <div className="proj-list">
        <div className="proj-list-hd">
          <span className="panel-title" style={{ margin: 0 }}>
            Konten ({items.length})
          </span>
          <span style={{ flex: 1 }} />
          {canEdit && (
            <button className="btn-primary sm" onClick={() => setAdding((v) => !v)}>
              {adding ? "Tutup" : "+ Baru"}
            </button>
          )}
        </div>
        {adding && (
          <NewWorkItemForm
            onCreated={(it) => {
              setAdding(false);
              setSelId(it.id);
              onChanged();
            }}
          />
        )}
        <div className="proj-list-body">
          {items.map((w) => (
            <button
              key={w.id}
              className={`proj-row ${selId === w.id ? "on" : ""}`}
              onClick={() => setSelId(w.id)}
            >
              <div className="proj-row-top">
                <span className="proj-gp">{w.alur}</span>
                <span className="proj-name">{w.title}</span>
              </div>
              <div className="proj-row-sub">
                {alurShort[w.alur]} · {w.project || "—"} · {phaseLabels[w.stage] ?? w.stage}
              </div>
            </button>
          ))}
          {items.length === 0 && <div className="empty-note">Belum ada konten.</div>}
        </div>
      </div>

      <div className="proj-detail">
        {selId === null ? (
          <div className="empty-note">Pilih konten untuk melihat langkah alurnya.</div>
        ) : (
          <WorkItemTree id={selId} canEdit={canEdit} onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}

function NewWorkItemForm({ onCreated }: { onCreated: (it: WorkItem) => void }) {
  const [title, setTitle] = useState("");
  const [alur, setAlur] = useState<Alur>("A");
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const it = await workItemService.create({ title, alur, project });
      onCreated(it);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }} onSubmit={submit}>
      <div className="form-field">
        <span>Judul Konten / Campaign</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Iklan Hardsell Cluster Mawar" />
      </div>
      <div className="form-field">
        <span>Proyek / Cluster</span>
        <input value={project} onChange={(e) => setProject(e.target.value)} />
      </div>
      <div className="form-field">
        <span>Alur</span>
        <select value={alur} onChange={(e) => setAlur(e.target.value as Alur)}>
          {(["A", "B", "C", "D"] as Alur[]).map((a) => (
            <option key={a} value={a}>
              {alurLabels[a]}
            </option>
          ))}
        </select>
      </div>
      {err && <div className="login-error">{err}</div>}
      <button className="btn-primary sm" type="submit" disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan & Seed Langkah"}
      </button>
    </form>
  );
}

function WorkItemTree({ id, canEdit, onChanged }: { id: number; canEdit: boolean; onChanged: () => void }) {
  const [item, setItem] = useState<WorkItem | null>(null);
  const [err, setErr] = useState("");

  const load = () => {
    setItem(null);
    setErr("");
    workItemService
      .get(id)
      .then(setItem)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [id]);

  const steps = useMemo(() => item?.steps ?? [], [item]);
  const progress = steps.length ? Math.round((steps.filter((s) => s.status === "done").length / steps.length) * 100) : 0;
  const grouped = useMemo(() => {
    const map = new Map<string, WorkStep[]>();
    for (const s of steps) (map.get(s.phase) ?? map.set(s.phase, []).get(s.phase)!).push(s);
    return PHASE_ORDER.filter((p) => map.has(p)).map((p) => [p, map.get(p)!] as const);
  }, [steps]);

  const onStepChange = (u: WorkStep) => {
    setItem((prev) => (prev ? { ...prev, steps: prev.steps?.map((s) => (s.id === u.id ? { ...s, ...u } : s)) } : prev));
    onChanged();
  };

  if (err) return <div className="empty-note error">{err}</div>;
  if (!item) return <div className="empty-note"><div className="spinner" /> Memuat…</div>;

  return (
    <div className="tree">
      <div className="tree-hd">
        <div>
          <div className="tree-title">{item.title}</div>
          <div className="tree-sub">
            {alurLabels[item.alur]} · Proyek: {item.project || "—"}
          </div>
        </div>
        <div className="tree-prog">
          <div className="tree-prog-num">{progress}%</div>
          <div className="pbar">
            <div className={`pbar-fill ${progress === 100 ? "ok" : "warn"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {grouped.map(([phase, list]) => (
        <div className="cat" key={phase}>
          <div className="cat-hd">
            <span className="cat-name">{phaseLabels[phase] ?? phase}</span>
            <span className="cat-pct">
              {list.filter((s) => s.status === "done").length}/{list.length}
            </span>
          </div>
          <div className="grp">
            {list.map((s) => (
              <StepRow key={s.id} step={s} canEdit={canEdit} onChange={onStepChange} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function dueBadge(due: string | null, status: StepStatus) {
  if (!due || status === "done") return null;
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <span className="pill bad">Telat {-days}h</span>;
  if (days <= 1) return <span className="pill warn">Sisa {days}h</span>;
  return <span className="pill grey">{new Date(due).toLocaleDateString("id-ID")}</span>;
}

function StepRow({ step, canEdit, onChange }: { step: WorkStep; canEdit: boolean; onChange: (s: WorkStep) => void }) {
  const fields = metadataFor(step.code);
  const [budget, setBudget] = useState(step.budget_amount);
  const [notes, setNotes] = useState(step.notes);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(step.metadata ?? {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const patch = async (input: UpdateStepInput) => {
    setBusy(true);
    setErr("");
    try {
      onChange(await stepService.update(step.id, input));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveDetails = () => patch({ budget_amount: budget, notes, metadata });

  const upload = async (file: File) => {
    setBusy(true);
    setErr("");
    try {
      await stepService.uploadDocument(step.id, file, phaseLabels[step.phase] ?? step.code);
      onChange(await stepService.get(step.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wf-step">
      <div className="wf-step-top">
        {canEdit ? (
          <select
            className={`status-select sm ${statusTone[step.status]}`}
            style={{ width: "auto" }}
            value={step.status}
            disabled={busy}
            onChange={(e) => patch({ status: e.target.value as StepStatus, budget_amount: budget, notes, metadata })}
          >
            {(Object.keys(statusLabel) as StepStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`pill ${statusTone[step.status]}`}>{statusLabel[step.status]}</span>
        )}
        <span className="wf-code">{step.code}</span>
        <span className="wf-step-name">{step.name}</span>
        <span className="wf-flags">
          <span className="pill neutral">{step.owner}</span>
          {step.is_approval && <span className="pill warn">Approval Kadep</span>}
          {step.requires_budget && <span className="pill orange">{step.budget_label}</span>}
          {step.notify_departments && step.collab_dept && <span className="pill grey">↔ {step.collab_dept}</span>}
          {dueBadge(step.due_date, step.status)}
        </span>
      </div>

      {canEdit && (
        <div className="wf-fields">
          {step.requires_budget && (
            <label className="wf-field">
              <span>{step.budget_label} (Rp)</span>
              <input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} onBlur={saveDetails} />
              {budget > 0 && <small className="note">{rupiah(budget)}</small>}
            </label>
          )}
          {fields.map((f) => (
            <label className="wf-field" key={f.key}>
              <span>{f.label}</span>
              <input
                type={f.type}
                value={String(metadata[f.key] ?? "")}
                onChange={(e) => setMetadata((m) => ({ ...m, [f.key]: e.target.value }))}
                onBlur={saveDetails}
              />
            </label>
          ))}
          <label className="wf-field wf-field-wide">
            <span>Catatan</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveDetails} />
          </label>
        </div>
      )}

      <div className="wf-docs">
        {step.documents?.map((d) => (
          <a key={d.id} className="wf-doc" href={stepService.downloadUrl(d.id)} target="_blank" rel="noreferrer">
            📎 {d.doc_type}: {d.original_name}
          </a>
        ))}
        {canEdit && (
          <label className="wf-upload">
            + Lampiran
            <input
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {err && <div className="wf-err">{err}</div>}
    </div>
  );
}
