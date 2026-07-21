import { useCallback, useEffect, useState } from "react";
import type { User, WorkItem, Warning } from "../models";
import { useRev } from "@/lib/realtime";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { workItemService } from "../services/workitem.service";
import { dashboardService } from "../services/dashboard.service";
import { MarketingOverviewWms } from "../MarketingOverviewWms";
import { AlurKerjaView } from "./views/AlurKerjaView";
import { TugasSayaView } from "./views/TugasSayaView";
import { PerformaView } from "../performa/PerformaView";
import { AdsView, WhatsAppView, InstagramView } from "../meta/MetaViews";
import { AccountsView } from "../meta/AccountsView";
import { BoardView } from "@/components/board/BoardView";

type Tab = "overview" | "performa" | "alur" | "tugas" | "board" | "ads" | "wa" | "ig" | "akun";

const SECTIONS: { key: Tab; label: string; group: string }[] = [
  { key: "overview", label: "Ringkasan", group: "Operasional" },
  { key: "performa", label: "Performa Iklan", group: "Operasional" },
  { key: "alur", label: "Alur Kerja", group: "Operasional" },
  { key: "tugas", label: "Tugas Saya", group: "Operasional" },
  { key: "board", label: "Papan Tugas", group: "Operasional" },
  { key: "ads", label: "Iklan (Ads)", group: "Meta" },
  { key: "wa", label: "WhatsApp", group: "Meta" },
  { key: "ig", label: "Instagram", group: "Meta" },
  { key: "akun", label: "Akun Meta", group: "Meta" },
];
const GROUP_ORDER = ["Operasional", "Meta"];

/**
 * New WMS "Ops Console" chrome for non-all-access Marketing staff/kadep — left
 * sidebar (division sections) + shared shell. The landing section (Ringkasan)
 * is the redesigned WMS overview; every other existing view is preserved and
 * rendered inside a `.mk-scope` wrapper so it keeps its original styling.
 *
 * Marketing has no per-section router (it is a single `/marketing/*` route that
 * switches views by local state), so the sidebar drives that same tab state
 * rather than `useNavigate` — the module-native way to reach these views.
 */
export function MarketingWmsShell({ user }: { user: User }) {
  const rev = useRev(); // realtime data revision — bumps on any backend write
  const [tab, setTab] = useState<Tab>("overview");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  // The work-items / warnings endpoints live only on the full marketing backend.
  // A 404 / network error means "module belum aktif" (calm note), not a red error.
  const [inactive, setInactive] = useState(false);

  const reload = useCallback(() => {
    setErr("");
    setInactive(false);
    Promise.all([workItemService.list(), dashboardService.warnings()])
      .then(([list, w]) => {
        setItems(list);
        setWarnings(w.warnings);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (/404/.test(msg) || /failed to fetch/i.test(msg) || /network/i.test(msg)) setInactive(true);
        else setErr(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch whenever the realtime revision bumps (any marketing backend write).
  useEffect(reload, [reload, rev]);

  const groups: WmsNavGroup[] = GROUP_ORDER.map((g) => ({
    heading: g,
    items: SECTIONS.filter((s) => s.group === g).map((s) => ({
      label: s.label,
      active: tab === s.key,
      onClick: () => setTab(s.key),
    })),
  }));

  const canEdit = user.role !== "viewer";
  const canReset = user.role === "kadep";

  return (
    <WmsShell brand="Marketing" brandSub="Departemen Marketing" nav={groups}>
      {/* key={rev} remounts the active view on each realtime push so the
          self-loading views (Tugas Saya, Meta tabs) also refetch live.
          EXCLUDED: Papan Tugas — BoardView refreshes in place via its own
          realtime socket, so an open card modal survives pushes. */}
      <div className="mk-scope" key={tab === "board" ? "board" : rev}>
        {err && <div className="empty-note error">{err}</div>}
        {inactive && (tab === "overview" || tab === "alur" || tab === "tugas") && (
          <div className="empty-note">
            📭 Modul <b>Alur Kerja</b> marketing belum aktif di server (backend work-items belum di-deploy). Tab{" "}
            <b>Iklan / WhatsApp / Instagram</b> tetap jalan. Datanya menyusul saat backend online.
          </div>
        )}
        {tab === "overview" && (
          <MarketingOverviewWms items={items} warnings={warnings} loading={loading} inactive={inactive} onOpenWorkflow={() => setTab("alur")} />
        )}
        {tab === "performa" && <PerformaView items={items} warnings={warnings} />}
        {tab === "alur" && <AlurKerjaView items={items} canEdit={canEdit} canReset={canReset} onChanged={reload} />}
        {tab === "tugas" && <TugasSayaView user={user} canEdit={canEdit} onChanged={reload} />}
        {tab === "board" && <BoardView boardName="Semua Divisi" />}
        {tab === "ads" && <AdsView />}
        {tab === "wa" && <WhatsAppView />}
        {tab === "ig" && <InstagramView />}
        {tab === "akun" && <AccountsView user={user} />}
      </div>
    </WmsShell>
  );
}
