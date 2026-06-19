import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PTMaster } from "@/modules/permit/models";
import { ptService } from "@/modules/permit/services/pt.service";

export function PTPage() {
  const [items, setItems] = useState<PTMaster[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [selected, setSelected] = useState<PTMaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    ptService
      .list()
      .then((r) => {
        setItems(r.items);
        setDocTypes(r.doc_types);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = async (id: number) => {
    const r = await ptService.get(id);
    setSelected(r.pt);
    setDocTypes(r.doc_types);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Master Data PT (E)</h1>
          <p className="muted">Data PT yang dipakai untuk akad &amp; PKS Bank.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Tutup" : "+ PT Baru"}
        </button>
      </div>

      {showForm && (
        <NewPTForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="pt-layout">
        <div className="pt-list">
          {loading ? (
            <div className="muted">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="empty">Belum ada PT.</div>
          ) : (
            items.map((pt) => (
              <button
                key={pt.id}
                className={`card pt-row ${selected?.id === pt.id ? "pt-row-active" : ""}`}
                onClick={() => openDetail(pt.id)}
              >
                <strong>{pt.name}</strong>
                <span className="muted small">NPWP: {pt.npwp || "—"} · NIB: {pt.nib || "—"}</span>
              </button>
            ))
          )}
        </div>

        <div className="pt-detail">
          {selected ? (
            <PTDetail pt={selected} docTypes={docTypes} onChanged={() => openDetail(selected.id)} />
          ) : (
            <div className="empty">Pilih PT untuk melihat &amp; mengunggah dokumen.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewPTForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [npwp, setNpwp] = useState("");
  const [nib, setNib] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await ptService.create({ name, npwp, nib });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="form-row">
        <label className="field">
          <span>Nama PT *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>NPWP PT</span>
          <input value={npwp} onChange={(e) => setNpwp(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>NIB</span>
        <input value={nib} onChange={(e) => setNib(e.target.value)} />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Menyimpan…" : "Simpan PT"}
      </button>
    </form>
  );
}

function PTDetail({ pt, docTypes, onChanged }: { pt: PTMaster; docTypes: string[]; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(docTypes[0] ?? "Akta PT");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      await ptService.uploadDocument(pt.id, file, docType);
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>{pt.name}</h2>
      <div className="muted small">NPWP: {pt.npwp || "—"} · NIB: {pt.nib || "—"}</div>

      <h3 style={{ marginTop: "1rem" }}>Dokumen</h3>
      <div className="docs-list">
        {pt.documents && pt.documents.length > 0 ? (
          pt.documents.map((d) => (
            <a key={d.id} className="doc-pill" href={ptService.downloadUrl(d.id)} target="_blank" rel="noreferrer">
              📄 {d.doc_type}: {d.original_name}
            </a>
          ))
        ) : (
          <span className="muted small">Belum ada dokumen.</span>
        )}
      </div>

      <div className="upload-row" style={{ marginTop: "0.8rem" }}>
        <select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {docTypes.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
        <input type="file" ref={fileRef} />
        <button className="btn btn-sm" onClick={upload} disabled={saving}>
          Unggah
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
