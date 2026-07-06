import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { ControlTowerView } from "./controltower/ControlTower";
import { AdminView } from "./AdminView";
import { AiGenerateButton } from "@/ai/AiGenerate";
import "./sales.css";

// Monev bundles xlsx + chart.js — code-split so they only load when its tab opens.
const MonevView = lazy(() => import("./monev/MonevView"));

type Tab = "tower" | "monev" | "master";

const roleLabel: Record<string, string> = {
  ceo: "CEO",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  sales: "Tim Sales",
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
 * Sales division shell. The Control Tower (war-room) self-authenticates to the
 * sales backend (:8085) with the shared read-only viewer account, so every
 * dashboard user sees the same live war-room. The header + DivisionTabs match
 * the other divisions so an all-access director can switch freely.
 */
export default function SalesApp() {
  const { user, logout } = useAuth();
  // Viewers and the overview-only CEO see the war-room only; sales managers
  // (and the Dirops director) also get Master Data / sync.
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [tab, setTab] = useState<Tab>("tower");
  const active: Tab = tab === "master" && canManage ? "master" : tab;
  return (
    <div className="sales-stage">
      <div className="sales-canvas">
        <header className="hdr">
          <div className="hdr-logo">
            <img src="/brand/logo-mark.png" alt="Greenpark Group" />
          </div>
          <div className="hdr-titles">
            <h1>Dashboard Sales</h1>
            <div className="sub">Greenpark Group · Departemen Sales</div>
            <div className="tag">LEADS · BOOKING · AKAD · CASH-IN</div>
          </div>
          <div className="hdr-spacer" />
          <AiGenerateButton division="sales" />
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
          <button className={`tab ${active === "tower" ? "on" : ""}`} onClick={() => setTab("tower")}>
            Control Tower
          </button>
          <button className={`tab ${active === "monev" ? "on" : ""}`} onClick={() => setTab("monev")}>
            Sales Monev
          </button>
          {canManage && (
            <button className={`tab ${active === "master" ? "on" : ""}`} onClick={() => setTab("master")}>
              Master Data
            </button>
          )}
        </DivisionTabBar>

        <main className="content">
          {active === "master" ? (
            <AdminView />
          ) : active === "monev" ? (
            <Suspense fallback={<div style={{ padding: 24, color: "#6b766c" }}>Memuat Sales Monev…</div>}>
              <MonevView />
            </Suspense>
          ) : (
            <ControlTowerView />
          )}
        </main>
      </div>
    </div>
  );
}
