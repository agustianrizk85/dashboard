import { useMemo, useRef, useState } from "react";
import type { ConstructionStage, ProgressUnit } from "../types";
import { api } from "../api/client";
import { useAuth } from "@/auth/AuthContext";
import { Bar } from "./ui";
import { groupByTermin, pctTone, unitPct } from "../lib/kurvaS";
import { downloadXlsx, parseXlsx } from "../lib/xlsx";
import { csvToRecords } from "../lib/csv";

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
const truthy = (v: string) => /^(true|1|ya|y|v|x|✓|checked|selesai)$/i.test(String(v ?? "").trim());

/** Maps a normalised Excel header to a scalar field of ProgressUnit. */
const SCALAR_HEADER: Record<string, keyof ProgressUnit> = {
  "NO. INDUK": "noInduk", "NO INDUK": "noInduk", "NOINDUK": "noInduk",
  "NAMA PROYEK": "project", PROYEK: "project", PROJECT: "project",
  BLOK: "blok",
  "TGL SPK": "tglSpk", "TGL SPK FINISH": "tglSpkFinish",
  "STATUS KAVLING / UNIT": "status", "STATUS KAVLING": "status", STATUS: "status",
  "KETERANGAN PROGRES": "keterangan", KETERANGAN: "keterangan",
};

export function ProgressChecklist({ stages: stagesIn, units: unitsIn }: { stages: ConstructionStage[]; units: ProgressUnit[] }) {
  const { user } = useAuth();
  const editable = user?.role === "Kadep Teknik";

  const stages = useMemo(
    () => [...stagesIn].sort((a, b) => a.no - b.no),
    [stagesIn],
  );
  const groups = useMemo(() => groupByTermin(stages), [stages]);
  const totalWeight = useMemo(() => stages.reduce((a, s) => a + s.weight, 0) || 100, [stages]);

  const [units, setUnits] = useState<ProgressUnit[]>(unitsIn);
  const projects = useMemo(
    () => Array.from(new Set(units.map((u) => u.project))).sort(),
    [units],
  );
  const [project, setProject] = useState<string>(() => unitsIn[0]?.project ?? "");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return units
      .filter((u) => u.project === project)
      .filter((u) => !ql || u.noInduk.toLowerCase().includes(ql) || u.blok.toLowerCase().includes(ql));
  }, [units, project, q]);

  const toggle = async (unit: ProgressUnit, stageName: string) => {
    if (!editable) return;
    const next: ProgressUnit = { ...unit, stages: { ...unit.stages, [stageName]: !unit.stages[stageName] } };
    setUnits((list) => list.map((u) => (u.id === unit.id ? next : u)));
    try {
      await api.update<ProgressUnit>("progress-units", unit.id, next);
    } catch (e) {
      setUnits((list) => list.map((u) => (u.id === unit.id ? unit : u))); // revert
      setMsg("Gagal menyimpan: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onTemplate = () => {
    const headers = ["NO. INDUK", "NAMA PROYEK", "BLOK", "TGL SPK", "TGL SPK FINISH", "STATUS KAVLING / UNIT", "KETERANGAN PROGRES", ...stages.map((s) => s.name)];
    const sample = [
      "001", project || "PROYEK", "A1", "2026-01-01", "2026-06-01", "SOLD", "Contoh",
      ...stages.map((_, i) => (i < 3 ? "TRUE" : "FALSE")),
    ];
    downloadXlsx("template-cek-list-progress", headers, [sample]);
  };

  const onImport = async (file: File) => {
    setMsg("");
    try {
      const recs = csvToRecords(await parseXlsx(await file.arrayBuffer()));
      if (!recs.length) {
        setMsg("File kosong.");
        return;
      }
      // index headers once
      const stageByNorm = new Map(stages.map((s) => [norm(s.name), s.name]));
      let ok = 0;
      for (const rec of recs) {
        const u: Partial<ProgressUnit> = { stages: {} };
        const st: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(rec)) {
          const nk = norm(k);
          const scalar = SCALAR_HEADER[nk];
          if (scalar) {
            (u as Record<string, unknown>)[scalar] = String(v ?? "");
          } else if (stageByNorm.has(nk)) {
            st[stageByNorm.get(nk)!] = truthy(String(v));
          }
        }
        // default any missing stage to false
        for (const s of stages) if (!(s.name in st)) st[s.name] = false;
        u.stages = st;
        if (!u.noInduk && !u.blok) continue;
        if (!u.project) u.project = project;
        await api.create<ProgressUnit>("progress-units", u);
        ok++;
      }
      const fresh = await api.list<ProgressUnit>("progress-units");
      setUnits(fresh);
      setMsg(`✓ ${ok} unit diimpor.`);
    } catch (e) {
      setMsg("Gagal impor: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <header className="panel-hd">
        <span className="ptag">CEK LIST</span>
        <span className="ptitle">Progress Pembangunan Unit</span>
        <span className="psub">· bobot tahap → % progres</span>
        <span className="pspacer" />
        <select className="ckl-filter" value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input className="ckl-search" placeholder="cari blok / no induk…" value={q} onChange={(e) => setQ(e.target.value)} />
        {editable && (
          <>
            <button className="md-btn" onClick={onTemplate} title="Unduh template Excel (.xlsx)">⬇ Contoh</button>
            <button className="md-btn" onClick={() => fileRef.current?.click()} title="Impor unit dari Excel (.xlsx)">⭱ Import</button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }} />
          </>
        )}
      </header>
      {msg && <div className="ckl-msg" style={{ color: msg.startsWith("✓") ? "var(--ok)" : "var(--bad)" }}>{msg}</div>}
      <div className="panel-bd" style={{ padding: 0, minHeight: 0 }}>
        <div className="ckl-scroll">
          <table className="ckl-table">
            <thead>
              <tr>
                <th className="ckl-sticky ckl-l1" rowSpan={2}>No. Induk</th>
                <th className="ckl-sticky ckl-l2" rowSpan={2}>Blok</th>
                <th rowSpan={2}>Status</th>
                {groups.map((g) => (
                  <th key={g.termin} className={`ckl-termin ${g.termin.toLowerCase()}`} colSpan={g.stages.length}>
                    {g.termin === "T1" ? "TERMIN 1" : g.termin === "T2" ? "TERMIN 2" : g.termin === "T3" ? "TERMIN 3" : "TERMIN 4"}
                  </th>
                ))}
                <th className="ckl-pct" rowSpan={2}>Persentase Progress</th>
                <th rowSpan={2}>Keterangan</th>
              </tr>
              <tr>
                {stages.map((s) => (
                  <th key={s.id} className="ckl-stage" title={`${s.name} — ${s.weight}%`}>
                    <span className="ckl-stage-name">{s.name}</span>
                    <span className="ckl-stage-w">{s.weight}%</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const pct = unitPct(u, stages);
                return (
                  <tr key={u.id}>
                    <td className="ckl-sticky ckl-l1 ckl-id">{u.noInduk}</td>
                    <td className="ckl-sticky ckl-l2">{u.blok}</td>
                    <td className="ckl-status">{u.status}</td>
                    {stages.map((s) => (
                      <td key={s.id} className="ckl-cell">
                        <input
                          type="checkbox"
                          checked={!!u.stages[s.name]}
                          disabled={!editable}
                          onChange={() => void toggle(u, s.name)}
                        />
                      </td>
                    ))}
                    <td className="ckl-pct">
                      <div className="ckl-pct-wrap">
                        <span className="ckl-pct-val">{(pct).toFixed(2)}%</span>
                        <Bar value={pct} max={100} tone={pctTone(pct)} />
                      </div>
                    </td>
                    <td className="ckl-ket">{u.keterangan}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={stages.length + 5} className="ckl-empty">Tidak ada unit untuk proyek/filter ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="ckl-foot">
        <span>{rows.length} unit · proyek <b>{project}</b> · total bobot {totalWeight.toFixed(2)}%</span>
        {!editable && <span className="ckl-ro">Mode lihat — login admin untuk mencentang.</span>}
      </footer>
    </div>
  );
}
