import { useEffect, useMemo, useState } from "react";
import type { DeadlineRule } from "@/modules/permit/models";
import { deadlineService } from "@/modules/permit/services/deadline.service";
import { categoryLabels } from "@/modules/permit/lib/processCatalog";

export function MasterDeadline({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<DeadlineRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    deadlineService
      .list()
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (code: string, patch: Partial<DeadlineRule>) =>
    setRules((rs) =>
      rs.map((r) => {
        if (r.code !== code) return r;
        const next = { ...r, ...patch };
        if (!next.deadline_enabled) next.alert_enabled = false; // alert requires deadline
        return next;
      }),
    );

  const grouped = useMemo(() => {
    const map = new Map<string, DeadlineRule[]>();
    for (const r of rules) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return Array.from(map.entries());
  }, [rules]);

  const save = async () => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const updated = await deadlineService.update(rules);
      setRules(updated);
      setMsg("Master Deadline tersimpan. Berlaku untuk lahan baru & alert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="muted">Memuat master deadline…</div>;

  return (
    <div className="card form-card">
      <div className="md-head">
        <div>
          <h2>Master Deadline</h2>
          <p className="muted small">
            Tentukan langkah mana yang pakai <b>deadline</b> & <b>alert</b>, beserta jumlah hari SLA-nya.
          </p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {grouped.map(([cat, list]) => (
        <div key={cat} className="md-group">
          <h3 className="md-cat">{categoryLabels[cat] ?? cat}</h3>
          <div className="md-rows">
            {list.map((r) => (
              <div key={r.code} className={`md-row ${r.deadline_enabled ? "" : "md-off"}`}>
                <div className="md-name">
                  <span className="step-code">{r.code}</span>
                  <span>{r.name}</span>
                </div>
                <div className="md-controls">
                  <label className="md-toggle">
                    <input
                      type="checkbox"
                      checked={r.deadline_enabled}
                      disabled={!canEdit}
                      onChange={(e) => set(r.code, { deadline_enabled: e.target.checked })}
                    />
                    <span>Deadline</span>
                  </label>
                  <label className="md-toggle">
                    <input
                      type="checkbox"
                      checked={r.alert_enabled}
                      disabled={!canEdit || !r.deadline_enabled}
                      onChange={(e) => set(r.code, { alert_enabled: e.target.checked })}
                    />
                    <span>Alert</span>
                  </label>
                  <label className="md-days">
                    <input
                      type="number"
                      min={0}
                      value={r.sla_days}
                      disabled={!canEdit || !r.deadline_enabled}
                      onChange={(e) => set(r.code, { sla_days: Number(e.target.value) })}
                    />
                    <span>hari</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {canEdit && (
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Master Deadline"}
        </button>
      )}
    </div>
  );
}
