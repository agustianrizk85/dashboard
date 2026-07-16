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
import { CicleBoardView } from "./components/views/CicleBoardView";
import { ProjectsView } from "./components/views/ProjectsView";
import { MyTasksView } from "./components/views/MyTasksView";
import { OutputsView } from "./components/views/OutputsView";
import { WorkDrawingsView } from "./components/views/WorkDrawingsView";
import { StaffView } from "./components/views/StaffView";
import { MasterView } from "./components/views/MasterView";
import type { DivisionOutputs, ProjectRollup, Summary } from "./types";
import "./perencanaan.css";

const SECTIONS = [
  { key: "", label: "Ringkasan" },
  { key: "board", label: "Papan Cicle" },
  { key: "projects", label: "Proyek" },
  { key: "tasks", label: "Tugas Saya" },
  { key: "outputs", label: "Output Divisi" },
  { key: "workdrawings", label: "Gambar Kerja" },
  { key: "staff", label: "Tim" },
  { key: "master", label: "Data Master" },
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

  // Staff are never all-access here (that path renders the classic UI), so
  // management rights follow the native role, exactly like Dashboard does.
  const canManage = user?.role === "ceo" || user?.role === "kadep";
  const canEdit = useCallback((pic: string) => canManage || user?.username === pic, [canManage, user]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRollup[]>([]);
  const [outputs, setOutputs] = useState<DivisionOutputs[]>([]);
  const [err, setErr] = useState("");

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
  };

  const groups: WmsNavGroup[] = [
    {
      heading: "Menu",
      items: SECTIONS.map((s) => ({
        label: s.label,
        active: active === s.key,
        onClick: () => nav(`/perencanaan/${s.key}`),
      })),
    },
  ];

  return (
    <WmsShell brand="Perencanaan" brandSub="Design & Deliverable" nav={groups}>
      <PerencanaanDataContext.Provider value={data}>
        {/* key={rev} remounts the active view on each realtime push so the
            self-loading views (Papan, Tugas, Gambar Kerja, Tim, Master) refetch. */}
        <div className="pr-scope" key={rev}>
          {err && <div className="empty-note error" style={{ marginBottom: 12 }}>{err}</div>}
          <Outlet />
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
function TasksSection() {
  const d = usePerencanaanData();
  return <MyTasksView username={d.username} canManage={d.canManage} canEdit={d.canEdit} onChanged={d.reload} />;
}
function OutputsSection() {
  const d = usePerencanaanData();
  return d.outputs.length ? <OutputsView outputs={d.outputs} /> : <Loading />;
}
function WorkDrawingsSection() {
  const d = usePerencanaanData();
  return <WorkDrawingsView projects={d.projects} />;
}
function MasterSection() {
  const d = usePerencanaanData();
  return <MasterView canManage={d.canManage} onChanged={d.reload} />;
}

export default function PerencanaanApp() {
  const { user, logout } = useAuth();
  // CEO / all-access directors keep the original UI; staff & kadep get the new
  // WMS Ops-Console redesign.
  const wms = !user?.allAccess;

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
            <Route index element={<PerencanaanOverviewWms />} />
            <Route path="board" element={<CicleBoardView />} />
            <Route path="projects" element={<ProjectsSection />} />
            <Route path="tasks" element={<TasksSection />} />
            <Route path="outputs" element={<OutputsSection />} />
            <Route path="workdrawings" element={<WorkDrawingsSection />} />
            <Route path="staff" element={<StaffView />} />
            <Route path="master" element={<MasterSection />} />
            <Route path="*" element={<Navigate to="/perencanaan" replace />} />
          </Route>
        </Routes>
      ) : (
        <div className="pr-scope pz-stage">
          <div className="pz-canvas" id="pz-canvas">
            <Dashboard />
          </div>
        </div>
      )}
    </RealtimeProvider>
  );
}
