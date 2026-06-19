import { useRef, useState } from "react";
import type { ProcessStep, StepStatus, UpdateStepInput } from "@/modules/permit/models";
import { stepService } from "@/modules/permit/services/step.service";
import { ocrService } from "@/modules/permit/services/ocr.service";
import { hintsFor, ocrDocTypes } from "@/modules/permit/lib/processCatalog";

const statusLabel: Record<StepStatus, string> = {
  pending: "Belum",
  in_progress: "Proses",
  done: "Selesai",
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function dueInfo(due: string | null, status: StepStatus): { label: string; cls: string } | null {
  if (!due || status === "done") return null;
  const d = new Date(due);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Terlambat ${-days} hari`, cls: "due-late" };
  if (days <= 3) return { label: `Sisa ${days} hari`, cls: "due-soon" };
  return { label: `Deadline ${d.toLocaleDateString("id-ID")}`, cls: "due-ok" };
}

export function StepCard({ step, onChange }: { step: ProcessStep; onChange: (s: ProcessStep) => void }) {
  const hints = hintsFor(step.code);
  const [priceFix, setPriceFix] = useState(step.price_fix);
  const [spk, setSpk] = useState(step.spk_number);
  const [notes, setNotes] = useState(step.notes);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(step.metadata ?? {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(hints.docTypes?.[0] ?? step.code);
  const [confidential, setConfidential] = useState(step.confidential_output);
  const [ocr, setOcr] = useState<Record<string, string> | null>(null);

  const due = dueInfo(step.due_date, step.status);
  const canOcr = ocrDocTypes.includes(docType.toUpperCase());

  const patch = async (input: UpdateStepInput) => {
    setSaving(true);
    setError("");
    try {
      const updated = await stepService.update(step.id, input);
      onChange(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () => patch({ price_fix: priceFix, spk_number: spk, notes, metadata });
  const setStatus = (status: StepStatus) => patch({ status, price_fix: priceFix, spk_number: spk, notes, metadata });

  const runOcr = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file dulu untuk OCR.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await ocrService.extract(file, docType);
      setOcr(result.fields);
      const merged = { ...metadata, ...result.fields };
      setMetadata(merged);
      await patch({ metadata: merged });
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR gagal");
    } finally {
      setSaving(false);
    }
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      await stepService.uploadDocument(step.id, file, docType, confidential);
      const refreshed = await stepService.get(step.id);
      onChange(refreshed);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`card step-card status-${step.status}`}>
      <div className="step-head">
        <div className="step-title">
          <span className="step-code">{step.code}</span>
          <h3>{step.name}</h3>
        </div>
        <div className="step-flags">
          {step.requires_price && <span className="tag tag-price">Harga Fix</span>}
          {step.requires_spk && <span className="tag tag-spk">SPK</span>}
          {step.notify_departments && <span className="tag tag-notify">Notif Lintas Dep</span>}
          {step.confidential_output && <span className="tag tag-conf">Confidential</span>}
          {due && <span className={`tag ${due.cls}`}>{due.label}</span>}
        </div>
      </div>

      <div className="status-switch">
        {(Object.keys(statusLabel) as StepStatus[]).map((s) => (
          <button
            key={s}
            className={`chip ${step.status === s ? "chip-active" : ""}`}
            disabled={saving}
            onClick={() => setStatus(s)}
          >
            {statusLabel[s]}
          </button>
        ))}
        {step.due_date && <span className="sla-hint muted">SLA {step.sla_days} hari</span>}
      </div>

      <div className="step-fields">
        {step.requires_price && (
          <label className="field">
            <span>{step.price_label || "Harga Fix"} (Rp) *</span>
            <input
              type="number"
              min={0}
              value={priceFix}
              onChange={(e) => setPriceFix(Number(e.target.value))}
              onBlur={saveDetails}
            />
            {priceFix > 0 && <small className="muted">{rupiah(priceFix)}</small>}
          </label>
        )}

        {step.requires_spk && (
          <label className="field">
            <span>Nomor SPK *</span>
            <input value={spk} onChange={(e) => setSpk(e.target.value)} onBlur={saveDetails} />
          </label>
        )}

        {hints.metadata?.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            <input
              type={f.type}
              value={String(metadata[f.key] ?? "")}
              onChange={(e) => setMetadata((m) => ({ ...m, [f.key]: e.target.value }))}
              onBlur={saveDetails}
            />
          </label>
        ))}

        <label className="field field-wide">
          <span>Catatan</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveDetails} rows={2} />
        </label>
      </div>

      <div className="step-docs">
        <div className="docs-list">
          {step.documents && step.documents.length > 0 ? (
            step.documents.map((d) => (
              <span key={d.id} className="doc-pill">
                <a href={stepService.downloadUrl(d.id)} target="_blank" rel="noreferrer">
                  📄 {d.doc_type}: {d.original_name}
                </a>
                {d.confidential && (
                  <a
                    className="tag tag-conf"
                    href={`${stepService.downloadUrl(d.id)}?watermark=1`}
                    target="_blank"
                    rel="noreferrer"
                    title="Unduh versi Confidential (watermark + hitam-putih) untuk Sales"
                  >
                    Confidential ⬇
                  </a>
                )}
              </span>
            ))
          ) : (
            <span className="muted small">Belum ada dokumen.</span>
          )}
        </div>

        <div className="upload-row">
          {hints.docTypes ? (
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {hints.docTypes.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="doc-type-input"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="Jenis dokumen"
            />
          )}
          <input type="file" ref={fileRef} />
          <label className="conf-check">
            <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
            Confidential
          </label>
          {canOcr && (
            <button className="btn btn-sm btn-ocr" onClick={runOcr} disabled={saving} title="Ekstrak data via OCR AI">
              🤖 OCR
            </button>
          )}
          <button className="btn btn-sm" onClick={upload} disabled={saving}>
            Unggah
          </button>
        </div>

        {ocr && (
          <div className="ocr-result">
            <strong>Hasil OCR ({Object.keys(ocr).length} field):</strong>
            <div className="ocr-fields">
              {Object.entries(ocr).map(([k, v]) => (
                <span key={k} className="ocr-pill">
                  <b>{k}</b>: {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
