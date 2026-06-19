import { useState } from "react";
import { api } from "../api/client";
import type { AddProjectInput } from "../api/client";
import { Modal } from "./Modal";

/**
 * AddProjectModal registers a new MASTER project. Creating a project is master
 * data management (the deliverable template is instantiated automatically), so
 * this lives in the Data Master view rather than the process (Proyek) view.
 */
export function AddProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<AddProjectInput>({
    gp: "GP1",
    name: "",
    lokasi: "",
    luas: "",
    units: 0,
    types: 0,
    sitePlans: 1,
    includeUnit: true,
    includeKawasan: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const created = await api.addProject(form);
      onCreated(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const set = (k: keyof AddProjectInput, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title="Tambah Proyek Master" sub="Template deliverable dibuat otomatis" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Nama proyek</span>
          <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Le Hauz …" />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Grup (GP)</span>
            <input value={form.gp} onChange={(e) => set("gp", e.target.value)} placeholder="GP2" />
          </label>
          <label className="form-field">
            <span>Luas</span>
            <input value={form.luas} onChange={(e) => set("luas", e.target.value)} placeholder="4.653 m2" />
          </label>
        </div>
        <label className="form-field">
          <span>Lokasi</span>
          <input value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} placeholder="Leuwinanggung" />
        </label>
        <div className="form-row">
          <label className="form-field">
            <span>Jumlah unit</span>
            <input
              type="number"
              min={0}
              value={form.units || ""}
              onChange={(e) => set("units", Number(e.target.value))}
            />
          </label>
          <label className="form-field">
            <span>Jumlah tipe</span>
            <input
              type="number"
              min={0}
              value={form.types || ""}
              onChange={(e) => set("types", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span>Jumlah Site Plan</span>
            <input
              type="number"
              min={1}
              max={20}
              value={form.sitePlans}
              onChange={(e) => set("sitePlans", Math.max(1, Number(e.target.value)))}
            />
          </label>
          <div className="form-field">
            <span>Komponen deliverable</span>
            <div className="chk-row">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={form.includeUnit}
                  onChange={(e) => set("includeUnit", e.target.checked)}
                />
                Desain Unit Hunian
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={form.includeKawasan}
                  onChange={(e) => set("includeKawasan", e.target.checked)}
                />
                Desain Kawasan
              </label>
            </div>
          </div>
        </div>
        <p className="form-hint">
          Site Plan dibuat sebanyak yang dipilih (mis. 3 → Site Plan 1, 2, 3). Deliverable & PIC
          masih bisa ditambah / diubah setelah proyek dibuat.
        </p>

        {err && <div className="login-error">{err}</div>}
        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !form.name.trim()}>
            {busy ? "Menyimpan…" : "Tambah Proyek"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
