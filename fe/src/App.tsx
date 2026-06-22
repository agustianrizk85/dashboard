import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Division, SessionUser } from "@/auth/AuthContext";
import { Login } from "@/components/Login";
import { LoadingSplash } from "@/components/Splash";

// Each division's module is code-split: only the logged-in division's bundle
// (and its CSS) is ever loaded, which keeps the two design systems isolated.
const PerencanaanApp = lazy(() => import("@/modules/perencanaan/PerencanaanApp"));
const PermitApp = lazy(() => import("@/modules/permit/PermitApp"));
const MarketingApp = lazy(() => import("@/modules/marketing/MarketingApp"));
const SalesApp = lazy(() => import("@/modules/sales/SalesApp"));
const KeuanganApp = lazy(() => import("@/modules/keuangan/KeuanganApp"));
const ApprovalsApp = lazy(() => import("@/approvals/ApprovalsApp"));
const RekapApp = lazy(() => import("@/modules/rekap/RekapApp"));
const AiImportApp = lazy(() => import("@/modules/aiimport/AiImportApp"));
const AdminApp = lazy(() => import("@/modules/admin/AdminApp"));

/** Where a given division's full dashboard lives. */
function homePath(division: Division): string {
  return `/${division}`;
}

/** Where a user lands on login. The CEO's home is the Marketing performance
 *  dashboard (Performa Iklan); everyone else lands on their own division. */
function landingPath(user: SessionUser): string {
  if (user.role === "ceo") return "/marketing";
  return homePath(user.division);
}

/** Gate a route to all-access directors (CEO / Dirops) only. */
function RequireAllAccess({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "checking") return <LoadingSplash label="Memeriksa sesi…" />;
  if (status === "out" || !user) return <Navigate to="/login" replace />;
  if (!user.allAccess) return <Navigate to={homePath(user.division)} replace />;
  return <Suspense fallback={<LoadingSplash />}>{children}</Suspense>;
}

/** Gate a module route: must be logged in AND belong to that division — unless
 *  the user is an all-access director (CEO / Dirops), who may open any division. */
function RequireDivision({ division, children }: { division: Division; children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "checking") return <LoadingSplash label="Memeriksa sesi…" />;
  if (status === "out" || !user) return <Navigate to="/login" replace />;
  if (user.division !== division && !user.allAccess) return <Navigate to={homePath(user.division)} replace />;
  return <Suspense fallback={<LoadingSplash />}>{children}</Suspense>;
}

/** "/" and "/login" behaviour depends on the current session. */
function RootRedirect() {
  const { status, user } = useAuth();
  if (status === "checking") return <LoadingSplash label="Memeriksa sesi…" />;
  if (status === "in" && user) return <Navigate to={landingPath(user)} replace />;
  return <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { status, user } = useAuth();
  if (status === "checking") return <LoadingSplash label="Memeriksa sesi…" />;
  if (status === "in" && user) return <Navigate to={landingPath(user)} replace />;
  return <Login />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/perencanaan/*"
          element={
            <RequireDivision division="perencanaan">
              <PerencanaanApp />
            </RequireDivision>
          }
        />
        <Route
          path="/permit/*"
          element={
            <RequireDivision division="permit">
              <PermitApp />
            </RequireDivision>
          }
        />
        <Route
          path="/marketing/*"
          element={
            <RequireDivision division="marketing">
              <MarketingApp />
            </RequireDivision>
          }
        />
        <Route
          path="/sales/*"
          element={
            <RequireDivision division="sales">
              <SalesApp />
            </RequireDivision>
          }
        />
        <Route
          path="/keuangan/*"
          element={
            <RequireDivision division="keuangan">
              <KeuanganApp />
            </RequireDivision>
          }
        />
        <Route
          path="/approvals/*"
          element={
            <RequireAllAccess>
              <ApprovalsApp />
            </RequireAllAccess>
          }
        />
        <Route
          path="/rekap/*"
          element={
            <RequireAllAccess>
              <RekapApp />
            </RequireAllAccess>
          }
        />
        <Route
          path="/ai-import/*"
          element={
            <RequireAllAccess>
              <AiImportApp />
            </RequireAllAccess>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireAllAccess>
              <AdminApp />
            </RequireAllAccess>
          }
        />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
