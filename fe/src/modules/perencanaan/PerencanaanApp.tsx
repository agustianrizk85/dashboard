import { useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider } from "@/lib/realtime";
import { api } from "./api/client";
import { Dashboard } from "./components/Dashboard";
import "./perencanaan.css";

export default function PerencanaanApp() {
  const { user, logout } = useAuth();
  useEffect(() => {
    // A 401 from the perencanaan API normally ends the dashboard session. But an
    // all-access director (CEO/Dirops) merely browsing this division must NOT be
    // logged out globally when this module's token is missing (e.g. the SSO
    // bridge is unavailable) — let the module surface its own error instead.
    // Native single-division perencanaan users are still logged out (correct).
    api.setUnauthorizedHandler(user?.allAccess ? () => {} : logout);
  }, [logout, user]);
  return (
    <RealtimeProvider url={api.realtimeURL()}>
      <div className="pz-stage">
        <div className="pz-canvas" id="pz-canvas">
          <Dashboard />
        </div>
      </div>
    </RealtimeProvider>
  );
}
