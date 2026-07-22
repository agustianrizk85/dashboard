import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider } from "@/lib/realtime";
import { realtimeURL } from "@/modules/permit/services/api";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { Layout } from "@/modules/permit/components/Layout";
import { DashboardPage } from "@/modules/permit/pages/DashboardPage";
import { PermitOverviewWms } from "@/modules/permit/PermitOverviewWms";
import { ProjectDetailPage } from "@/modules/permit/pages/ProjectDetailPage";
import { PTPage } from "@/modules/permit/pages/PTPage";
import { VendorPage } from "@/modules/permit/pages/VendorPage";
import { SPKPage } from "@/modules/permit/pages/SPKPage";
import { DeadlinePage } from "@/modules/permit/pages/DeadlinePage";
import { OutputsPage } from "@/modules/permit/pages/OutputsPage";
import { SettingsPage } from "@/modules/permit/pages/SettingsPage";
import { SyncPage } from "@/modules/permit/pages/SyncPage";
import { PurchasingInbox } from "@/purchasing/PurchasingInbox";
import { BoardView } from "@/components/board/BoardView";
import "./permit.css";

const SECTIONS = [
  { key: "", label: "Dashboard" },
  { key: "board", label: "Papan Tugas" },
  { key: "pt", label: "Master PT" },
  { key: "vendors", label: "Vendor" },
  { key: "spk", label: "SPK" },
  { key: "deadline", label: "Deadline" },
  { key: "outputs", label: "Output Divisi" },
  { key: "sync", label: "Sync Sheet" },
  { key: "settings", label: "Setting" },
];

/** New WMS "Ops Console" chrome for staff/kadep — sidebar + shared shell.
 *  Sub-pages keep their existing `.pm-scope` styling inside the shell. */
function PermitWmsLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const active = loc.pathname.replace(/^\/permit\/?/, "").split("/")[0];
  const groups: WmsNavGroup[] = [
    {
      heading: "Menu",
      items: SECTIONS.map((s) => ({
        label: s.label,
        active: active === s.key,
        onClick: () => nav(`/permit/${s.key}`),
      })),
    },
  ];
  return (
    <WmsShell brand="Permit" brandSub="Legal & Perizinan" nav={groups}>
      <div className="pm-scope">
        <Outlet />
      </div>
    </WmsShell>
  );
}

export default function PermitApp() {
  const { user } = useAuth();
  // CEO / all-access directors keep the original UI; staff & kadep get the new
  // WMS Ops-Console redesign.
  const wms = !user?.allAccess;
  return (
    <RealtimeProvider url={realtimeURL()}>
      <Routes>
        <Route element={wms ? <PermitWmsLayout /> : <Layout />}>
          <Route index element={wms ? <PermitOverviewWms /> : <DashboardPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="board" element={<BoardView boardName="Semua Divisi" />} />
          <Route path="pt" element={<PTPage />} />
          <Route path="vendors" element={<VendorPage />} />
          <Route path="spk" element={<SPKPage />} />
          <Route path="deadline" element={<DeadlinePage />} />
          <Route path="outputs" element={<OutputsPage />} />
          <Route path="pembelian" element={<PurchasingInbox />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/permit" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  );
}
