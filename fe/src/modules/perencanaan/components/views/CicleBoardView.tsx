import { useEffect, useState } from "react";
import { api } from "../../api/client";

/* Full mirror of the cicle Kanban board (Departemen Perencanaan), synced by the
 * backend. Read-only: columns exactly as cicle, cards with members, labels, due
 * date, checklist count and downloadable attachments. */

interface CMember { id: string; name: string; photo: string }
interface CLabel { name: string; color: string }
interface CAttachment { name: string; url: string }
interface CCard {
  id: string;
  name: string;
  members: CMember[];
  labels: CLabel[];
  dueDate: string;
  cover?: string;
  checklist?: { total: number };
  attachments?: CAttachment[];
  attachmentCount?: number;
}
interface CColumn { name: string; cards: CCard[] }
interface CBoard { team: string; columns: CColumn[]; totalCards: number }

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function CicleBoardView() {
  const [board, setBoard] = useState<CBoard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .cicleBoard()
      .then((b) => setBoard(b as CBoard))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) return <div className="empty-note error">{err}</div>;
  if (!board) return <div className="empty-note">Memuat papan…</div>;
  const cols = board.columns.filter((c) => c.cards.length > 0 || !/^Pending$|^Revisi$/i.test(c.name));

  return (
    <div className="view view-cicle">
      <div className="cicle-hd">
        <h2 className="panel-title">Papan Cicle — {board.team}</h2>
        <span className="cicle-count">{board.totalCards} kartu · {board.columns.length} kolom</span>
      </div>
      <div className="cicle-board">
        {cols.map((col) => (
          <div className="cicle-col" key={col.name}>
            <div className="cicle-col-hd">
              <span className="cicle-col-name">{col.name}</span>
              <span className="cicle-col-count">{col.cards.length}</span>
            </div>
            <div className="cicle-col-body">
              {col.cards.map((c) => (
                <div className="cicle-card" key={c.id}>
                  {c.labels.length > 0 && (
                    <div className="cicle-labels">
                      {c.labels.map((l, i) => (
                        <span key={i} className="cicle-label">{l.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="cicle-card-name">{c.name}</div>
                  <div className="cicle-card-meta">
                    {c.dueDate && <span className="cicle-due">📅 {c.dueDate.slice(0, 10)}</span>}
                    {(c.attachmentCount ?? c.attachments?.length ?? 0) > 0 && (
                      <span className="cicle-files-n">📎 {c.attachmentCount ?? c.attachments?.length}</span>
                    )}
                    {(c.checklist?.total ?? 0) > 0 && <span className="cicle-chk">☑ {c.checklist!.total}</span>}
                    <span className="cicle-avatars">
                      {c.members.slice(0, 4).map((m) => (
                        <span key={m.id} className="cicle-av" title={m.name}>
                          {m.photo && !m.photo.includes("user-default") ? (
                            <img src={m.photo} alt={m.name} />
                          ) : (
                            initials(m.name)
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="cicle-att">
                      {c.attachments.slice(0, 4).map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" title={a.name} className="cicle-att-link">
                          {a.name || `file ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {col.cards.length === 0 && <div className="cicle-empty">—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
