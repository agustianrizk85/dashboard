import { useCallback, useEffect, useMemo, useState } from "react";
import { listKlausul, extractPlaceholders, fillPlaceholders, type Klausul } from "./klausulApi";
import { listKontraktor, type Kontraktor } from "../kontraktor/kontraktorApi";
import "./klausul.css";

/* Pemetaan field kontraktor → nama placeholder yang lazim di dokumen SPK.
 * Saat kontraktor dipilih, tiap field mengisi placeholder yang cocok (jika ada
 * di dokumen). Cocok tanpa peduli huruf besar/kecil. */
const KONTRAKTOR_MAP: { field: keyof Kontraktor; keys: string[] }[] = [
  { field: "nama", keys: ["NAMA PEMBORONG", "NAMA KONTRAKTOR", "NAMA PIHAK KEDUA"] },
  { field: "alamat", keys: ["ALAMAT PEMBORONG", "ALAMAT KONTRAKTOR", "ALAMAT PIHAK KEDUA"] },
  { field: "atasNama", keys: ["NAMA REKENING", "ATAS NAMA", "PEMEGANG REKENING"] },
  { field: "bank", keys: ["BANK"] },
  { field: "noRek", keys: ["NO REKENING", "NOMOR REKENING", "NO. REKENING"] },
  { field: "telp", keys: ["TELP", "TELEPON", "NO HP", "NO TELEPON"] },
  { field: "npwp", keys: ["NPWP"] },
  { field: "email", keys: ["EMAIL"] },
];

/* Sumber auto-isi generik (mis. Unit/Proyek dari modul divisi). Tiap opsi
 * membawa map {NAMA PLACEHOLDER → nilai}; saat dipilih, placeholder yang cocok
 * (case-insensitive) di dokumen otomatis terisi. */
export interface DocFillSource {
  label: string;
  placeholder?: string;
  options: { id: string; label: string; values: Record<string, string> }[];
}

/* Buat Dokumen — susun sebuah dokumen (mis. SPK) dari Master Klausul divisi:
 * pilih jenis dokumen → centang klausul yang dipakai → isi placeholder → pratinjau
 * → Cetak / simpan PDF (lewat dialog cetak browser). */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---- Rapikan isi klausul jadi baris terstruktur (hanging indent, label:nilai,
 *      dua kolom untuk tanda tangan) — dipakai pratinjau & cetak. ---- */
type DocLine =
  | { t: "blank" }
  | { t: "item"; ind: number; mk: string; tx: string } // a. / 1) / I. / -
  | { t: "kv"; ind: number; k: string; v: string } // Nama : Faiz
  | { t: "cols"; l: string; r: string } // PIHAK PERTAMA        PIHAK KEDUA
  | { t: "text"; ind: number; tx: string };

const RE_ITEM = /^([A-Za-z][.)]|[IVXLC]{2,4}\.|\d{1,2}[.)]|[-•])\s+(.+)$/;
const RE_KV = /^([A-Za-z][A-Za-z ./]{0,24}?)\s*:\s+(.+)$/;
const RE_COLS = /^(.+?)\s{3,}(.+)$/;

function parseDoc(body: string): DocLine[] {
  return body.split("\n").map<DocLine>((raw) => {
    if (raw.trim() === "") return { t: "blank" };
    const lead = raw.match(/^ */)?.[0].length ?? 0;
    const ind = Math.min(4, Math.floor(lead / 3));
    const s = raw.trim();
    let m: RegExpMatchArray | null;
    if ((m = s.match(RE_ITEM))) return { t: "item", ind, mk: m[1], tx: m[2] };
    if ((m = s.match(RE_KV))) return { t: "kv", ind, k: m[1], v: m[2] };
    if ((m = s.match(RE_COLS))) return { t: "cols", l: m[1], r: m[2] };
    return { t: "text", ind, tx: s };
  });
}

/** Isi klausul → HTML rapi (untuk jendela cetak). */
function linesHtml(body: string): string {
  return parseDoc(body)
    .map((l) => {
      const pl = l.t !== "blank" && l.t !== "cols" ? ` style="padding-left:${l.ind * 22}px"` : "";
      switch (l.t) {
        case "blank":
          return `<div class="dl-blank"></div>`;
        case "item":
          return `<div class="dl-item"${pl}><span class="dl-mk">${esc(l.mk)}</span><span class="dl-tx">${esc(l.tx)}</span></div>`;
        case "kv":
          return `<div class="dl-kv"${pl}><span class="dl-k">${esc(l.k)}</span><span>:</span><span class="dl-v">${esc(l.v)}</span></div>`;
        case "cols":
          return `<div class="dl-cols"><span>${esc(l.l)}</span><span>${esc(l.r)}</span></div>`;
        default:
          return `<p class="dl-p"${pl}>${esc(l.tx)}</p>`;
      }
    })
    .join("");
}

/** Isi klausul → JSX rapi (untuk pratinjau di layar). */
function DocLines({ body }: { body: string }) {
  return (
    <>
      {parseDoc(body).map((l, i) => {
        const pl = l.t !== "blank" && l.t !== "cols" ? { paddingLeft: l.ind * 22 } : undefined;
        switch (l.t) {
          case "blank":
            return <div key={i} className="dl-blank" />;
          case "item":
            return (
              <div key={i} className="dl-item" style={pl}>
                <span className="dl-mk">{l.mk}</span>
                <span className="dl-tx">{l.tx}</span>
              </div>
            );
          case "kv":
            return (
              <div key={i} className="dl-kv" style={pl}>
                <span className="dl-k">{l.k}</span>
                <span>:</span>
                <span className="dl-v">{l.v}</span>
              </div>
            );
          case "cols":
            return (
              <div key={i} className="dl-cols">
                <span>{l.l}</span>
                <span>{l.r}</span>
              </div>
            );
          default:
            return (
              <p key={i} className="dl-p" style={pl}>
                {l.tx}
              </p>
            );
        }
      })}
    </>
  );
}

// Judul & nomor default per jenis dokumen yang dikenal (sisanya pakai kode dok).
const TITLE_DEFAULTS: Record<string, string> = { SPK: "SURAT PERINTAH KERJA" };
const NO_DEFAULTS: Record<string, string> = {
  SPK: "Nomor : 000/SPK-TNK/{NAMA PROYEK}/{BULAN}/{TAHUN}",
};

export function DocBuilder({
  division,
  fillSources = [],
}: {
  division: string;
  fillSources?: DocFillSource[];
}) {
  const [all, setAll] = useState<Klausul[]>([]);
  const [docType, setDocType] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [srcSel, setSrcSel] = useState<Record<number, string>>({});
  const [docTitle, setDocTitle] = useState("");
  const [docNo, setDocNo] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [kontraktors, setKontraktors] = useState<Kontraktor[]>([]);
  const [selKontraktor, setSelKontraktor] = useState("");

  const reload = useCallback(async () => {
    setErr("");
    try {
      const rows = await listKlausul(division);
      setAll(rows);
      setLoaded(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setLoaded(true);
    }
  }, [division]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Master Kontraktor (untuk auto-isi placeholder pihak kedua & rekening).
  useEffect(() => {
    listKontraktor()
      .then(setKontraktors)
      .catch(() => setKontraktors([]));
  }, []);

  const docTypes = useMemo(() => {
    const s = new Set<string>();
    all.forEach((k) => s.add(k.docType));
    return [...s].sort();
  }, [all]);

  // Default to the first doc type once loaded.
  useEffect(() => {
    if (!docType && docTypes.length > 0) setDocType(docTypes[0]);
  }, [docTypes, docType]);

  // Clauses of the active doc type, ordered (already sorted by the API).
  const clauses = useMemo(() => all.filter((k) => k.docType === docType), [all, docType]);

  // When the doc type changes, select every clause of it by default + set a
  // sensible title/nomor default for known types.
  useEffect(() => {
    setSel(new Set(clauses.map((k) => k.id)));
    setDocTitle(docType ? TITLE_DEFAULTS[docType] ?? docType : "");
    setDocNo(docType ? NO_DEFAULTS[docType] ?? "" : "");
  }, [docType]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedClauses = useMemo(() => clauses.filter((k) => sel.has(k.id)), [clauses, sel]);

  // Placeholders across doc title/nomor + selected clause titles & bodies.
  const placeholders = useMemo(
    () => extractPlaceholders([docTitle, docNo, ...selectedClauses.flatMap((k) => [k.title, k.body])]),
    [selectedClauses, docTitle, docNo],
  );

  // Isi placeholder yang cocok (case-insensitive) dari sebuah map nilai.
  const applyValues = (vals: Record<string, string>) =>
    setValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(vals)) {
        if (!v) continue;
        const match = placeholders.find((p) => p.toUpperCase() === k.toUpperCase());
        if (match) next[match] = v;
      }
      return next;
    });

  // Pilih kontraktor → isi placeholder pihak kedua & rekening dari data master.
  const applyKontraktor = (id: string) => {
    setSelKontraktor(id);
    const k = kontraktors.find((x) => x.id === id);
    if (!k) return;
    const vals: Record<string, string> = {};
    for (const { field, keys } of KONTRAKTOR_MAP) {
      const val = String(k[field] ?? "").trim();
      if (!val) continue;
      for (const key of keys) vals[key] = val;
    }
    applyValues(vals);
  };

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSel = clauses.length > 0 && selectedClauses.length === clauses.length;
  const toggleAll = () => setSel(allSel ? new Set() : new Set(clauses.map((k) => k.id)));

  const composed = useMemo(
    () =>
      selectedClauses.map((k) => ({
        id: k.id,
        code: k.code,
        title: fillPlaceholders(k.title, values),
        body: fillPlaceholders(k.body, values),
      })),
    [selectedClauses, values],
  );

  const print = () => {
    const title = fillPlaceholders(docTitle, values) || docType;
    const no = fillPlaceholders(docNo, values);
    const secs = composed
      .map(
        (k) =>
          `<section><h2>${k.code ? esc(k.code) + ". " : ""}${esc(k.title)}</h2>${linesHtml(k.body)}</section>`,
      )
      .join("");
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4; margin: 22mm 20mm; }
      * { box-sizing: border-box; }
      body { font-family: "Times New Roman", Georgia, serif; color: #111; font-size: 12pt; line-height: 1.5; }
      h1 { text-align: center; font-size: 15pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .5px; }
      .docno { text-align: center; margin: 0 0 20px; font-size: 11pt; }
      section { margin: 0 0 14px; page-break-inside: avoid; }
      h2 { font-size: 12pt; margin: 0 0 5px; text-transform: uppercase; }
      .dl-item { display: flex; gap: 8px; margin: 0 0 2px; }
      .dl-mk { flex: none; min-width: 20px; }
      .dl-tx { flex: 1; text-align: justify; }
      .dl-kv { display: flex; gap: 6px; margin: 0 0 1px; }
      .dl-kv .dl-k { flex: none; min-width: 96px; }
      .dl-kv .dl-v { flex: 1; }
      .dl-cols { display: flex; gap: 24px; margin: 3px 0; }
      .dl-cols > span { flex: 1; }
      .dl-p { margin: 0 0 2px; text-align: justify; }
      .dl-blank { height: 8px; }
      @media print { button { display: none; } }
    </style></head><body onload="window.print()">
      ${docTitle ? `<h1>${esc(title)}</h1>` : ""}${no ? `<div class="docno">${esc(no)}</div>` : ""}${secs}
    </body></html>`;
    const w = window.open("", "_blank", "width=920,height=1000");
    if (!w) {
      alert("Popup diblokir. Izinkan popup untuk mencetak / menyimpan PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!loaded) return <div className="klx-loading">Memuat klausul…</div>;

  return (
    <div className="klx">
      <div className="klx-head">
        <div>
          <h2>🧾 Buat Dokumen</h2>
          <p className="klx-sub">
            Susun dokumen dari Master Klausul divisi <b>{division}</b>. Pilih jenis, centang klausul,
            isi bagian bertanda <code>{"{…}"}</code>, lalu Cetak / simpan PDF.
          </p>
        </div>
      </div>

      {err && <div className="klx-alert err">⚠ {err}</div>}
      {docTypes.length === 0 ? (
        <div className="klx-alert">
          Belum ada klausul. Tambahkan dulu di menu <b>Master Klausul</b>.
        </div>
      ) : (
        <div className="klx-build">
          {/* ---- Kontrol (kiri) ---- */}
          <div className="klx-card klx-controls">
            <label className="klx-field">
              <span>Jenis Dokumen</span>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {docTypes.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="klx-field">
              <span>Judul Dokumen</span>
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Judul di atas dokumen" />
            </label>
            <label className="klx-field">
              <span>Nomor Dokumen</span>
              <input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="mis. Nomor : 000/SPK-TNK/…" />
            </label>

            <div className="klx-card-h wrap" style={{ marginTop: 6 }}>
              <h3>Klausul ({selectedClauses.length}/{clauses.length})</h3>
              <button className="klx-btn ghost sm" onClick={toggleAll}>
                {allSel ? "Kosongkan" : "Pilih semua"}
              </button>
            </div>
            <div className="klx-clauselist">
              {clauses.map((k) => (
                <label key={k.id} className={`klx-clause ${sel.has(k.id) ? "on" : ""}`}>
                  <input type="checkbox" checked={sel.has(k.id)} onChange={() => toggle(k.id)} />
                  <span className="klx-clause-code">{k.code || "•"}</span>
                  <span className="klx-clause-title">{k.title}</span>
                </label>
              ))}
            </div>

            {placeholders.length > 0 && (
              <>
                <div className="klx-card-h" style={{ marginTop: 10 }}>
                  <h3>Isi Data ({placeholders.length})</h3>
                </div>
                {fillSources.map(
                  (src, i) =>
                    src.options.length > 0 && (
                      <label key={i} className="klx-field klx-kt-pick">
                        <span>{src.label}</span>
                        <select
                          value={srcSel[i] ?? ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSrcSel((s) => ({ ...s, [i]: id }));
                            const opt = src.options.find((o) => o.id === id);
                            if (opt) applyValues(opt.values);
                          }}
                        >
                          <option value="">{src.placeholder ?? "— pilih —"}</option>
                          {src.options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ),
                )}
                {kontraktors.length > 0 && (
                  <label className="klx-field klx-kt-pick">
                    <span>👷 Isi dari Master Kontraktor</span>
                    <select value={selKontraktor} onChange={(e) => applyKontraktor(e.target.value)}>
                      <option value="">— pilih kontraktor (auto-isi) —</option>
                      {kontraktors.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama}
                          {k.bank ? ` · ${k.bank} ${k.noRek}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="klx-fill">
                  {placeholders.map((p) => (
                    <label key={p} className="klx-field">
                      <span>{p}</span>
                      <input
                        value={values[p] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                        placeholder={p}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}

            <button className="klx-btn wide" style={{ marginTop: 12 }} disabled={selectedClauses.length === 0} onClick={print}>
              🖨 Cetak / Simpan PDF
            </button>
          </div>

          {/* ---- Pratinjau (kanan) ---- */}
          <div className="klx-preview-wrap">
            <div className="klx-doc">
              {docTitle && <h1>{fillPlaceholders(docTitle, values)}</h1>}
              {docNo && <div className="klx-doc-no">{fillPlaceholders(docNo, values)}</div>}
              {composed.length === 0 ? (
                <p className="klx-doc-empty">Centang minimal satu klausul.</p>
              ) : (
                composed.map((k) => (
                  <section key={k.id}>
                    <h2>
                      {k.code ? k.code + ". " : ""}
                      {k.title}
                    </h2>
                    <div className="klx-doc-body">
                      <DocLines body={k.body} />
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
