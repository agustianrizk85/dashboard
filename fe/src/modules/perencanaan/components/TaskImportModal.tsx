import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import type { TaskImportResult, TaskImportRow } from "../api/client";
import type { Task } from "../types";
import { Modal } from "./Modal";

/**
 * TaskImportModal — backfill EXISTING tasks' status + schedule dates from a
 * pasted spreadsheet OR an uploaded XLSX/CSV. Flow mirrors KavlingImportModal:
 * parse → auto-detect column mapping (editable) → preview → commit via
 * api.importTasks. The backend matches each row to a task BY NAME (case-
 * insensitive) within this project; it never creates tasks — rows whose name
 * matches nothing are skipped and reported.
 *
 * Optionally a row may also list one or more FILE names (";"/"|"/newline
 * separated). When a File column is mapped AND the user picks the folder those
 * files live in, each matched file is uploaded as a task attachment (ANY type,
 * ≤1 GiB) via api.uploadTaskAttachment after the status/date import. Files show
 * up on the task card (Papan Tugas) and in the Proyek view (📎 chip).
 */

/** The importable targets, plus "" = abaikan (ignore this column). "file" is
 *  never sent to importTasks — it drives the optional attachment upload. */
type Field = "name" | "status" | "start" | "deadline" | "finish" | "file" | "";

const FIELD_OPTS: { value: Field; label: string }[] = [
  { value: "", label: "(abaikan)" },
  { value: "name", label: "Nama Task" },
  { value: "status", label: "Status" },
  { value: "start", label: "Mulai" },
  { value: "deadline", label: "Deadline" },
  { value: "finish", label: "Selesai" },
  { value: "file", label: "File" },
];

/** Normalize a header for keyword matching: lowercase, alphanumerics only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Last path segment of a possibly-qualified name (splits on / and \). */
const basename = (p: string): string => {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
};

/**
 * Guess the target field for a header. `file` is checked FIRST so a column named
 * "File"/"Lampiran"/"Nama File" claims the attachment column (and doesn't get
 * swallowed by the "nama" → name rule). `finish` stays before `status` so a
 * "Selesai" column claims finish rather than status.
 */
function detect(header: string): Field {
  const n = norm(header);
  if (!n) return "";
  if (n.includes("file") || n.includes("lampiran") || n.includes("berkas") || n.includes("dokumen") || n.includes("attachment") || n.includes("namafile")) return "file";
  if (n.includes("namatask") || n.includes("nama") || n.includes("name") || n === "task" || n.includes("deliverable") || n.includes("tugas")) return "name";
  if (n.includes("tanggalmulai") || n.includes("mulai") || n.includes("start")) return "start";
  if (n.includes("deadline") || n.includes("batas") || n.includes("target") || n.includes("duedate")) return "deadline";
  if (n.includes("tanggalselesai") || n.includes("selesai") || n.includes("finish") || n.includes("done")) return "finish";
  if (n.includes("status") || n.includes("progress") || n.includes("keterangan")) return "status";
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

/** Best-effort date passthrough: trim, and if a cell looks like DD/MM/YYYY (or
 *  DD-MM-YYYY / DD.MM.YYYY) rewrite it to YYYY-MM-DD; otherwise leave as typed
 *  (ISO YYYY-MM-DD is untouched since its year is the first group). */
const normDate = (s: string): string => {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return t;
};

/** Split a file cell into tokens: separated by ";" / "|" / newline, trimmed,
 *  blanks dropped. A token may be a bare name or a (sub)path — matching later
 *  reduces to the basename (or matches the full relative path). */
const parseFiles = (raw: string): string[] =>
  raw.split(/[;|\n]/).map((s) => s.trim()).filter(Boolean);

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

/** A lookup over the files the user picked from a folder. */
interface FolderMap {
  byBase: Map<string, File>; // lowercase basename → first file with that name
  byPath: Map<string, File>; // lowercase full webkitRelativePath → file
  dupBase: boolean; // any basename appeared in more than one subfolder?
  count: number;
}

/** Build the folder lookup from a picked FileList (webkitdirectory). */
function buildFolderMap(list: FileList): FolderMap {
  const byBase = new Map<string, File>();
  const byPath = new Map<string, File>();
  let dupBase = false;
  for (const f of Array.from(list)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const base = basename(rel).toLowerCase();
    if (base) {
      if (byBase.has(base)) dupBase = true;
      else byBase.set(base, f); // keep the first on a duplicate basename
    }
    const path = rel.replace(/\\/g, "/").toLowerCase();
    if (path && !byPath.has(path)) byPath.set(path, f);
  }
  return { byBase, byPath, dupBase, count: list.length };
}

/** Resolve one file token against the folder — extension-agnostic, by filename.
 *  A token with a path separator matches the full relative path first (exact,
 *  then a "/name" suffix), else falls back to basename; a bare name matches by
 *  basename. Returns undefined when nothing matches. */
function matchFile(token: string, fm: FolderMap): File | undefined {
  const t = token.trim();
  if (!t) return undefined;
  const base = basename(t).toLowerCase();
  if (/[\\/]/.test(t)) {
    const p = t.replace(/\\/g, "/").toLowerCase();
    const exact = fm.byPath.get(p);
    if (exact) return exact;
    for (const [key, f] of fm.byPath) if (key.endsWith("/" + p)) return f;
  }
  return fm.byBase.get(base);
}

/** Per-row file resolution status for the preview. */
function fileStat(files: string[], fm: FolderMap): { matched: number; total: number; missing: string[] } {
  const missing: string[] = [];
  for (const t of files) if (!matchFile(t, fm)) missing.push(basename(t));
  return { matched: files.length - missing.length, total: files.length, missing };
}

/** One preview/commit row: the importable fields plus the parsed file tokens
 *  (kept separate — files are never sent to importTasks). */
interface PrevRow extends TaskImportRow {
  fileRaw: string;
  files: string[];
}

/** Outcome of the optional attachment-upload phase, shown in the summary. */
interface UploadSummary {
  filesUploaded: number;
  filesMissing: string[]; // token basenames not present in the picked folder
  tasksMissing: string[]; // file rows whose task name matched no task
  uploadErrors: string[]; // "name: reason" for failed uploads
}

function summaryText(r: TaskImportResult): string {
  return `✓ ${r.updated} task diperbarui · dilewati: ${r.skipped.length}`;
}

export function TaskImportModal({
  projectId,
  projectName,
  tasks,
  onClose,
  onDone,
}: {
  projectId: string;
  projectName: string;
  /** The project's tasks — used to resolve a row NAME → task id for uploads. */
  tasks: Task[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [folderMap, setFolderMap] = useState<FolderMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<TaskImportResult | null>(null);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  const { header, data } = useMemo(() => splitMatrix(matrix), [matrix]);

  // task NAME (trimmed, lowercased) → task id, for resolving file rows.
  const taskByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.name.trim().toLowerCase(), t.id);
    return m;
  }, [tasks]);

  const resetOut = () => {
    setResult(null);
    setUploadSummary(null);
    setUploadMsg("");
    setErr("");
  };

  // Load a fresh matrix and re-run auto-detection (any manual mapping resets).
  const applyMatrix = (m: string[][]) => {
    setMatrix(m);
    setMapping(autoMap(splitMatrix(m).header));
    resetOut();
  };

  const onPaste = (text: string) => {
    setPaste(text);
    applyMatrix(text.trim() ? parsePaste(text) : []);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    resetOut();
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

  // Build the folder lookup from a picked directory (any file type, no filter).
  const onFolder = (list: FileList | null) => {
    setFolderMap(list && list.length ? buildFolderMap(list) : null);
    setResult(null);
    setUploadSummary(null);
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
    setUploadSummary(null);
  };

  // field → source column index (last one wins if a target is duplicated).
  const fieldCol = useMemo(() => {
    const rec: Partial<Record<Exclude<Field, "">, number>> = {};
    mapping.forEach((f, i) => { if (f) rec[f] = i; });
    return rec;
  }, [mapping]);

  const fileMapped = fieldCol.file != null;

  // Build the rows: drop rows where every mapped cell is blank; keep name-missing
  // rows so the "N akan dilewati" forecast matches what's sent. File tokens are
  // parsed but kept out of the importTasks payload.
  const rows = useMemo<PrevRow[]>(() => {
    const get = (r: string[], f: Exclude<Field, "">) => {
      const c = fieldCol[f];
      return c == null ? "" : (r[c] ?? "").trim();
    };
    const out: PrevRow[] = [];
    for (const r of data) {
      const name = get(r, "name");
      const status = get(r, "status");
      const start = normDate(get(r, "start"));
      const deadline = normDate(get(r, "deadline"));
      const finish = normDate(get(r, "finish"));
      const fileRaw = get(r, "file");
      const files = parseFiles(fileRaw);
      if (!name && !status && !start && !deadline && !finish && !fileRaw) continue; // fully blank
      out.push({ name, status, start, deadline, finish, fileRaw, files });
    }
    return out;
  }, [data, fieldCol]);

  const blankName = rows.filter((r) => !r.name).length;
  const preview = rows.slice(0, 15);
  const cols = fileMapped ? 6 : 5;

  // Build + download a sample XLSX so users know the expected format.
  const downloadTemplate = () => {
    const sample = [
      ["Nama Task", "Status", "Mulai", "Deadline", "Selesai", "File"],
      ["Siteplan teknis", "Selesai", "2026-06-01", "2026-06-10", "2026-06-09", "siteplan-teknis.pdf"],
      ["Data proyek", "Progress", "2026-06-02", "2026-06-15", "", "data.jsonl; catatan.txt"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 26 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Task");
    XLSX.writeFile(wb, "contoh-import-task.xlsx");
  };

  const doImport = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    setErr("");
    setUploadMsg("");
    setUploadSummary(null);
    try {
      // a. Status + dates import (matched by NAME) — file field is NOT sent.
      const importRows: TaskImportRow[] = rows.map((r) => ({
        name: r.name,
        status: r.status,
        start: r.start,
        deadline: r.deadline,
        finish: r.finish,
      }));
      const res = await api.importTasks(projectId, importRows);

      // b. Optional: upload matched files as task attachments.
      if (fileMapped && folderMap) {
        const jobs: { taskId: string; file: File }[] = [];
        const filesMissing: string[] = [];
        const tasksMissing = new Set<string>();
        for (const r of rows) {
          if (!r.files.length) continue;
          const taskId = taskByName.get(r.name.trim().toLowerCase());
          if (!taskId) {
            if (r.name) tasksMissing.add(r.name);
            continue; // can't attach to a task that doesn't exist
          }
          for (const tok of r.files) {
            const f = matchFile(tok, folderMap);
            if (f) jobs.push({ taskId, file: f });
            else filesMissing.push(basename(tok));
          }
        }
        const total = jobs.length;
        let uploaded = 0;
        const uploadErrors: string[] = [];
        for (let k = 0; k < jobs.length; k++) {
          setUploadMsg(`Mengunggah file… (${k + 1}/${total})`);
          try {
            await api.uploadTaskAttachment(projectId, jobs[k].taskId, jobs[k].file);
            uploaded++;
          } catch (e) {
            uploadErrors.push(`${jobs[k].file.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        setUploadMsg("");
        setUploadSummary({ filesUploaded: uploaded, filesMissing, tasksMissing: Array.from(tasksMissing), uploadErrors });
      }

      setResult(res);
      onDone(); // reload the project (counts / RAG / attachment chips)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setUploadMsg("");
    }
  };

  return (
    <Modal title="Import Task" sub={`${projectName} · isi status & tanggal dari spreadsheet`} onClose={onClose} width={880}>
      {/* Hint: import fills existing tasks only, matched by name. */}
      <p className="form-note-soft">
        Import mencocokkan baris ke task berdasarkan <b>NAMA task</b>. Task harus sudah ada (dari editor Deliverable) — import
        hanya mengisi status &amp; tanggal, tidak membuat task baru.
      </p>
      {/* Hint: the optional File column + folder-based attachment upload. */}
      <p className="form-note-soft">
        <b>Kolom File</b>: isi NAMA file (mis. <code>grammar.jsonl</code>; pisahkan beberapa file dengan <code>;</code>). Pilih
        folder tempat file berada — browser mencocokkan berdasarkan nama file, lalu mengunggahnya sebagai lampiran task. File
        muncul di kartu task (Papan Tugas).
      </p>

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
          placeholder={"Tempel dari Excel/Sheets (dengan baris judul).\nContoh:\nNama Task\tStatus\tMulai\tDeadline\tSelesai\tFile\nSiteplan teknis\tSelesai\t2026-06-01\t2026-06-10\t2026-06-09\tsiteplan-teknis.pdf"}
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

      {/* Folder picker — only relevant when a File column is mapped. Accepts ANY
          file type (no filter): matching is purely by filename. */}
      {fileMapped && (
        <div className="kav-imp-file" style={{ marginTop: 10 }}>
          <span>Pilih folder berisi file: </span>
          <input
            type="file"
            multiple
            ref={(el) => {
              if (el) {
                el.setAttribute("webkitdirectory", "");
                el.setAttribute("directory", "");
              }
            }}
            onChange={(e) => onFolder(e.target.files)}
          />
          {folderMap && (
            <span className="note">
              {" "}{folderMap.count} file dipilih{folderMap.dupBase ? " · beberapa nama file ganda" : ""}
            </span>
          )}
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
                  <th>Nama Task</th>
                  <th>Status</th>
                  <th>Mulai</th>
                  <th>Deadline</th>
                  <th>Selesai</th>
                  {fileMapped && <th>File</th>}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.name || <span className="note">— kosong —</span>}</td>
                    <td>{r.status}</td>
                    <td>{r.start}</td>
                    <td>{r.deadline}</td>
                    <td>{r.finish}</td>
                    {fileMapped && (
                      <td>
                        {r.fileRaw ? (
                          <>
                            <span>{r.fileRaw}</span>
                            {folderMap && r.files.length > 0 && <FileCellStatus files={r.files} fm={folderMap} />}
                          </>
                        ) : (
                          <span className="note">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {preview.length === 0 && (
                  <tr><td colSpan={cols} className="note">Belum ada baris data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kav-imp-count">
            {rows.length} baris{blankName > 0 && <> · <b>{blankName} akan dilewati (nama kosong)</b></>}
            {rows.length > preview.length && <> · menampilkan {preview.length} pertama</>}
          </div>
        </div>
      )}

      {/* Result / error */}
      {result && (
        <div className="kav-imp-summary">
          {summaryText(result)}
          {uploadSummary && <> · {uploadSummary.filesUploaded} file dilampirkan</>}
          {result.skipped.length > 0 && (
            <div className="kav-imp-skips">
              {result.skipped.map((s, i) => (
                <div key={i}>Baris {s.row}{s.key ? ` (${s.key})` : ""}: {s.reason}</div>
              ))}
            </div>
          )}
          {uploadSummary && (uploadSummary.filesMissing.length > 0 || uploadSummary.tasksMissing.length > 0 || uploadSummary.uploadErrors.length > 0) && (
            <div className="kav-imp-skips">
              {uploadSummary.filesMissing.length > 0 && (
                <div>File tidak ditemukan di folder: {uploadSummary.filesMissing.join(", ")}</div>
              )}
              {uploadSummary.tasksMissing.length > 0 && (
                <div>Task tidak ditemukan (file dilewati): {uploadSummary.tasksMissing.join(", ")}</div>
              )}
              {uploadSummary.uploadErrors.length > 0 && (
                <div>Gagal upload: {uploadSummary.uploadErrors.join("; ")}</div>
              )}
            </div>
          )}
        </div>
      )}
      {busy && uploadMsg && <div className="kav-imp-count">{uploadMsg}</div>}
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

/** Small inline "matched/total" file status for a preview row. */
function FileCellStatus({ files, fm }: { files: string[]; fm: FolderMap }) {
  const st = fileStat(files, fm);
  if (st.missing.length === 0) {
    return <span className="fileok"> {st.matched}/{st.total} file ✓</span>;
  }
  return (
    <span className="filemiss"> {st.matched}/{st.total} ({st.missing.join(", ")} tidak ada di folder)</span>
  );
}
