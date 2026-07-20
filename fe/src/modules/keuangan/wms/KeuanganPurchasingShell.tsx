import { useState } from "react";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { AiGenerateButton } from "@/ai/AiGenerate";
import { PurchasingDashboard } from "../purchasing/PurchasingDashboard";
import { PRView } from "../purchasing/PRView";
import { POView } from "../purchasing/POView";
import { ApprovalView } from "../purchasing/ApprovalView";
import { MasterDataView } from "../purchasing/MasterDataView";
import "../keuangan.css"; // purchasing views keep their .kc-scope styling (embed = transparent)
import "./keuanganWms.css";

type Tab = "dash" | "pr" | "po" | "approval" | "master";

/**
 * Ops-Console shell for the dedicated Purchasing account (role "purchasing").
 * Purchasing lives INSIDE the Keuangan division but this account sees ONLY the
 * operational purchasing surface — Dashboard + PR + PO + Approval + Master Data.
 * The finance akad dashboard, AR / Piutang, and Sync / Import are intentionally
 * NOT shown here (AR piutang is a separate finance concern).
 */
export function KeuanganPurchasingShell() {
  const [tab, setTab] = useState<Tab>("dash");

  const sections: { key: Tab; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "pr", label: "Purchase Request" },
    { key: "po", label: "Purchase Order" },
    { key: "approval", label: "Approval" },
    { key: "master", label: "Master Data" },
  ];
  const nav: WmsNavGroup[] = [
    {
      heading: "Purchasing",
      items: sections.map((s) => ({ label: s.label, active: tab === s.key, onClick: () => setTab(s.key) })),
    },
  ];

  return (
    <WmsShell brand="Keuangan" brandSub="Purchasing" nav={nav} toolbar={<AiGenerateButton division="keuangan" />}>
      {tab === "pr" ? (
        <div className="kc-scope embed">
          <PRView />
        </div>
      ) : tab === "po" ? (
        <div className="kc-scope embed">
          <POView />
        </div>
      ) : tab === "approval" ? (
        <div className="kc-scope embed">
          <ApprovalView />
        </div>
      ) : tab === "master" ? (
        <div className="kc-scope embed">
          <div className="body">
            <MasterDataView />
          </div>
        </div>
      ) : (
        <PurchasingDashboard onGoto={(t) => setTab(t as Tab)} />
      )}
    </WmsShell>
  );
}
