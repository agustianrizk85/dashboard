import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { RealtimeProvider, useRev } from "@/lib/realtime";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { api } from "./api/client";
import { Dashboard } from "./components/Dashboard";
import { PerencanaanOverviewWms } from "./PerencanaanOverviewWms";
import { PerencanaanDataContext } from "./PerencanaanWmsData";
import type { PerencanaanData } from "./PerencanaanWmsData";
import { usePerencanaanData } from "./PerencanaanWmsData";
import { ProjectsView } from "./components/views/ProjectsView";
import { OutputsView } from "./components/views/OutputsView";
import { WorkDrawingsView } from "./components/views/WorkDrawingsView";
import { StaffView } from "./components/views/StaffView";
import { MasterView } from "./components/views/MasterView";
import { SkillView } from "./components/views/SkillView";
import { ModelView } from "./components/views/ModelView";
import { BoardView } from "@/components/board/BoardView";
import { ChatView } from "@/messaging/ChatView";
import { MessagesPane } from "@/messaging/MessagesPane";
import { chatApi, subscribeChat } from "@/messaging/api";
import { usePicRoster } from "./lib/roster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { DivisionOutputs, ProjectRollup, Summary } from "./types";
import "./perencanaan.css";

// Base menu — every account in the department sees these, Kadep or not.
const COMMON_SECTIONS = [
  { key: "", label: "Ringkasan" },
  { key: "projects", label: "Proyek" },
  // "Tugas Saya" is now folded into the unified board: the caller's formal
  // deliverable tasks appear as cards on "Papan Tugas" (status columns).
  { key: "board", label: "Papan Tugas" },
  { key: "outputs", label: "Output Divisi" },
  { key: "workdrawings", label: "Gambar Kerja" },
];

// Extra manager-only sections appended after the common menu (Kadep/CEO).
const MANAGER_SECTIONS = [
  { key: "staff", label: "Tim" },
  { key: "master", label: "Data Master" },
];

const SECTIONS = [...COMMON_SECTIONS, ...MANAGER_SECTIONS];

// AI tools (Kadep/CEO only) — grouped under an "AI" heading in the sidebar.
const AI_SECTIONS = [
  { key: "skill", label: "Skill" },
  { key: "model", label: "Model" },
];

function Loading() {
  return (
    <div className="empty-note">
      <div className="spinner" /> Memuat…
    </div>
  );
}

/** New WMS "Ops Console" chrome for staff/kadep — sidebar + shared shell. Loads
 *  the portfolio data once (like the classic Dashboard) and shares it with the
 *  overview + section routes via context. Sub-pages keep their `.pr-scope`
 *  styling inside the shell. */
function PerencanaanWmsLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const rev = useRev(); // realtime revision — bumps on any backend write

  const active = loc.pathname.replace(/^\/perencanaan\/?/, "").split("/")[0];

  // Department roster from the SSO sync — drives PIC pickers + display names.
  const roster = usePicRoster(rev);

  // Staff are never all-access here (that path renders the classic UI), so
  // management rights follow the native role, exactly like Dashboard does.
  const canManage = user?.role === "ceo" || user?.role === "kadep";
  const canEdit = useCallback((pic: string) => canManage || user?.username === pic, [canManage, user]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRollup[]>([]);
  const [outputs, setOutputs] = useState<DivisionOutputs[]>([]);
  const [err, setErr] = useState("");

  // Chat / Kotak Masuk unread badges — refreshed realtime by the chat SSE stream.
  const [chanUnread, setChanUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const refreshChatCounts = useCallback(() => {
    chatApi.channels().then((cs) => setChanUnread(cs.reduce((n, c) => n + c.unread, 0))).catch(() => {});
    chatApi.conversations().then((cs) => setDmUnread(cs.reduce((n, c) => n + c.unread, 0))).catch(() => {});
  }, []);
  useEffect(() => {
    refreshChatCounts();
  }, [refreshChatCounts]);
  useEffect(() => subscribeChat(refreshChatCounts), [refreshChatCounts]);

  const reload = useCallback(() => {
    Promise.all([api.summary(), api.projects(), api.outputs()])
      .then(([s, p, o]) => {
        setSummary(s);
        setProjects(p);
        setOutputs(o);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  // Re-run whenever the realtime revision bumps (any backend write).
  useEffect(reload, [reload, rev]);

  const data: PerencanaanData = {
    summary,
    projects,
    outputs,
    err,
    reload,
    canManage,
    canEdit,
    username: user?.username ?? "",
    roster,
  };

  // Managers (Kadep) see the full operational menu; staff get the common menu
  // (Ringkasan, Proyek, Papan Tugas, Output Divisi) without the manager-only tools.
  const menu = canManage ? SECTIONS : COMMON_SECTIONS;
  const groups: WmsNavGroup[] = [
    {
      heading: "Menu",
      items: menu.map((s) => ({
        label: s.label,
        active: active === s.key,
        onClick: () => nav(`/perencanaan/${s.key}`),
      })),
    },
    ...(canManage
      ? [
          {
            heading: "AI",
            items: AI_SECTIONS.map((s) => ({
              label: s.label,
              active: active === s.key,
              onClick: () => nav(`/perencanaan/${s.key}`),
            })),
          },
        ]
      : []),
    {
      heading: "Komunikasi",
      items: [
        { label: "Chat", active: active === "chat", onClick: () => nav("/perencanaan/chat"), badge: chanUnread },
        { label: "Kotak Masuk", active: active === "inbox", onClick: () => nav("/perencanaan/inbox"), badge: dmUnread },
      ],
    },
  ];

  return (
    <WmsShell brand="Perencanaan" brandSub="Design & Deliverable" nav={groups}>
      <PerencanaanDataContext.Provider value={data}>
        {/* key={rev} remounts the active view on each realtime push so the
            self-loading views (Papan, Tim) refetch. EXCLUDED from the remount:
            Data Master (self-reloads on its own edits), Tugas / Gambar Kerja
            (they refetch in place via a `rev` prop instead — so an open Deep
            Analisis / Deep Revisi AI modal isn't unmounted mid-run) and the
            Papan Tugas board (refetches in place via useRev, so an open card
            modal survives realtime pushes). */}
        <div
          className="pr-scope"
          key={
            active === "master" || active === "workdrawings" || active === "board"
              ? active
              : rev
          }
        >
          {err && <div className="empty-note error" style={{ marginBottom: 12 }}>{err}</div>}
          <ErrorBoundary key={active}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </PerencanaanDataContext.Provider>
    </WmsShell>
  );
}

/* ---- Section routes: reuse the existing views with the shared data ---------- */

function ProjectsSection() {
  const d = usePerencanaanData();
  return <ProjectsView projects={d.projects} canManage={d.canManage} canEdit={d.canEdit} onChanged={d.reload} />;
}
function OutputsSection() {
  const d = usePerencanaanData();
  return d.outputs.length ? <OutputsView outputs={d.outputs} /> : <Loading />;
}
function WorkDrawingsSection() {
  const d = usePerencanaanData();
  const rev = useRev();
  return <WorkDrawingsView projects={d.projects} pics={d.roster.filter((r) => r.isPic)} rev={rev} />;
}
function MasterSection() {
  const d = usePerencanaanData();
  return <MasterView canManage={d.canManage} onChanged={d.reload} />;
}
function SkillSection() {
  const d = usePerencanaanData();
  return <SkillView canManage={d.canManage} />;
}

export default function PerencanaanApp() {
  const { user, logout } = useAuth();
  // CEO / all-access directors keep the original UI; staff & kadep get the new
  // WMS Ops-Console redesign.
  const wms = !user?.allAccess;
  // Only Kadep gets the full operational menu; other staff (arsitek/drafter) are
  // limited to their own tasks + Chat + Kotak Masuk.
  const canManage = user?.role === "ceo" || user?.role === "kadep";

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
      {wms ? (
        <Routes>
          <Route element={<PerencanaanWmsLayout />}>
            {canManage ? (
              <>
                <Route index element={<PerencanaanOverviewWms />} />
                <Route path="projects" element={<ProjectsSection />} />
                {/* Tugas Saya melebur ke Papan Tugas — jaga bookmark lama. */}
                <Route path="tasks" element={<Navigate to="/perencanaan/board" replace />} />
                <Route path="board" element={<BoardView boardName="Departemen Perencanaan" />} />
                <Route path="outputs" element={<OutputsSection />} />
                <Route path="workdrawings" element={<WorkDrawingsSection />} />
                <Route path="staff" element={<StaffView />} />
                <Route path="master" element={<MasterSection />} />
                <Route path="skill" element={<SkillSection />} />
                <Route path="model" element={<ModelView />} />
              </>
            ) : (
              <>
                {/* Staff: common menu (Ringkasan, Proyek, Papan Tugas, Output Divisi,
                    Gambar Kerja) — read-only where relevant (canManage=false gates edit
                    controls inside each view). Tim / Data Master stay manager-only. */}
                <Route index element={<PerencanaanOverviewWms />} />
                <Route path="projects" element={<ProjectsSection />} />
                <Route path="tasks" element={<Navigate to="/perencanaan/board" replace />} />
                <Route path="board" element={<BoardView boardName="Departemen Perencanaan" />} />
                <Route path="outputs" element={<OutputsSection />} />
                <Route path="workdrawings" element={<WorkDrawingsSection />} />
              </>
            )}
            {/* Communication tools available to everyone. */}
            <Route path="chat" element={<ChatView />} />
            <Route path="inbox" element={<MessagesPane mode="dms" />} />
            <Route path="*" element={<Navigate to="/perencanaan" replace />} />
          </Route>
        </Routes>
      ) : (
        <div className="pr-scope pz-stage">
          <div className="pz-canvas" id="pz-canvas">
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          </div>
        </div>
      )}
    </RealtimeProvider>
  );
}
