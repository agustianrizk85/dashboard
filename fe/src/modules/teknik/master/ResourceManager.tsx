import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { downloadXlsx } from "../lib/xlsx";
import type { Cell } from "../lib/xlsx";
import type { FieldDef, ResourceConfig } from "./schema";
import { ImportButton } from "./ImportData";

type MasterRecord = Record<string, unknown> & { id: string };
type FormValues = Record<string, string>;

/** Map a record field to an Excel cell (numbers numeric; selects → label). */
function exportCell(f: FieldDef, rec: MasterRecord): Cell {
  const v = rec[f.name];
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "tags") return Array.isArray(v) ? v.join(", ") : String(v);
  if (f.type === "number") return typeof v === "number" ? v : Number(v);
  if (f.type === "select" && f.options) {
    const opt = f.options.find((o) => o.value === v);
    return opt ? opt.label : String(v);
  }
  return String(v);
}

/** Generic create/read/update/delete manager for one master-data resource. */
export function ResourceManager({ config }: { config: ResourceConfig }) {
  const [items, setItems] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const columns = useMemo(() => config.fields.filter((f) => !f.hideInTable && !f.uiOnly), [config]);

  // Related resources referenced by any "ref" field — loaded so we can show
  // human labels in the table and offer dropdowns in the form.
  const refResources = useMemo(
    () => [...new Set(config.fields.filter((f) => f.type === "ref" && f.refResource).map((f) => f.refResource as string))],
    [config],
  );
  const [refData, setRefData] = useState<Record<string, MasterRecord[]>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(
      refResources.map((r) =>
        api.list<MasterRecord>(r).then((d) => [r, d] as const).catch(() => [r, [] as MasterRecord[]] as const),
      ),
    ).then((pairs) => {
      if (alive) setRefData(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [refResources]);

  const refLabel = useCallback(
    (f: FieldDef, value: unknown): string => {
      const list = refData[f.refResource ?? ""] ?? [];
      const hit = list.find((r) => String(r.id) === String(value));
      if (hit) return String(hit[f.refLabelField ?? "id"] ?? hit.id);
      return value === null || value === undefined ? "" : String(value);
    },
    [refData],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .list<MasterRecord>(config.key)
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [config.key]);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (rec: MasterRecord) => {
    setEditing(rec);
    setFormOpen(true);
  };

  const onDelete = async (rec: MasterRecord) => {
    if (!window.confirm(`Hapus ${config.singular} ini?`)) return;
    try {
      await api.remove(config.key, rec.id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  // Bulk import: create each record in the imported array, then refresh.
  const importItems = async (data: unknown): Promise<number> => {
    const arr = data as Record<string, unknown>[];
    let n = 0;
    for (const raw of arr) {
      await api.create(config.key, normalizeRecord(config, raw, refData));
      n++;
    }
    load();
    return n;
  };

  // Export to .xlsx — relation columns show NAMES (not ids) for round-trip import.
  const onExport = () => {
    const fields = config.fields.filter((f) => !f.uiOnly);
    const columns = [config.idLabel ?? "ID", ...fields.map((f) => f.label)];
    const body: Cell[][] = items.map((rec) => [
      rec.id,
      ...fields.map((f) => (f.type === "ref" ? refLabel(f, rec[f.name]) : exportCell(f, rec))),
    ]);
    downloadXlsx(`Teknik-${config.title}`, columns, body, config.title.slice(0, 31));
  };

  return (
    <div className="md-panel">
      <header className="md-head">
        <div>
          <h2>{config.title}</h2>
          <span className="md-count">{items.length} data</span>
        </div>
        <div className="md-head-actions">
          <button className="md-btn" onClick={onExport} disabled={items.length === 0} title="Unduh sebagai file Excel (.xlsx)">
            ▦ Excel
          </button>
          <ImportButton
            entity={config.key}
            columns={importColumns(config)}
            sample={[sampleRecord(config, refData)]}
            onImport={importItems}
          />
          <button className="md-btn primary" onClick={openCreate}>
            ＋ Tambah {config.singular}
          </button>
        </div>
      </header>

      {error && <div className="md-error">{error}</div>}

      <div className="md-table-wrap">
        {loading ? (
          <div className="md-empty">Memuat…</div>
        ) : items.length === 0 ? (
          <div className="md-empty">Belum ada data.</div>
        ) : (
          <table className="md-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.name}>{c.label}</th>
                ))}
                <th className="md-actions-col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rec) => (
                <tr key={rec.id}>
                  {columns.map((c) => (
                    <td key={c.name}>
                      {c.type === "ref"
                        ? refLabel(c, rec[c.name])
                        : c.type === "file"
                          ? rec[c.name]
                            ? <a href={api.fileUrl(String(rec[c.name]))} target="_blank" rel="noreferrer">📎 file</a>
                            : ""
                          : cellText(rec[c.name])}
                    </td>
                  ))}
                  <td className="md-actions">
                    <button className="md-btn" onClick={() => openEdit(rec)}>
                      Edit
                    </button>
                    <button className="md-btn danger" onClick={() => onDelete(rec)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <RecordForm
          config={config}
          editing={editing}
          refData={refData}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function cellText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

/* ---- Create / edit form (modal) --------------------------------------- */

function RecordForm({
  config,
  editing,
  refData,
  onClose,
  onSaved,
}: {
  config: ResourceConfig;
  editing: MasterRecord | null;
  refData: Record<string, MasterRecord[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const refOptionsFor = (f: FieldDef, values: FormValues): { value: string; label: string }[] => {
    let list = refData[f.refResource ?? ""] ?? [];
    if (f.filterBy) {
      const fv = values[f.filterBy.byField];
      if (fv) list = list.filter((r) => String(r[f.filterBy!.refField] ?? "") === String(fv));
    }
    return list.map((r) => ({ value: String(r.id), label: String(r[f.refLabelField ?? "id"] ?? r.id) }));
  };
  const [values, setValues] = useState<FormValues>(() => initialValues(config, editing));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = buildPayload(config, editing, values);
    try {
      if (editing) {
        await api.update(config.key, editing.id, payload);
      } else {
        await api.create(config.key, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <form className="mdf-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="mdf-head">
          <h3>
            {editing ? "Edit" : "Tambah"} {config.singular}
          </h3>
          <button type="button" className="mdf-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="mdf-body">
          {config.idEditable && !editing && (
            <Field
              def={{
                name: "id",
                label: config.idLabel ?? "ID",
                type: "text",
                tip: config.idTip ?? "Kunci unik record.",
                result: "Dipakai sebagai identitas; tidak bisa diubah setelah dibuat.",
              }}
              value={values.id ?? ""}
              onChange={set}
            />
          )}
          {config.fields.map((f) => (
            <Field
              key={f.name}
              def={f}
              value={values[f.name] ?? ""}
              onChange={set}
              refOptions={f.type === "ref" ? refOptionsFor(f, values) : undefined}
            />
          ))}
        </div>

        {error && <div className="mdf-error">{error}</div>}

        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="md-btn primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  def,
  value,
  onChange,
  refOptions,
}: {
  def: FieldDef;
  value: string;
  onChange: (name: string, value: string) => void;
  refOptions?: { value: string; label: string }[];
}) {
  return (
    <label className={`mdf-field ${def.type === "textarea" ? "wide" : ""}`}>
      <span className="mdf-label">
        {def.label}
        {def.tip && (
          <span
            className="mdf-tip"
            tabIndex={0}
            title={def.tip + (def.result ? "\n\nHasil: " + def.result : "")}
          >
            <span className="mdf-tip-i">i</span>
            <span className="mdf-tip-pop" role="tooltip">
              <b>{def.label}</b>
              <span>{def.tip}</span>
              {def.result && (
                <span className="mdf-tip-res">
                  <b>Hasil:</b> {def.result}
                </span>
              )}
            </span>
          </span>
        )}
      </span>
      {def.readOnly ? (
        <input
          type={def.type === "number" ? "number" : "text"}
          value={value}
          readOnly
          disabled
          title="Dihitung otomatis dari Cek List Progress — tidak bisa diubah di sini."
        />
      ) : def.type === "ref" ? (
        <select value={value} onChange={(e) => onChange(def.name, e.target.value)}>
          <option value="">— pilih —</option>
          {(refOptions ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.type === "select" ? (
        <select value={value} onChange={(e) => onChange(def.name, e.target.value)}>
          <option value="">— pilih —</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.type === "file" ? (
        <FileField value={value} onChange={(v) => onChange(def.name, v)} suggest={def.name} />
      ) : def.type === "textarea" ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(def.name, e.target.value)} />
      ) : (
        <input
          type={def.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(def.name, e.target.value)}
        />
      )}
    </label>
  );
}

/** File upload field: pick a file → uploads → stores returned URL. */
function FileField({ value, onChange, suggest }: { value: string; onChange: (v: string) => void; suggest: string }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const r = await api.upload(f, suggest);
      onChange(r.url);
    } catch (err) {
      alert("Upload gagal: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mdf-file">
      {value && (
        <a className="mdf-file-link" href={api.fileUrl(value)} target="_blank" rel="noreferrer">📎 Lihat file</a>
      )}
      <input type="file" onChange={pick} disabled={busy} />
      {busy && <span className="mdf-file-busy">Mengunggah…</span>}
    </div>
  );
}

/* ---- Value mapping ----------------------------------------------------- */

function initialValues(config: ResourceConfig, editing: MasterRecord | null): FormValues {
  const out: FormValues = {};
  if (config.idEditable) out.id = editing ? String(editing.id ?? "") : "";
  for (const f of config.fields) {
    const raw = editing ? editing[f.name] : undefined;
    if (f.type === "tags") out[f.name] = Array.isArray(raw) ? raw.join(", ") : "";
    else out[f.name] = raw === null || raw === undefined ? "" : String(raw);
  }
  return out;
}

function buildPayload(config: ResourceConfig, editing: MasterRecord | null, values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = editing ? { ...editing } : {};
  if (config.idEditable && !editing && values.id.trim() !== "") {
    payload.id = values.id.trim();
  }
  for (const f of config.fields) {
    if (f.readOnly || f.uiOnly) continue; // derived/UI-only; never sent from the form
    const raw = values[f.name] ?? "";
    if (f.type === "number") payload[f.name] = raw === "" ? 0 : Number(raw);
    else if (f.type === "tags") payload[f.name] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    else payload[f.name] = raw;
  }
  return payload;
}

/* ---- Import helpers ----------------------------------------------------- *
 * Templates & imports use human LABELS/NAMES as headers (users don't know
 * internal ids). Relation (ref) columns accept a NAME; we resolve it back to
 * the id on import. For units (blok can repeat), a "Proyek" column disambiguates.
 * ------------------------------------------------------------------------- */

type RefData = Record<string, MasterRecord[]>;

/** Resolve a typed name back to a ref id (passes through if already an id). */
function resolveRefId(f: FieldDef, val: unknown, refData: RefData, proyekCtx?: string): string {
  const s = String(val ?? "").trim();
  if (!s) return "";
  const list = refData[f.refResource ?? ""] ?? [];
  if (list.some((r) => String(r.id) === s)) return s; // already an id
  const lc = s.toLowerCase();
  let m = list.filter((r) => String(r[f.refLabelField ?? "id"] ?? "").trim().toLowerCase() === lc);
  if (f.refResource === "units" && m.length > 1 && proyekCtx) {
    m = m.filter((r) => String(r.proyekId) === proyekCtx);
  }
  return m[0] ? String(m[0].id) : s;
}

/** Columns for the import template — labels; includes a Proyek column for ref. */
function importColumns(config: ResourceConfig): string[] {
  const cols: string[] = [];
  if (config.idEditable) cols.push(config.idLabel ?? "ID");
  for (const f of config.fields) {
    if (f.readOnly) continue;
    if (f.uiOnly && f.type !== "ref") continue; // keep the uiOnly Proyek ref as a column
    cols.push(f.label);
  }
  return cols;
}

/** A sample row for the template — keyed by label, with a real example name for refs. */
function sampleRecord(config: ResourceConfig, refData: RefData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  if (config.idEditable) rec[config.idLabel ?? "ID"] = "";
  for (const f of config.fields) {
    if (f.readOnly) continue;
    if (f.uiOnly && f.type !== "ref") continue;
    if (f.type === "ref") {
      const ex = (refData[f.refResource ?? ""] ?? [])[0];
      rec[f.label] = ex ? String(ex[f.refLabelField ?? "id"] ?? "") : "(nama)";
    } else if (f.type === "number") rec[f.label] = 0;
    else if (f.type === "select") rec[f.label] = f.options?.[0]?.value ?? "";
    else rec[f.label] = "";
  }
  return rec;
}

/** Coerce one imported row (label-keyed, names) to the API payload (ids). */
function normalizeRecord(config: ResourceConfig, raw: Record<string, unknown>, refData: RefData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  if (config.idEditable) {
    const idv = raw[config.idLabel ?? "ID"];
    if (idv != null && String(idv).trim() !== "") rec.id = String(idv).trim();
  }
  // Resolve a Proyek context first (to disambiguate unit by blok).
  const pf = config.fields.find((f) => f.type === "ref" && f.refResource === "proyek");
  const proyekCtx = pf ? resolveRefId(pf, raw[pf.label], refData) : "";
  for (const f of config.fields) {
    if (f.readOnly || f.uiOnly) continue; // derived/UI-only; not sent
    const v = raw[f.label];
    if (f.type === "ref") rec[f.name] = resolveRefId(f, v, refData, proyekCtx);
    else if (f.type === "number") rec[f.name] = v == null || v === "" ? 0 : Number(v);
    else if (f.type === "tags")
      rec[f.name] = Array.isArray(v)
        ? v.map((s) => String(s))
        : typeof v === "string"
          ? v.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
    else rec[f.name] = v == null ? "" : String(v);
  }
  return rec;
}
