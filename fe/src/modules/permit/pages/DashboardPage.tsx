import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Project } from "@/modules/permit/models";
import { projectService } from "@/modules/permit/services/project.service";
import { EarlyWarningPanel } from "@/modules/permit/components/EarlyWarningPanel";
import { DocumentSearch } from "@/modules/permit/components/DocumentSearch";
import { StageStepper } from "@/modules/permit/components/StageStepper";

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    projectService
      .list()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard Proyek Lahan</h1>
          <p className="muted">Pantau progres legal &amp; perizinan setiap lahan.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Tutup" : "+ Lahan Baru"}
        </button>
      </div>

      {showForm && (
        <NewProjectForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="dash-grid">
        <EarlyWarningPanel />
        <DocumentSearch />
      </div>

      <h2 className="section-title">Daftar Lahan</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="muted">Memuat…</div>
      ) : projects.length === 0 ? (
        <div className="empty">Belum ada lahan. Buat lahan baru untuk memulai Proses A.</div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/permit/projects/${p.id}`} className="card project-card">
              <div className="project-card-head">
                <h3>{p.name}</h3>
              </div>
              <StageStepper stage={p.stage} />
              <div className="muted small">{p.location || "Lokasi belum diisi"}</div>
              <div className="project-meta">
                <span>Pemilik: {p.owner_name || "—"}</span>
                <span>PT: {p.pt_name || "—"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ptName, setPtName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await projectService.create({
        name,
        location,
        owner_name: ownerName,
        pt_name: ptName,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="form-row">
        <label className="field">
          <span>Nama Lahan / Proyek *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Lokasi</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Pemilik Lahan</span>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </label>
        <label className="field">
          <span>PT yang Dipakai</span>
          <input value={ptName} onChange={(e) => setPtName(e.target.value)} />
        </label>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Menyimpan…" : "Simpan & Seed Proses A"}
      </button>
    </form>
  );
}
