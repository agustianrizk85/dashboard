import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Compact finance (Keuangan) KPI ringkasan shown on the all-access director's
 * landing. Self-contained: it authenticates to the finance backend (:8084) with
 * the shared service account, reads GET /api/summary, and fails silently if the
 * backend is unavailable. Click anywhere to jump to the full Keuangan dashboard.
 */
interface FinSummary {
  nilaiAkad: number;
  cashIn: number;
  pipelineValue: number;
  akadCount: number;
  targetAkad: number;
  achievement: number;
  bookingCount: number;
  cancelRate: number;
}

const ORIGIN = (import.meta.env.VITE_KEUANGAN_API as string) ?? "http://localhost:8084";
const BASE = ORIGIN.replace(/\/$/, "") + "/api";
const TOKEN_KEY = "gp_keuangan_token";

/** Rp juta → compact label ("Rp x,y M" / "Rp n jt"). */
function rp(juta: number): string {
  if (Math.abs(juta) >= 1000) return "Rp " + (juta / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  return "Rp " + juta.toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
}

async function fetchSummary(): Promise<FinSummary | null> {
  const tryGet = async (token: string) => {
    const res = await fetch(BASE + "/summary", { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) return "unauth" as const;
    if (!res.ok) return null;
    return (await res.json()) as FinSummary;
  };
  let token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    const r = await tryGet(token);
    if (r && r !== "unauth") return r;
  }
  // (Re)authenticate with the shared service account.
  const login = await fetch(BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  if (!login.ok) return null;
  token = ((await login.json()) as { token?: string }).token ?? null;
  if (!token) return null;
  localStorage.setItem(TOKEN_KEY, token);
  const r = await tryGet(token);
  return r && r !== "unauth" ? r : null;
}

export function FinanceStrip() {
  const [s, setS] = useState<FinSummary | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    fetchSummary()
      .then((d) => alive && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!s || s.akadCount === 0) return null;

  const cells: { label: string; value: string; tone?: string }[] = [
    { label: "Nilai Akad", value: rp(s.nilaiAkad) },
    { label: "Cash-in DP", value: rp(s.cashIn) },
    { label: "Akad", value: s.targetAkad ? `${s.akadCount} / ${s.targetAkad} (${s.achievement}%)` : `${s.akadCount}`, tone: s.achievement >= 80 ? "ok" : "warn" },
    { label: "Booking Aktif", value: `${s.bookingCount} · ${rp(s.pipelineValue)}` },
    { label: "Rasio Batal", value: `${s.cancelRate}%`, tone: s.cancelRate > 20 ? "bad" : s.cancelRate > 10 ? "warn" : "ok" },
  ];

  return (
    <button className="fin-strip" onClick={() => nav("/keuangan")} title="Buka Dashboard Keuangan">
      <span className="fin-strip-tag">💰 KEUANGAN</span>
      {cells.map((c) => (
        <span className={"fin-cell " + (c.tone ?? "")} key={c.label}>
          <span className="fin-cell-l">{c.label}</span>
          <span className="fin-cell-v">{c.value}</span>
        </span>
      ))}
      <span className="fin-strip-go">Buka →</span>
    </button>
  );
}
