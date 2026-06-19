import { useEffect, useMemo, useState } from "react";
import type { DivisionOutputs } from "../../types";
import { picName } from "../../lib/format";
import { ProgressBar, StatusPill } from "../ui";

/**
 * Output Divisi view — where each finished deliverable is routed: Legal,
 * Marketing, Teknik, Konsumen and the CEO overview. Pick a division tab to see
 * its deliverables and how many are ready.
 */
export function OutputsView({ outputs }: { outputs: DivisionOutputs[] }) {
  const [active, setActive] = useState(outputs[0]?.division ?? "");
  const [projFilter, setProjFilter] = useState("");
  const [picFilter, setPicFilter] = useState("");
  const current = outputs.find((o) => o.division === active) ?? outputs[0];

  // Project + PIC options derived from the active division's items, so the long
  // list can be narrowed to a single project and/or author.
  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    (current?.items ?? []).forEach((it) => seen.set(it.projectId, `${it.gp} · ${it.projectName}`));
    return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [current]);

  const pics = useMemo(
    () => Array.from(new Set((current?.items ?? []).map((it) => it.pic))).sort(),
    [current],
  );

  // Drop filters that no longer apply when switching division.
  useEffect(() => {
    setProjFilter("");
    setPicFilter("");
  }, [active]);

  const items = (current?.items ?? []).filter(
    (it) => (!projFilter || it.projectId === projFilter) && (!picFilter || it.pic === picFilter),
  );

  return (
    <div className="view view-outputs">
      <div className="seg seg-lg">
        {outputs.map((o) => {
          const pct = o.total > 0 ? Math.round((o.ready / o.total) * 100) : 0;
          return (
            <button
              key={o.division || o.label}
              className={o.division === active ? "on" : ""}
              onClick={() => setActive(o.division)}
            >
              {o.label}
              <span className="seg-badge">
                {o.ready}/{o.total}
              </span>
              <span className="seg-pct">{pct}%</span>
            </button>
          );
        })}
      </div>

      {current && (
        <section className="panel">
          <div className="out-hd">
            <h2 className="panel-title">Output {current.label}</h2>
            <div className="out-prog">
              <ProgressBar value={current.total > 0 ? Math.round((current.ready / current.total) * 100) : 0} />
              <span>
                {current.ready} siap dari {current.total} deliverable
              </span>
            </div>
          </div>
          <div className="out-toolbar">
            <label className="filter-select">
              <span>Proyek</span>
              <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)}>
                <option value="">Semua proyek</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select">
              <span>PIC</span>
              <select value={picFilter} onChange={(e) => setPicFilter(e.target.value)}>
                <option value="">Semua PIC</option>
                {pics.map((p) => (
                  <option key={p} value={p}>
                    {picName(p)}
                  </option>
                ))}
              </select>
            </label>
            {(projFilter || picFilter) && (
              <button
                className="btn-ghost sm out-clear"
                onClick={() => {
                  setProjFilter("");
                  setPicFilter("");
                }}
              >
                Reset filter
              </button>
            )}
            <span className="out-count">{items.length} deliverable</span>
          </div>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Proyek</th>
                  <th>Deliverable</th>
                  <th>Author</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.projectId + it.deliverable + i}>
                    <td>
                      <span className="proj-gp inline">{it.gp}</span> {it.projectName}
                    </td>
                    <td>{it.deliverable}</td>
                    <td>{picName(it.pic)}</td>
                    <td>
                      <StatusPill status={it.status} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-note">
                      {current.items.length === 0
                        ? "Belum ada output untuk divisi ini."
                        : "Tidak ada output yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
