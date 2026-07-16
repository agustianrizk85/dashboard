import { MasterDeadline } from "@/modules/permit/components/MasterDeadline";

export function DeadlinePage() {
  // Read-only gate removed — every authenticated permit user may edit.
  const canEdit = true;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Master Deadline</h1>
          <p className="muted">Atur langkah mana yang pakai deadline &amp; alert beserta SLA-nya.</p>
        </div>
      </div>
      {!canEdit && <div className="alert alert-error">Role Anda hanya bisa melihat (read-only).</div>}
      <MasterDeadline canEdit={canEdit} />
    </div>
  );
}
