import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../models";
import { metaOAuth, type MetaConnection, type MetaOAuthConfig } from "./metaOAuth";
import "./meta.css";

type Toast = { tone: "ok" | "err"; msg: string } | null;

// Akun Meta — connect one or more Meta (Facebook) accounts via OAuth and pick
// which one is active. The active account's token is what powers the Ads /
// WhatsApp / Instagram tabs (resolved server-side per request).
export function AccountsView({ user }: { user: User }) {
  const isKadep = user.role === "kadep";
  const canManage = user.role !== "viewer";

  const [config, setConfig] = useState<MetaOAuthConfig | null>(null);
  const [conns, setConns] = useState<MetaConnection[]>([]);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const flash = useCallback((t: Toast) => {
    setToast(t);
    if (t) setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(() => {
    Promise.all([metaOAuth.getConfig(), metaOAuth.listConnections()])
      .then(([c, list]) => {
        setConfig(c);
        setConns(list);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(reload, [reload]);

  // The OAuth popup posts back {source:"meta-oauth", status, detail} on finish.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as { source?: string; status?: string; detail?: string };
      if (!d || d.source !== "meta-oauth") return;
      if (d.status === "connected") {
        flash({ tone: "ok", msg: `Akun Meta terhubung${d.detail ? `: ${d.detail}` : ""}.` });
        reload();
      } else {
        flash({ tone: "err", msg: d.detail || "Gagal menghubungkan akun Meta." });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [flash, reload]);

  const connect = () => {
    if (!config?.configured) {
      flash({ tone: "err", msg: "Lengkapi App ID & App Secret dulu." });
      return;
    }
    const w = 600;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      metaOAuth.loginUrl(),
      "meta-oauth",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
  };

  const activate = async (id: number) => {
    setBusy(true);
    try {
      setConns(await metaOAuth.activate(id));
      flash({ tone: "ok", msg: "Akun aktif diganti." });
    } catch (e) {
      flash({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (c: MetaConnection) => {
    if (!confirm(`Putuskan koneksi "${c.label || c.meta_user_name}"?`)) return;
    setBusy(true);
    try {
      setConns(await metaOAuth.disconnect(c.id));
      flash({ tone: "ok", msg: "Koneksi diputus." });
    } catch (e) {
      flash({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const active = conns.find((c) => c.is_active);

  return (
    <div className="meta-wrap">
      {toast && <div className={`meta-toast ${toast.tone}`}>{toast.msg}</div>}
      {err && <div className="meta-state error">{err}</div>}

      {/* readiness summary */}
      <div className="meta-tiles">
        <div className="meta-tile">
          <b>{config?.configured ? "Siap" : "Belum"}</b>
          <span>Meta App {config?.app_id ? `· ${config.app_id}` : "· App ID & Secret belum diisi"}</span>
        </div>
        <div className="meta-tile">
          <b>{conns.length}</b>
          <span>Akun terhubung · semua dijumlahkan</span>
        </div>
        <div className="meta-tile">
          <b>{conns.length > 0 ? "Digabung" : "—"}</b>
          <span>{conns.length} akun dijumlahkan di Ads / WA / IG</span>
        </div>
      </div>

      {/* connected accounts */}
      <section className="meta-card">
        <div className="meta-head">
          <h3>Akun Meta Terhubung</h3>
          {canManage && (
            <button className="mo-btn primary" onClick={connect} disabled={busy}>
              + Hubungkan Akun
            </button>
          )}
        </div>
        {conns.length > 1 && (
          <p className="mo-hint" style={{ marginTop: -2, marginBottom: 10 }}>
            Semua {conns.length} akun digabung &amp; dijumlahkan di tab Ads / WA / IG.
            {active
              ? ` Akun bertanda AKTIF (${active.label || active.meta_user_name}) dipakai untuk breakdown mendalam (tren harian & segmen).`
              : ""}
          </p>
        )}
        {conns.length === 0 ? (
          <div className="meta-empty">
            Belum ada akun.{" "}
            {canManage
              ? "Klik “Hubungkan Akun” untuk login lewat Facebook (bisa lebih dari satu akun)."
              : "Hubungi admin untuk menghubungkan akun."}
          </div>
        ) : (
          <div className="mo-list">
            {conns.map((c) => (
              <ConnectionRow
                key={c.id}
                conn={c}
                canManage={canManage}
                busy={busy}
                onActivate={() => activate(c.id)}
                onDisconnect={() => disconnect(c)}
                onSaved={setConns}
                flash={flash}
              />
            ))}
          </div>
        )}
      </section>

      {/* manual token — tanpa popup OAuth / redirect URI */}
      {canManage && (
        <section className="meta-card">
          <div className="meta-head">
            <h3>Tempel Token Manual</h3>
            <span className="meta-tag">tanpa popup / redirect URI</span>
          </div>
          <ManualTokenForm onSaved={setConns} flash={flash} />
        </section>
      )}

      {/* app config */}
      <section className="meta-card">
        <div className="meta-head">
          <h3>Konfigurasi Meta App (OAuth)</h3>
          <span className="meta-tag">Facebook Login</span>
        </div>
        {config && <ConfigForm config={config} canEdit={isKadep} onSaved={setConfig} flash={flash} />}
      </section>
    </div>
  );
}

function ConnectionRow({
  conn,
  canManage,
  busy,
  onActivate,
  onDisconnect,
  onSaved,
  flash,
}: {
  conn: MetaConnection;
  canManage: boolean;
  busy: boolean;
  onActivate: () => void;
  onDisconnect: () => void;
  onSaved: (c: MetaConnection[]) => void;
  flash: (t: Toast) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [label, setLabel] = useState(conn.label);
  const [adAccount, setAdAccount] = useState(conn.ad_account_id);
  const [saving, setSaving] = useState(false);

  const expired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : false;

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await metaOAuth.update(conn.id, { label, ad_account_id: adAccount }));
      setEdit(false);
      flash({ tone: "ok", msg: "Akun diperbarui." });
    } catch (e) {
      flash({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`mo-conn ${conn.is_active ? "on" : ""}`}>
      <div className="mo-main">
        <div className="mo-top">
          <span className="mo-name">{conn.label || conn.meta_user_name}</span>
          {conn.is_active && <span className="meta-pill ok">AKTIF</span>}
          {expired && <span className="meta-pill bad">TOKEN KADALUARSA</span>}
        </div>
        <div className="mo-sub">
          {conn.meta_user_name} · ID {conn.meta_user_id}
          {conn.ad_account_id ? ` · act_${conn.ad_account_id}` : " · akun iklan otomatis"}
        </div>
        {edit && (
          <div className="mo-edit">
            <label>
              Label
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nama tampilan" />
            </label>
            <label>
              Pin Ad Account ID
              <input
                value={adAccount}
                onChange={(e) => setAdAccount(e.target.value)}
                placeholder="cth. 108683553290578 (opsional)"
              />
            </label>
          </div>
        )}
      </div>
      {canManage && (
        <div className="mo-actions">
          {!conn.is_active && (
            <button className="mo-btn" onClick={onActivate} disabled={busy}>
              Jadikan Aktif
            </button>
          )}
          {edit ? (
            <>
              <button className="mo-btn primary" onClick={save} disabled={saving}>
                Simpan
              </button>
              <button className="mo-btn ghost" onClick={() => setEdit(false)} disabled={saving}>
                Batal
              </button>
            </>
          ) : (
            <button className="mo-btn ghost" onClick={() => setEdit(true)}>
              Edit
            </button>
          )}
          <button className="mo-btn danger" onClick={onDisconnect} disabled={busy}>
            Putuskan
          </button>
        </div>
      )}
    </div>
  );
}

function ManualTokenForm({
  onSaved,
  flash,
}: {
  onSaved: (c: MetaConnection[]) => void;
  flash: (t: Toast) => void;
}) {
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!token.trim()) {
      flash({ tone: "err", msg: "Token belum diisi." });
      return;
    }
    setSaving(true);
    try {
      onSaved(await metaOAuth.connectManual(token.trim(), label.trim() || undefined));
      setToken("");
      setLabel("");
      flash({ tone: "ok", msg: "Token tersimpan & dijadikan akun aktif." });
    } catch (e) {
      flash({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mo-config">
      <p className="mo-hint">
        Cara tercepat tanpa login Facebook. Buat <b>System User token</b> di Meta → <i>Business Settings → System Users →
        Generate Token</i> (pilih app, centang <code>ads_read</code> dll), lalu tempel di bawah. Backend memvalidasi &
        menjadikannya akun aktif untuk tab Ads / WA / IG.
      </p>
      <label className="mo-field">
        <span>Access Token</span>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAA..." autoComplete="off" spellCheck={false} />
      </label>
      <label className="mo-field">
        <span>Label (opsional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="cth. Akun Iklan Cirimekar" />
      </label>
      <button className="mo-btn primary wide" onClick={save} disabled={saving}>
        {saving ? "Memeriksa token…" : "Simpan & Jadikan Aktif"}
      </button>
    </div>
  );
}

function ConfigForm({
  config,
  canEdit,
  onSaved,
  flash,
}: {
  config: MetaOAuthConfig;
  canEdit: boolean;
  onSaved: (c: MetaOAuthConfig) => void;
  flash: (t: Toast) => void;
}) {
  const [appId, setAppId] = useState(config.app_id);
  const [appSecret, setAppSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(config.redirect_uri);
  const [scopes, setScopes] = useState(config.scopes);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const next = await metaOAuth.saveConfig({
        app_id: appId,
        app_secret: appSecret || undefined,
        redirect_uri: redirectUri,
        scopes,
      });
      onSaved(next);
      setAppSecret("");
      flash({ tone: "ok", msg: "Konfigurasi disimpan." });
    } catch (e) {
      flash({ tone: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const copyRedirect = () => {
    navigator.clipboard?.writeText(config.redirect_uri);
    flash({ tone: "ok", msg: "Redirect URI disalin." });
  };

  return (
    <div className="mo-config">
      <p className="mo-hint">
        Daftarkan satu Meta App di{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
          developers.facebook.com
        </a>
        , tambahkan produk <b>Facebook Login</b>, lalu masukkan Redirect URI di bawah ke{" "}
        <i>Valid OAuth Redirect URIs</i>.
      </p>

      <label className="mo-field">
        <span>App ID</span>
        <input value={appId} onChange={(e) => setAppId(e.target.value)} disabled={!canEdit} placeholder="cth. 123456789012345" />
      </label>

      <label className="mo-field">
        <span>App Secret {config.has_secret && <em>(tersimpan — kosongkan jika tak diubah)</em>}</span>
        <input
          type="password"
          value={appSecret}
          onChange={(e) => setAppSecret(e.target.value)}
          disabled={!canEdit}
          placeholder={config.has_secret ? "••••••••" : "App Secret"}
        />
      </label>

      <label className="mo-field">
        <span>Redirect URI (callback)</span>
        <div className="mo-inline">
          <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} disabled={!canEdit} />
          <button className="mo-btn ghost" type="button" onClick={copyRedirect}>
            Salin
          </button>
        </div>
      </label>

      <label className="mo-field">
        <span>Scopes (izin Graph, pisahkan koma)</span>
        <input value={scopes} onChange={(e) => setScopes(e.target.value)} disabled={!canEdit} />
      </label>

      {canEdit ? (
        <button className="mo-btn primary wide" onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Konfigurasi"}
        </button>
      ) : (
        <p className="mo-hint muted">Hanya Kepala Departemen yang dapat mengubah konfigurasi App.</p>
      )}
    </div>
  );
}
