import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import type { MasterImportResult, MasterImportRow, MasterKind } from "../api/client";
import { Modal } from "./Modal";

/**
 * MasterImportModal — generalized bulk-import for the four Master Produk targets
 * (GP, Tipe Bangunan, Lebar Kavling, Lokasi). Flow mirrors KavlingImportModal:
 * paste OR upload XLSX/CSV → auto-detect an editable column mapping → preview →
 * commit via api.importMaster. Only the fields relevant to the kind are sent;
 * the backend matches by KEY (gp→code, others→name) and upserts or skips.
 */

/** The importable master fields, plus "" = abaikan (ignore this column). */
type Field = "code" | "name" | "bangunan" | "tanah" | "";

interface FieldDef {
  field: Exclude<Field, "">;
  label: string;
  kind: "text" | "number";
  /** normalized-header substrings that map to this field (priority = array order of fields). */
  keywords: string[];
}

interface KindConfig {
  fields: FieldDef[];
  /** the required matching key (gp→code, others→name). */
  keyField: Exclude<Field, "">;
  keyLabel: string;
  sampleHeader: string[];
  sampleRows: (string | number)[][];
}

/** Per-kind field + auto-detect + sample-template configuration. */
const CONFIGS: Record<MasterKind, KindConfig> = {
  gp: {
    fields: [
      { field: "code", label: "Kode", kind: "text", keywords: ["kode", "code", "gp"] },
      { field: "name", label: "Nama", kind: "text", keywords: ["namagrup", "nama", "name", "grup", "brand"] },
    ],
    keyField: "code",
    keyLabel: "Kode",
    sampleHeader: ["Kode", "Nama"],
    sampleRows: [
      ["GP1", "Le Hauz"],
      ["GP2", "Green Park"],
    ],
  },
  tipe: {
    fields: [
      { field: "name", label: "Nama", kind: "text", keywords: ["nama", "name", "tipe", "type"] },
      { field: "bangunan", label: "Bangunan", kind: "number", keywords: ["luasbangunan", "bangunan", "lb", "building"] },
      { field: "tanah", label: "Tanah", kind: "number", keywords: ["luastanah", "tanah", "lt", "land"] },
    ],
    keyField: "name",
    keyLabel: "Nama",
    sampleHeader: ["Nama", "Bangunan", "Tanah"],
    sampleRows: [
      ["Garnet", 42, 32],
      ["Ruby", 42, 33],
    ],
  },
  lebar: {
    fields: [{ field: "name", label: "Nama", kind: "text", keywords: ["nama", "name", "lebar", "width"] }],
    keyField: "name",
    keyLabel: "Nama",
    sampleHeader: ["Nama"],
    sampleRows: [["L4"], ["L5"], ["L3.5"]],
  },
  lokasi: {
    fields: [{ field: "name", label: "Nama", kind: "text", keywords: ["nama", "name", "lokasi", "location"] }],
    keyField: "name",
    keyLabel: "Nama",
    sampleHeader: ["Nama"],
    sampleRows: [["Leuwinanggung"], ["Curug"]],
  },
};

/** Normalize a header for keyword matching: lowercase, alphanumerics only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess the target field for a header; fields are tried in config order. */
function detect(cfg: KindConfig, header: string): Field {
  const n = norm(header);
  if (!n) return "";
  for (const fd of cfg.fields) {
    if (fd.keywords.some((k) => n.includes(k))) return fd.field;
  }
  return "";
}

/** Auto-map headers → fields, each target claimed by its leftmost match. */
function autoMap(cfg: KindConfig, header: string[]): Field[] {
  const used = new Set<Field>();
  return header.map((h) => {
    const f = detect(cfg, h);
    if (f && !used.has(f)) {
      used.add(f);
      return f;
    }
    return "";
  });
}

/** Parse a number cell by stripping non-digits → integer (empty → 0). */
const toInt = (s: string) => {
  const d = s.replace(/[^0-9]/g, "");
  return d ? parseInt(d, 10) : 0;
};

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

/** Read a field's value out of an assembled row. */
function cellVal(r: MasterImportRow, f: Exclude<Field, "">): string | number {
  switch (f) {
    case "code":
      return r.code ?? "";
    case "name":
      return r.name ?? "";
    case "bangunan":
      return r.bangunan ?? 0;
    case "tanah":
      return r.tanah ?? 0;
  }
}

function summaryText(r: MasterImportResult): string {
  const parts = [`✓ ${r.created} dibuat`, `${r.updated} diperbarui`];
  if (r.skipped.length) parts.push(`dilewati: ${r.skipped.length}`);
  return parts.join(" · ");
}

export function MasterImportModal({
  kind,
  title,
  onClose,
  onDone,
}: {
  kind: MasterKind;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const cfg = CONFIGS[kind];
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [upsert, setUpsert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<MasterImportResult | null>(null);

  const { header, data } = useMemo(() => splitMatrix(matrix), [matrix]);

  const fieldOpts = useMemo<{ value: Field; label: string }[]>(
    () => [{ value: "" as Field, label: "(abaikan)" }, ...cfg.fields.map((fd) => ({ value: fd.field as Field, label: fd.label }))],
    [cfg],
  );

  // Load a fresh matrix and re-run auto-detection (any manual mapping resets).
  const applyMatrix = (m: string[][]) => {
    setMatrix(m);
    setMapping(autoMap(cfg, splitMatrix(m).header));
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
  // missing the key field are still sent (backend reports them in "skipped").
  const rows = useMemo<MasterImportRow[]>(() => {
    const get = (r: string[], f: Exclude<Field, "">) => {
      const c = fieldCol[f];
      return c == null ? "" : (r[c] ?? "").trim();
    };
    const out: MasterImportRow[] = [];
    for (const r of data) {
      const vals = cfg.fields.map((fd) => ({ fd, raw: get(r, fd.field) }));
      if (vals.every((v) => v.raw === "")) continue; // fully blank
      const row: MasterImportRow = {};
      for (const { fd, raw } of vals) {
        switch (fd.field) {
          case "code":
            row.code = raw;
            break;
          case "name":
            row.name = raw;
            break;
          case "bangunan":
            row.bangunan = toInt(raw);
            break;
          case "tanah":
            row.tanah = toInt(raw);
            break;
        }
      }
      out.push(row);
    }
    return out;
  }, [data, fieldCol, cfg]);

  const keyVal = (r: MasterImportRow) => String((cfg.keyField === "code" ? r.code : r.name) ?? "");
  const blankKey = rows.filter((r) => !keyVal(r)).length;
  const preview = rows.slice(0, 15);

  // Build + download a sample XLSX for THIS kind so users know the format.
  const downloadTemplate = () => {
    const sample: (string | number)[][] = [cfg.sampleHeader, ...cfg.sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = cfg.sampleHeader.map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind);
    XLSX.writeFile(wb, `contoh-import-${kind}.xlsx`);
  };

  const doImport = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.importMaster(kind, rows, upsert);
      setResult(res);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const placeholder =
    "Tempel dari Excel/Sheets (dengan baris judul).\nContoh:\n" +
    cfg.sampleHeader.join("\t") +
    "\n" +
    cfg.sampleRows[0].join("\t");

  return (
    <Modal title={`Import ${title}`} sub="Tempel dari spreadsheet atau unggah XLSX/CSV" onClose={onClose} width={720}>
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
        <textarea className="kav-imp-ta" placeholder={placeholder} value={paste} onChange={(e) => onPaste(e.target.value)} />
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
                  {fieldOpts.map((o) => (
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
                  {cfg.fields.map((fd) => (
                    <th key={fd.field}>{fd.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    {cfg.fields.map((fd) => {
                      const isKey = fd.field === cfg.keyField;
                      if (fd.kind === "number") {
                        return <td key={fd.field} className="num">{cellVal(r, fd.field)}</td>;
                      }
                      const v = cellVal(r, fd.field);
                      return (
                        <td key={fd.field} className={isKey ? "name" : undefined}>
                          {v || (isKey ? <span className="note">— kosong —</span> : "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr>
                    <td colSpan={cfg.fields.length} className="note">Belum ada baris data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kav-imp-count">
            {rows.length} baris{blankKey > 0 && <> · <b>{blankKey} akan dilewati ({cfg.keyLabel} kosong)</b></>}
            {rows.length > preview.length && <> · menampilkan {preview.length} pertama</>}
          </div>
        </div>
      )}

      {/* Options */}
      <label className="chk">
        <input type="checkbox" checked={upsert} onChange={(e) => setUpsert(e.target.checked)} />
        Perbarui data dengan {cfg.keyLabel} yang sama
      </label>

      {/* Result / error */}
      {result && (
        <div className="kav-imp-summary">
          {summaryText(result)}
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
              {busy ? "Mengimpor…" : `Import ${rows.length} baris`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
