import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import "./admin.css";

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "http://localhost:8090/api").replace(/\/$/, "");
const SHEETS = ((import.meta.env.VITE_SHEETS_API as string) ?? "http://localhost:8091").replace(/\/$/, "");
const TOKEN_KEY = "gp_dashboard_token";

const DEPTS = [
  { code: "finance", name: "Keuangan" },
  { code: "marketing", name: "Marketing" },
  { code: "sales", name: "Sales" },
  { code: "perencanaan", name: "Perencanaan" },
  { code: "legalpermit", name: "Legal & Perizinan" },
  { code: "sdm", name: "SDM / HR" },
  { code: "teknik", name: "Teknik" },
  { code: "digitalmarketing", name: "Digital Marketing" },
  { code: "departemen", name: "Departemen" },
];

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  super: boolean;
  roles?: Record<string, string>;
}

function authHeaders(): HeadersInit {
  return { Authorization: "Bearer " + (localStorage.getItem(TOKEN_KEY) ?? ""), "Content-Type": "application/json" };
}

const emptyNew = { username: "", name: "", email: "", password: "", super: false };

export default function AdminApp() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"users" | "ai">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [uErr, setUErr] = useState("");
  const [nu, setNu] = useState({ ...emptyNew });
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; masked: string }>({ configured: false, masked: "" });
  const [newKey, setNewKey] = useState("");
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

  const loadKey = useCallback(async () => {
    try {
      const r = await fetch(`${SHEETS}/api/ai/key`);
      if (r.ok) setKeyStatus(await r.json());
    } catch {
      /* sheets-api offline — ignore */
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadKey();
  }, [loadUsers, loadKey]);

  const setRole = (code: string, role: string) =>
    setRoles((r) => {
      const next = { ...r };
      if (role) next[code] = role;
      else delete next[code];
      return next;
    });

  const addUser = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const body = { ...nu, roles: nu.super ? {} : roles };
      const r = await fetch(`${AUTH}/admin/users`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSaveMsg("✓ User dibuat: " + nu.username);
      setNu({ ...emptyNew });
      setRoles({});
      void loadUsers();
    } catch (e) {
      setSaveMsg("⚠ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

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

  const saveKey = async () => {
    setKeyMsg("");
    try {
      const r = await fetch(`${SHEETS}/api/ai/key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setKeyStatus(j);
      setNewKey("");
      setKeyMsg(j.configured ? "✓ Key tersimpan terpusat" : "✓ Key dihapus");
    } catch (e) {
      setKeyMsg("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const canSubmit = nu.username.trim() && nu.password.trim().length >= 6;

  return (
    <div className="adm">
      <header className="adm-top">
        <button className="adm-back" onClick={() => nav(-1)}>← Kembali</button>
        <div className="adm-title">
          <h1>Panel Admin</h1>
          <p>Kelola user & kunci AI · login sebagai <b>{user?.name ?? "—"}</b></p>
        </div>
        <nav className="adm-tabs">
          <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>👤 Kelola User</button>
          <button className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}>🔑 AI Key</button>
        </nav>
      </header>

      {tab === "users" && (
        <div className="adm-grid">
          <section className="adm-card">
            <h2>Tambah User</h2>
            <div className="adm-f"><span>Username</span><input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} placeholder="mis. budi@greenpark.id" /></div>
            <div className="adm-f"><span>Nama</span><input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Budi" /></div>
            <div className="adm-f"><span>Email <small>(opsional)</small></span><input value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="adm-f"><span>Password <small>(min 6)</small></span><input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></div>
            <label className="adm-super">
              <input type="checkbox" checked={nu.super} onChange={(e) => setNu({ ...nu, super: e.target.checked })} />
              <span><b>Super</b> — akses semua divisi + bisa kelola user</span>
            </label>

            {!nu.super && (
              <div className="adm-roles">
                <span className="adm-roles-h">Role per divisi</span>
                {DEPTS.map((d) => (
                  <div className="adm-role" key={d.code}>
                    <span>{d.name}</span>
                    <select value={roles[d.code] ?? ""} onChange={(e) => setRole(d.code, e.target.value)}>
                      <option value="">—</option>
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            <button className="adm-btn" disabled={!canSubmit || saving} onClick={addUser}>{saving ? "Menyimpan…" : "Tambah User"}</button>
            {saveMsg && <div className={saveMsg.startsWith("✓") ? "adm-ok" : "adm-err"}>{saveMsg}</div>}
          </section>

          <section className="adm-card">
            <h2>User ({users.length})</h2>
            {uErr && <div className="adm-err">⚠ {uErr}</div>}
            <div className="adm-users">
              {users.map((u) => (
                <div className="adm-u" key={u.id}>
                  <div className="adm-u-main">
                    <b>{u.username}</b>{u.super && <span className="adm-badge super">SUPER</span>}
                    <small>{u.name}</small>
                  </div>
                  <div className="adm-u-roles">
                    {u.super ? <span className="adm-badge">semua divisi</span> :
                      Object.entries(u.roles ?? {}).map(([d, r]) => <span className="adm-badge" key={d}>{d}:{r}</span>)}
                  </div>
                  <button className="adm-del" onClick={() => delUser(u)} title="Hapus">✕</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "ai" && (
        <div className="adm-grid one">
          <section className="adm-card">
            <h2>🔑 OpenRouter API Key (terpusat)</h2>
            <p className="adm-note">
              Disetel <b>sekali</b> di sini, disimpan di server, dipakai semua user untuk fitur <b>AI Import</b> — tak perlu lagi tiap orang tempel key di browser.
            </p>
            <div className="adm-keystat">
              Status: {keyStatus.configured ? <span className="adm-ok inline">✓ aktif ({keyStatus.masked})</span> : <span className="adm-err inline">belum diset</span>}
            </div>
            <div className="adm-f"><span>API Key baru</span><input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sk-or-v1-…" /></div>
            <div className="adm-keyrow">
              <button className="adm-btn" disabled={!newKey.trim()} onClick={saveKey}>Simpan Key</button>
              <button className="adm-btn ghost" onClick={() => { setNewKey(""); void fetch(`${SHEETS}/api/ai/key`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "" }) }).then(() => loadKey()); }}>Hapus Key</button>
            </div>
            {keyMsg && <div className={keyMsg.startsWith("✓") ? "adm-ok" : "adm-err"}>{keyMsg}</div>}
            <p className="adm-note small">Buat gratis di <b>openrouter.ai → Keys</b>. Model default: <code>openai/gpt-oss-120b:free</code>.</p>
          </section>
        </div>
      )}
    </div>
  );
}
