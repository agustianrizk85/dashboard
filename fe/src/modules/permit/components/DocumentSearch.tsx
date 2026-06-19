import { useState } from "react";
import type { DocumentFile } from "@/modules/permit/models";
import { dashboardService } from "@/modules/permit/services/dashboard.service";
import { stepService } from "@/modules/permit/services/step.service";

export function DocumentSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DocumentFile[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const r = await dashboardService.searchDocuments(q);
      setResults(r.items);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>🔎 Search All Dokumen</h2>
      <div className="search-row">
        <input
          placeholder="Cari nama / jenis dokumen (KTP, SHM, Akta…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>
          {loading ? "…" : "Cari"}
        </button>
      </div>
      {results && (
        <div className="docs-list" style={{ marginTop: "0.7rem" }}>
          {results.length === 0 ? (
            <span className="muted small">Tidak ada dokumen cocok.</span>
          ) : (
            results.map((d) => (
              <a key={d.id} className="doc-pill" href={stepService.downloadUrl(d.id)} target="_blank" rel="noreferrer">
                📄 {d.doc_type}: {d.original_name}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
