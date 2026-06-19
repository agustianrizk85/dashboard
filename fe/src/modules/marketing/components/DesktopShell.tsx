import { useCallback, useEffect, useState } from "react";
import type { User, WorkItem, Warning } from "../models";
import { useAuth } from "@/auth/AuthContext";
import { useRev } from "@/lib/realtime";
import { workItemService } from "../services/workitem.service";
import { dashboardService } from "../services/dashboard.service";
import { AlurKerjaView } from "./views/AlurKerjaView";
import { TugasSayaView } from "./views/TugasSayaView";
import { PerformaView } from "../performa/PerformaView";
import { AdsView, WhatsAppView, InstagramView } from "../meta/MetaViews";
import { DivisionTabs } from "@/components/DivisionTabs";
import { FinanceStrip } from "@/components/FinanceStrip";

type Tab = "ringkasan" | "alur" | "tugas" | "ads" | "wa" | "ig";

const roleLabel: Record<string, string> = {
  kadep: "Kepala Departemen",
  staff: "Tim Marketing",
  viewer: "Viewer",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const t = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const d = now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="clock">
      <div className="t">{t}</div>
      <div className="d">{d}</div>
    </div>
  );
}

export function DesktopShell({ user }: { user: User }) {
  const { user: session, logout } = useAuth();
  const allAccess = !!session?.allAccess;
  const rev = useRev(); // realtime data revision — bumps on any backend write

  // Directors & managers land on the unified Ringkasan dashboard (content ops +
  // ad performance, merged); staff start on their task board.
  const [tab, setTab] = useState<Tab>(allAccess || user.role !== "staff" ? "ringkasan" : "tugas");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [err, setErr] = useState("");

  const reload = useCallback(() => {
    Promise.all([workItemService.list(), dashboardService.warnings()])
      .then(([list, w]) => {
        setItems(list);
        setWarnings(w.warnings);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  // Re-fetch whenever the realtime revision bumps (any marketing backend write).
  useEffect(reload, [reload, rev]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "ringkasan", label: "Ringkasan" },
    { key: "alur", label: "Alur Kerja" },
    { key: "tugas", label: "Tugas Saya" },
    { key: "ads", label: "Iklan (Ads)" },
    { key: "wa", label: "WhatsApp" },
    { key: "ig", label: "Instagram" },
  ];
  // Directors get the overview + live Meta tabs, no operational task tabs.
  const visibleTabs = allAccess
    ? TABS.filter((t) => t.key === "ringkasan" || t.key === "ads" || t.key === "wa" || t.key === "ig")
    : TABS;

  return (
    <div className="mk-stage">
      <div className="mk-canvas">
        <header className="hdr">
          <div className="hdr-logo"><img src="/brand/logo-mark.png" alt="Greenpark Group" /></div>
          <div className="hdr-titles">
            <h1>Alur Kerja Marketing</h1>
            <div className="sub">Greenpark Group · Departemen Marketing</div>
            <div className="tag">IKLAN BERBAYAR · KONTEN ORGANIK · LEAD</div>
          </div>
          <div className="hdr-spacer" />
          <div className="hdr-meta">
            <div className="badge-target">
              {items.length}
              <small>KONTEN</small>
            </div>
            <Clock />
            <div className="hdr-user">
              <div className="hu-name">{user.position || user.name}</div>
              <div className="hu-role">{roleLabel[user.role] ?? user.role}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Keluar">
              ✕
            </button>
          </div>
        </header>

        <nav className="tabs">
          {visibleTabs.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
          <DivisionTabs />
        </nav>

        {/* key={rev} remounts the active view on each realtime push so the
            self-loading "Tugas Saya" board also refetches live. */}
        <main className="content" key={rev}>
          {err && <div className="empty-note error">{err}</div>}
          {/* All-access directors get a cross-division finance ringkasan on the landing. */}
          {allAccess && tab === "ringkasan" && <FinanceStrip />}
          {tab === "ringkasan" && <PerformaView items={items} warnings={warnings} />}
          {tab === "alur" && <AlurKerjaView items={items} canEdit={user.role !== "viewer"} onChanged={reload} />}
          {tab === "tugas" && <TugasSayaView user={user} canEdit={user.role !== "viewer"} onChanged={reload} />}
          {tab === "ads" && <AdsView />}
          {tab === "wa" && <WhatsAppView />}
          {tab === "ig" && <InstagramView />}
        </main>
      </div>
    </div>
  );
}
