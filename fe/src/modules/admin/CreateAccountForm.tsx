import { useEffect, useState } from "react";
import { AUTH, authHeaders } from "./adminApi";
import { DEPARTMENTS, rolesFor, type Dept, type RoleOpt } from "./roleCatalog";
import { getDepartments, getRoles } from "./masterApi";

/** Account-creation form. To keep it unconfusing, a normal user is placed in ONE
 *  division with ONE role (pick divisi → pick role); "＋ divisi lain" adds more
 *  rows only when needed. Super admin skips divisions entirely.
 *
 *  Divisions + roles come from the dynamic master data (auth /admin/departments
 *  and /admin/roles) fetched on mount. If either fetch fails or is empty we fall
 *  back to the static roleCatalog so the form never breaks when auth is offline. */
export function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  // Master data: seeded with the static catalogue, replaced by the backend when
  // reachable. `roles === null` → catalogue not loaded, use per-dept rolesFor().
  const [depts, setDepts] = useState<Dept[]>(DEPARTMENTS);
  const [roles, setRoles] = useState<RoleOpt[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [d, r] = await Promise.all([getDepartments(), getRoles()]);
        if (!alive) return;
        if (Array.isArray(d) && d.length) setDepts(d);
        if (Array.isArray(r) && r.length) setRoles(r.map((x) => ({ value: x.value, label: x.label })));
      } catch {
        /* auth unreachable — keep static DEPARTMENTS + rolesFor() fallback */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // All catalogue roles once loaded (backend accepts any role per dept); the
  // static per-dept list otherwise.
  const rolesForDept = (deptCode: string): RoleOpt[] => roles ?? rolesFor(deptCode);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [rows, setRows] = useState<{ dept: string; role: string }[]>([{ dept: "", role: "" }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const setRow = (i: number, patch: Partial<{ dept: string; role: string }>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { dept: "", role: "" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  // Departments already chosen (so the next dropdown doesn't offer duplicates).
  const chosen = new Set(rows.map((r) => r.dept).filter(Boolean));

  const rolesMap = (): Record<string, string> => {
    const m: Record<string, string> = {};
    for (const r of rows) if (r.dept && r.role) m[r.dept] = r.role;
    return m;
  };

  const canSubmit =
    username.trim().length > 0 && password.trim().length >= 6 && (isSuper || Object.keys(rolesMap()).length > 0);

  const reset = () => {
    setUsername("");
    setName("");
    setEmail("");
    setPassword("");
    setIsSuper(false);
    setRows([{ dept: "", role: "" }]);
  };

  const submit = async () => {
    setSaving(true);
    setMsg("");
    try {
      const body = {
        username: username.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        super: isSuper,
        roles: isSuper ? {} : rolesMap(),
      };
      const r = await fetch(`${AUTH}/admin/users`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg("✓ User dibuat: " + body.username);
      reset();
      onCreated();
    } catch (e) {
      setMsg("⚠ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wms-card">
      <div className="wms-card-h">
        <h3>Tambah User</h3>
      </div>

      <label className="wms-field">
        <span>Username</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. budi@greenpark.id" />
      </label>
      <label className="wms-field">
        <span>Nama Lengkap</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi Santoso" />
      </label>
      <label className="wms-field">
        <span>Email <small>(opsional)</small></span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="budi@greenpark.id" />
      </label>
      <label className="wms-field">
        <span>Password <small>(min 6 karakter)</small></span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </label>

      <label className="wms-check">
        <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} />
        <span><b>Super admin</b> — akses semua divisi + kelola user</span>
      </label>

      {!isSuper && (
        <div className="wms-assign">
          <span className="wms-roles-h">Penempatan — Divisi &amp; Role</span>
          {rows.map((row, i) => (
            <div className="wms-assign-row" key={i}>
              <select value={row.dept} onChange={(e) => setRow(i, { dept: e.target.value, role: "" })} aria-label="Divisi">
                <option value="">— pilih divisi —</option>
                {depts.filter((d) => d.code === row.dept || !chosen.has(d.code)).map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
              <select value={row.role} onChange={(e) => setRow(i, { role: e.target.value })} disabled={!row.dept} aria-label="Role">
                <option value="">{row.dept ? "— pilih role —" : "—"}</option>
                {row.dept && rolesForDept(row.dept).map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {rows.length > 1 && (
                <button className="wms-del" type="button" onClick={() => removeRow(i)} title="Hapus baris">✕</button>
              )}
            </div>
          ))}
          {chosen.size < depts.length && (
            <button className="wms-assign-add" type="button" onClick={addRow}>＋ Divisi lain</button>
          )}
        </div>
      )}

      <button className="wms-btn" disabled={!canSubmit || saving} onClick={submit}>
        {saving ? "Menyimpan…" : "Tambah User"}
      </button>
      {msg && <div className={msg.startsWith("✓") ? "wms-ok" : "wms-err"} style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
