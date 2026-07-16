import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Division } from "@/auth/AuthContext";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { ApprovalsPanel } from "@/approvals/ApprovalsPanel";
import { ChatView } from "@/messaging/ChatView";
import { InboxView } from "./InboxView";
import { chatApi, subscribeChat } from "@/messaging/api";
import { loadAllApprovals, realtimeURLs } from "@/approvals/adapters";
import { useRealtimeSocket } from "@/lib/realtime";
import "@/components/wms/wms.css";
import "./console.css";

/**
 * Director Console — the home for all-access directors (CEO / Dirops). Instead
 * of the platform Admin panel (that's the superadmin's job) they land here: a
 * launcher into every division dashboard plus the cross-division director tools
 * — Persetujuan (the existing /approvals inbox), Chat and Kotak Masuk. Routed at
 * /console, gated to all-access users in App.tsx.
 */

type View = "beranda" | "persetujuan" | "chat" | "inbox";

interface DivLink {
  division: Division;
  label: string;
  desc: string;
  initial: string;
}

// Every division the directors can open, with the same labels the cross-division
// switcher (DivisionTabs) uses. Clicking a tile/menu opens that dashboard.
const DIVISIONS: DivLink[] = [
  { division: "perencanaan", label: "Perencanaan", desc: "Desain & gambar kerja", initial: "P" },
  { division: "permit", label: "Legal & Perizinan", desc: "Izin & dokumen legal", initial: "L" },
  { division: "marketing", label: "Marketing", desc: "Iklan & konten", initial: "M" },
  { division: "sales", label: "Sales", desc: "Penjualan & Control Tower", initial: "S" },
  { division: "keuangan", label: "Keuangan", desc: "Akad/KPR & arus kas", initial: "K" },
  { division: "teknik", label: "Teknik", desc: "Progres pembangunan", initial: "T" },
  { division: "cso", label: "CSO", desc: "Komplain pelanggan", initial: "C" },
];

export default function ConsoleApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const go = (path: string) => navigate(path);

  // The active view is driven by the URL sub-path (/console, /console/persetujuan,
  // …) so it's linkable AND the cross-division switcher (DivisionTabs) can point
  // straight at it. The divisions themselves are separate apps, so those items
  // navigate away instead of switching a view here.
  const sub = location.pathname.replace(/^\/console\/?/, "").split("/")[0];
  const view: View =
    sub === "persetujuan" ? "persetujuan" : sub === "chat" ? "chat" : sub === "inbox" ? "inbox" : "beranda";

  const roleLabel =
    user?.role === "ceo" ? "Direktur Utama" : user?.role === "dirops" ? "Direktur Operasional" : "Direktur";

  // Live counts for the sidebar badges, refreshed realtime by the chat SSE
  // stream + the division approval sockets. Chat badge = unread division
  // channels; Kotak Masuk badge = unread direct messages (per person);
  // Persetujuan badge = pending cross-division approvals.
  const [dmUnread, setDmUnread] = useState(0);
  const [chanUnread, setChanUnread] = useState(0);
  const [apprCount, setApprCount] = useState(0);
  const refreshCounts = useCallback(() => {
    chatApi.conversations().then((cs) => setDmUnread(cs.reduce((n, c) => n + c.unread, 0))).catch(() => {});
    chatApi.channels().then((cs) => setChanUnread(cs.reduce((n, c) => n + c.unread, 0))).catch(() => {});
    loadAllApprovals()
      .then((loads) => setApprCount(loads.reduce((n, l) => n + l.items.length, 0)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);
  useEffect(() => subscribeChat(refreshCounts), [refreshCounts]);
  const ws = realtimeURLs();
  useRealtimeSocket(ws.perencanaan, refreshCounts);
  useRealtimeSocket(ws.permit, refreshCounts);
  useRealtimeSocket(ws.marketing, refreshCounts);

  const nav: WmsNavGroup[] = [
    {
      heading: "Ringkasan",
      items: [{ label: "Beranda", active: view === "beranda", onClick: () => go("/console") }],
    },
    {
      heading: "Divisi",
      items: DIVISIONS.map((d) => ({ label: d.label, onClick: () => go(`/${d.division}`) })),
    },
    {
      heading: "Kantor Direktur",
      items: [
        { label: "Persetujuan", active: view === "persetujuan", onClick: () => go("/console/persetujuan"), badge: apprCount },
        { label: "Chat", active: view === "chat", onClick: () => go("/console/chat"), badge: chanUnread },
        { label: "Kotak Masuk", active: view === "inbox", onClick: () => go("/console/inbox"), badge: dmUnread },
      ],
    },
  ];

  return (
    <WmsShell brand="Kantor Direktur" brandSub={roleLabel} nav={nav}>
      {view === "beranda" && <Beranda name={user?.name} roleLabel={roleLabel} go={go} />}
      {view === "persetujuan" && <ApprovalsPanel />}
      {view === "chat" && <ChatView />}
      {view === "inbox" && <InboxView />}
    </WmsShell>
  );
}

function Beranda({ name, roleLabel, go }: { name?: string; roleLabel: string; go: (path: string) => void }) {
  return (
    <>
      <div className="con-hi">
        <h1>Halo, {name || "Direktur"} 👋</h1>
        <p>{roleLabel} · akses semua divisi Greenpark Group</p>
      </div>

      <div className="con-sech">Buka Divisi</div>
      <div className="con-launch">
        {DIVISIONS.map((d) => (
          <button key={d.division} className="con-tile" onClick={() => go(`/${d.division}`)} type="button">
            <span className="con-ic">{d.initial}</span>
            <b>{d.label}</b>
            <span>{d.desc}</span>
            <span className="t-go">Buka dashboard →</span>
          </button>
        ))}
      </div>

      <div className="con-sech">Kantor Direktur</div>
      <div className="wms-grid">
        <div className="wms-card wms-col-6">
          <div className="con-cta">
            <span className="con-ic">✓</span>
            <div className="c-txt">
              <b>Pusat Persetujuan</b>
              <p>Tinjau &amp; setujui pengajuan yang menunggu dari seluruh divisi.</p>
            </div>
            <button className="wms-btn" onClick={() => go("/console/persetujuan")} type="button">
              Buka
            </button>
          </div>
        </div>
        <div className="wms-card wms-col-3">
          <div className="con-cta">
            <span className="con-ic">💬</span>
            <div className="c-txt">
              <b>Chat</b>
              <p>Obrolan grup per divisi.</p>
            </div>
            <button className="wms-btn ghost" onClick={() => go("/console/chat")} type="button">
              Buka
            </button>
          </div>
        </div>
        <div className="wms-card wms-col-3">
          <div className="con-cta">
            <span className="con-ic">📥</span>
            <div className="c-txt">
              <b>Kotak Masuk</b>
              <p>Pesan pribadi (japri) per orang.</p>
            </div>
            <button className="wms-btn ghost" onClick={() => go("/console/inbox")} type="button">
              Buka
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
