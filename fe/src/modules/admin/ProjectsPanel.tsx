import { useCallback, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * Proyek panel (Admin): map a real-estate project to the Meta accounts
 * (WhatsApp numbers / Instagram accounts) that serve it and the sales team
 * that handles it. Backend = metaapi (/be/meta/api/meta/projects). This is the
 * source of truth for attribution, routing, and per-project dashboard filters.
 * ──────────────────────────────────────────────────────────────────────── */

const META = ((import.meta.env.VITE_META_API as string) ?? "/be/meta").replace(/\/$/, "") + "/api";
const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "gp_dashboard_token";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: "Bearer " + t, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

interface Acct {
  kind: "wa" | "ig" | "ad";
  ref: string;
  label: string;
}
interface Sales {
  email: string;
  name: string;
}
interface Project {
  id: number;
  name: string;
  note: string;
  accounts: Acct[] | null;
  sales: Sales[] | null;
}
interface Opt {
  ref: string;
  label: string;
}
interface UserOpt {
  email: string;
  name: string;
}

const emptyDraft = { id: 0, name: "", note: "", wa: new Set<string>(), ig: new Set<string>(), ad: new Set<string>(), sales: new Set<string>() };
type Draft = { id: number; name: string; note: string; wa: Set<string>; ig: Set<string>; ad: Set<string>; sales: Set<string> };

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [waOpts, setWaOpts] = useState<Opt[]>([]);
  const [igOpts, setIgOpts] = useState<Opt[]>([]);
  const [adOpts, setAdOpts] = useState<Opt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [pj, wa, ig, conns, us] = await Promise.all([
        fetch(`${META}/meta/projects`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${META}/meta/whatsapp`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${META}/meta/instagram/accounts`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${META}/meta/connections`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        // Sales pool = users of the sales/marketing depts. Uses the per-dept
        // endpoint (any authed director can read it) — not the super-only
        // /admin/users — so the picker isn't empty for a non-super director.
        Promise.all(
          ["sales", "marketing", "digitalmarketing"].map((d) =>
            fetch(`${AUTH}/dept/${d}/users`, { headers: authHeaders() })
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => []),
          ),
        ).then((lists) => lists.flatMap((x) => (Array.isArray(x) ? x : x.users ?? []))),
      ]);
      setProjects(pj.projects ?? []);
      // WA numbers: wabas[].phones[] → {id=phone_number_id, display_phone_number}
      const waList: Opt[] = [];
      for (const w of wa.wabas ?? []) {
        for (const p of w.phones ?? []) {
          if (p.id) waList.push({ ref: String(p.id), label: p.display_phone_number || p.verified_name || String(p.id) });
        }
      }
      setWaOpts(waList);
      // IG accounts: {accounts:[{id=ig user id, username}]} (defensive on shape)
      const igArr = ig.accounts ?? ig.igAccounts ?? [];
      setIgOpts(igArr.filter((a: { id?: string }) => a.id).map((a: { id: string; username?: string }) => ({ ref: String(a.id), label: a.username ? "@" + a.username : String(a.id) })));
      // Ad accounts: one per connection (its pinned ad_account_id).
      const connArr = conns.connections ?? [];
      const adSeen = new Set<string>();
      const adList: Opt[] = [];
      for (const cn of connArr as Array<{ label?: string; ad_account_id?: string; meta_user_name?: string }>) {
        const ref = (cn.ad_account_id || "").replace(/^act_/, "");
        if (!ref || adSeen.has(ref)) continue;
        adSeen.add(ref);
        adList.push({ ref, label: `${cn.label || cn.meta_user_name || "Akun"} · act_${ref}` });
      }
      setAdOpts(adList);
      // Sales pool: dedupe the merged dept users by e-mail.
      const arr: Array<{ email?: string; name?: string; username?: string }> = Array.isArray(us) ? us : [];
      const seen = new Set<string>();
      const salesUsers: UserOpt[] = [];
      for (const u of arr) {
        const email = (u.email || u.username || "").toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        salesUsers.push({ email, name: u.name || u.username || email });
      }
      setUsers(salesUsers);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editProject = (p: Project) => {
    setMsg("");
    setDraft({
      id: p.id,
      name: p.name,
      note: p.note ?? "",
      wa: new Set((p.accounts ?? []).filter((a) => a.kind === "wa").map((a) => a.ref)),
      ig: new Set((p.accounts ?? []).filter((a) => a.kind === "ig").map((a) => a.ref)),
      ad: new Set((p.accounts ?? []).filter((a) => a.kind === "ad").map((a) => a.ref)),
      sales: new Set((p.sales ?? []).map((s) => s.email)),
    });
  };

  const toggle = (set: "wa" | "ig" | "ad" | "sales", key: string) =>
    setDraft((d) => {
      const next = new Set(d[set]);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...d, [set]: next };
    });

  const save = async () => {
    if (!draft.name.trim()) {
      setErr("Nama proyek wajib diisi.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    const accounts: Acct[] = [
      ...[...draft.wa].map((ref) => ({ kind: "wa" as const, ref, label: waOpts.find((o) => o.ref === ref)?.label ?? ref })),
      ...[...draft.ig].map((ref) => ({ kind: "ig" as const, ref, label: igOpts.find((o) => o.ref === ref)?.label ?? ref })),
      ...[...draft.ad].map((ref) => ({ kind: "ad" as const, ref, label: adOpts.find((o) => o.ref === ref)?.label ?? ref })),
    ];
    const sales: Sales[] = [...draft.sales].map((email) => ({ email, name: users.find((u) => u.email === email)?.name ?? email }));
    try {
      const r = await fetch(`${META}/meta/projects`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: draft.id, name: draft.name.trim(), note: draft.note.trim(), accounts, sales }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg(draft.id ? "Proyek diperbarui." : "Proyek dibuat.");
      setDraft({ ...emptyDraft });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Project) => {
    if (!confirm(`Hapus proyek "${p.name}"?`)) return;
    try {
      const r = await fetch(`${META}/meta/projects/${p.id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (draft.id === p.id) setDraft({ ...emptyDraft });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="adm-projects">
      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}

      <div className="adm-proj-grid">
        {/* ── Editor ── */}
        <section className="adm-card">
          <h2>{draft.id ? "Edit Proyek" : "Proyek Baru"}</h2>
          <label className="adm-field">
            NAMA PROYEK
            <input value={draft.name} placeholder="mis. Green Park Serua" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="adm-field">
            CATATAN (opsional)
            <input value={draft.note} placeholder="lokasi / keterangan" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>

          <div className="adm-field">
            NOMOR WHATSAPP
            {waOpts.length === 0 && <span className="adm-hint">Belum ada nomor WA terhubung.</span>}
            {waOpts.map((o) => (
              <label key={o.ref} className="adm-check">
                <input type="checkbox" checked={draft.wa.has(o.ref)} onChange={() => toggle("wa", o.ref)} /> {o.label}
              </label>
            ))}
          </div>

          <div className="adm-field">
            AKUN INSTAGRAM
            {igOpts.length === 0 && <span className="adm-hint">Belum ada akun IG terhubung.</span>}
            {igOpts.map((o) => (
              <label key={o.ref} className="adm-check">
                <input type="checkbox" checked={draft.ig.has(o.ref)} onChange={() => toggle("ig", o.ref)} /> {o.label}
              </label>
            ))}
          </div>

          <div className="adm-field">
            AKUN IKLAN (untuk filter Ads)
            {adOpts.length === 0 && <span className="adm-hint">Belum ada akun iklan terhubung.</span>}
            {adOpts.map((o) => (
              <label key={o.ref} className="adm-check">
                <input type="checkbox" checked={draft.ad.has(o.ref)} onChange={() => toggle("ad", o.ref)} /> {o.label}
              </label>
            ))}
          </div>

          <div className="adm-field">
            TIM SALES
            {users.length === 0 && <span className="adm-hint">Belum ada user marketing/sales.</span>}
            {users.map((u) => (
              <label key={u.email} className="adm-check">
                <input type="checkbox" checked={draft.sales.has(u.email)} onChange={() => toggle("sales", u.email)} /> {u.name} <em>{u.email}</em>
              </label>
            ))}
          </div>

          <div className="adm-proj-actions">
            <button className="adm-btn" disabled={busy} onClick={save}>
              {busy ? "Menyimpan…" : draft.id ? "Simpan Perubahan" : "Tambah Proyek"}
            </button>
            {draft.id !== 0 && (
              <button className="adm-btn ghost" disabled={busy} onClick={() => setDraft({ ...emptyDraft })}>
                Batal
              </button>
            )}
          </div>
        </section>

        {/* ── List ── */}
        <section className="adm-card">
          <h2>Proyek ({projects.length})</h2>
          {projects.length === 0 && <div className="adm-hint">Belum ada proyek. Buat di sebelah kiri.</div>}
          <div className="adm-proj-list">
            {projects.map((p) => (
              <div key={p.id} className="adm-proj-item">
                <div className="adm-proj-head">
                  <b>{p.name}</b>
                  <div className="adm-proj-btns">
                    <button className="adm-link" onClick={() => editProject(p)}>edit</button>
                    <button className="adm-link danger" onClick={() => del(p)}>hapus</button>
                  </div>
                </div>
                {p.note && <div className="adm-proj-note">{p.note}</div>}
                <div className="adm-proj-tags">
                  {(p.accounts ?? []).map((a, i) => (
                    <span key={i} className={"adm-tag " + a.kind}>
                      {a.kind === "wa" ? "📱" : a.kind === "ig" ? "📷" : "💰"} {a.label}
                    </span>
                  ))}
                  {(p.sales ?? []).map((s, i) => (
                    <span key={"s" + i} className="adm-tag sales">
                      🧑‍💼 {s.name}
                    </span>
                  ))}
                </div>
                {(p.accounts ?? []).length === 0 && (p.sales ?? []).length === 0 && <div className="adm-hint">Belum ada akun/sales.</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
