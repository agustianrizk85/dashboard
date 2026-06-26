import { useState } from "react";
import { csvToRecords, download } from "../lib/csv";
import { downloadXlsx, parseXlsx } from "../lib/xlsx";

type Rec = Record<string, unknown>;

const cellText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));

/* ----------------------------------------------------------------------- *
 * Tabular import — for list resources and flat singletons. Offers a CSV    *
 * template download (opens in Excel) plus import from CSV or JSON.         *
 * ----------------------------------------------------------------------- */

export function ImportButton({
  entity,
  columns,
  sample,
  onImport,
}: {
  /** Filename base, e.g. "projects". */
  entity: string;
  /** Ordered column keys for the CSV template. */
  columns: string[];
  /** Example rows used for the downloadable template. */
  sample: Rec[];
  /** Performs the API calls; returns how many rows were imported. */
  onImport: (rows: Rec[]) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);

  const downloadTemplate = () => {
    const rows = sample.map((r) => columns.map((c) => cellText(r[c])));
    // Real .xlsx so each header lands in its own column (not a comma CSV).
    downloadXlsx(`${entity}-contoh`, columns, rows);
  };

  return (
    <>
      <button className="md-btn" onClick={downloadTemplate} title="Unduh contoh Excel (.xlsx, per kolom)">
        ⬇ Contoh (Excel)
      </button>
      <button className="md-btn" onClick={() => setOpen(true)} title="Impor dari CSV / Excel / JSON">
        ⭱ Import
      </button>
      {open && <ImportDialog columns={columns} onImport={onImport} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportDialog({
  columns,
  onImport,
  onClose,
}: {
  columns: string[];
  onImport: (rows: Rec[]) => Promise<number>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setRows(null);
    setInfo("");
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Hanya file Excel (.xlsx). Unduh dulu lewat tombol Contoh (Excel).");
      return;
    }
    try {
      const recs = csvToRecords(await parseXlsx(await file.arrayBuffer()));
      setRows(recs);
      setInfo(`✓ ${recs.length} baris terbaca dari Excel.`);
    } catch (err) {
      setError("Gagal membaca Excel: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const submit = async () => {
    setError("");
    if (!rows || rows.length === 0) {
      setError("Pilih file Excel (.xlsx) dulu.");
      return;
    }
    setBusy(true);
    try {
      setDone(await onImport(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <form
        className="mdf-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (done === null) submit();
          else onClose();
        }}
      >
        <header className="mdf-head">
          <h3>Import Data</h3>
          <button type="button" className="mdf-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="mdf-body">
          {done !== null ? (
            <div className="md-count" style={{ color: "var(--green-600)" }}>
              ✓ Berhasil impor {done} baris.
            </div>
          ) : (
            <>
              <div className="md-count">
                Kolom: <b>{columns.join(", ")}</b>
              </div>
              <label className="mdf-field wide">
                <span>Berkas Excel (.xlsx)</span>
                <input type="file" accept=".xlsx" onChange={onFile} />
              </label>
              {info && (
                <div className="md-count" style={{ color: "var(--green-600)" }}>
                  {info}
                </div>
              )}
              <div className="md-count" style={{ fontSize: 11 }}>
                Unduh <b>⬇ Contoh (Excel)</b>, isi di Excel, lalu unggah file <b>.xlsx</b> di sini.
              </div>
            </>
          )}
        </div>

        {error && <div className="mdf-error">{error}</div>}

        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>
            {done !== null ? "Tutup" : "Batal"}
          </button>
          {done === null && (
            <button type="submit" className="md-btn primary" disabled={busy || !rows}>
              {busy ? "Mengimpor…" : "Import"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------------- *
 * JSON import — for nested singletons (quality) that don't fit one table.  *
 * ----------------------------------------------------------------------- */

export function ImportJsonButton({
  entity,
  sample,
  onImport,
}: {
  entity: string;
  sample: unknown;
  onImport: (data: unknown) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);

  const downloadTemplate = () =>
    download(`${entity}-contoh.json`, JSON.stringify(sample, null, 2), "application/json;charset=utf-8");

  return (
    <>
      <button className="md-btn" onClick={downloadTemplate} title="Unduh contoh format JSON">
        ⬇ Contoh (JSON)
      </button>
      <button className="md-btn" onClick={() => setOpen(true)} title="Impor dari JSON">
        ⭱ Import
      </button>
      {open && <ImportJsonDialog sample={sample} onImport={onImport} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportJsonDialog({
  sample,
  onImport,
  onClose,
}: {
  sample: unknown;
  onImport: (data: unknown) => Promise<number>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    setError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError("JSON tidak valid: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    setBusy(true);
    try {
      setDone(await onImport(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mdf-overlay" onClick={onClose}>
      <form
        className="mdf-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (done === null) submit();
          else onClose();
        }}
      >
        <header className="mdf-head">
          <h3>Import Data</h3>
          <button type="button" className="mdf-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="mdf-body">
          {done !== null ? (
            <div className="md-count" style={{ color: "var(--green-600)" }}>
              ✓ Data berhasil diimpor.
            </div>
          ) : (
            <>
              <label className="mdf-field wide">
                <span>Berkas JSON</span>
                <input type="file" accept=".json,application/json" onChange={onFile} />
              </label>
              <label className="mdf-field wide">
                <span>atau tempel JSON di sini</span>
                <textarea
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </label>
              <button type="button" className="md-btn" onClick={() => setText(JSON.stringify(sample, null, 2))}>
                Isi contoh format
              </button>
            </>
          )}
        </div>

        {error && <div className="mdf-error">{error}</div>}

        <footer className="mdf-foot">
          <button type="button" className="md-btn" onClick={onClose}>
            {done !== null ? "Tutup" : "Batal"}
          </button>
          {done === null && (
            <button type="submit" className="md-btn primary" disabled={busy || text.trim() === ""}>
              {busy ? "Mengimpor…" : "Import"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
