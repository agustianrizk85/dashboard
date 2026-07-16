import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";

/** Unified Greenpark login. The user's division (returned with the session)
 *  decides which dashboard they land on — they do not choose it here. */
export function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await login(identifier.trim(), password.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      {/* Immersive brand backdrop — green gradient + topographic texture +
          slow-drifting lime glows. Purely decorative, ignored by AT. */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-texture" />
        <span className="login-glow login-glow-a" />
        <span className="login-glow login-glow-b" />
      </div>

      {/* Left: brand hero (hidden on narrow screens) */}
      <aside className="login-hero" aria-hidden="true">
        <img className="login-hero-logo" src="/brand/logo-mark.png" alt="" />
        <h2 className="login-hero-title">Greenpark Group</h2>
        <p className="login-hero-tagline">Live Smart&nbsp;·&nbsp;Live Green&nbsp;·&nbsp;Live Better</p>
        <p className="login-hero-sub">
          Satu portal untuk seluruh departemen — Perencanaan, Legal&nbsp;&amp;&nbsp;Perizinan,
          Marketing, Sales, Keuangan, Teknik&nbsp;&amp;&nbsp;CSO dalam satu dashboard.
        </p>
      </aside>

      {/* Right: login card */}
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img className="login-logo" src="/brand/logo-mark.png" alt="Greenpark Group" />
          <div>
            <h1>Masuk Dashboard</h1>
            <p>Greenpark Group · Portal Departemen</p>
          </div>
        </div>

        <label className="login-field">
          <span>Username / Email</span>
          <input
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="kadep  ·  dirops@greenpark.id"
            autoComplete="username"
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" type="submit" disabled={busy || !identifier || !password}>
          {busy ? "Memproses…" : "Masuk"}
        </button>

        <details className="login-hint">
          <summary>Akun demo per divisi</summary>
          <div className="login-hint-body">
            <b>Admin — kelola user &amp; AI key</b>: superadmin / superadmin123
            <br />
            <b>Direktur — semua divisi</b>: ceo@greenpark.id / ceo123 (overview) · dirops@greenpark.id / dirops123 (bisa approve)
            <br />
            <b>Perencanaan</b>: kadep / kadep123 · randi / randi123
            <br />
            <b>Legal &amp; Perizinan</b>: dirops@greenpark.id / dirops123 · legal@greenpark.id / legal123
            <br />
            <b>Marketing</b>: marketing@greenpark.id / kadep123 · akun tim per-orang (mis. ichsan@greenpark.id) — password dibagikan terpisah
            <br />
            <b>Sales</b>: sales@greenpark.id / sales123 (Control Tower)
            <br />
            <b>Keuangan</b>: keuangan@greenpark.id / keuangan123 (Akad & KPR)
            <br />
            <b>Teknik</b>: teknik@greenpark.id / teknik123 (Progres Pembangunan)
            <br />
            <b>CSO</b>: cso@greenpark.id / cso123 (Customer Complaint)
          </div>
        </details>
      </form>
    </div>
  );
}
