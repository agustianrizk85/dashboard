// AI helpers for the RAB calculator — reuse the central Greenpark AI gateway
// (auth service /ai/chat), the same one every dashboard uses. No API key here;
// the key lives centrally (Admin → Kunci AI).

import { ROOF_COVERS, type RabInput, type RabResult } from "../lib/rabAtap";

const AUTH_API = (import.meta.env.VITE_AUTH_API as string) ?? "/api";
const TOKEN_KEY = "gp_dashboard_token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) };
}

/** Whether the central AI key is configured (to show a pointer if not). */
export async function aiConfigured(): Promise<{ configured: boolean; model: string } | null> {
  try {
    const res = await fetch(AUTH_API + "/ai/config", { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as { configured: boolean; model: string };
  } catch {
    return null;
  }
}

/** Low-level: one-shot chat with the gateway. Returns the reply text. */
async function chat(system: string, user: string, context: unknown): Promise<string> {
  const res = await fetch(AUTH_API + "/ai/chat", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      division: "Teknik",
      page: "Kalkulator RAB Atap Baja Ringan",
      context,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.reply || "";
}

/** Extract the first JSON object from a model reply. */
function extractJSON(text: string): any | null {
  const i = text.indexOf("{");
  const j = text.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    return JSON.parse(text.slice(i, j + 1));
  } catch {
    return null;
  }
}

/** "Isi Otomatis": turn a free-text building description into RAB inputs. */
export async function aiParseSpec(text: string): Promise<Partial<RabInput>> {
  const covers = ROOF_COVERS.map((c) => c.key).join(" | ");
  // The central gateway's model is chatty; force a JSON-only reply with an
  // explicit template in the USER message (last message wins) — verified live.
  const system =
    "Anda API ekstraksi parameter. Output WAJIB HANYA satu baris JSON valid, " +
    "TANPA teks lain, TANPA markdown, TANPA tabel, TANPA blok kode. Dilarang menjelaskan.";
  const user =
    "Ekstrak parameter atap pelana baja ringan dari deskripsi (angka dalam meter; " +
    "jika tidak disebut, perkirakan wajar: tinggi kuda-kuda ≈ 1/4 lebar, overstek 0.8, jarak kuda-kuda 1.2). " +
    'Balas HANYA JSON satu baris persis format: ' +
    '{"lebar":0,"panjang":0,"tinggiKuda":0,"overstekLebar":0,"overstekPanjang":0,"jarakKuda":1.2,"cover":"metal_pasir"}. ' +
    `cover salah satu: ${covers}. Deskripsi: "${text}".`;
  const reply = await chat(system, user, null);
  const j = extractJSON(reply);
  if (!j) throw new Error("AI tidak mengembalikan parameter yang bisa dibaca");
  const out: Partial<RabInput> = {};
  const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : undefined);
  if (num(j.lebar) !== undefined) out.lebar = j.lebar;
  if (num(j.panjang) !== undefined) out.panjang = j.panjang;
  if (num(j.tinggiKuda) !== undefined) out.tinggiKuda = j.tinggiKuda;
  if (num(j.overstekLebar) !== undefined) out.overstekLebar = j.overstekLebar;
  if (num(j.overstekPanjang) !== undefined) out.overstekPanjang = j.overstekPanjang;
  if (num(j.jarakKuda) !== undefined) out.jarakKuda = j.jarakKuda;
  if (typeof j.cover === "string" && ROOF_COVERS.some((c) => c.key === j.cover)) out.cover = j.cover;
  return out;
}

/** "Analisa RAB": review the computed budget and return insight text (markdown). */
export async function aiAnalyze(input: RabInput, result: RabResult): Promise<string> {
  const cover = ROOF_COVERS.find((c) => c.key === input.cover)?.label ?? input.cover;
  const context = {
    dimensi: input,
    penutup: cover,
    geometri: {
      kemiringanDeg: +result.geometry.kemiringanDeg.toFixed(1),
      luasAtap_m2: +result.geometry.luasAtap.toFixed(1),
      jumlahKudaKuda: result.geometry.jumlahKuda,
    },
    volume: result.lines.map((l) => ({ uraian: l.uraian, volume: +l.volume.toFixed(2), satuan: l.satuan, harga: l.harga, jumlah: Math.round(l.volume * l.harga) })),
    totalTenaga: Math.round(result.totalTenaga),
    totalBahan: Math.round(result.totalBahan),
    total: Math.round(result.total),
    biayaPerM2: Math.round(result.total / (result.geometry.luasAtap || 1)),
  };
  const system =
    "Anda estimator senior (QS) proyek perumahan di Indonesia. Tinjau RAB pekerjaan atap pelana baja ringan " +
    "yang diberikan (JSON). Beri analisa ringkas berbahasa Indonesia dalam poin-poin, mencakup: " +
    "(1) kewajaran biaya per m² vs pasaran, (2) item yang mendominasi biaya & potensi penghematan, " +
    "(3) kewajaran volume/koefisien (mis. C75, reng, jumlah kuda-kuda), (4) catatan teknis/struktur atau risiko. " +
    "Maksimal ~12 poin, langsung dan actionable.";
  return chat(system, "Analisa RAB berikut.", context);
}
