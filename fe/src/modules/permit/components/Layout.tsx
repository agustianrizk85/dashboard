import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useRev } from "@/lib/realtime";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { AiGenerateButton } from "@/ai/AiGenerate";

const roleLabel: Record<string, string> = {
  ceo: "CEO",
  dirops: "Direktur Operasional",
  kadep: "Kepala Departemen",
  legal_permit: "Legal Permit",
};

const NAV = [
  { to: "/permit", label: "Dashboard", end: true },
  { to: "/permit/pt", label: "Master PT" },
  { to: "/permit/vendors", label: "Vendor" },
  { to: "/permit/spk", label: "SPK" },
  { to: "/permit/deadline", label: "Deadline" },
  { to: "/permit/pembelian", label: "Pembelian" },
  { to: "/permit/sync", label: "Sync Sheet" },
  { to: "/permit/settings", label: "Setting" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="clock">
      <div className="t">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
      <div className="d">
        {now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const rev = useRev(); // realtime data revision — bumps on any backend write
  // All-access directors (CEO/Dirops) only need the dashboard, not the menus.
  const nav = user?.allAccess ? NAV.filter((n) => n.to === "/permit") : NAV;
  return (
    <div className="app pm-scope">
      <header className="hdr">
        <div className="hdr-logo">
          <img src="/brand/logo-mark.png" alt="Greenpark Group" />
        </div>
        <div className="hdr-titles">
          <h1>Legal Permit System</h1>
          <div className="sub">Greenpark Group · Departemen Legal &amp; Perizinan</div>
          <div className="tag">PRA-AKAD · AKAD · PERMIT · LEGAL</div>
        </div>
        <div className="hdr-spacer" />
        <AiGenerateButton division="permit" />
        <div className="hdr-meta">
          <Clock />
          <div className="hdr-user">
            <div className="hu-name">{user?.name}</div>
            <div className="hu-role">{user ? roleLabel[user.role] ?? user.role : ""}</div>
          </div>
          <button className="logout-btn" onClick={logout} title="Keluar">
            ✕
          </button>
        </div>
      </header>

      <DivisionTabBar navClass="topnav">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? "navlink active" : "navlink")}
          >
            {n.label}
          </NavLink>
        ))}
      </DivisionTabBar>

      {/* key={rev} remounts the active page on each realtime push so every
          permit page (which loads its own data) refetches live. */}
      <main className="content" key={rev}>
        <Outlet />
      </main>
    </div>
  );
}
