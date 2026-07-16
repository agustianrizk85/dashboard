import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const TABS: { path: string; label: string }[] = [
  // Director home / console — the launcher into every division + director tools.
  { path: "/console", label: "Beranda" },
  { path: "/perencanaan", label: "Perencanaan" },
  { path: "/permit", label: "Legal & Permit" },
  { path: "/marketing", label: "Marketing" },
  { path: "/sales", label: "Sales" },
  { path: "/keuangan", label: "Keuangan" },
  { path: "/teknik", label: "Teknik" },
  { path: "/cso", label: "CSO" },
  // Cross-division AI orchestrator (directors only). Set apart visually.
  { path: "/orchestrator", label: "Orchestrator AI" },
  // Cross-division approval inbox — now a view INSIDE the director Console.
  { path: "/console/persetujuan", label: "Persetujuan" },
];

// Admin panel (user management + the ONE central AI key) is the SUPERADMIN's
// job, not the directors' — so it's appended only for super users.
const ADMIN_TAB = { path: "/admin", label: "⚙ Admin" };

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
  const tabs = user.super ? [...TABS, ADMIN_TAB] : TABS;
  return (
    <div className="divtabs">
      {tabs.map((t) => {
        // "/console" (Beranda) is a prefix of the other console views, so match it
        // exactly; everything else highlights on prefix as before.
        const active = t.path === "/console" ? location.pathname === "/console" : location.pathname.startsWith(t.path);
        const accent = t.path === "/console/persetujuan" ? "divtab-approvals" : t.path === "/orchestrator" ? "divtab-orchestrator" : t.path === "/admin" ? "divtab-admin" : "";
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
