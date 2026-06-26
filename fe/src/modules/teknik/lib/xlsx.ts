// Minimal, dependency-free .xlsx (Office Open XML) writer. Produces a real
// Excel workbook (single sheet, typed cells) as a ZIP — not CSV — so Excel
// opens it natively without a format-mismatch warning.

export type Cell = string | number | boolean | null | undefined;

/* ---- XML helpers ------------------------------------------------------- */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Column index (0-based) → spreadsheet column letters (A, B, …, AA). */
function colLetter(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(ref: string, value: Cell, style?: number): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") return `<c r="${ref}"${s}/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  const text = typeof value === "boolean" ? (value ? "Ya" : "Tidak") : String(value);
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

function sheetXml(columns: string[], rows: Cell[][]): string {
  const lines: string[] = [];
  // Header row uses style 1 (bold).
  lines.push(`<row r="1">${columns.map((c, i) => cellXml(colLetter(i) + "1", c, 1)).join("")}</row>`);
  rows.forEach((row, ri) => {
    const r = ri + 2;
    lines.push(`<row r="${r}">${columns.map((_, ci) => cellXml(colLetter(ci) + r, row[ci])).join("")}</row>`);
  });
  const lastCol = colLetter(Math.max(0, columns.length - 1));
  const lastRow = rows.length + 1;
  const range = `A1:${lastCol}${lastRow}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${range}"/>` +
    // Freeze the header row so it stays visible while scrolling.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    `<sheetData>${lines.join("")}</sheetData>` +
    // AutoFilter dropdowns on the header (Excel-style table header).
    `<autoFilter ref="${range}"/>` +
    `</worksheet>`
  );
}

/* ---- ZIP (store / no compression) ------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Build a ZIP archive (store method) from the given files. */
function zip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const DOS_TIME = 0;
  const DOS_DATE = (2024 - 1980) << 9 | (1 << 5) | 1; // 2024-01-01

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, e.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  for (const c of central) {
    out.set(c, p);
    p += c.length;
  }
  out.set(end, p);
  return out;
}

/* ---- Public API -------------------------------------------------------- */

const enc = new TextEncoder();
const file = (name: string, xml: string): ZipEntry => ({ name, data: enc.encode(xml) });

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WB_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

// Minimal stylesheet: style index 1 = bold (used for the header row).
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

function workbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

/** Build a complete .xlsx workbook as bytes. */
export function buildXlsx(columns: string[], rows: Cell[][], sheetName = "Data"): Uint8Array {
  return zip([
    file("[Content_Types].xml", CONTENT_TYPES),
    file("_rels/.rels", ROOT_RELS),
    file("xl/workbook.xml", workbookXml(sheetName)),
    file("xl/_rels/workbook.xml.rels", WB_RELS),
    file("xl/styles.xml", STYLES),
    file("xl/worksheets/sheet1.xml", sheetXml(columns, rows)),
  ]);
}

/** Build and trigger a browser download of an .xlsx file. */
export function downloadXlsx(filename: string, columns: string[], rows: Cell[][], sheetName = "Data"): void {
  const bytes = buildXlsx(columns, rows, sheetName);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ======================================================================= *
 * .xlsx READER — parse a real Excel file (store or DEFLATE) into a matrix. *
 * Uses the browser/Node DecompressionStream for DEFLATE; no dependency.    *
 * ======================================================================= */

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&");
}

function colToIndex(ref: string): number {
  const m = ref.match(/^([A-Z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function inflateRaw(comp: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([comp.buffer.slice(comp.byteOffset, comp.byteOffset + comp.byteLength) as ArrayBuffer])
    .stream()
    .pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read a ZIP archive (store + deflate) into name → bytes. */
async function unzip(buf: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("File bukan .xlsx/zip yang valid.");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const fnLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + fnLen));
    const lfnLen = dv.getUint16(localOff + 26, true);
    const lextraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lfnLen + lextraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 0 ? comp : await inflateRaw(comp));
    off += 46 + fnLen + extraLen + commentLen;
  }
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const body = m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, "");
    const texts = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unescapeXml(x[1]));
    out.push(texts.join(""));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1];
      const inner = cm[2] ?? "";
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1] || "";
      const col = ref ? colToIndex(ref) : cells.length;
      const t = (attrs.match(/t="([^"]+)"/) || [])[1] || "n";
      let val = "";
      if (t === "s") {
        const idx = Number((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]);
        val = shared[idx] ?? "";
      } else if (t === "inlineStr") {
        val = unescapeXml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "");
      } else {
        val = unescapeXml((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "");
      }
      cells[col] = val;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows;
}

/** Parse a real .xlsx file (first worksheet) into a matrix of cell strings. */
export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(new Uint8Array(buf));
  const dec = new TextDecoder();
  const sharedRaw = files.get("xl/sharedStrings.xml");
  const shared = sharedRaw ? parseSharedStrings(dec.decode(sharedRaw)) : [];
  let sheetKey = "xl/worksheets/sheet1.xml";
  if (!files.has(sheetKey)) {
    for (const k of files.keys()) {
      if (/^xl\/worksheets\/.*\.xml$/.test(k)) {
        sheetKey = k;
        break;
      }
    }
  }
  const sheetRaw = files.get(sheetKey);
  if (!sheetRaw) throw new Error("Worksheet tidak ditemukan dalam file Excel.");
  const matrix = parseSheet(dec.decode(sheetRaw), shared);
  return matrix.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
}
