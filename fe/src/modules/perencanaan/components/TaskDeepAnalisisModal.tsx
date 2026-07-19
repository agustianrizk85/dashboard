import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { GkConfig, SkillMeta, TaskAIState } from "../api/client";
import { Modal } from "./Modal";
import { PdfViewerModal } from "./PdfViewerModal";
import { GkFindingsList } from "../lib/gkFindings";

const DEFAULT_SKILL = "pengecekan-gambar-kerja";

/**
 * TaskDeepAnalisisModal — runs Deep Analisis AI on a task's uploaded review PDF:
 * pick which checklist skill(s) to apply, then vision-QC every page against them.
 * Shows live progress + findings as they stream in, and produces an annotated
 * result PDF. While a run is in flight the modal cannot be closed (nothing on the
 * card is clickable) so the process is watched to completion.
 */
export function TaskDeepAnalisisModal({
  projectId,
  taskId,
  docName,
  onClose,
}: {
  projectId: string;
  taskId: string;
  docName: string;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<GkConfig>({ keyConfigured: false, keyModel: "", visionModel: "" });
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [selInit, setSelInit] = useState(false);
  const [state, setState] = useState<TaskAIState>({ aiStatus: "idle" });
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);

  // Load config + skills + current analysis state once.
  useEffect(() => {
    api.gkConfig().then(setCfg).catch(() => {});
    api.skills().then(setSkills).catch(() => {});
    api.taskAIStatus(projectId, taskId).then(setState).catch(() => {});
  }, [projectId, taskId]);

  // Default skill selection once the list is known: prior run's skills, else the
  // GK checklist, else the first available.
  useEffect(() => {
    if (selInit || skills.length === 0) return;
    const prior = (state.aiSkills ?? []).filter((n) => skills.some((s) => s.name === n));
    if (prior.length) setSel(prior);
    else if (skills.some((s) => s.name === DEFAULT_SKILL)) setSel([DEFAULT_SKILL]);
    else setSel([skills[0].name]);
    setSelInit(true);
  }, [skills, state.aiSkills, selInit]);

  // Poll while a run is in flight so progress + findings appear live.
  useEffect(() => {
    if (state.aiStatus !== "running") return;
    const id = window.setInterval(() => {
      api.taskAIStatus(projectId, taskId).then(setState).catch(() => {});
    }, 1500);
    return () => window.clearInterval(id);
  }, [state.aiStatus, projectId, taskId]);

  const toggle = (name: string) =>
    setSel((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  const start = async () => {
    setStarting(true);
    setErr("");
    try {
      await api.startTaskAI(projectId, taskId, sel);
      setState((s) => ({ ...s, aiStatus: "running", aiError: "", aiFindings: [], aiDone: 0, aiTotal: 0 }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const openPdf = () => {
    setErr("");
    api
      .taskAIPdfUrl(projectId, taskId)
      .then(setPdf)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  const closePdf = () =>
    setPdf((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

  const status = state.aiStatus || "idle";
  const running = status === "running";
  const total = state.aiTotal ?? 0;
  const done = state.aiDone ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const ready = cfg.keyConfigured && sel.length > 0;
  const live = state.aiFindings ?? [];
  const skillLabel = useMemo(
    () => sel.map((n) => skills.find((s) => s.name === n)?.title ?? n).join(", "),
    [sel, skills],
  );

  return (
    <Modal
      title="🔬 Deep Analisis AI — Cek Dokumen"
      sub={`${docName} · QC 1 dokumen vs checklist · vision AI`}
      onClose={running ? () => {} : onClose}
      width={660}
    >
      <div className="form">
        <div className="gk-keybox">
          <div className={cfg.keyConfigured ? "gk-keyok" : "gk-keywarn"}>
            {cfg.keyConfigured
              ? `✓ pakai Kunci AI pusat${cfg.visionModel ? ` · model vision: ${cfg.visionModel}` : ""}`
              : "⚠ Kunci AI belum diset — atur di Panel Admin › Kunci AI"}
          </div>
        </div>

        {err && <div className="login-error">{err}</div>}

        {status === "idle" ? (
          <>
            <div className="gk-skillpick">
              <div className="gk-skillpick-hd">Pilih skill yang dipakai (bisa lebih dari satu)</div>
              {skills.length === 0 ? (
                <div className="empty-note">Belum ada skill — buat di menu Skill AI.</div>
              ) : (
                <div className="gk-skilllist">
                  {skills.map((s) => (
                    <label key={s.name} className={`gk-skillopt ${sel.includes(s.name) ? "on" : ""}`}>
                      <input type="checkbox" checked={sel.includes(s.name)} onChange={() => toggle(s.name)} />
                      <span className="gk-skillopt-title">{s.title}</span>
                      <span className="gk-skillopt-name">{s.name}.md</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Tutup
              </button>
              <button type="button" className="btn-ai" disabled={!ready || starting} onClick={start}>
                {starting ? "Memulai…" : "🔬 Mulai Analisis"}
              </button>
            </div>
          </>
        ) : running ? (
          <div className="gk-progress">
            <div className="gk-progress-top">
              <span>⏳ Menganalisis halaman {total > 0 ? `${done}/${total}` : "…"}</span>
              <b>{total > 0 ? `${pct}%` : ""}</b>
            </div>
            <div className="gk-progress-bar">
              <span style={{ width: total > 0 ? `${pct}%` : "8%" }} className={total > 0 ? "" : "indet"} />
            </div>
            <div className="gk-progress-sub">
              Skill: <b>{skillLabel || "—"}</b>. AI memeriksa tiap halaman — mohon tunggu, jendela tak bisa
              ditutup selama proses berjalan.
            </div>
            <div className="gk-live">
              <div className="gk-live-hd">
                AI menemukan sejauh ini <span className="gk-live-count">{live.length}</span>
              </div>
              {live.length === 0 ? (
                <div className="gk-live-empty">Belum ada temuan — menganalisis…</div>
              ) : (
                <ul className="gk-live-list">
                  {live.map((f, i) => (
                    <li key={i}>
                      <b>Hal. {f.page}</b>
                      {f.wrong ? (
                        <>
                          {" "}
                          — <code>{f.wrong}</code>
                        </>
                      ) : (
                        <> — ⚠ gagal dianalisis</>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : status === "failed" ? (
          <>
            <div className="login-error">Gagal: {state.aiError}</div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Tutup
              </button>
              <button type="button" className="btn-ai" onClick={() => setState((s) => ({ ...s, aiStatus: "idle" }))}>
                🔬 Coba Lagi
              </button>
            </div>
          </>
        ) : (
          <>
            {state.aiError && <div className="gk-keywarn" style={{ marginBottom: 8 }}>⚠ {state.aiError}</div>}
            <div className="wd-revisi big">
              <GkFindingsList
                findings={state.aiFindings ?? []}
                emptyText="Tidak ada ketidaksesuaian ditemukan — dokumen sudah sesuai."
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Tutup
              </button>
              {state.aiAnnotated && (
                <button type="button" className="btn-primary" onClick={openPdf}>
                  📄 Lihat PDF Hasil
                </button>
              )}
              <button type="button" className="btn-ai" onClick={() => setState((s) => ({ ...s, aiStatus: "idle" }))}>
                🔬 Cek Ulang
              </button>
            </div>
          </>
        )}
      </div>

      {pdf && (
        <PdfViewerModal
          name={state.aiAnnotated?.name ?? "hasil-analisis.pdf"}
          url={pdf}
          canReplace={false}
          busy={false}
          onReplace={() => {}}
          onClose={closePdf}
        />
      )}
    </Modal>
  );
}
