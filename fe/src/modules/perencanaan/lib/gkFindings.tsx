/* Deep Revisi / Deep Analisis findings de-duplication + renderer.
 *
 * The vision AI checks each page independently, so an issue that repeats across
 * sheets (e.g. a title-block value on every page, or a total dimension on many
 * denah) gets flagged once per page. We cluster near-duplicate findings by token
 * similarity of their `wrong` text and show ONE entry listing all pages.
 *
 * Shared by the Gambar Kerja Deep Revisi modal (WorkDrawingsView) and the task
 * review Deep Analisis modal so both dedupe identically. */
import type { GKFinding } from "../types";

export interface GkGroup {
  wrong: string;
  correct: string;
  explain: string;
  confidence?: string;
  pages: number[];
}

const GK_STOP = new Set([
  "yang", "tidak", "pada", "dan", "atau", "dengan", "harus", "seharusnya", "untuk", "dari",
  "tiap", "antara", "adalah", "salah", "tertulis", "misal", "serta", "juga", "namun", "agar",
  "sisi", "total", "gambar", "denah", "lebih", "area",
]);

// Tokens are built from the WRONG (problem) text only — the SEHARUSNYA text
// varies a lot per page and dilutes the similarity, splitting real duplicates.
function gkTokens(f: GKFinding): Set<string> {
  const text = f.wrong.toLowerCase().replace(/m²/g, "m2").replace(/[^a-z0-9.\s]/g, " ");
  return new Set(text.split(/\s+/).filter((t) => t && (/\d/.test(t) || (t.length >= 4 && !GK_STOP.has(t)))));
}

function gkJaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

export function dedupeFindings(findings: GKFinding[]): GkGroup[] {
  const real: { rep: GKFinding; toks: Set<string>; pages: Set<number> }[] = [];
  const failPages = new Set<number>();
  for (const f of findings) {
    if (!f.wrong || !f.wrong.trim()) {
      failPages.add(f.page);
      continue;
    }
    const toks = gkTokens(f);
    const g = real.find((x) => gkJaccard(x.toks, toks) >= 0.3);
    if (g) g.pages.add(f.page);
    else real.push({ rep: f, toks, pages: new Set([f.page]) });
  }
  const out: GkGroup[] = real
    .sort((a, b) => b.pages.size - a.pages.size)
    .map((g) => ({
      wrong: g.rep.wrong,
      correct: g.rep.correct,
      explain: g.rep.explain,
      confidence: g.rep.confidence,
      pages: [...g.pages].sort((a, b) => a - b),
    }));
  if (failPages.size) {
    out.push({
      wrong: "",
      correct: "",
      explain: "Gagal dianalisis AI (timeout/error) — jalankan ulang bila perlu.",
      pages: [...failPages].sort((a, b) => a - b),
    });
  }
  return out;
}

/** Renders the de-duplicated findings list (header + grouped items). */
export function GkFindingsList({
  findings,
  emptyText = "Tidak ada ketidaksesuaian ditemukan — sudah sesuai.",
}: {
  findings: GKFinding[];
  emptyText?: string;
}) {
  const groups = dedupeFindings(findings);
  if (groups.length === 0) return <>{emptyText}</>;
  const merged = findings.length - groups.length;
  return (
    <>
      <div className="gk-findings-head">
        {groups.length} temuan unik dari {findings.length} deteksi
        {merged > 0 ? ` · ${merged} duplikat digabung` : ""}
      </div>
      <ul className="gk-findings">
        {groups.map((g, i) => (
          <li key={i}>
            <b>Hal. {g.pages.join(", ")}</b>
            {g.pages.length > 1 && <span className="gk-dup">×{g.pages.length}</span>}
            {g.wrong ? (
              <>
                {" "}
                — SALAH: <code>{g.wrong}</code> → SEHARUSNYA: <code>{g.correct}</code>
              </>
            ) : (
              <> — ⚠ Gagal dianalisis</>
            )}
            <div className="gk-explain">
              {g.explain} {g.confidence && `(${g.confidence})`}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
