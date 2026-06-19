import { useState } from "react";
import { api } from "../../api/client";
import type { Field, Section } from "./schema";

/* ---------- dotted-path helpers ---------- */
type Rec = Record<string, any>;

export function getPath(obj: Rec, path: string): any {
  return path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj: Rec, path: string, val: any): void {
  const ks = path.split(".");
  const last = ks.pop() as string;
  let t = obj;
  for (const k of ks) {
    if (t[k] == null || typeof t[k] !== "object") t[k] = {};
    t = t[k];
  }
  t[last] = val;
}
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
function emptyRecord(fields: Field[]): Rec {
  const r: Rec = {};
  for (const f of fields) {
    setPath(r, f.key, f.type === "number" ? 0 : f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0] ?? "" : "");
  }
  return r;
}
function coerceNumbers(rec: Rec, fields: Field[], nullableKeys: string[] = []) {
  for (const f of fields) {
    if (f.type !== "number") continue;
    const v = getPath(rec, f.key);
    if (v === "" || v == null || Number.isNaN(v)) setPath(rec, f.key, nullableKeys.includes(f.key) ? null : 0);
  }
}
function cell(v: any): string {
  if (v === true) return "✓";
  if (v === false) return "—";
  if (v == null || v === "") return "—";
  return String(v);
}

/* ---------- single field input ---------- */
function FieldInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  if (field.type === "checkbox") {
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (field.type === "select") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        step={field.step ?? 1}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    );
  }
  return <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/* ---------- modal record form (create / edit one row) ---------- */
function RecordForm({
  title,
  fields,
  record,
  onSubmit,
  onCancel,
}: {
  title: string;
  fields: Field[];
  record: Rec;
  onSubmit: (r: Rec) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Rec>(() => clone(record));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (key: string, val: any) =>
    setDraft((d) => {
      const n = clone(d);
      setPath(n, key, val);
      return n;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const out = clone(draft);
      coerceNumbers(out, fields);
      await onSubmit(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal adm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-h">
          <div>
            <h2>{title}</h2>
          </div>
          <button className="modal-x" onClick={onCancel} aria-label="Tutup">
            ×
          </button>
        </header>
        <form className="modal-body adm-form" onSubmit={submit}>
          <div className="adm-grid">
            {fields.map((f) => (
              <label key={f.key} className={"adm-field" + (f.full ? " full" : "") + (f.type === "checkbox" ? " adm-check" : "")}>
                <span>{f.label}</span>
                <FieldInput field={f} value={getPath(draft, f.key)} onChange={(v) => set(f.key, v)} />
              </label>
            ))}
          </div>
          {err && <div className="adm-error">{err}</div>}
          <div className="adm-actions">
            <button type="button" className="adm-btn ghost" onClick={onCancel}>
              Batal
            </button>
            <button type="submit" className="adm-btn primary" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- CRUD table section ---------- */
export function CrudSection({ section, rows, reload }: { section: Extract<Section, { kind: "crud" }>; rows: Rec[]; reload: () => void }) {
  const [editing, setEditing] = useState<Rec | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const labelOf = (key: string) => section.fields.find((f) => f.key === key)?.label ?? key;

  const onSave = async (rec: Rec) => {
    await api.saveEntity(section.collection, rec);
    setEditing(null);
    setCreating(false);
    reload();
  };

  const onDelete = async (row: Rec) => {
    if (!window.confirm("Hapus data ini?")) return;
    setError("");
    try {
      await api.deleteEntity(section.collection, String(row._id));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="adm-section">
      <div className="adm-section-h">
        <div>
          <h2>{section.label}</h2>
          <span className="adm-count">{rows.length} baris</span>
        </div>
        <button className="adm-btn primary" onClick={() => setCreating(true)}>
          + Tambah
        </button>
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              {section.columns.map((c) => (
                <th key={c}>{labelOf(c)}</th>
              ))}
              <th className="adm-actions-col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row._id)}>
                {section.columns.map((c) => (
                  <td key={c}>{cell(getPath(row, c))}</td>
                ))}
                <td className="adm-actions-col">
                  <button className="adm-link" onClick={() => setEditing(row)}>
                    Edit
                  </button>
                  <button className="adm-link danger" onClick={() => onDelete(row)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <RecordForm
          title={(creating ? "Tambah " : "Edit ") + section.label}
          fields={section.fields}
          record={creating ? emptyRecord(section.fields) : (editing as Rec)}
          onSubmit={onSave}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- singleton editor (exec / stock / events / meta / reason-meta) ---------- */
export function SingletonForm({ section, value, reload }: { section: Extract<Section, { kind: "single" }>; value: Rec; reload: () => void }) {
  const [draft, setDraft] = useState<Rec>(() => clone(value));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const set = (key: string, val: any) =>
    setDraft((d) => {
      const n = clone(d);
      setPath(n, key, val);
      return n;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const out = clone(draft);
      coerceNumbers(out, section.fields);
      await api.putSingleton(section.path, out);
      setMsg("Tersimpan.");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-section">
      <div className="adm-section-h">
        <div>
          <h2>{section.label}</h2>
          <span className="adm-count">data tunggal</span>
        </div>
      </div>
      <form className="adm-form" onSubmit={submit}>
        <div className="adm-grid">
          {section.fields.map((f) => (
            <label key={f.key} className={"adm-field" + (f.full ? " full" : "") + (f.type === "checkbox" ? " adm-check" : "")}>
              <span>{f.label}</span>
              <FieldInput field={f} value={getPath(draft, f.key)} onChange={(v) => set(f.key, v)} />
            </label>
          ))}
        </div>
        {err && <div className="adm-error">{err}</div>}
        {msg && <div className="adm-ok">{msg}</div>}
        <div className="adm-actions">
          <button type="submit" className="adm-btn primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- array editor (funnel / monthly) ---------- */
export function ArrayEditor({ section, rows, reload }: { section: Extract<Section, { kind: "array" }>; rows: Rec[]; reload: () => void }) {
  const [list, setList] = useState<Rec[]>(() => clone(rows));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const setCell = (i: number, key: string, val: any) =>
    setList((L) => {
      const n = clone(L);
      setPath(n[i], key, val);
      return n;
    });
  const addRow = () => setList((L) => [...L, emptyRecord(section.fields)]);
  const delRow = (i: number) => setList((L) => L.filter((_, j) => j !== i));

  const save = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const out = clone(list);
      out.forEach((r) => coerceNumbers(r, section.fields, section.nullableKeys));
      await api.putSingleton(section.path, out);
      setMsg("Tersimpan.");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-section">
      <div className="adm-section-h">
        <div>
          <h2>{section.label}</h2>
          <span className="adm-count">{list.length} baris</span>
        </div>
        {section.addable && (
          <button className="adm-btn ghost" onClick={addRow}>
            + Baris
          </button>
        )}
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table adm-edit-table">
          <thead>
            <tr>
              {section.fields.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              {section.addable && <th className="adm-actions-col" />}
            </tr>
          </thead>
          <tbody>
            {list.map((row, i) => (
              <tr key={i}>
                {section.fields.map((f) => (
                  <td key={f.key}>
                    <FieldInput field={f} value={getPath(row, f.key)} onChange={(v) => setCell(i, f.key, v)} />
                  </td>
                ))}
                {section.addable && (
                  <td className="adm-actions-col">
                    <button className="adm-link danger" onClick={() => delRow(i)}>
                      Hapus
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <div className="adm-error">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}
      <div className="adm-actions">
        <button className="adm-btn primary" onClick={save} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan Semua"}
        </button>
      </div>
    </div>
  );
}
