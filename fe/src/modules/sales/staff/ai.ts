// Konsumen Screening AI scoring — routed through the CENTRAL AI gateway on the
// auth service (`POST /api/ai/chat` → Ollama), the SAME key every division uses
// ("Generate AI", Deep Analisis, Asisten, …). No per-service key: the sales
// backend holds none. When the gateway is off/fails this returns null and the
// backend falls back to its deterministic rule-based scorer.
import type { ScreeningAnswer, ScreeningResult, Verdict } from "./types";

const AUTH_API = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function authHeaders(): HeadersInit {
  const t = localStorage.getItem("gp_dashboard_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) };
}

export interface AiAssessInput {
  consumer: string;
  project?: string;
  unit?: string;
  price?: number;
  answers: ScreeningAnswer[];
}

const INSTRUCTION = `Kamu adalah analis kredit & sales senior Greenpark Group. Nilai KELAYAKAN calon
konsumen membeli rumah (umumnya via KPR) HANYA dari data screening pada DATA HALAMAN.

Pertimbangkan prinsip KPR di Indonesia:
- Rasio cicilan/penghasilan (DSR) idealnya <= 35%. Perkirakan angsuran KPR bulanan dari
  hargaRumah, DP, dan (bila tak disebut) asumsi tenor 15 tahun bunga ~10%/tahun, lalu
  bandingkan dengan (penghasilan bersih - cicilan lain).
- Riwayat kredit (SLIK/BI Checking) bersih = SYARAT WAJIB; bila bermasalah -> tidak_layak.
- Kesiapan DP, kelengkapan dokumen, kestabilan & lama bekerja/usaha.

Balas HANYA satu objek JSON valid (tanpa teks lain, tanpa markdown/code fence):
{
  "verdict": "layak" | "bersyarat" | "tidak_layak",
  "score": bilangan bulat 0-100,
  "summary": "1-2 kalimat kesimpulan (sebut perkiraan DSR bila bisa dihitung)",
  "strengths": ["faktor pendukung", ...] (maks 4),
  "risks": ["faktor risiko / yang perlu dilengkapi", ...] (maks 4),
  "recommendations": ["langkah tindak lanjut untuk sales", ...] (maks 4)
}
Bahasa Indonesia, format uang Rupiah, JANGAN mengarang data di luar yang diberikan.`;

const VALID: Verdict[] = ["layak", "bersyarat", "tidak_layak", "review"];

function normalizeVerdict(v: unknown): Verdict | null {
  const s = String(v ?? "").toLowerCase().replace(/\s+/g, "_");
  if (s.includes("tidak")) return "tidak_layak";
  if (s.includes("syarat") || s.includes("kondisi")) return "bersyarat";
  if (s.includes("layak")) return "layak";
  if (s.includes("review") || s.includes("tinjau")) return "review";
  return VALID.includes(s as Verdict) ? (s as Verdict) : null;
}

function toList(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
}

/** Parse the model reply (tolerating prose/fences) into a ScreeningResult. */
function parseResult(reply: string): ScreeningResult | null {
  const i = reply.indexOf("{");
  const j = reply.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    const o = JSON.parse(reply.slice(i, j + 1)) as Record<string, unknown>;
    const verdict = normalizeVerdict(o.verdict);
    if (!verdict) return null;
    let score = Math.round(Number(o.score));
    if (!Number.isFinite(score)) score = 0;
    score = Math.min(100, Math.max(0, score));
    return {
      verdict,
      score,
      summary: String(o.summary ?? "").trim(),
      strengths: toList(o.strengths),
      risks: toList(o.risks),
      recommendations: toList(o.recommendations),
      source: "ai",
    };
  } catch {
    return null;
  }
}

/**
 * Score a prospective buyer via the central auth AI gateway. Returns null when
 * AI is unconfigured, unreachable, or returns something unparseable — the caller
 * then lets the sales backend apply its rule-based fallback.
 */
export async function assessConsumerAI(input: AiAssessInput): Promise<ScreeningResult | null> {
  const context = {
    konsumen: input.consumer,
    proyek: input.project || undefined,
    unit: input.unit || undefined,
    hargaRumah: input.price ?? 0,
    jawaban: input.answers.map((a) => ({ pertanyaan: a.label, jawaban: a.value || "(kosong)" })),
  };
  try {
    const res = await fetch(AUTH_API + "/ai/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        division: "sales",
        page: "Screening Konsumen",
        context,
        messages: [{ role: "user", content: INSTRUCTION }],
      }),
    });
    if (!res.ok) return null; // 503 = key not set → fall back to rules
    const body = (await res.json()) as { reply?: string };
    return parseResult(body.reply ?? "");
  } catch {
    return null;
  }
}
