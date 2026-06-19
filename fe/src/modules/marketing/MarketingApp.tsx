import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider } from "@/lib/realtime";
import type { User, Role } from "./models";
import { realtimeURL } from "./services/api";
import { DesktopShell } from "./components/DesktopShell";
import { MobileApp } from "./components/MobileApp";
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

  return (
    <RealtimeProvider url={realtimeURL()}>
      {MOBILE_POSITIONS.includes(mkUser.position) ? <MobileApp user={mkUser} /> : <DesktopShell user={mkUser} />}
    </RealtimeProvider>
  );
}
