import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { KeuanganView } from "./KeuanganView";
import { ARView } from "./ARView";
import { ImportPanel } from "./components/admin/ImportPanel";
import "../sales/sales.css"; // shared division shell chrome (stage/header/tabs)
import "./keuangan.css"; // finance dashboard content, scoped under .kc-scope
import { AiGenerateButton } from "@/ai/AiGenerate";

type Tab = "dash" | "ar" | "sync";

const roleLabel: Record<string, string> = {
  ceo: "CEO",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  viewer: "Viewer",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="clock">
      <div className="t">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
      <div className="d">{now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
    </div>
  );
}

/**
 * Keuangan division shell. The Finance dashboard (Akad/KPR control tower) reads
 * the keuangan backend (:8084) via a shared service account, so every dashboard
 * user sees the same live data. The header + DivisionTabs match the other
 * divisions so an all-access director can switch freely. Finance managers (and
 * the Dirops director) additionally get the Sync / Import tab; the overview-only
 * CEO and viewers see the dashboard only.
 */
export default function KeuanganApp() {
  const { user, logout } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [tab, setTab] = useState<Tab>("dash");
  const active: Tab = tab === "sync" && !canManage ? "dash" : tab;

  return (
    <div className="sales-stage">
      <div className="sales-canvas">
        <header className="hdr">
          <div className="hdr-logo">
            <img src="/brand/logo-mark.png" alt="Greenpark Group" />
          </div>
          <div className="hdr-titles">
            <h1>Dashboard Keuangan</h1>
            <div className="sub">Greenpark Group · Departemen Keuangan</div>
            <div className="tag">AKAD · KPR · CASH-IN · PENDANAAN</div>
          </div>
          <div className="hdr-spacer" />
          <AiGenerateButton division="keuangan" />
          <div className="hdr-meta">
            <Clock />
            <div className="hdr-user">
              <div className="hu-name">{user?.name}</div>
              <div className="hu-role">{user ? roleLabel[user.role] ?? user.role : ""}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Keluar">
              ✕
            </button>
          </div>
        </header>

        <DivisionTabBar>
          <button className={`tab ${active === "dash" ? "on" : ""}`} onClick={() => setTab("dash")}>
            Dashboard
          </button>
          <button className={`tab ${active === "ar" ? "on" : ""}`} onClick={() => setTab("ar")}>
            AR / Piutang
          </button>
          {canManage && (
            <button className={`tab ${active === "sync" ? "on" : ""}`} onClick={() => setTab("sync")}>
              Sync / Import
            </button>
          )}
        </DivisionTabBar>

        <main className="content">
          {active === "sync" ? (
            <div className="kc-scope">
              <div className="body">
                <ImportPanel reload={() => window.location.reload()} />
              </div>
            </div>
          ) : active === "ar" ? (
            <ARView />
          ) : (
            <KeuanganView />
          )}
        </main>
      </div>
    </div>
  );
}
