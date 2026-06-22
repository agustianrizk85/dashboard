import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRealtimeSocket } from "@/lib/realtime";
import type { Dashboard, ProjectFin } from "./types";
import { api, AuthError } from "./api/client";
import {
  AchievementPanel,
  AiDecisionPanel,
  AlertPanel,
  BankPanel,
  KpiRow,
  MonthlyPanel,
  PayMixPanel,
  PipelinePanel,
  ProjectPanel,
  SalesPanel,
} from "./components/panels";
import { FOCUS_META, ProjectDetail } from "./components/focus";
import "./keuangan.css";

// The finance dashboard reads the keuangan backend (:8084). Every dashboard
// user views it through the shared service account; access to /keuangan is
// gated by the unified login. admin lets the optional Sync tab work too.
const FIN_USER = { user: "admin", pass: "admin123" };

type LoadState =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: Dashboard; error: "" }
  | { status: "error"; data: null; error: string };

type Modal = { kind: "focus"; key: string } | { kind: "project"; p: ProjectFin };

/** Embedded Finance dashboard (Akad/KPR control tower) for the unified shell. */
export function KeuanganView() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: "" });

  const load = useCallback(async () => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: "" }));
    const fetchOnce = async () => {
      if (!api.hasToken()) await api.login(FIN_USER.user, FIN_USER.pass);
      return api.dashboard();
    };
    try {
      setState({ status: "ready", data: await fetchOnce(), error: "" });
    } catch (e) {
      if (e instanceof AuthError) {
        try {
          await api.login(FIN_USER.user, FIN_USER.pass);
          setState({ status: "ready", data: await api.dashboard(), error: "" });
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

  // Realtime: the finance backend pushes on every data change (sync/upload) —
  // re-fetch instantly, no refresh needed.
  useRealtimeSocket(api.realtimeURL(), () => void load());

  const wrap = (inner: ReactNode) => <div className="kc-scope embed">{inner}</div>;

  if (state.status === "loading") {
    return wrap(
      <div className="splash">
        <div className="spinner" />
        Memuat data keuangan…
      </div>,
    );
  }
  if (state.status === "error") {
    return wrap(
      <div className="splash error">
        <div className="splash-title">Gagal memuat data</div>
        <div className="splash-msg">{state.error}</div>
        <div className="splash-msg">API: {api.base}</div>
        <button className="splash-btn" onClick={() => void load()}>
          Coba lagi
        </button>
      </div>,
    );
  }
  return wrap(<Body D={state.data} />);
}

function Body({ D }: { D: Dashboard }) {
  const [modal, setModal] = useState<Modal | null>(null);
  const empty = D.summary.akadCount === 0 && D.projects.length === 0;
  const openFocus = (key: string) => setModal({ kind: "focus", key });
  const openProject = (p: ProjectFin) => setModal({ kind: "project", p });

  if (empty) {
    return (
      <div className="body">
        <div className="empty-mini" style={{ padding: 60 }}>
          📊 Belum ada data keuangan. Buka tab <b>Sync / Import</b> untuk tarik data dari Google Sheets.
        </div>
      </div>
    );
  }

  return (
    <div className="body">
      <div style={{ fontSize: 12, color: "var(--ink-3)", margin: "0 0 10px" }}>
        {D.period}{D.updated ? ` · diperbarui ${D.updated}` : ""}
      </div>
      <KpiRow s={D.summary} />
      <div className="grid">
        <AchievementPanel s={D.summary} onExpand={() => openFocus("kpi")} />
        <MonthlyPanel monthly={D.monthly} onExpand={() => openFocus("cashflow")} />
        <ProjectPanel projects={D.projects} onExpand={() => openFocus("project")} onRow={openProject} />
        <BankPanel banks={D.banks} onExpand={() => openFocus("bank")} />
        <SalesPanel sales={D.sales} onExpand={() => openFocus("sales")} />
        <PayMixPanel payMix={D.payMix} />
        <PipelinePanel pipeline={D.pipeline} onExpand={() => openFocus("pipeline")} />
        <AlertPanel alerts={D.alerts} />
        <AiDecisionPanel insights={D.ai} decisions={D.decisions} onExpand={() => openFocus("ai")} />
      </div>
      {modal && <ModalView modal={modal} D={D} onClose={() => setModal(null)} />}
    </div>
  );
}

function ModalView({ modal, D, onClose }: { modal: Modal; D: Dashboard; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  let title: string;
  let sub: string;
  let content: ReactNode;
  if (modal.kind === "project") {
    title = modal.p.name;
    sub = "Akad deep-dive · " + modal.p.gp;
    content = <ProjectDetail p={modal.p} />;
  } else {
    const m = FOCUS_META[modal.key];
    title = m.title;
    sub = m.sub;
    content = m.render(D);
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-hd">
          <h2>{title}</h2>
          <span className="mh-sub">{sub}</span>
          <span className="mh-sp" />
          <button className="mclose" onClick={onClose}>×</button>
        </header>
        <div className="modal-bd">{content}</div>
      </div>
    </div>
  );
}
