import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CreateSPKInput, PricingMode, Project, SPK, SPKStatus, SPKType, Vendor } from "@/modules/permit/models";
import { spkService } from "@/modules/permit/services/spk.service";
import { vendorService } from "@/modules/permit/services/vendor.service";
import { projectService } from "@/modules/permit/services/project.service";
import { useAuth } from "@/auth/AuthContext";
import { SearchableSelect, type SSOption } from "@/modules/permit/components/SearchableSelect";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const statusLabel: Record<SPKStatus, string> = {
  draft: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const filters: { key: SPKStatus | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Menunggu Approval" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

export function SPKPage() {
  const { user } = useAuth();
  const isKadep = user?.role === "kadep";
  const isDirops = user?.role === "dirops";

  const [items, setItems] = useState<SPK[]>([]);
  const [filter, setFilter] = useState<SPKStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [types, setTypes] = useState<SPKType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const load = () => {
    setLoading(true);
    spkService
      .list(filter === "all" ? undefined : filter)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  useEffect(() => {
    Promise.all([spkService.types(), vendorService.list(), projectService.list()])
      .then(([ty, v, p]) => {
        setTypes(ty);
        setVendors(v.items);
        setProjects(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  const decide = async (spk: SPK, approve: boolean) => {
    const note = window.prompt(approve ? "Catatan approval (opsional):" : "Alasan penolakan:") ?? "";
    try {
      if (approve) await spkService.approve(spk.id, note);
      else await spkService.reject(spk.id, note);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>SPK Legal Permit (J)</h1>
          <p className="muted">
            Pembuatan SPK (Kadep) → approval Direktur Operasional. Nomor SPK dibuat otomatis.
          </p>
        </div>
        {isKadep && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Tutup" : "+ SPK Baru"}
          </button>
        )}
      </div>

      {showForm && isKadep && (
        <SPKForm
          types={types}
          vendors={vendors}
          projects={projects}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`tab ${filter === f.key ? "tab-active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="muted">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="empty">Belum ada SPK.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nomor SPK</th>
                <th>Jenis</th>
                <th>Vendor</th>
                <th>Lahan</th>
                <th>Nilai</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.number}</strong>
                    <div className="muted small">{rincian(s)}</div>
                  </td>
                  <td>{s.type_name}</td>
                  <td>{s.vendor?.name ?? "—"}</td>
                  <td>{s.project?.name ?? "—"}</td>
                  <td>{rupiah(s.total)}</td>
                  <td>
                    <span className={`badge badge-${s.status}`}>{statusLabel[s.status]}</span>
                    {s.decision_note && <div className="muted small">{s.decision_note}</div>}
                  </td>
                  <td>
                    {isDirops && s.status === "draft" && (
                      <div className="row-actions">
                        <button className="btn btn-sm btn-primary" onClick={() => decide(s, true)}>
                          Setujui
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => decide(s, false)}>
                          Tolak
                        </button>
                      </div>
                    )}
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

function rincian(s: SPK): string {
  if (s.pricing_mode === "per_meter") return `${rupiah(s.unit_price)}/m² × ${s.quantity} m²`;
  if (s.pricing_mode === "per_unit") return `${rupiah(s.unit_price)}/unit × ${s.quantity} unit`;
  return "Lumpsum";
}

const modeLabels: Record<PricingMode, { price: string; qty?: string }> = {
  per_meter: { price: "Harga per Meter (Rp)", qty: "Luas Lahan (m²)" },
  per_unit: { price: "Harga per Unit (Rp)", qty: "Total Unit" },
  lumpsum: { price: "Harga (Rp)" },
};

function SPKForm({
  types,
  vendors,
  projects,
  onClose,
  onSaved,
}: {
  types: SPKType[];
  vendors: Vendor[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [typeCode, setTypeCode] = useState("");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [completionTime, setCompletionTime] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [scopeNote, setScopeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const vendorOptions: SSOption[] = useMemo(
    () =>
      vendors.map((v) => ({
        value: v.id,
        label: v.name,
        sub: [v.category, v.bank_name, v.account_holder].filter(Boolean).join(" · "),
      })),
    [vendors],
  );
  const projectOptions: SSOption[] = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name, sub: p.location || p.pt_name })),
    [projects],
  );

  const selectedType = useMemo(() => types.find((t) => t.code === typeCode), [types, typeCode]);
  const mode: PricingMode = selectedType?.pricing_mode ?? "lumpsum";
  const labels = modeLabels[mode];
  const total = mode === "lumpsum" ? unitPrice : unitPrice * (quantity || 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!typeCode || !vendorId) {
      setError("Jenis SPK dan Vendor wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    const payload: CreateSPKInput = {
      type: typeCode,
      vendor_id: Number(vendorId),
      project_id: projectId === "" ? null : Number(projectId),
      unit_price: unitPrice,
      quantity: mode === "lumpsum" ? 0 : quantity,
      completion_time: completionTime,
      payment_terms: paymentTerms,
      scope_note: scopeNote,
    };
    try {
      await spkService.create(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit}>
      <h3>SPK Baru — Nomor otomatis saat disimpan</h3>
      <div className="form-row">
        <label className="field">
          <span>Jenis SPK *</span>
          <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} required>
            <option value="">— Pilih jenis —</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Vendor (Acuan I-1) *</span>
          <SearchableSelect
            options={vendorOptions}
            value={vendorId}
            onChange={setVendorId}
            placeholder="Cari & pilih vendor…"
            emptyText="Vendor tidak ditemukan — tambahkan di menu Vendor"
          />
        </label>
      </div>

      <label className="field">
        <span>Lahan / Proyek (opsional)</span>
        <SearchableSelect
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="Cari & pilih lahan… (boleh kosong)"
          emptyText="Lahan tidak ditemukan"
        />
      </label>

      <div className="form-row">
        <label className="field">
          <span>{labels.price}</span>
          <input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
        </label>
        {labels.qty && (
          <label className="field">
            <span>{labels.qty}</span>
            <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
        )}
      </div>

      <div className="form-row">
        <label className="field">
          <span>Waktu Penyelesaian</span>
          <input value={completionTime} onChange={(e) => setCompletionTime(e.target.value)} placeholder="mis. 30 hari kerja" />
        </label>
        <label className="field">
          <span>Termin Pembayaran</span>
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="mis. 50% DP, 50% selesai" />
        </label>
      </div>

      <label className="field">
        <span>Ruang Lingkup / Catatan</span>
        <input value={scopeNote} onChange={(e) => setScopeNote(e.target.value)} />
      </label>

      <div className="total-preview">
        Nilai SPK: <strong>{rupiah(total)}</strong>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Batal
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Menyimpan…" : "Buat SPK"}
        </button>
      </div>
    </form>
  );
}
