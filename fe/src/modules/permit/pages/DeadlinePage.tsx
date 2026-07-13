import { MasterDeadline } from "@/modules/permit/components/MasterDeadline";
import { useAuth } from "@/auth/AuthContext";

export function DeadlinePage() {
  const { user } = useAuth();
  // Editable for the legal department + directors (CEO/Dirops were read-only before).
  const canEdit = ["ceo", "dirops", "kadep", "legal_permit"].includes(user?.role ?? "");

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
