// Tiny dependency-free CSV helpers.
//
// Excel splits columns using the OS "list separator", which in many locales
// (Indonesia, most of Europe) is ";" not ",". A plain comma CSV therefore lands
// in a single column. Two fixes:
//   • Download: prepend a `sep=,` directive + UTF-8 BOM. Excel reads `sep=,` and
//     splits on commas regardless of locale; the BOM keeps accents intact.
//   • Import: auto-detect the delimiter (`sep=` line, or sniff , ; tab) so files
//     re-saved by Excel with semicolons still import correctly.

const BOM = "﻿";

const esc = (v: string | number, delim: string) => {
  const s = String(v ?? "");
  return s.includes(delim) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV body only (no BOM, no sep directive) — for showing in a paste box. */
export function csvBody(headers: string[], rows: (string | number)[][], delim = ","): string {
  const lines = [headers.map((h) => esc(h, delim)).join(delim), ...rows.map((r) => r.map((c) => esc(c, delim)).join(delim))];
  return lines.join("\r\n");
}

/** Full Excel-friendly CSV: BOM + `sep=,` directive + body. Use for downloads. */
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  return BOM + "sep=,\r\n" + csvBody(headers, rows, ",");
}

/** Detect the delimiter from the first non-directive line (, ; or tab). */
function sniffDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parse a CSV string into a matrix of cell strings (handles quotes/newlines). */
export function parseCSV(text: string): string[][] {
  let src = text.replace(/^﻿/, "");

  // Honour an explicit `sep=X` directive (Excel writes/reads this), else sniff.
  let delim = ",";
  const sepMatch = src.match(/^sep=(.)\r?\n/i);
  if (sepMatch) {
    delim = sepMatch[1];
    src = src.slice(sepMatch[0].length);
  } else {
    const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
    delim = sniffDelimiter(firstLine);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  // Flush the trailing cell/row unless the file ended on a clean newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Map a parsed CSV matrix (first row = headers) to objects keyed by header. */
export function csvToRecords(matrix: string[][]): Record<string, string>[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cells[i] ?? ""));
    return rec;
  });
}

/** Trigger a browser download of text content. */
export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
