import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { KeuanganView } from "./KeuanganView";
import { ARView } from "./ARView";
import { ImportPanel } from "./components/admin/ImportPanel";
import { KeuanganWmsShell } from "./wms/KeuanganWmsShell";
import { PRView } from "./purchasing/PRView";
import { POView } from "./purchasing/POView";
import { ApprovalView } from "./purchasing/ApprovalView";
import { MasterDataView } from "./purchasing/MasterDataView";
import "../sales/sales.css"; // shared division shell chrome (stage/header/tabs)
import "./keuangan.css"; // finance dashboard content, scoped under .kc-scope
import { AiGenerateButton } from "@/ai/AiGenerate";

interface TabDef {
  id: string;
  label: string;
  /** Only visible to managers (not viewer / not overview-only CEO). */
  manage?: boolean;
  /** Part of the operational Purchasing sub-module (the only tabs a dedicated
   *  purchasing-staff account sees). */
  purchasing?: boolean;
}

const TABS: TabDef[] = [
  { id: "dash", label: "Dashboard" },
  { id: "ar", label: "AR / Piutang" },
  { id: "pr", label: "Purchase Request", manage: true, purchasing: true },
  { id: "po", label: "Purchase Order", manage: true, purchasing: true },
  { id: "approval", label: "Approval", manage: true, purchasing: true },
  { id: "master", label: "Master Data", manage: true, purchasing: true },
  { id: "sync", label: "Sync / Import", manage: true },
];

const roleLabel: Record<string, string> = {
  ceo: "CEO",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  purchasing: "Staff Purchasing",
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
 * user sees the same live data. Beyond the read-only Dashboard + AR views,
 * finance managers (and the Dirops director) get the operational Purchasing
 * tabs — Purchase Request, Purchase Order, Approval, Master Data — plus the
 * Sync / Import tab. The overview-only CEO and viewers see the dashboards only.
 */
export default function KeuanganApp() {
  const { user, logout } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  // A dedicated purchasing-staff account works ONLY inside the operational
  // Purchasing sub-module — it does not see the finance Dashboard / AR / Sync.
  const purchasingOnly = user?.role === "purchasing";
  const [rawTab, setRawTab] = useState<string>(() => localStorage.getItem("gp_keuangan_tab") ?? "dash");

  const visible = purchasingOnly ? TABS.filter((t) => t.purchasing) : TABS.filter((t) => canManage || !t.manage);
  // Never strand a user on a tab they can't see (e.g. a remembered "pr" for a
  // viewer, or "dash" for a purchasing-only account).
  const active = visible.some((t) => t.id === rawTab) ? rawTab : visible[0].id;
  const setTab = (t: string) => {
    setRawTab(t);
    try {
      localStorage.setItem("gp_keuangan_tab", t);
    } catch {
      /* ignore */
    }
  };

  // CEO / all-access directors keep the original war-room UI; staff & kadep get
  // the new WMS Ops-Console redesign.
  if (!user?.allAccess) return <KeuanganWmsShell />;

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
            <div className="tag">AKAD · KPR · CASH-IN · PENDANAAN · PURCHASING</div>
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
          {visible.map((t) => (
            <button key={t.id} className={`tab ${active === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </DivisionTabBar>

        <main className="content">
          {active === "ar" ? (
            <ARView />
          ) : active === "sync" ? (
            <div className="kc-scope">
              <div className="body">
                <ImportPanel reload={() => window.location.reload()} />
              </div>
            </div>
          ) : active === "pr" ? (
            <div className="kc-scope">
              <PRView />
            </div>
          ) : active === "po" ? (
            <div className="kc-scope">
              <POView />
            </div>
          ) : active === "approval" ? (
            <div className="kc-scope">
              <ApprovalView />
            </div>
          ) : active === "master" ? (
            <div className="kc-scope">
              <div className="body">
                <MasterDataView />
              </div>
            </div>
          ) : (
            <KeuanganView />
          )}
        </main>
      </div>
    </div>
  );
}
