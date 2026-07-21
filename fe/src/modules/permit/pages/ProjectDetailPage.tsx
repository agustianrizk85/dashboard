import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProcessStep, Project } from "@/modules/permit/models";
import { projectService } from "@/modules/permit/services/project.service";
import { StepCard } from "@/modules/permit/components/StepCard";
import { PerencanaanPanel } from "@/modules/permit/components/PerencanaanPanel";
import { PksBankPanel } from "@/modules/permit/components/PksBankPanel";
import { categoryLabels } from "@/modules/permit/lib/processCatalog";
import { PERMIT_LEGACY_ENABLED } from "@/modules/permit/services/features";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Guard: an invalid/missing route param yields NaN — don't fire GET /projects/NaN.
    if (!Number.isFinite(projectId)) {
      setError("Proyek tidak ditemukan (id tidak valid).");
      setLoading(false);
      return;
    }
    setLoading(true);
    projectService
      .get(projectId)
      .then(setProject)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const steps = project?.steps ?? [];

  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    const done = steps.filter((s) => s.status === "done").length;
    return Math.round((done / steps.length) * 100);
  }, [steps]);

  // Group steps by macro category.
  const grouped = useMemo(() => {
    const map = new Map<string, ProcessStep[]>();
    for (const s of steps) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries());
  }, [steps]);

  // Collapsed categories (by code). Default: all expanded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (category: string) =>
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }));

  const onStepChange = (updated: ProcessStep) => {
    setProject((prev) =>
      prev
        ? { ...prev, steps: prev.steps?.map((s) => (s.id === updated.id ? updated : s)) }
        : prev,
    );
  };

  if (loading) return <div className="muted">Memuat…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!project) return <div className="muted">Proyek tidak ditemukan.</div>;

  return (
    <div className="page">
      <Link to="/permit" className="back-link">
        ← Kembali ke Dashboard
      </Link>

      <div className="page-head">
        <div>
          <h1>{project.name}</h1>
          <p className="muted">
            {project.location || "—"} · Pemilik: {project.owner_name || "—"} · PT:{" "}
            {project.pt_name || "—"}
          </p>
        </div>
      </div>

      {PERMIT_LEGACY_ENABLED && (
        <PerencanaanPanel project={project} onProjectChange={setProject} />
      )}

      {/* Berkas Acuan (F) — auto-aggregated PKS Bank; self-gated behind the
          legacy flag and never crashes on fetch error. */}
      <PksBankPanel projectId={project.id} />

      <div className="progress-bar-wrap">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{progress}% selesai</span>
      </div>

      {grouped.map(([category, list]) => {
        const isOpen = !collapsed[category];
        const doneCount = list.filter((s) => s.status === "done").length;
        return (
          <section key={category} className="category-section">
            <button
              type="button"
              className="category-title category-toggle"
              onClick={() => toggle(category)}
              aria-expanded={isOpen}
            >
              <span className={`chevron ${isOpen ? "chevron-open" : ""}`}>▶</span>
              <span className="category-name">{categoryLabels[category] ?? `Kategori ${category}`}</span>
              <span className="category-count">
                {doneCount}/{list.length}
              </span>
            </button>
            {isOpen && (
              <div className="steps">
                {list.map((s) => (
                  <StepCard key={s.id} step={s} onChange={onStepChange} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
