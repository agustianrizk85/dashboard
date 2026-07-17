import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { withAuth, errMsg } from "./data";
import { rpFull } from "./format";

/* ── Config-driven CRUD (ported & adapted from Teknik master) ─────────────── */

type Rec = Record<string, unknown> & { id: string };
type FormValues = Record<string, string>;

type FieldType = "text" | "number" | "textarea" | "select" | "ref" | "bool";

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  /** For "ref": resource key whose records populate the dropdown. */
  refKey?: string;
  /** For "ref": which field of the related record to show as the label. */
  refLabelField?: string;
  hideInTable?: boolean;
  placeholder?: string;
  /** money: render with rpFull in the table. */
  money?: boolean;
}

interface ResourceDef {
  key: string;
  title: string;
  singular: string;
  fields: FieldDef[];
  list: () => Promise<Rec[]>;
  create: (body: Record<string, unknown>) => Promise<Rec>;
  update: (id: string, body: Record<string, unknown>) => Promise<Rec>;
  remove: (id: string) => Promise<unknown>;
}

const cast = <T,>(p: Promise<T>) => p as unknown as Promise<Rec>;
const castList = <T,>(p: Promise<T[]>) => p as unknown as Promise<Rec[]>;

const RESOURCES: ResourceDef[] = [
  {
    key: "vendors",
    title: "Vendor / Supplier",
    singular: "Vendor",
    fields: [
      { name: "nama", label: "Nama Vendor", type: "text", placeholder: "PT Sumber Makmur" },
      { name: "alamat", label: "Alamat", type: "textarea" },
      { name: "telepon", label: "Telepon", type: "text" },
    ],
    list: () => castList(withAuth(() => api.vendors())),
    create: (b) => cast(withAuth(() => api.createVendor(b))),
    update: (id, b) => cast(withAuth(() => api.updateVendor(id, b))),
    remove: (id) => withAuth(() => api.deleteVendor(id)),
  },
  {
    key: "produk",
    title: "Produk / Material",
    singular: "Produk",
    fields: [
      { name: "nama", label: "Nama Produk", type: "text" },
      { name: "vendorId", label: "Vendor", type: "ref", refKey: "vendors", refLabelField: "nama" },
      { name: "harga", label: "Harga (Rp)", type: "number", money: true },
      { name: "satuan", label: "Satuan", type: "text", placeholder: "sak, m³, pcs" },
      { name: "negotiable", label: "Bisa Nego?", type: "bool" },
    ],
    list: () => castList(withAuth(() => api.produk())),
    create: (b) => cast(withAuth(() => api.createProduk(b))),
    update: (id, b) => cast(withAuth(() => api.updateProduk(id, b))),
    remove: (id) => withAuth(() => api.deleteProduk(id)),
  },
  {
    key: "sla",
    title: "SLA / SOP Purchasing",
    singular: "SLA",
    fields: [
      { name: "no", label: "No", type: "number" },
      { name: "aktivitas", label: "Aktivitas", type: "text" },
      { name: "pic", label: "PIC", type: "text" },
      { name: "slaHari", label: "SLA", type: "text", placeholder: "1 Hari / Sesuai tempo" },
      { name: "slaTargetHari", label: "Target (hari)", type: "number" },
      { name: "output", label: "Output", type: "text" },
    ],
    list: () => castList(withAuth(() => api.sla())),
    create: (b) => cast(withAuth(() => api.createSla(b))),
    update: (id, b) => cast(withAuth(() => api.updateSla(id, b))),
    remove: (id) => withAuth(() => api.deleteSla(id)),
  },
];

/** Default 8-step purchasing SOP (contract SLA reference), inserted on demand. */
const SOP_DEFAULT: Record<string, unknown>[] = [
  { no: 1, aktivitas: "Permintaan Pembelian (PR)", pic: "Pemohon", slaHari: "1 Hari", slaTargetHari: 1, output: "PR diajukan" },
  { no: 2, aktivitas: "Verifikasi & Persetujuan PR", pic: "Kadep", slaHari: "1 Hari", slaTargetHari: 1, output: "PR disetujui" },
  { no: 3, aktivitas: "Permintaan Penawaran / Negosiasi", pic: "Purchasing", slaHari: "2 Hari", slaTargetHari: 2, output: "Penawaran vendor" },
  { no: 4, aktivitas: "Pembuatan Purchase Order (PO)", pic: "Purchasing", slaHari: "1 Hari", slaTargetHari: 1, output: "PO terbit" },
  { no: 5, aktivitas: "Persetujuan PO", pic: "Kadep / Dirops", slaHari: "1 Hari", slaTargetHari: 1, output: "PO disetujui" },
  { no: 6, aktivitas: "Pemesanan ke Supplier", pic: "Purchasing", slaHari: "1 Hari", slaTargetHari: 1, output: "Order terkirim" },
  { no: 7, aktivitas: "Penerimaan Barang & BAST", pic: "Gudang / Purchasing", slaHari: "Sesuai tempo", slaTargetHari: 0, output: "Barang diterima" },
  { no: 8, aktivitas: "Invoice & Pembayaran", pic: "Keuangan", slaHari: "Sesuai tempo", slaTargetHari: 0, output: "Pembayaran lunas" },
];

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function ResourceManager({ config }: { config: ResourceDef }) {
  const [items, setItems] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Rec | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const columns = useMemo(() => config.fields.filter((f) => !f.hideInTable), [config]);

  // Related resources referenced by any ref field.
  const refKeys = useMemo(
    () => [...new Set(config.fields.filter((f) => f.type === "ref" && f.refKey).map((f) => f.refKey as string))],
    [config],
  );
  const [refData, setRefData] = useState<Record<string, Rec[]>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(
      refKeys.map((k) => {
        const r = RESOURCES.find((x) => x.key === k);
        return (r ? r.list() : Promise.resolve([] as Rec[])).then((d) => [k, d] as const).catch(() => [k, [] as Rec[]] as const);
      }),
    ).then((pairs) => {
      if (alive) setRefData(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [refKeys]);

  const refLabel = useCallback(
    (f: FieldDef, value: unknown): string => {
      const list = refData[f.refKey ?? ""] ?? [];
      const hit = list.find((r) => String(r.id) === String(value));
      return hit ? String(hit[f.refLabelField ?? "id"] ?? hit.id) : value == null ? "" : String(value);
    },
    [refData],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    config
      .list()
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [config]);

  useEffect(load, [load]);

  const onDelete = async (rec: Rec) => {
    if (!window.confirm(`Hapus ${config.singular} ini?`)) return;
    try {
      await config.remove(rec.id);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const seedSop = async () => {
    if (!window.confirm("Isi 8 langkah SOP purchasing default?")) return;
    setSeeding(true);
    try {
      for (const row of SOP_DEFAULT) await config.create(row);
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSeeding(false);
    }
  };

  const fmtCell = (f: FieldDef, rec: Rec) => {
    if (f.type === "ref") return refLabel(f, rec[f.name]);
    if (f.type === "bool") return rec[f.name] ? "Ya" : "Tidak";
    if (f.money) return rpFull(Number(rec[f.name]) || 0);
    return cellText(rec[f.name]);
  };

  return (
    <div className="md-panel">
      <header className="md-head">
        <div>
          <h2>{config.title}</h2>
          <span className="md-count">{items.length} data</span>
        </div>
        <div className="md-head-actions">
          {config.key === "sla" && (
            <button className="md-btn" onClick={seedSop} disabled={seeding} title="Isi 8 langkah SOP purchasing default">
              {seeding ? "Mengisi…" : "＋ Isi SOP default"}
            </button>
          )}
          <button className="md-btn primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
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
                    <td key={c.name}>{fmtCell(c, rec)}</td>
                  ))}
                  <td className="md-actions">
                    <button className="md-btn" onClick={() => { setEditing(rec); setFormOpen(true); }}>Edit</button>
                    <button className="md-btn danger" onClick={() => onDelete(rec)}>Hapus</button>
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
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function initialValues(config: ResourceDef, editing: Rec | null): FormValues {
  const out: FormValues = {};
  for (const f of config.fields) {
    const raw = editing ? editing[f.name] : undefined;
    if (f.type === "bool") out[f.name] = raw ? "true" : "false";
    else out[f.name] = raw == null ? "" : String(raw);
  }
  return out;
}

function buildPayload(config: ResourceDef, editing: Rec | null, values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = editing ? { ...editing } : {};
  for (const f of config.fields) {
    const raw = values[f.name] ?? "";
    if (f.type === "number") payload[f.name] = raw === "" ? 0 : Number(raw);
    else if (f.type === "bool") payload[f.name] = raw === "true";
    else payload[f.name] = raw;
  }
  return payload;
}

function RecordForm({
  config,
  editing,
  refData,
  onClose,
  onSaved,
}: {
  config: ResourceDef;
  editing: Rec | null;
  refData: Record<string, Rec[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(config, editing));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = buildPayload(config, editing, values);
      if (editing) await config.update(editing.id, payload);
      else await config.create(payload);
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <form className="mdf-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="mdf-head">
          <h3>{editing ? "Edit" : "Tambah"} {config.singular}</h3>
          <button type="button" className="mdf-close" onClick={onClose}>×</button>
        </header>
        <div className="mdf-body">
          {config.fields.map((f) => (
            <label key={f.name} className={`mdf-field ${f.type === "textarea" ? "wide" : ""}`}>
              <span className="mdf-label">{f.label}</span>
              {f.type === "ref" ? (
                <select value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">— pilih —</option>
                  {(refData[f.refKey ?? ""] ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{String(r[f.refLabelField ?? "id"] ?? r.id)}</option>
                  ))}
                </select>
              ) : f.type === "select" ? (
                <select value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">— pilih —</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === "bool" ? (
                <select value={values[f.name] ?? "false"} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="false">Tidak</option>
                  <option value="true">Ya</option>
                </select>
              ) : f.type === "textarea" ? (
                <textarea rows={2} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        {error && <div className="mdf-error">{error}</div>}
        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>Batal</button>
          <button type="submit" className="md-btn primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
        </footer>
      </form>
    </div>
  );
}

/** Master-data workspace: resource picker on the left, CRUD table on the right. */
export function MasterDataView() {
  const [activeKey, setActiveKey] = useState(RESOURCES[0].key);
  const active = RESOURCES.find((r) => r.key === activeKey) ?? RESOURCES[0];
  return (
    <div className="master">
      <aside className="master-nav">
        <div className="master-nav-title">Master Data Purchasing</div>
        {RESOURCES.map((r) => (
          <button
            key={r.key}
            className={`master-nav-item ${r.key === activeKey ? "active" : ""}`}
            onClick={() => setActiveKey(r.key)}
          >
            {r.title}
          </button>
        ))}
      </aside>
      <section className="master-content">
        <ResourceManager key={active.key} config={active} />
      </section>
    </div>
  );
}
