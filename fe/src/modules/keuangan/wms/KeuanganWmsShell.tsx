import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { AiGenerateButton } from "@/ai/AiGenerate";
import { KeuanganOverviewWms } from "./KeuanganOverviewWms";
import { KeuanganPurchasingShell } from "./KeuanganPurchasingShell";
import { BoardView } from "@/components/board/BoardView";
import { ARView } from "../ARView";
import { ImportPanel } from "../components/admin/ImportPanel";
import "../keuangan.css"; // AR view + import panel keep their .kc-scope styling (embed = transparent, no fixed canvas)
import "./keuanganWms.css";

type Tab = "dash" | "ar" | "board" | "sync";

/**
 * WMS "Ops Console" chrome for non-all-access Keuangan staff/kadep — left sidebar
 * (Dashboard / AR / Sync) + shared shell. The landing Dashboard is the redesigned
 * WMS finance overview (KeuanganOverviewWms); AR and Sync reuse the existing views
 * embedded (they render transparent inside `.kc-scope embed`). The all-access CEO /
 * directors keep the original war-room UI — gated in KeuanganApp.
 */
export function KeuanganWmsShell() {
  const { user } = useAuth();
  // Dedicated purchasing account: a purchasing-only Ops-Console (no akad / AR /
  // sync). Purchasing still lives inside the Keuangan division.
  if (user?.role === "purchasing") return <KeuanganPurchasingShell />;
  const canManage = !!user && user.role !== "viewer" && user.role !== "ceo";
  const [tab, setTab] = useState<Tab>("dash");
  const active: Tab = tab === "sync" && !canManage ? "dash" : tab;

  const sections: { key: Tab; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "ar", label: "AR / Piutang" },
    { key: "board", label: "Papan Tugas" },
    ...(canManage ? [{ key: "sync" as Tab, label: "Sync / Import" }] : []),
  ];
  const nav: WmsNavGroup[] = [
    {
      heading: "Keuangan",
      items: sections.map((s) => ({ label: s.label, active: active === s.key, onClick: () => setTab(s.key) })),
    },
  ];

  return (
    <WmsShell brand="Keuangan" brandSub="Departemen Keuangan" nav={nav} toolbar={<AiGenerateButton division="keuangan" />}>
      {active === "sync" ? (
        <div className="kc-scope embed">
          <div className="body">
            <ImportPanel reload={() => window.location.reload()} />
          </div>
        </div>
      ) : active === "ar" ? (
        <ARView />
      ) : active === "board" ? (
        <BoardView boardName="Semua Divisi" />
      ) : (
        <KeuanganOverviewWms />
      )}
    </WmsShell>
  );
}
