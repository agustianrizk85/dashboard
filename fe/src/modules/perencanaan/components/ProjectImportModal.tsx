import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import type { ProjectImportResult, ProjectImportRow } from "../api/client";
import { Modal } from "./Modal";

/**
 * ProjectImportModal — bulk-create MASTER projects from a pasted spreadsheet OR
 * an uploaded XLSX/CSV. Flow mirrors KavlingImportModal: parse → auto-detect an
 * editable column mapping → preview → commit via api.importProjects. Only the
 * four project fields are sent; `luas` stays a STRING. One shared deliverable
 * template (Site Plans + Unit/Kawasan components) applies to EVERY imported
 * project, exactly like AddProjectModal. Projects are create-only — a name that
 * already exists is skipped (reported), never updated.
 */

/** The four importable fields, plus "" = abaikan (ignore this column). */
type Field = "name" | "gp" | "luas" | "lokasi" | "";

const FIELD_OPTS: { value: Field; label: string }[] = [
  { value: "", label: "(abaikan)" },
  { value: "name", label: "Nama Proyek" },
  { value: "gp", label: "GP" },
  { value: "luas", label: "Luas Total" },
  { value: "lokasi", label: "Lokasi" },
];

/** Normalize a header for keyword matching: lowercase, alphanumerics only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess the target field for a header; more specific keywords come first. */
function detect(header: string): Field {
  const n = norm(header);
  if (!n) return "";
  if (n.includes("lokasiproyek")) return "lokasi"; // guard before generic "proyek" catches it as name
  if (n.includes("namaproyek") || n === "nama" || n === "name" || n.includes("proyek") || n.includes("project")) return "name";
  if (n === "gp" || n.includes("grup") || n.includes("group") || n.includes("kodegp")) return "gp";
  if (n.includes("luastotal") || n.includes("luas") || n === "lt" || n.includes("area") || n.includes("size")) return "luas";
  if (n.includes("lokasi") || n.includes("location")) return "lokasi";
  return "";
}

/** Auto-map headers → fields, each target claimed by its leftmost match. */
function autoMap(header: string[]): Field[] {
  const used = new Set<Field>();
  return header.map((h) => {
    const f = detect(h);
    if (f && !used.has(f)) {
      used.add(f);
      return f;
    }
    return "";
  });
}

/** Split a raw matrix into header (first non-blank row) + the data rows after it. */
function splitMatrix(m: string[][]): { header: string[]; data: string[][] } {
  let i = 0;
  while (i < m.length && m[i].every((c) => (c ?? "").trim() === "")) i++;
  if (i >= m.length) return { header: [], data: [] };
  return { header: m[i].map((c) => (c ?? "").trim()), data: m.slice(i + 1) };
}

/** Paste path: TAB delimiter if any line has a tab, else comma. */
function parsePaste(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/);
  const delim = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((l) => l.split(delim));
}

function summaryText(r: ProjectImportResult): string {
  const parts = [`✓ ${r.created} dibuat`];
  if (r.skipped.length) parts.push(`dilewati: ${r.skipped.length}`);
  return parts.join(" · ");
}

export function ProjectImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  // Batch deliverable template applied to every imported project (see AddProjectModal).
  const [sitePlans, setSitePlans] = useState(1);
  const [includeUnit, setIncludeUnit] = useState(true);
  const [includeKawasan, setIncludeKawasan] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<ProjectImportResult | null>(null);

  const { header, data } = useMemo(() => splitMatrix(matrix), [matrix]);

  // Load a fresh matrix and re-run auto-detection (any manual mapping resets).
  const applyMatrix = (m: string[][]) => {
    setMatrix(m);
    setMapping(autoMap(splitMatrix(m).header));
    setResult(null);
    setErr("");
  };

  const onPaste = (text: string) => {
    setPaste(text);
    applyMatrix(text.trim() ? parsePaste(text) : []);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setErr("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false }) as unknown[][];
      applyMatrix(aoa.map((r) => (r ?? []).map((c) => (c == null ? "" : String(c)))));
    } catch (e) {
      setErr("Gagal membaca file: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Change one column's target; a target can be claimed by at most one column.
  const setField = (col: number, f: Field) => {
    setMapping((prev) => {
      const next = prev.slice();
      while (next.length < header.length) next.push("");
      if (f) next.forEach((v, i) => { if (v === f && i !== col) next[i] = ""; });
      next[col] = f;
      return next;
    });
    setResult(null);
  };

  // field → source column index.
  const fieldCol = useMemo(() => {
    const rec: Partial<Record<Exclude<Field, "">, number>> = {};
    mapping.forEach((f, i) => { if (f) rec[f] = i; });
    return rec;
  }, [mapping]);

  // Build the rows to send: skip rows where every mapped cell is blank. Rows
  // missing `name` are still sent (backend reports them in "skipped").
  const rows = useMemo<ProjectImportRow[]>(() => {
    const get = (r: string[], f: Exclude<Field, "">) => {
      const c = fieldCol[f];
      return c == null ? "" : (r[c] ?? "").trim();
    };
    const out: ProjectImportRow[] = [];
    for (const r of data) {
      const name = get(r, "name");
      const gp = get(r, "gp");
      const luas = get(r, "luas");
      const lokasi = get(r, "lokasi");
      if (!name && !gp && !luas && !lokasi) continue; // fully blank
      out.push({ name, gp, luas, lokasi });
    }
    return out;
  }, [data, fieldCol]);

  const blankName = rows.filter((r) => !r.name).length;
  const preview = rows.slice(0, 15);

  // Build + download a sample XLSX so users know the expected format.
  const downloadTemplate = () => {
    const sample = [
      ["Nama Proyek", "GP", "Luas", "Lokasi"],
      ["Le Hauz Premiere", "GP4", "4653", "Leuwinanggung"],
      ["Green Valley", "GP3", "3200", "Curug"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = [{ wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proyek");
    XLSX.writeFile(wb, "contoh-import-proyek.xlsx");
  };

  const doImport = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.importProjects(rows, { sitePlans, includeUnit, includeKawasan, skipExisting });
      setResult(res);
      onDone(); // refresh the Proyek list
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import Proyek" sub="Tempel dari spreadsheet atau unggah XLSX/CSV" onClose={onClose} width={880}>
      {/* Input mode */}
      <div className="kav-imp-tabs">
        <button type="button" className={"kav-imp-tab" + (mode === "paste" ? " on" : "")} onClick={() => setMode("paste")}>
          Tempel
        </button>
        <button type="button" className={"kav-imp-tab" + (mode === "file" ? " on" : "")} onClick={() => setMode("file")}>
          Unggah file
        </button>
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="btn-ghost sm" onClick={downloadTemplate} title="Unduh file contoh XLSX">
          ⬇ Unduh contoh format
        </button>
      </div>

      {mode === "paste" ? (
        <textarea
          className="kav-imp-ta"
          placeholder={"Tempel dari Excel/Sheets (dengan baris judul).\nContoh:\nNama Proyek\tGP\tLuas\tLokasi\nLe Hauz Premiere\tGP4\t4653\tLeuwinanggung"}
          value={paste}
          onChange={(e) => onPaste(e.target.value)}
        />
      ) : (
        <div className="kav-imp-file">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onFile(e.target.files?.[0])} />
          {fileName && <span className="note"> {fileName}</span>}
        </div>
      )}

      {/* Column mapping */}
      {header.length > 0 && (
        <div>
          <div className="kav-imp-sec">Pemetaan kolom</div>
          <div className="kav-imp-map">
            {header.map((h, i) => (
              <div className="kav-imp-col" key={i}>
                <span className="kav-imp-col-h" title={h || `Kolom ${i + 1}`}>{h || `Kolom ${i + 1}`}</span>
                <select value={mapping[i] ?? ""} onChange={(e) => setField(i, e.target.value as Field)}>
                  {FIELD_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {header.length > 0 && (
        <div>
          <div className="kav-imp-sec">Pratinjau</div>
          <div className="kav-imp-prev">
            <table className="big">
              <thead>
                <tr>
                  <th>Nama Proyek</th>
                  <th>GP</th>
                  <th>Luas</th>
                  <th>Lokasi</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.name || <span className="note">— kosong —</span>}</td>
                    <td>{r.gp}</td>
                    <td>{r.luas}</td>
                    <td>{r.lokasi}</td>
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr><td colSpan={4} className="note">Belum ada baris data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kav-imp-count">
            {rows.length} baris{blankName > 0 && <> · <b>{blankName} akan dilewati (Nama kosong)</b></>}
            {rows.length > preview.length && <> · menampilkan {preview.length} pertama</>}
          </div>
        </div>
      )}

      {/* Batch deliverable template — applied to ALL imported projects */}
      <div className="kav-imp-sec">Template Deliverable</div>
      <div className="form-row">
        <label className="form-field">
          <span>Jumlah Site Plan</span>
          <input
            type="number"
            min={1}
            max={20}
            value={sitePlans}
            onChange={(e) => setSitePlans(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <div className="form-field">
          <span>Komponen</span>
          <div className="chk-row">
            <label className="chk">
              <input type="checkbox" checked={includeUnit} onChange={(e) => setIncludeUnit(e.target.checked)} />
              Desain Unit Hunian
            </label>
            <label className="chk">
              <input type="checkbox" checked={includeKawasan} onChange={(e) => setIncludeKawasan(e.target.checked)} />
              Desain Kawasan
            </label>
          </div>
        </div>
      </div>
      <p className="form-hint">Template ini diterapkan ke semua proyek yang diimpor. PIC &amp; deliverable bisa diubah nanti.</p>

      {/* Options */}
      <label className="chk">
        <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
        Lewati proyek yang namanya sudah ada
      </label>

      {/* Result / error */}
      {result && (
        <div className="kav-imp-summary">
          {summaryText(result)}
          {result.gpsCreated.length > 0 && <div>GP baru: {result.gpsCreated.join(", ")}</div>}
          {result.skipped.length > 0 && (
            <div className="kav-imp-skips">
              {result.skipped.map((s, i) => (
                <div key={i}>Baris {s.row}{s.key ? ` (${s.key})` : ""}: {s.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <div className="review-err">{err}</div>}

      {/* Actions */}
      <div className="form-actions">
        {result ? (
          <button type="button" className="btn-primary" onClick={onClose}>Tutup</button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
            <button type="button" className="btn-primary" disabled={busy || rows.length === 0} onClick={() => void doImport()}>
              {busy ? "Mengimpor…" : `Import ${rows.length} proyek`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
