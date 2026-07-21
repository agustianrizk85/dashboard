import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { AiGenerateButton } from "@/ai/AiGenerate";
import { DeepAnalysisButton } from "@/ai/DeepAnalysis";
import { PurchasingInbox } from "@/purchasing/PurchasingInbox";
import { ControlTowerView } from "../controltower/ControlTower";
import { AdminView } from "../AdminView";
import { BoardView } from "@/components/board/BoardView";
import { SalesOverviewWms } from "./SalesOverviewWms";
import "../sales.css"; // Control Tower keeps its .ct-scope styling (embed = natural height, no fixed canvas)
import "./saleswms.css";

// Code-split the heavier / tab-specific views (Monev pulls in xlsx + chart.js).
// Screening & Credit are lazy here too so they share ONE chunk with SalesApp's
// lazy imports instead of being duplicated into the shell bundle.
const MonevView = lazy(() => import("../monev/MonevView"));
const ScreeningView = lazy(() => import("../staff/ScreeningView"));
const CreditSimView = lazy(() => import("../staff/CreditSimView"));

type Tab = "ringkasan" | "tower" | "board" | "screening" | "kredit" | "monev" | "pembelian" | "master";

/**
 * WMS "Ops Console" chrome for non-all-access Sales staff/kadep — left sidebar +
 * shared shell. The landing "Ringkasan" is the redesigned Ops-Console overview
 * (SalesOverviewWms); "Control Tower" embeds the full war-room (renders at natural
 * height inside `.ct-scope embed`); the staff tools, Monev, Pembelian and Master
 * Data reuse their existing views. The all-access CEO / directors keep the original
 * war-room UI — gated in SalesApp.
 */
export function SalesWmsShell() {
  const { user } = useAuth();
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [tab, setTab] = useState<Tab>("ringkasan");
  const active: Tab = tab === "master" && !canManage ? "ringkasan" : tab;

  const nav: WmsNavGroup[] = [
    {
      heading: "Dashboard",
      items: [
        { label: "Ringkasan", active: active === "ringkasan", onClick: () => setTab("ringkasan") },
        { label: "Control Tower", active: active === "tower", onClick: () => setTab("tower") },
      ],
    },
    {
      heading: "Alat Sales",
      items: [
        { label: "Screening Konsumen", active: active === "screening", onClick: () => setTab("screening") },
        { label: "Simulasi Kredit", active: active === "kredit", onClick: () => setTab("kredit") },
        { label: "Sales Monev", active: active === "monev", onClick: () => setTab("monev") },
      ],
    },
    {
      heading: "Operasional",
      items: [
        { label: "Papan Tugas", active: active === "board", onClick: () => setTab("board") },
        { label: "Pembelian", active: active === "pembelian", onClick: () => setTab("pembelian") },
        ...(canManage ? [{ label: "Master Data", active: active === "master", onClick: () => setTab("master") }] : []),
      ],
    },
  ];

  return (
    <WmsShell
      brand="Sales"
      brandSub="Departemen Sales"
      nav={nav}
      toolbar={
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <AiGenerateButton division="sales" />
          <DeepAnalysisButton division="sales" />
        </div>
      }
    >
      <Suspense fallback={<div className="wms-empty">Memuat…</div>}>
        {active === "tower" ? (
          <ControlTowerView />
        ) : active === "board" ? (
          <BoardView boardName="Semua Divisi" />
        ) : active === "screening" ? (
          <ScreeningView />
        ) : active === "kredit" ? (
          <CreditSimView />
        ) : active === "monev" ? (
          <MonevView />
        ) : active === "pembelian" ? (
          <PurchasingInbox />
        ) : active === "master" ? (
          <AdminView />
        ) : (
          <SalesOverviewWms onOpenTower={() => setTab("tower")} />
        )}
      </Suspense>
    </WmsShell>
  );
}

export default SalesWmsShell;
