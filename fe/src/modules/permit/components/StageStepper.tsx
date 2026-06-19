import type { ProjectStage } from "@/modules/permit/models";

// Ordered lahan stages mirroring the legal-permit flow (A→B→C→D→done).
const STAGES: { key: ProjectStage; label: string }[] = [
  { key: "pra_akad", label: "Pra-Akad" },
  { key: "akad", label: "Akad" },
  { key: "permit", label: "Permit" },
  { key: "legal", label: "Legal" },
  { key: "done", label: "Selesai" },
];

export function StageStepper({ stage }: { stage: ProjectStage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="stepper" role="list" aria-label="Tahap lahan">
      {STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <div key={s.key} className="step" role="listitem">
            <div className={`step-dot step-${state}`}>{state === "done" ? "✓" : i + 1}</div>
            <span className={`step-label step-label-${state}`}>{s.label}</span>
            {i < STAGES.length - 1 && <span className={`step-line ${i < current ? "step-line-done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}
