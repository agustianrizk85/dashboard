import { useMemo, useState } from "react";
import type { ReactNode } from "react";

/* Reusable division card for the Output Divisi page — used for BOTH directions
 * (inbound: divisions → Permit, outbound: Permit → divisions). Provides a search
 * box that FILTERS the list (pagination recalculates) with Enter-to-open, plus
 * prev/next pagination. Rows are normalized upstream so this stays direction-
 * agnostic. */

export interface OutRow {
  key: string;
  name: string;
  sub: string;
  statusLabel: string;
  statusCls: string;
  mark: ReactNode; // right-side indicator (doc / confidential …)
  searchText: string; // precomputed lowercase haystack
  onClick?: () => void; // set → row is a clickable button (opens detail)
}

const PAGE_SIZE = 8;

function RowInner({ r }: { r: OutRow }) {
  return (
    <>
      <div className="od-row-main">
        <span className="od-row-name">{r.name}</span>
        <span className="od-sub">{r.sub}</span>
      </div>
      <div className="od-row-marks">
        {r.mark}
        <span className={`od-badge ${r.statusCls}`}>{r.statusLabel}</span>
      </div>
    </>
  );
}

export function OutputCard({
  icon,
  label,
  rows,
  done,
}: {
  icon: string;
  label: string;
  rows: OutRow[];
  done: number;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const total = rows.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const clickable = rows.some((r) => r.onClick);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.searchText.includes(needle));
  }, [rows, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="od-card card">
      <div className="od-card-head">
        <span className="od-card-title">
          <span className="od-ico">{icon}</span>
          {label}
        </span>
        <span className="od-count">
          {done}/{total} selesai · {pct}%
        </span>
      </div>
      <div className="od-bar" title={`${pct}% selesai`}>
        <span className="od-bar-fill" style={{ width: pct + "%" }} />
      </div>

      {total > 0 && (
        <div className="od-search">
          <input
            className="od-search-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") filtered[0]?.onClick?.();
            }}
            placeholder={
              clickable ? "🔎 Cari deliverable / proyek… (Enter untuk buka)" : "🔎 Cari deliverable / proyek…"
            }
          />
          {q.trim() && <span className="od-search-count">{filtered.length} hasil</span>}
        </div>
      )}

      <div className="od-rows">
        {total === 0 ? (
          <div className="muted small od-empty">Belum ada output.</div>
        ) : filtered.length === 0 ? (
          <div className="muted small od-empty">Tidak ada yang cocok.</div>
        ) : (
          slice.map((r) =>
            r.onClick ? (
              <button type="button" key={r.key} className="od-row od-row-btn" onClick={r.onClick}>
                <RowInner r={r} />
              </button>
            ) : (
              <div key={r.key} className="od-row">
                <RowInner r={r} />
              </div>
            ),
          )
        )}
      </div>

      {pages > 1 && (
        <div className="od-pager">
          <button
            type="button"
            className="od-pg-btn"
            disabled={cur === 0}
            onClick={() => setPage(cur - 1)}
          >
            ‹ Sebelumnya
          </button>
          <span className="od-pg-info">
            Hal {cur + 1} / {pages}
          </span>
          <button
            type="button"
            className="od-pg-btn"
            disabled={cur >= pages - 1}
            onClick={() => setPage(cur + 1)}
          >
            Berikutnya ›
          </button>
        </div>
      )}
    </section>
  );
}
