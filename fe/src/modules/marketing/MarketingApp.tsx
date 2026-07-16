import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider } from "@/lib/realtime";
import type { User, Role } from "./models";
import { realtimeURL } from "./services/api";
import { DesktopShell } from "./components/DesktopShell";
import { MobileApp } from "./components/MobileApp";
import { MarketingWmsShell } from "./components/MarketingWmsShell";
import "./styles.base.css";
import "./styles.marketing.css";

// Field roles use the touch-first mobile layout; everyone else gets the desktop shell.
const MOBILE_POSITIONS = ["Talent", "Videografer"];

export default function MarketingApp() {
  const { user } = useAuth();
  if (!user) return null; // shell guards this route; defensive only

  // Adapt the shared session identity to the marketing User shape the views expect.
  // All-access directors have no native Marketing role: Dirops views as Kadep
  // (may approve), CEO views as a read-only viewer (overview only).
  const mkRole: Role = user.role === "dirops" ? "kadep" : user.role === "ceo" ? "viewer" : (user.role as Role);
  const mkUser: User = {
    id: 0,
    name: user.name,
    email: user.email ?? user.username,
    role: mkRole,
    position: user.position ?? "",
    created_at: "",
    updated_at: "",
  };

  // GATE: CEO / all-access directors keep the ORIGINAL marketing UI unchanged
  // (DesktopShell, or MobileApp for field roles). Non-all-access marketing staff
  // get the new WMS "Ops Console" redesign. Field roles (Talent / Videografer)
  // keep their touch-first MobileApp on both paths.
  const wms = !user.allAccess;
  const mobile = MOBILE_POSITIONS.includes(mkUser.position);

  return (
    <RealtimeProvider url={realtimeURL()}>
      {mobile ? <MobileApp user={mkUser} /> : wms ? <MarketingWmsShell user={mkUser} /> : <DesktopShell user={mkUser} />}
    </RealtimeProvider>
  );
}
