import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const TABS: { path: string; label: string }[] = [
  { path: "/perencanaan", label: "Perencanaan" },
  { path: "/permit", label: "Legal & Permit" },
  { path: "/marketing", label: "Marketing" },
  { path: "/sales", label: "Sales" },
  { path: "/keuangan", label: "Keuangan" },
  { path: "/teknik", label: "Teknik" },
  { path: "/cso", label: "CSO" },
  // Cross-division AI orchestrator (directors only). Set apart visually.
  { path: "/orchestrator", label: "Orchestrator AI" },
  // Cross-division approval inbox (directors only). Set apart visually.
  { path: "/approvals", label: "Persetujuan" },
  // Admin panel: user management + the ONE central AI key. Set apart visually.
  { path: "/admin", label: "⚙ Admin" },
];

/**
 * The all-access director's dashboard switch, rendered INSIDE each module's
 * nav/tab bar (left-aligned). Renders nothing for normal single-division users.
 * Includes the cross-division "Persetujuan" (approval inbox) tab.
 */
export function DivisionTabs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user?.allAccess) return null;
  return (
    <div className="divtabs">
      {TABS.map((t) => {
        const active = location.pathname.startsWith(t.path);
        const accent = t.path === "/approvals" ? "divtab-approvals" : t.path === "/orchestrator" ? "divtab-orchestrator" : t.path === "/admin" ? "divtab-admin" : "";
        return (
          <button
            key={t.path}
            className={`divtab ${active ? "on" : ""} ${accent}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
