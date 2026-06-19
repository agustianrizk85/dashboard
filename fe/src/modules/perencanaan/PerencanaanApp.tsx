import { useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider } from "@/lib/realtime";
import { api } from "./api/client";
import { Dashboard } from "./components/Dashboard";
import "./perencanaan.css";

export default function PerencanaanApp() {
  const { logout } = useAuth();
  useEffect(() => {
    api.setUnauthorizedHandler(logout); // a 401 from the perencanaan API → shell logout
  }, [logout]);
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
