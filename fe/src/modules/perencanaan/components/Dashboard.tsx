import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useRev } from "@/lib/realtime";
import { usePicRoster } from "../lib/roster";
import { DivisionTabBar } from "@/components/DivisionTabBar";
import { api } from "../api/client";
import type { DivisionOutputs, ProjectRollup, Summary } from "../types";
import { roleLabel } from "../lib/format";
import { Clock } from "./Clock";
import { Icon } from "./Icon";
import { Tooltip } from "./ui";
import { Modal } from "./Modal";
import { SummaryView } from "./views/SummaryView";
import { ProjectsView } from "./views/ProjectsView";
import { MyTasksView } from "./views/MyTasksView";
import { OutputsView } from "./views/OutputsView";
import { WorkDrawingsView } from "./views/WorkDrawingsView";
import { StaffView } from "./views/StaffView";
import { MasterView } from "./views/MasterView";
import { SkillView } from "./views/SkillView";
import { AiGenerateButton } from "@/ai/AiGenerate";
import { PurchasingInbox } from "@/purchasing/PurchasingInbox";
import { BoardView } from "@/components/board/BoardView";

type Tab = "summary" | "projects" | "tasks" | "board" | "outputs" | "workdrawings" | "staff" | "master" | "pembelian" | "skill";

const TABS: { key: Tab; label: string; icon: string; tip: string }[] = [
  { key: "summary", label: "Ringkasan", icon: "grid", tip: "PROSES · Snapshot portfolio: progress rata-rata, beban tiap author, kesiapan output divisi, dan ringkasan alert." },
  { key: "projects", label: "Proyek", icon: "layers", tip: "PROSES · Pohon deliverable per proyek — ubah status tugas (Belum/Proses/Review/Selesai). Tambah proyek master di sini." },
  { key: "tasks", label: "Tugas Saya", icon: "list", tip: "PROSES · Pembagian tugas berdasarkan akun PIC — semua deliverable yang ditugaskan kepada Anda lintas proyek." },
  { key: "board", label: "Papan Tugas", icon: "layers", tip: "Papan tugas ala Trello — list & kartu dengan anggota, label, tanggal, ceklis, lampiran, dan komentar." },
  { key: "outputs", label: "Output Divisi", icon: "flag", tip: "PROSES · Deliverable yang dialirkan ke Legal, Marketing, Teknik, Konsumen, dan CEO beserta kesiapannya." },
  { key: "workdrawings", label: "Gambar Kerja", icon: "home", tip: "PROSES · Flow gambar kerja per konsumen: SLA 15 hk (konsumen) & 5 hk (kontraktor), alert, dan revisi AI." },
  { key: "staff", label: "Tim", icon: "user", tip: "Daftar staf departemen dan beban kerja tiap author." },
  { key: "master", label: "Data Master", icon: "layers", tip: "MASTER · Data acuan read-only: proyek master, template deliverable, akun & peran, dan divisi output." },
  { key: "skill", label: "Skill AI", icon: "flag", tip: "Checklist yang diikuti AI vision saat Deep Revisi gambar kerja — edit langsung dengan preview, dipakai di cek berikutnya." },
  { key: "pembelian", label: "Pembelian", icon: "list", tip: "Ajukan & setujui Purchase Request" },
];

/** The planning control tower shell: header, tab nav and the active view. */
export function Dashboard() {
  const { user, logout } = useAuth();
  const rev = useRev(); // realtime data revision — bumps on any backend write
  const roster = usePicRoster(rev); // SSO roster: registers picName() names + PIC pickers
  const pics = roster.filter((r) => r.isPic);

  // All-access directors (CEO/Dirops) only see this division's dashboard
  // (Ringkasan), no operational tabs. CEO is overview-only; Dirops may approve.
  const allAccess = !!user?.allAccess;
  const canManage = allAccess
    ? !!user?.canApprove
    : user?.role === "ceo" || user?.role === "kadep";
  const canEdit = useCallback(
    (pic: string) => canManage || user?.username === pic,
    [canManage, user],
  );

  // Managers and any all-access director land on the portfolio overview.
  const [tab, setTab] = useState<Tab>(canManage || user?.allAccess ? "summary" : "tasks");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRollup[]>([]);
  const [outputs, setOutputs] = useState<DivisionOutputs[]>([]);
  const [err, setErr] = useState("");

  // Admin (seed / reset) state.
  const [confirm, setConfirm] = useState<null | "proses" | "master" | "kosong">(null);
  const [busy, setBusy] = useState<"" | "seed" | "proses" | "master" | "kosong">("");

  const reload = useCallback(() => {
    Promise.all([api.summary(), api.projects(), api.outputs()])
      .then(([s, p, o]) => {
        setSummary(s);
        setProjects(p);
        setOutputs(o);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  // Re-run whenever the realtime revision bumps (any backend write) so the
  // portfolio snapshot stays live without a refresh.
  useEffect(reload, [reload, rev]);

  const runSeed = async () => {
    setBusy("seed");
    setErr("");
    try {
      await api.seed();
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const runReset = async (kind: "proses" | "master" | "kosong") => {
    setBusy(kind);
    setErr("");
    try {
      await (kind === "proses" ? api.resetProses() : kind === "master" ? api.resetMaster() : api.emptyAll());
      setConfirm(null);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <header className="hdr">
        <div className="hdr-logo"><img src="/brand/logo-mark.png" alt="Greenpark Group" /></div>
        <div className="hdr-titles">
          <h1>Dashboard Perencanaan</h1>
          <div className="sub">Greenpark Group · Departemen Perencanaan</div>
          <div className="tag">DESIGN · DELIVERABLE · GAMBAR KERJA</div>
        </div>
        <div className="hdr-spacer" />
        <AiGenerateButton division="perencanaan" />
        <div className="hdr-meta">
          {canManage && !allAccess && (
            <div className="admin-actions">
              <Tooltip tip="Isi ulang dashboard dengan data contoh (progress tugas & flow gambar kerja) untuk demo." pos="bottom">
                <button className="admin-btn" onClick={runSeed} disabled={busy !== ""}>
                  <Icon name="layers" size={14} />
                  {busy === "seed" ? "Mengisi…" : "Isi Contoh"}
                </button>
              </Tooltip>
              <Tooltip tip="DATA PROSES · Kosongkan progress (status → Belum) dan hapus semua flow gambar kerja. Data master proyek TETAP, termasuk proyek tambahan." pos="bottom">
                <button
                  className="admin-btn"
                  onClick={() => setConfirm("proses")}
                  disabled={busy !== ""}
                >
                  <Icon name="clock" size={14} />
                  Reset Proses
                </button>
              </Tooltip>
              <Tooltip tip="DATA MASTER · Kembalikan portfolio ke 32 proyek bawaan — proyek yang ditambah manual ikut terhapus, dan proses ikut dikosongkan." pos="bottom">
                <button
                  className="admin-btn danger"
                  onClick={() => setConfirm("master")}
                  disabled={busy !== ""}
                >
                  <Icon name="x" size={14} />
                  Reset Master
                </button>
              </Tooltip>
              <Tooltip tip="KOSONGKAN SEMUA · Hapus permanen SEMUA data: proyek, deliverable, semua master (GP/tipe/lebar/lokasi), blok & kavling. Benar-benar kosong, tanpa data contoh." pos="bottom">
                <button
                  className="admin-btn danger"
                  onClick={() => setConfirm("kosong")}
                  disabled={busy !== ""}
                >
                  <Icon name="x" size={14} />
                  Kosongkan Semua
                </button>
              </Tooltip>
            </div>
          )}
          {summary && (
            <Tooltip tip="Progress rata-rata seluruh proyek, ditimbang dari status tiap deliverable." pos="bottom">
              <div className="badge-target">
                {summary.avgProgress}%<small>PROGRESS</small>
              </div>
            </Tooltip>
          )}
          <Clock />
          <div className="hdr-user">
            <div className="hu-name">{user?.name}</div>
            <div className="hu-role">{roleLabel(user?.role ?? "")}</div>
          </div>
          <button className="logout-btn" onClick={() => void logout()} title="Keluar">
            <Icon name="x" size={18} />
          </button>
        </div>
      </header>

      <DivisionTabBar>
        {(allAccess ? TABS.filter((t) => t.key === "summary" || t.key === "board") : TABS).map((tabItem) => (
          <Tooltip key={tabItem.key} tip={tabItem.tip} pos="bottom">
            <button
              className={`tab ${tab === tabItem.key ? "on" : ""}`}
              onClick={() => setTab(tabItem.key)}
            >
              <Icon name={tabItem.icon} size={17} />
              {tabItem.label}
            </button>
          </Tooltip>
        ))}
      </DivisionTabBar>

      {/* key={rev} remounts the active view on each realtime push so views that
          load their own data (Tim, Master) refetch live. Tugas & Gambar Kerja are
          EXCLUDED — they refresh in place via a `rev` prop instead, so an open
          Deep Analisis / Deep Revisi AI modal isn't unmounted mid-run. */}
      <main className="content" key={tab === "tasks" || tab === "workdrawings" || tab === "board" ? tab : rev}>
        {err && <div className="empty-note error">{err}</div>}
        {tab === "summary" && (summary ? <SummaryView summary={summary} /> : <Loading />)}
        {tab === "projects" && (
          <ProjectsView projects={projects} canManage={canManage} canEdit={canEdit} onChanged={reload} />
        )}
        {tab === "tasks" && user && (
          <MyTasksView
            username={user.username}
            canManage={canManage}
            canEdit={canEdit}
            pics={pics}
            onChanged={reload}
            rev={rev}
          />
        )}
        {tab === "board" && <BoardView boardName="Departemen Perencanaan" />}
        {tab === "outputs" &&
          (outputs.length ? (
            <OutputsView outputs={outputs} />
          ) : summary ? (
            <div className="empty-note">Belum ada deliverable yang dialirkan ke divisi lain.</div>
          ) : (
            <Loading />
          ))}
        {tab === "workdrawings" && <WorkDrawingsView projects={projects} pics={pics} rev={rev} />}
        {tab === "staff" && <StaffView />}
        {tab === "master" && <MasterView canManage={canManage} onChanged={reload} />}
        {tab === "skill" && <SkillView canManage={canManage} />}
        {tab === "pembelian" && <PurchasingInbox />}
      </main>

      {confirm === "proses" && (
        <Modal title="Reset Data Proses" sub="Master tetap" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Mengosongkan <b>data proses</b>: seluruh progress tugas kembali ke status{" "}
            <b>Belum</b> dan <b>semua flow gambar kerja dihapus</b>.
            <br />
            <br />
            Data <b>master tetap utuh</b> — semua proyek (termasuk yang ditambah manual), template
            deliverable, dan akun tidak berubah. Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-primary" onClick={() => runReset("proses")} disabled={busy !== ""}>
              {busy === "proses" ? "Mereset…" : "Reset Proses"}
            </button>
          </div>
        </Modal>
      )}

      {confirm === "master" && (
        <Modal title="Reset Data Master" sub="Mengembalikan portfolio bawaan" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Mengembalikan portfolio ke <b>32 proyek bawaan</b>. <b>Proyek yang ditambah manual akan
            terhapus</b>, dan seluruh data proses (status + gambar kerja) ikut dikosongkan.
            <br />
            <br />
            Tindakan ini tidak dapat dibatalkan. Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-danger" onClick={() => runReset("master")} disabled={busy !== ""}>
              {busy === "master" ? "Mereset…" : "Ya, Reset Master"}
            </button>
          </div>
        </Modal>
      )}

      {confirm === "kosong" && (
        <Modal title="Kosongkan Semua Data" sub="Benar-benar kosong — tidak ada sama sekali" onClose={() => setConfirm(null)}>
          <p className="modal-text">
            Menghapus <b>SEMUA</b> data secara permanen: seluruh <b>proyek &amp; deliverable</b>, semua{" "}
            <b>master</b> (GP, Tipe Bangunan), serta <b>Blok &amp; Kavling</b> dan file
            lampiran. Portfolio jadi <b>benar-benar kosong</b> — tanpa data contoh apa pun (tidak
            di-isi ulang). Roster tim &amp; papan tugas tidak terpengaruh.
            <br />
            <br />
            Tindakan ini <b>tidak dapat dibatalkan</b>. Lanjutkan?
          </p>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy !== ""}>
              Batal
            </button>
            <button className="btn-danger" onClick={() => runReset("kosong")} disabled={busy !== ""}>
              {busy === "kosong" ? "Mengosongkan…" : "Ya, Kosongkan Semua"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="empty-note">
      <div className="spinner" /> Memuat…
    </div>
  );
}
