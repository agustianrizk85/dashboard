import { Navigate, Route, Routes } from "react-router-dom";
import { RealtimeProvider } from "@/lib/realtime";
import { realtimeURL } from "@/modules/permit/services/api";
import { Layout } from "@/modules/permit/components/Layout";
import { DashboardPage } from "@/modules/permit/pages/DashboardPage";
import { ProjectDetailPage } from "@/modules/permit/pages/ProjectDetailPage";
import { PTPage } from "@/modules/permit/pages/PTPage";
import { VendorPage } from "@/modules/permit/pages/VendorPage";
import { SPKPage } from "@/modules/permit/pages/SPKPage";
import { DeadlinePage } from "@/modules/permit/pages/DeadlinePage";
import { SettingsPage } from "@/modules/permit/pages/SettingsPage";
import "./permit.css";

export default function PermitApp() {
  return (
    <RealtimeProvider url={realtimeURL()}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="pt" element={<PTPage />} />
          <Route path="vendors" element={<VendorPage />} />
          <Route path="spk" element={<SPKPage />} />
          <Route path="deadline" element={<DeadlinePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/permit" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  );
}
