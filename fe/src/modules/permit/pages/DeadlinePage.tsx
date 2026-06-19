import { MasterDeadline } from "@/modules/permit/components/MasterDeadline";
import { useAuth } from "@/auth/AuthContext";

export function DeadlinePage() {
  const { user } = useAuth();
  const canEdit = user?.role === "kadep" || user?.role === "dirops";

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
