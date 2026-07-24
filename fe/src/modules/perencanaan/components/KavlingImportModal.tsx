import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import type { KavlingImportResult, KavlingImportRow } from "../api/client";
import { Modal } from "./Modal";

/**
 * KavlingImportModal — bulk-create kavling from a pasted spreadsheet OR an
 * uploaded XLSX/CSV. Flow: parse → auto-detect column mapping (editable) →
 * preview → commit via api.importKavling. Only names are sent; the backend
 * resolves/creates Blok and Tipe masters and upserts by No. Kav.
 */

/** The five importable targets, plus "" = abaikan (ignore this column). Lebar
 *  is the plot size — it absorbed the old separate "Kavling (luas)" target. */
type Field = "noKav" | "tipe" | "blok" | "bangunan" | "lebar" | "";

const FIELD_OPTS: { value: Field; label: string }[] = [
  { value: "", label: "(abaikan)" },
  { value: "noKav", label: "No. Kav" },
  { value: "tipe", label: "Tipe" },
  { value: "blok", label: "Blok" },
  { value: "bangunan", label: "Luas Bangunan" },
  { value: "lebar", label: "Luas Tanah" },
];

/** Normalize a header for keyword matching: lowercase, alphanumerics only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Guess the target field for a header. Priority order matters so the ambiguous
 * "kavling" resolves right: the unit *number* (noKav) is matched before the
 * plot *size* (kavling luas / lebar — same target now).
 */
function detect(header: string): Field {
  const n = norm(header);
  if (!n) return "";
  if (n.includes("nokav") || n.includes("nounit") || n.includes("nomor") || n === "no" || n === "unit") return "noKav";
  if (n.includes("tipe") || n.includes("type")) return "tipe";
  if (n.includes("blok") || n.includes("block") || n.includes("cluster")) return "blok";
  if (n.includes("luasbangunan") || n.includes("bangunan") || n === "lb" || n.includes("building")) return "bangunan";
  if (n.includes("luaskavling") || n.includes("luastanah") || n === "lt" || n === "kavling" || n === "kav" || n === "luas") return "lebar";
  if (n.includes("lebar") || n.includes("width") || n.includes("frontage")) return "lebar";
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

/** Parse "bangunan"/"kavling" by stripping non-digits → integer (empty → 0). */
const toInt = (s: string) => {
  const d = s.replace(/[^0-9]/g, "");
  return d ? parseInt(d, 10) : 0;
};

/** Fallback when the sheet has no Blok column: derive it from No Kav's letter
 *  prefix ("A1" → "A", "B12" → "B"). Only used when Blok wasn't mapped/filled. */
const blokFromNoKav = (noKav: string): string => (noKav.match(/^[A-Za-z]+/) ?? [""])[0];

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

function summaryText(r: KavlingImportResult): string {
  const parts = [`✓ ${r.created} dibuat`, `${r.updated} diperbarui`];
  if (r.bloksCreated.length) parts.push(`blok baru: ${r.bloksCreated.join(", ")}`);
  if (r.typesCreated.length) parts.push(`tipe baru: ${r.typesCreated.join(", ")}`);
  if (r.skipped.length) parts.push(`dilewati: ${r.skipped.length}`);
  return parts.join(" · ");
}

export function KavlingImportModal({
  projectId,
  onClose,
  onDone,
}: {
  projectId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [upsert, setUpsert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<KavlingImportResult | null>(null);

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

  // field → source column index (last one wins if a target is duplicated).
  const fieldCol = useMemo(() => {
    const rec: Partial<Record<Exclude<Field, "">, number>> = {};
    mapping.forEach((f, i) => { if (f) rec[f] = i; });
    return rec;
  }, [mapping]);

  // Build the rows to send: skip rows where every mapped cell is blank.
  const rows = useMemo<KavlingImportRow[]>(() => {
    const get = (r: string[], f: Exclude<Field, "">) => {
      const c = fieldCol[f];
      return c == null ? "" : (r[c] ?? "").trim();
    };
    const out: KavlingImportRow[] = [];
    for (const r of data) {
      const noKav = get(r, "noKav");
      const tipe = get(r, "tipe");
      const lebar = get(r, "lebar");
      const bg = get(r, "bangunan");
      const blokRaw = get(r, "blok");
      if (!noKav && !tipe && !blokRaw && !lebar && !bg) continue; // fully blank
      // No Blok column mapped/found → fall back to No Kav's letter prefix so
      // rows still land in the right blok instead of "unassigned".
      const blok = blokRaw || blokFromNoKav(noKav);
      out.push({ noKav, tipe, blok, bangunan: toInt(bg), lebar });
    }
    return out;
  }, [data, fieldCol]);

  const blankNoKav = rows.filter((r) => !r.noKav).length;
  const preview = rows.slice(0, 15);

  // Build + download a sample XLSX so users know the expected format. The
  // "Persentase" column is included on purpose to show it is ignored on import.
  const downloadTemplate = () => {
    const sample = [
      ["No Kav", "Tipe", "Blok", "Luas Bangunan", "Luas Tanah", "Persentase"],
      ["A1", "Garnet", "C", 42, 50, "100%"],
      ["A2", "Garnet", "C", 42, 35, "80%"],
      ["A3", "Ruby", "B", 42, 39, "60%"],
      ["A4", "Ruby", "B", 42, 33, "40%"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 11 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kavling");
    XLSX.writeFile(wb, "contoh-import-kavling.xlsx");
  };

  const doImport = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.importKavling(projectId, rows, upsert);
      setResult(res);
      onDone(); // reload editor + refresh Proyek counts
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import Kavling" sub="Tempel dari spreadsheet atau unggah XLSX/CSV" onClose={onClose} width={880}>
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
          placeholder={"Tempel dari Excel/Sheets (dengan baris judul).\nContoh:\nNo Kav\tTipe\tBlok\tLuas Bangunan\tLuas Tanah\nA1\tGarnet\tA\t36\t72"}
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
                  <th>No Kav</th>
                  <th>Tipe</th>
                  <th>Blok</th>
                  <th>Luas Bangunan</th>
                  <th>Luas Tanah</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.noKav || <span className="note">— kosong —</span>}</td>
                    <td>{r.tipe}</td>
                    <td>{r.blok}</td>
                    <td className="num">{r.bangunan}</td>
                    <td>{r.lebar}</td>
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr><td colSpan={5} className="note">Belum ada baris data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kav-imp-count">
            {rows.length} baris{blankNoKav > 0 && <> · <b>{blankNoKav} akan dilewati (No. Kav kosong)</b></>}
            {rows.length > preview.length && <> · menampilkan {preview.length} pertama</>}
          </div>
        </div>
      )}

      {/* Options */}
      <label className="chk">
        <input type="checkbox" checked={upsert} onChange={(e) => setUpsert(e.target.checked)} />
        Perbarui kavling dengan No. Kav yang sama (jika sudah ada)
      </label>

      {/* Result / error */}
      {result && (
        <div className="kav-imp-summary">
          {summaryText(result)}
          {result.skipped.length > 0 && (
            <div className="kav-imp-skips">
              {result.skipped.map((s, i) => (
                <div key={i}>Baris {s.row}{s.noKav ? ` (${s.noKav})` : ""}: {s.reason}</div>
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
              {busy ? "Mengimpor…" : `Import ${rows.length} baris`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
