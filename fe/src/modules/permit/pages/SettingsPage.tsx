import { useEffect, useState } from "react";
import type { DACIConfig, NotificationConfig } from "@/modules/permit/models";
import { settingsService } from "@/modules/permit/services/settings.service";
import { useAuth } from "@/auth/AuthContext";

export function SettingsPage() {
  const { user } = useAuth();
  // Editable for the legal department + directors (CEO/Dirops were read-only before).
  const canEdit = ["ceo", "dirops", "kadep", "legal_permit"].includes(user?.role ?? "");
  const [daci, setDaci] = useState<DACIConfig | null>(null);
  const [notif, setNotif] = useState<NotificationConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([settingsService.getDACI(), settingsService.getNotification()])
      .then(([d, n]) => {
        setDaci(d);
        setNotif(n);
      })
      .catch((e) => setError(e.message));
  }, []);

  const saveDaci = async () => {
    if (!daci) return;
    setError("");
    setMsg("");
    try {
      await settingsService.setDACI(daci);
      setMsg("DACI tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
  };

  const saveNotif = async () => {
    if (!notif) return;
    setError("");
    setMsg("");
    try {
      await settingsService.setNotification(notif);
      setMsg("Notifikasi tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
  };

  const csv = (arr: string[]) => arr.join(", ");
  const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  if (!daci || !notif) return <div className="muted">Memuat…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Setting</h1>
          <p className="muted">DACI &amp; notifikasi — dinamis (KADEP / DIROPS).</p>
        </div>
      </div>
      {!canEdit && <div className="alert alert-error">Role Anda hanya bisa melihat (read-only).</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="card form-card">
        <h2>DACI</h2>
        <h3>Driver</h3>
        {daci.drivers.map((d, i) => (
          <div className="form-row" key={i}>
            <label className="field">
              <span>Kode</span>
              <input
                value={d.code}
                disabled={!canEdit}
                onChange={(e) =>
                  setDaci({ ...daci, drivers: daci.drivers.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })
                }
              />
            </label>
            <label className="field">
              <span>Nama</span>
              <input
                value={d.name}
                disabled={!canEdit}
                onChange={(e) =>
                  setDaci({ ...daci, drivers: daci.drivers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                }
              />
            </label>
          </div>
        ))}
        {canEdit && (
          <button
            className="btn btn-sm"
            onClick={() => setDaci({ ...daci, drivers: [...daci.drivers, { code: "", name: "" }] })}
          >
            + Driver
          </button>
        )}

        <label className="field">
          <span>Approver (pisahkan koma)</span>
          <input value={csv(daci.approver)} disabled={!canEdit} onChange={(e) => setDaci({ ...daci, approver: parseCsv(e.target.value) })} />
        </label>
        <label className="field">
          <span>Consulting</span>
          <input value={csv(daci.consulting)} disabled={!canEdit} onChange={(e) => setDaci({ ...daci, consulting: parseCsv(e.target.value) })} />
        </label>
        <label className="field">
          <span>Informed</span>
          <input value={csv(daci.informed)} disabled={!canEdit} onChange={(e) => setDaci({ ...daci, informed: parseCsv(e.target.value) })} />
        </label>
        {canEdit && (
          <button className="btn btn-primary" onClick={saveDaci}>
            Simpan DACI
          </button>
        )}
      </div>

      <div className="card form-card">
        <h2>Notifikasi WA &amp; Audit AI</h2>
        <label className="conf-check">
          <input type="checkbox" checked={notif.whatsapp_enabled} disabled={!canEdit} onChange={(e) => setNotif({ ...notif, whatsapp_enabled: e.target.checked })} />
          Aktifkan notifikasi WhatsApp (disiplin input data)
        </label>
        <label className="conf-check">
          <input type="checkbox" checked={notif.audit_ai_enabled} disabled={!canEdit} onChange={(e) => setNotif({ ...notif, audit_ai_enabled: e.target.checked })} />
          Aktifkan Audit AI (chatbot legal) ke WA user
        </label>
        <div className="form-row">
          <label className="field">
            <span>Jam Reminder Harian (0–23)</span>
            <input type="number" min={0} max={23} value={notif.reminder_hour} disabled={!canEdit} onChange={(e) => setNotif({ ...notif, reminder_hour: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>WhatsApp API URL</span>
            <input value={notif.whatsapp_api_url} disabled={!canEdit} onChange={(e) => setNotif({ ...notif, whatsapp_api_url: e.target.value })} />
          </label>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={saveNotif}>
            Simpan Notifikasi
          </button>
        )}
      </div>
    </div>
  );
}
