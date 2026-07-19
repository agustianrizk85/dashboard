import { useCallback, useEffect, useState } from "react";
import { WmsShell } from "@/components/wms/WmsShell";
import type { WmsNavGroup } from "@/components/wms/WmsShell";
import { ProjectsPanel } from "./ProjectsPanel";
import { CreateAccountForm } from "./CreateAccountForm";
import { UsersTable } from "./UsersTable";
import { MasterPanel, type MasterRow } from "./MasterPanel";
import { AUTH, authHeaders, type User } from "./adminApi";
import { getDepartments, saveDepartment, deleteDepartment, getRoles, saveRole, deleteRole } from "./masterApi";
import "./admin.css";

// Stable adapters (defined at module scope so their identity never changes —
// MasterPanel's reload effect depends on `load`, so an inline arrow would loop).
const loadDepts = async (): Promise<MasterRow[]> => (await getDepartments()).map((d) => ({ k: d.code, v: d.name }));
const loadRoles = async (): Promise<MasterRow[]> => (await getRoles()).map((r) => ({ k: r.value, v: r.label }));

export default function AdminApp() {
  const [tab, setTab] = useState<"users" | "projects" | "divisi" | "roles" | "ai">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [uErr, setUErr] = useState("");

  // Central AI key = the ONE Ollama key used by every AI feature (Generate AI,
  // Asisten AI, WhatsApp auto-reply). Set here → auth persists it → all services read it.
  const [aiCfg, setAiCfg] = useState<{ configured: boolean; model: string; visionModel: string }>({
    configured: false,
    model: "",
    visionModel: "",
  });
  const [newKey, setNewKey] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newVisionModel, setNewVisionModel] = useState("");
  const [keyMsg, setKeyMsg] = useState("");

  const loadUsers = useCallback(async () => {
    setUErr("");
    try {
      const r = await fetch(`${AUTH}/admin/users`, { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUsers(Array.isArray(j) ? j : j.users ?? []);
    } catch (e) {
      setUErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadAiCfg = useCallback(async () => {
    try {
      const r = await fetch(`${AUTH}/ai/config`, { headers: authHeaders() });
      if (r.ok) {
        const j = await r.json();
        setAiCfg({ configured: !!j.configured, model: j.model ?? "", visionModel: j.visionModel ?? "" });
        setNewModel((m) => m || j.model || "");
        setNewVisionModel((m) => m || j.visionModel || "");
      }
    } catch {
      /* auth offline — ignore */
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadAiCfg();
  }, [loadUsers, loadAiCfg]);

  const delUser = async (u: User) => {
    if (!window.confirm(`Hapus user "${u.username}"?`)) return;
    try {
      const r = await fetch(`${AUTH}/admin/users/${u.id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      void loadUsers();
    } catch (e) {
      setUErr(e instanceof Error ? e.message : String(e));
    }
  };

  const saveAiKey = async () => {
    setKeyMsg("");
    try {
      const r = await fetch(`${AUTH}/ai/config`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ key: newKey.trim(), model: newModel.trim(), visionModel: newVisionModel.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setAiCfg({ configured: !!j.configured, model: j.model ?? "", visionModel: j.visionModel ?? "" });
      setNewKey("");
      setKeyMsg(j.configured ? "✓ Tersimpan terpusat" : "✓ Diperbarui");
    } catch (e) {
      setKeyMsg("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const groups: WmsNavGroup[] = [
    {
      heading: "Panel Admin",
      items: [
        { label: "Kelola User", active: tab === "users", onClick: () => setTab("users") },
        { label: "Proyek", active: tab === "projects", onClick: () => setTab("projects") },
        { label: "Master Divisi", active: tab === "divisi", onClick: () => setTab("divisi") },
        { label: "Master Role", active: tab === "roles", onClick: () => setTab("roles") },
        { label: "Kunci AI", active: tab === "ai", onClick: () => setTab("ai") },
      ],
    },
  ];

  return (
    <WmsShell brand="Panel Admin" brandSub="Akun · Kunci AI · Setting" nav={groups}>
      {tab === "projects" && <ProjectsPanel />}

      {tab === "users" && (
        <div className="wms-grid">
          <div className="wms-col-4">
            <CreateAccountForm onCreated={loadUsers} />
          </div>
          <div className="wms-card wms-col-8">
            <div className="wms-card-h">
              <h3>Daftar User ({users.length})</h3>
            </div>
            {uErr && <div className="wms-err" style={{ marginBottom: 8 }}>⚠ {uErr}</div>}
            <UsersTable users={users} onDelete={delUser} />
          </div>
        </div>
      )}

      {tab === "divisi" && (
        <MasterPanel
          title="Master Divisi"
          note="Divisi (departemen) yang tersedia untuk penempatan akun. Kode dipakai sistem, Nama tampil di layar."
          kHead="Kode"
          vHead="Nama"
          kPlaceholder="mis. perencanaan"
          vPlaceholder="mis. Perencanaan"
          load={loadDepts}
          save={saveDepartment}
          remove={deleteDepartment}
        />
      )}

      {tab === "roles" && (
        <MasterPanel
          title="Master Role"
          note="Katalog role/jabatan. Value dipakai sistem, Label tampil di layar. Semua role bisa dipilih untuk divisi mana pun."
          kHead="Value"
          vHead="Label"
          kPlaceholder="mis. kadep"
          vPlaceholder="mis. Kepala Divisi"
          load={loadRoles}
          save={saveRole}
          remove={deleteRole}
        />
      )}

      {tab === "ai" && (
        <div className="wms-grid">
          <div className="wms-card wms-col-8">
            <div className="wms-card-h">
              <h3>🔑 Kunci AI (Ollama) — terpusat</h3>
            </div>
            <p className="wms-note">
              Disetel <b>sekali</b> di sini, disimpan di server, dipakai <b>SEMUA</b> fitur AI: ✨ Generate AI di tiap dashboard,
              Asisten AI, dan Auto-reply WhatsApp. Tak perlu tiap orang menempel key di browser.
            </p>
            <div className="wms-keystat">
              Status:{" "}
              {aiCfg.configured ? (
                <span className="wms-ok inline">
                  ✓ aktif{aiCfg.model ? ` · umum ${aiCfg.model}` : ""}{aiCfg.visionModel ? ` · vision ${aiCfg.visionModel}` : ""}
                </span>
              ) : (
                <span className="wms-err inline">belum diset</span>
              )}
            </div>
            <label className="wms-field">
              <span>API Key Ollama</span>
              <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="tempel Ollama Cloud API key…" />
            </label>
            <label className="wms-field">
              <span>Model Umum <small>(dashboard · asisten · WA)</small></span>
              <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="glm-5.2:cloud" />
            </label>
            <label className="wms-field">
              <span>Model Perencanaan <small>(vision · Deep Revisi gambar kerja)</small></span>
              <input value={newVisionModel} onChange={(e) => setNewVisionModel(e.target.value)} placeholder="qwen3.5:397b" />
            </label>
            <button className="wms-btn" disabled={!newKey.trim() && !newModel.trim() && !newVisionModel.trim()} onClick={saveAiKey}>
              Simpan
            </button>
            {keyMsg && <div className={keyMsg.startsWith("✓") ? "wms-ok" : "wms-err"} style={{ marginTop: 8 }}>{keyMsg}</div>}
            <p className="wms-note small">
              Satu <b>key</b> untuk semua. <b>Model Umum</b> untuk teks (asisten/WA); <b>Model Perencanaan</b> harus model{" "}
              <b>vision</b> (baca gambar). Dapatkan key di <b>ollama.com</b>.
            </p>
          </div>
        </div>
      )}
    </WmsShell>
  );
}
