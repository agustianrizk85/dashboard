import { useEffect, useState, type FormEvent } from "react";
import type { Vendor, VendorInput } from "@/modules/permit/models";
import { vendorService } from "@/modules/permit/services/vendor.service";

const empty: VendorInput = {
  category: "Legal Permit",
  name: "",
  address: "",
  ktp_number: "",
  account_number: "",
  bank_name: "",
  account_holder: "",
  notes: "",
};

export function VendorPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<string[]>(["Legal Permit"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    vendorService
      .list()
      .then((r) => {
        setItems(r.items);
        if (r.categories?.length) setCategories(r.categories);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (v: Vendor) => {
    setEditing(v);
    setShowForm(true);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Master Data Vendor / Pihak Ketiga (I)</h1>
          <p className="muted">Acuan vendor untuk SPK Legal Permit (Proses J).</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          + Vendor Baru
        </button>
      </div>

      {showForm && (
        <VendorForm
          initial={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="muted">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="empty">Belum ada vendor.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kategori</th>
                <th>No. KTP</th>
                <th>Bank</th>
                <th>No. Rekening</th>
                <th>Atas Nama</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.name}</strong>
                    {v.address && <div className="muted small">{v.address}</div>}
                  </td>
                  <td>{v.category}</td>
                  <td>{v.ktp_number || "—"}</td>
                  <td>{v.bank_name || "—"}</td>
                  <td>{v.account_number || "—"}</td>
                  <td>{v.account_holder || "—"}</td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(v)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorForm({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: Vendor | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VendorInput>(
    initial
      ? {
          category: initial.category,
          name: initial.name,
          address: initial.address,
          ktp_number: initial.ktp_number,
          account_number: initial.account_number,
          bank_name: initial.bank_name,
          account_holder: initial.account_holder,
          notes: initial.notes,
        }
      : empty,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof VendorInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (initial) await vendorService.update(initial.id, form);
      else await vendorService.create(form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit}>
      <h3>{initial ? "Edit Vendor" : "Vendor Baru"}</h3>
      <div className="form-row">
        <label className="field">
          <span>Kategori</span>
          <select value={form.category} onChange={set("category")}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nama *</span>
          <input value={form.name} onChange={set("name")} required />
        </label>
      </div>
      <label className="field">
        <span>Alamat</span>
        <input value={form.address} onChange={set("address")} />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Nomor KTP</span>
          <input value={form.ktp_number} onChange={set("ktp_number")} />
        </label>
        <label className="field">
          <span>Bank Rekening</span>
          <input value={form.bank_name} onChange={set("bank_name")} />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Nomor Rekening</span>
          <input value={form.account_number} onChange={set("account_number")} />
        </label>
        <label className="field">
          <span>Atas Nama Rekening</span>
          <input value={form.account_holder} onChange={set("account_holder")} />
        </label>
      </div>
      <label className="field">
        <span>Catatan</span>
        <input value={form.notes} onChange={set("notes")} />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
