import { useEffect, useMemo, useState } from "react";
import type { User, MineStep, StepStatus, UpdateStepInput } from "../models";
import { useAuth } from "@/auth/AuthContext";
import { useRev } from "@/lib/realtime";
import { stepService } from "../services/step.service";
import { alurShort, metadataFor } from "../lib/alurCatalog";

const statusLabel: Record<StepStatus, string> = { pending: "Belum", in_progress: "Proses", done: "Selesai" };
const FILTERS: { key: "all" | StepStatus; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Belum" },
  { key: "in_progress", label: "Proses" },
  { key: "done", label: "Selesai" },
];

/** Touch-first layout for field roles (Talent & Videografer). */
export function MobileApp({ user }: { user: User }) {
  const { logout } = useAuth();
  const rev = useRev(); // realtime data revision — bumps on any backend write
  const [steps, setSteps] = useState<MineStep[] | null>(null);
  const [filter, setFilter] = useState<"all" | StepStatus>("all");
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    stepService
      .mine(user.position)
      .then(setSteps)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(
    () => (steps ?? []).filter((s) => filter === "all" || s.status === filter),
    [steps, filter],
  );
  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, done: 0 } as Record<StepStatus, number>;
    (steps ?? []).forEach((s) => (c[s.status] += 1));
    return c;
  }, [steps]);

  return (
    <div className="m-app mk-scope">
      <header className="m-bar">
        <div className="m-bar-l">
          <div className="m-logo">GP</div>
          <div>
            <div className="m-title">Tugas Saya</div>
            <div className="m-sub">{user.position}</div>
          </div>
        </div>
        <button className="m-logout" onClick={logout}>
          Keluar
        </button>
      </header>

      <div className="m-filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`m-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}
            {f.key !== "all" && <span className="m-chip-n">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {err && <div className="m-err">{err}</div>}

      <main className="m-list">
        {!steps ? (
          <div className="m-empty">
            <div className="spinner" /> Memuat…
          </div>
        ) : list.length === 0 ? (
          <div className="m-empty">Tidak ada tugas.</div>
        ) : (
          list.map((s) => <MobileCard key={s.id} step={s} onChanged={load} />)
        )}
      </main>
    </div>
  );
}

function dueText(due: string | null, status: StepStatus) {
  if (!due || status === "done") return null;
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <span className="m-due late">Telat {-days} hari</span>;
  if (days <= 1) return <span className="m-due soon">Hari ini / besok</span>;
  return <span className="m-due">Deadline {new Date(due).toLocaleDateString("id-ID")}</span>;
}

function MobileCard({ step, onChanged }: { step: MineStep; onChanged: () => void }) {
  const fields = metadataFor(step.code);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(step.metadata ?? {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const patch = async (input: UpdateStepInput) => {
    setBusy(true);
    setErr("");
    try {
      await stepService.update(step.id, input);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setErr("");
    try {
      await stepService.uploadDocument(step.id, file, "Footage");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`m-card status-${step.status}`}>
      <div className="m-card-top">
        <span className="m-alur">{alurShort[step.work_item_alur]}</span>
        <span className="m-code">{step.code}</span>
        {dueText(step.due_date, step.status)}
      </div>
      <div className="m-card-title">{step.name}</div>
      <div className="m-card-proj">{step.work_item_title}</div>

      {fields.map((f) => (
        <label className="m-field" key={f.key}>
          <span>{f.label}</span>
          <input
            type={f.type}
            value={String(metadata[f.key] ?? "")}
            onChange={(e) => setMetadata((m) => ({ ...m, [f.key]: e.target.value }))}
            onBlur={() => patch({ metadata })}
            inputMode={f.type === "number" ? "numeric" : undefined}
          />
        </label>
      ))}

      <label className="m-upload">
        📎 Unggah Footage / File
        <input
          type="file"
          hidden
          accept="image/*,video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </label>

      {step.documents && step.documents.length > 0 && (
        <div className="m-docs">
          {step.documents.map((d) => (
            <a key={d.id} href={stepService.downloadUrl(d.id)} target="_blank" rel="noreferrer">
              📎 {d.original_name}
            </a>
          ))}
        </div>
      )}

      <div className="m-status">
        {(["pending", "in_progress", "done"] as StepStatus[]).map((st) => (
          <button
            key={st}
            className={`m-status-btn ${st} ${step.status === st ? "on" : ""}`}
            disabled={busy}
            onClick={() => patch({ status: st })}
          >
            {statusLabel[st]}
          </button>
        ))}
      </div>
      {err && <div className="m-err inline">{err}</div>}
    </div>
  );
}
