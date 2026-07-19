import { useState } from "react";
import { api } from "../controltower/api/client";
import { Button } from "./ui";
import type { FieldType, ScreeningQuestion } from "./types";

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Teks singkat",
  textarea: "Teks panjang",
  number: "Angka",
  currency: "Rupiah",
  boolean: "Ya / Tidak",
  select: "Pilihan",
};

let tmpSeq = 0;
const newQuestion = (order: number): ScreeningQuestion => ({
  _id: `new-${Date.now()}-${tmpSeq++}`,
  order,
  label: "",
  type: "text",
  category: "",
  weight: 3,
  required: false,
  active: true,
  options: [],
});

/**
 * Question manager for the Kadep — the "pertanyaan dibuat dinamis oleh kadep"
 * side of the feature. Staff never see this; they only answer. Saves the whole
 * set at once (PUT /screening/questions), which the backend restricts to admin.
 */
export function QuestionManager({
  questions,
  onSaved,
  onClose,
}: {
  questions: ScreeningQuestion[];
  onSaved: (qs: ScreeningQuestion[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ScreeningQuestion[]>(() =>
    questions.length ? questions.map((q) => ({ ...q })) : [newQuestion(1)],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const patch = (i: number, p: Partial<ScreeningQuestion>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () => setRows((rs) => [...rs, newQuestion(rs.length + 1)]);

  const save = async () => {
    const cleaned = rows
      .map((r, idx) => ({ ...r, label: r.label.trim(), order: idx + 1 }))
      .filter((r) => r.label !== "");
    if (!cleaned.length) {
      setErr("Minimal satu pertanyaan dengan label harus diisi.");
      return;
    }
    // Strip client-only temp ids so the backend assigns stable ones.
    const payload = cleaned.map((r) => ({ ...r, _id: r._id.startsWith("new-") ? "" : r._id }));
    setSaving(true);
    setErr("");
    try {
      const saved = await api.setScreeningQuestions(payload as ScreeningQuestion[]);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="st-card">
      <h3>Kelola Pertanyaan Screening</h3>
      <p style={{ marginTop: -8, marginBottom: 14, fontSize: 12.5, color: "var(--ink-3)" }}>
        Pertanyaan yang aktif akan otomatis muncul di form screening seluruh staff. Staff hanya mengisi jawaban.
      </p>
      {err && <div className="st-msg err">{err}</div>}

      {rows.map((q, i) => (
        <div className={`st-qm-row ${q.active ? "" : "off"}`} key={q._id}>
          <div className="st-qm-top">
            <div className="st-qm-tools">
              <button className="st-icon-btn" title="Naik" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button className="st-icon-btn" title="Turun" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
            </div>
            <div className="st-qm-fields">
              <input
                type="text"
                value={q.label}
                placeholder={`Pertanyaan #${i + 1} — mis. "Penghasilan bersih per bulan"`}
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              <div className="st-qm-inline">
                <select value={q.type} onChange={(e) => patch(i, { type: e.target.value as FieldType })}>
                  {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={q.category ?? ""}
                  placeholder="Kategori (mis. Finansial)"
                  onChange={(e) => patch(i, { category: e.target.value })}
                />
                <select value={q.weight ?? 3} onChange={(e) => patch(i, { weight: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Bobot {w}
                    </option>
                  ))}
                </select>
              </div>
              {q.type === "select" && (
                <input
                  type="text"
                  value={(q.options ?? []).join(", ")}
                  placeholder="Pilihan, pisahkan dengan koma — mis. KPR, Cash Bertahap, Cash Keras"
                  onChange={(e) => patch(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
              <input
                type="text"
                value={q.hint ?? ""}
                placeholder="Petunjuk pengisian (opsional)"
                onChange={(e) => patch(i, { hint: e.target.value })}
              />
              <div className="st-qm-inline">
                <label className="st-check">
                  <input type="checkbox" checked={!!q.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                  Wajib diisi
                </label>
                <label className="st-check">
                  <input type="checkbox" checked={q.active} onChange={(e) => patch(i, { active: e.target.checked })} />
                  Aktif
                </label>
              </div>
            </div>
            <div className="st-qm-tools">
              <button className="st-icon-btn" title="Hapus" onClick={() => remove(i)}>
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="st-actions">
        <Button variant="ghost" className="sm" onClick={add}>
          + Tambah pertanyaan
        </Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Batal
        </Button>
        <Button onClick={save} loading={saving}>
          Simpan pertanyaan
        </Button>
      </div>
    </div>
  );
}
