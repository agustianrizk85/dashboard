import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAiGrounding } from "@/ai/AiAssistant";
import { useRealtimeSocket } from "@/lib/realtime";
import { useAuth } from "@/auth/AuthContext";
import type { ARData, ARProject, ARPiutangRow } from "./types";
import { api, AuthError } from "./api/client";
import { Bar, Kpi, Panel, Stat } from "./components/ui";
import "./keuangan.css";

// Same shared service account as the akad dashboard — AR reads/sync go through it.
const FIN_USER = { user: "admin", pass: "admin123" };

/** Compact Rupiah label: 1_230_000_000 → "Rp 1,23 M", 540_000_000 → "Rp 540 jt". */
function rp(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000_000) return "Rp " + (v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
  if (Math.abs(v) >= 1_000_000) return "Rp " + (v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return "Rp " + v.toLocaleString("id-ID");
}
function num(n: number): string {
  return n.toLocaleString("id-ID");
}
function monthLabel(period: string): string {
  const [y, m] = period.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const mi = parseInt(m, 10);
  return (names[mi] ?? m) + " " + (y ?? "");
}

function normalizeAR(d: ARData): ARData {
  const arr = <T,>(x: T[] | null | undefined): T[] => (Array.isArray(x) ? x : []);
  return {
    ...d,
    tahapan: arr(d.tahapan),
    aging: arr(d.aging),
    monthly: arr(d.monthly),
    banks: arr(d.banks),
    projects: arr(d.projects),
    piutang: arr(d.piutang),
    sheets: arr(d.sheets),
    summary: d.summary ?? ({} as ARData["summary"]),
  };
}

type LoadState =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: ARData; error: "" }
  | { status: "error"; data: null; error: string };

/** AR / Piutang sub-dashboard for the Keuangan division. */
export function ARView() {
  const { user } = useAuth();
  const canSync = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const setGrounding = useAiGrounding();

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    const once = async () => {
      if (!api.hasToken()) await api.login(FIN_USER.user, FIN_USER.pass);
      return normalizeAR(await api.ar());
    };
    try {
      setState({ status: "ready", data: await once(), error: "" });
    } catch (e) {
      if (e instanceof AuthError) {
        try {
          await api.login(FIN_USER.user, FIN_USER.pass);
          setState({ status: "ready", data: normalizeAR(await api.ar()), error: "" });
          return;
        } catch (e2) {
          setState({ status: "error", data: null, error: e2 instanceof Error ? e2.message : String(e2) });
          return;
        }
      }
      setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeSocket(api.realtimeURL(), () => void load());

  // Publish AR summary to the AI assistant.
  useEffect(() => {
    if (state.status !== "ready") return;
    const d = state.data;
    setGrounding({
      division: "Keuangan",
      page: "AR / Piutang",
      data: { period: d.period, summary: d.summary, tahapan: d.tahapan, aging: d.aging, projects: d.projects, banks: d.banks },
    });
  }, [state, setGrounding]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      if (!api.hasToken()) await api.login(FIN_USER.user, FIN_USER.pass);
      const ar = normalizeAR(await api.arSyncApprove());
      setState({ status: "ready", data: ar, error: "" });
      setSyncMsg("Sinkronisasi berhasil · " + (ar.updated || ""));
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  const wrap = (inner: ReactNode) => <div className="kc-scope embed">{inner}</div>;

  if (state.status === "loading") {
    return wrap(
      <div className="splash">
        <div className="spinner" />
        Memuat data AR / piutang…
      </div>,
    );
  }
  if (state.status === "error") {
    return wrap(
      <div className="splash error">
        <div className="splash-title">Gagal memuat data AR</div>
        <div className="splash-msg">{state.error}</div>
        <button className="splash-btn" onClick={() => void load()}>Coba lagi</button>
      </div>,
    );
  }

  const D = state.data;
  const s = D.summary;
  const empty = (s.unitTotal ?? 0) === 0 && D.projects.length === 0;

  return wrap(
    <div className="body">
      <div className="ar-bar">
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {D.period}{D.updated ? ` · diperbarui ${D.updated}` : ""}
        </div>
        <span style={{ flex: 1 }} />
        {syncMsg && <span className="ar-syncmsg">{syncMsg}</span>}
        {canSync && (
          <button className="ar-syncbtn" onClick={() => void doSync()} disabled={syncing}>
            {syncing ? "Menyinkronkan…" : "↻ Sync Sheet AR"}
          </button>
        )}
      </div>

      {empty ? (
        <div className="empty-mini" style={{ padding: 48 }}>
          📒 Belum ada data AR. {canSync ? "Klik " : "Minta admin klik "}<b>Sync Sheet AR</b> untuk menarik dari spreadsheet input per proyek.
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
            (Isi dulu URL spreadsheet AR tiap proyek di tab <b>Sync / Import → Spreadsheet AR / Piutang per Proyek</b>, lalu share tiap sheet ke email service account.)
          </div>
        </div>
      ) : (
        <>
          <div className="ar-kpis">
            <Kpi label="Nilai Kontrak" value={rp(s.nilaiKontrak)} />
            <Kpi label="Total Terbayar" value={rp(s.totalTerbayar)} tone="ok" />
            <Kpi label="Sisa Piutang" value={rp(s.sisaPiutang)} tone={s.sisaPiutang > 0 ? "warn" : "ok"} />
            <Kpi label="Progres Bayar" value={s.progresPct + "%"} />
            <Kpi label={`Cash-in ${D.focusYear}`} value={rp(s.cashIn)} tone="ok" />
            <Kpi label="Pencairan KPR" value={rp(s.pencairanKpr)} />
            <Kpi label="Unit Lunas" value={`${num(s.unitLunas)}/${num(s.unitTotal)}`} />
            <Kpi label="DP Jatuh Tempo" value={num(s.dpJatuhTempo)} unit="unit" tone={s.dpJatuhTempo > 0 ? "bad" : "ok"} />
          </div>

          <div className="ar-grid">
            <Panel tag="KPR" title="Pencairan KPR per Tahap" sub={`Total ${rp(s.pencairanKpr)}`}>
              {D.tahapan.length === 0 ? (
                <div className="ar-none">Belum ada pencairan KPR.</div>
              ) : (
                <div className="ar-stack">
                  {D.tahapan.map((t) => {
                    const max = Math.max(...D.tahapan.map((x) => x.nilai), 1);
                    return (
                      <div className="ar-rowbar" key={t.key}>
                        <div className="ar-rowbar-top">
                          <span>{t.label}</span>
                          <span className="ar-rowbar-val">{rp(t.nilai)} · {t.count}×</span>
                        </div>
                        <Bar value={t.nilai} max={max} tone="green" />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel tag="DP" title="Aging Piutang DP" sub={`Sisa DP ${rp(s.dpSisa)}`}>
              {D.aging.length === 0 ? (
                <div className="ar-none">Tidak ada sisa piutang DP.</div>
              ) : (
                <div className="ar-stack">
                  {D.aging.map((a) => {
                    const max = Math.max(...D.aging.map((x) => x.nilai), 1);
                    const tone = a.bucket.includes("> 90") ? "red" : a.bucket.includes("31") ? "yellow" : a.bucket.includes("1–30") ? "yellow" : "green";
                    return (
                      <div className="ar-rowbar" key={a.bucket}>
                        <div className="ar-rowbar-top">
                          <span>{a.bucket}</span>
                          <span className="ar-rowbar-val">{rp(a.nilai)} · {a.count} unit</span>
                        </div>
                        <Bar value={a.nilai} max={max} tone={tone} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel tag="CASH-IN" title="Dana Masuk Bulanan" sub={String(D.focusYear)}>
              {D.monthly.length === 0 ? (
                <div className="ar-none">Belum ada dana masuk tahun {D.focusYear}.</div>
              ) : (
                <div className="ar-stack">
                  {D.monthly.map((m) => {
                    const max = Math.max(...D.monthly.map((x) => x.cashIn), 1);
                    return (
                      <div className="ar-rowbar" key={m.period}>
                        <div className="ar-rowbar-top">
                          <span>{monthLabel(m.period)}</span>
                          <span className="ar-rowbar-val">{rp(m.cashIn)}{m.kpr > 0 ? ` · KPR ${rp(m.kpr)}` : ""}</span>
                        </div>
                        <Bar value={m.cashIn} max={max} tone="green" />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel tag="BANK" title="Dana Masuk per Bank Penerima">
              {D.banks.length === 0 ? (
                <div className="ar-none">Belum ada data bank.</div>
              ) : (
                <div className="ar-statgrid">
                  {D.banks.slice(0, 8).map((b) => (
                    <Stat key={b.name} label={`${b.name} · ${b.count}×`} value={rp(b.nilai)} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel tag="PROYEK" title="Piutang per Proyek" sub={`${D.projects.length} proyek`}>
              <ProjectTable rows={D.projects} />
            </Panel>

            <Panel tag="WATCH-LIST" title="Sisa Piutang Terbesar" sub={`${D.piutang.length} unit`}>
              <PiutangTable rows={D.piutang} />
            </Panel>
          </div>
        </>
      )}
    </div>,
  );
}

function ProjectTable({ rows }: { rows: ARProject[] }) {
  if (rows.length === 0) return <div className="ar-none">Belum ada data proyek.</div>;
  return (
    <div className="ar-tablewrap">
      <table className="ar-table">
        <thead>
          <tr>
            <th>Proyek</th><th className="r">Kontrak</th><th className="r">Terbayar</th>
            <th className="r">Sisa</th><th className="r">Progres</th><th className="r">Lunas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.code}>
              <td><b>{p.code}</b></td>
              <td className="r">{rp(p.nilaiKontrak)}</td>
              <td className="r">{rp(p.totalTerbayar)}</td>
              <td className="r" style={{ color: p.sisaPiutang > 0 ? "var(--warn, #c77)" : "inherit" }}>{rp(p.sisaPiutang)}</td>
              <td className="r">{p.progresPct}%</td>
              <td className="r">{num(p.lunas)}/{num(p.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PiutangTable({ rows }: { rows: ARPiutangRow[] }) {
  if (rows.length === 0) return <div className="ar-none">Tidak ada sisa piutang. 🎉</div>;
  return (
    <div className="ar-tablewrap">
      <table className="ar-table">
        <thead>
          <tr>
            <th>Proyek</th><th>Konsumen</th><th>Blok</th><th>Bank</th>
            <th className="r">Harga</th><th className="r">Terbayar</th><th className="r">Sisa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.project}</td>
              <td>{r.customer}</td>
              <td>{r.blok}</td>
              <td>{r.bank}</td>
              <td className="r">{rp(r.hargaJual)}</td>
              <td className="r">{rp(r.terbayar)}</td>
              <td className="r" style={{ color: "var(--warn, #c77)" }}>{rp(r.sisa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
