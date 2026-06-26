import { useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";

/**
 * AI Insight card — on demand, asks the backend (OpenRouter) to analyse the
 * current dashboard data, then renders the narrative VISUALLY (headed sections,
 * colour-coded severity bullets & chips) instead of plain text.
 */
export function AiInsight({ scope, label }: { scope: string; label?: string }) {
  const [text, setText] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.insight(scope);
      setText(r.insight);
      setModel(r.model ?? "");
      setConfigured(r.configured);
    } catch (e) {
      setText("Gagal: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-insight">
      <div className="ai-head">
        <span className="ai-title">✨ AI Insight{label ? ` — ${label}` : ""}</span>
        {model && <span className="ai-model">{model}</span>}
        <span className="ai-sp" />
        <button className="md-btn" onClick={() => void run()} disabled={loading}>
          {loading ? "Menganalisa…" : text ? "↻ Ulangi" : "Generate"}
        </button>
      </div>
      {!text && !loading && (
        <div className="ai-hint">Klik “Generate” untuk analisa visual otomatis dari data saat ini.</div>
      )}
      {text && (configured ? <InsightRich text={text} /> : <div className="ai-body warn">{text}</div>)}
    </div>
  );
}

/* ---- Visual renderer --------------------------------------------------- */

function sevColor(w: string): string {
  const s = w.toLowerCase();
  if (s.includes("critical") || s.includes("kritis") || s.includes("merah")) return "var(--bad)";
  if (s.includes("warning") || s.includes("kuning") || s.includes("risiko")) return "var(--warn)";
  if (s.includes("on schedule") || s.includes("cepat") || s.includes("stabil") || s.includes("hijau") || s.includes("on track")) return "var(--ok)";
  return "";
}

/** Inline markdown-lite: **bold**, *emphasis/severity chip*. */
function inline(s: string, keyBase: string): ReactNode[] {
  return s
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((t, i) => {
      const key = `${keyBase}-${i}`;
      if (t.startsWith("**") && t.endsWith("**")) return <strong key={key}>{t.slice(2, -2)}</strong>;
      if (t.startsWith("*") && t.endsWith("*")) {
        const w = t.slice(1, -1);
        const c = sevColor(w);
        return c ? (
          <span key={key} className="ins-chip" style={{ color: c, borderColor: c }}>{w}</span>
        ) : (
          <em key={key}>{w}</em>
        );
      }
      return <span key={key}>{t}</span>;
    });
}

function headIcon(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("ringkas") || s.includes("global") || s.includes("eksekutif")) return "📊";
  if (s.includes("risiko") || s.includes("kritis") || s.includes("kritikal")) return "⚠️";
  if (s.includes("rekomendasi") || s.includes("recovery") || s.includes("aksi") || s.includes("tindak")) return "🛠️";
  if (s.includes("stabil") || s.includes("on schedule")) return "✅";
  if (s.includes("kontraktor") || s.includes("vendor")) return "👷";
  if (s.includes("jadwal") || s.includes("kurva")) return "📈";
  return "▸";
}

function InsightRich({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    // Heading: a whole line wrapped in ** ** (optionally trailing :)
    const h = line.match(/^\*\*(.+?)\*\*:?$/);
    if (h) {
      const title = h[1];
      out.push(
        <div key={i} className="ins-h">
          <span className="ins-h-ic">{headIcon(title)}</span>
          {inline(title, `h${i}`)}
        </div>,
      );
      return;
    }
    // Bullet / numbered item
    const b = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (b) {
      const body = b[2];
      const c = sevColor(body) || "var(--line-strong)";
      out.push(
        <div key={i} className="ins-li" style={{ borderColor: c }}>
          {inline(body, `b${i}`)}
        </div>,
      );
      return;
    }
    out.push(<p key={i} className="ins-p">{inline(line, `p${i}`)}</p>);
  });
  return <div className="ai-body ins-rich">{out}</div>;
}
