import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeSocket } from "@/lib/realtime";
import { useAuth } from "@/auth/AuthContext";
import { boardApi } from "./boardApi";
import type { BoardCard, BoardData, BoardTaskCard, BoardTaskStatus } from "./types";
import { isTaskCard } from "./types";
import { CardModal } from "./CardModal";
import { TaskCardModal } from "./TaskCardModal";
import {
  avatarBg,
  checklistAgg,
  fmtDayMonth,
  initialsOf,
  isOverdue,
  labelTextColor,
} from "./boardFmt";
import "./board.css";

/* Papan Tugas — shared UNIFIED status-column board (usable by any module).
 * The backend serves 4 FIXED system lists (To Do / Sedang Dikerjakan / Review /
 * Selesai). Each list holds a MIXED array of two card kinds:
 *   - FREE cards  → free-form team cards (CardModal).
 *   - TASK cards  → the viewer's own formal project deliverables, injected
 *                   read-only per-viewer and rendered as a distinct tile
 *                   (TaskCardModal). See types.ts / isTaskCard.
 * Renders its own `.cyb-scope` wrapper and owns its realtime socket, so it needs
 * no RealtimeProvider or module CSS scope from the host. Loads /board once and
 * refetches IN-PLACE on every realtime push (the view stays mounted so an open
 * modal survives pushes: modals re-derive their card from the fresh board by
 * id). */

interface DragState {
  kind: "card";
  id: string;
}

/** sys-<status> list id → task status. Lists are fixed by the backend. */
const STATUS_OF: Record<string, BoardTaskStatus> = {
  "sys-todo": "todo",
  "sys-progress": "progress",
  "sys-review": "review",
  "sys-done": "done",
};
function statusOf(listId: string): BoardTaskStatus | null {
  return STATUS_OF[listId] ?? null;
}

export function BoardView({
  boardName,
}: {
  /** Board owner shown in the title ("Departemen Perencanaan"). Defaults to
   *  the viewer's own department from /board. */
  boardName?: string;
} = {}) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Only operational directors (Dirops / CEO / all-access / super admin) may
  // browse the board ACROSS divisions. Everyone else (kadep, staff) is scoped
  // to their own division. The board `me.role` is collapsed to "kadep" by the
  // SSO bridge, so read the real role from the app AuthContext instead.
  const { user } = useAuth();
  const canAllDivisions = !!user && (
    user.allAccess || user.super || user.role === "dirops" || user.role === "ceo"
  );

  // Toolbar filters.
  const [q, setQ] = useState("");
  const [fMembers, setFMembers] = useState<string[]>([]);
  const [fLabels, setFLabels] = useState<string[]>([]);
  const [fDivision, setFDivision] = useState("");
  const [labelFilterOpen, setLabelFilterOpen] = useState(false);

  // Inline "+ Buat Tugas" editor (creates a FREE card in a status column).
  const [addCardFor, setAddCardFor] = useState<string | null>(null);
  const [newCard, setNewCard] = useState("");

  // HTML5 drag & drop (both card kinds move between the 4 fixed columns).
  const dragRef = useRef<DragState | null>(null);
  const [dropHint, setDropHint] = useState<{ listId: string; index: number } | null>(null);

  const reload = useCallback(() => {
    boardApi
      .board()
      .then((b) => {
        setBoard(b);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(reload, [reload]);

  // Own realtime socket (no RealtimeProvider needed): every backend push
  // refetches the board in place, so an open card modal survives.
  useRealtimeSocket(boardApi.wsUrl(), reload);

  // If the open card was deleted elsewhere, close the modal.
  useEffect(() => {
    if (openId && board && !(board.lists ?? []).some((l) => (l.cards ?? []).some((c) => c.id === openId))) {
      setOpenId(null);
    }
  }, [board, openId]);

  const users = board?.users ?? [];
  const labels = board?.labels ?? [];
  const lists = board?.lists ?? [];
  const depts = board?.departments ?? [];

  const nameOf = useCallback(
    (u: string) => users.find((x) => x.username === u)?.name ?? u,
    [users],
  );
  const deptName = useCallback(
    (code: string) => depts.find((d) => d.code === code)?.name ?? code,
    [depts],
  );

  // "Papan Tugas — Departemen X": explicit prop wins, else the viewer's own
  // department from /board (shared component: hosts may not pass anything).
  const ownDept = board?.me.division ? deptName(board.me.division) : "";
  const title =
    "Papan Tugas" + (boardName ? ` — ${boardName}` : ownDept ? ` — Departemen ${ownDept}` : "");

  const cardVisible = (c: BoardCard): boolean => {
    const needle = q.trim().toLowerCase();
    if (needle) {
      // Task cards are also matchable by project name/GP and PIC name.
      const hay = isTaskCard(c)
        ? [c.title, c.project.name, c.project.gp, nameOf(c.task.pic)].join(" ").toLowerCase()
        : c.title.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (fMembers.length && !(c.members ?? []).some((m) => fMembers.includes(m))) return false;
    if (fLabels.length && !(c.labels ?? []).some((l) => fLabels.includes(l))) return false;
    // Non-directors: hard-scope to their OWN division. Untagged cards and cards
    // they're on (member/creator) stay visible so nobody loses their own work;
    // OTHER divisions' cards are hidden (they also have no division dropdown).
    if (!canAllDivisions) {
      const myDiv = board?.me.division ?? "";
      const me = board?.me.username ?? "";
      const mine =
        c.division === myDiv ||
        c.division === "" ||
        (c.members ?? []).includes(me) ||
        c.createdBy === me;
      if (!mine) return false;
    }
    // Directors' optional division dropdown.
    if (canAllDivisions && fDivision && c.division !== fDivision) return false;
    return true;
  };

  /* ---- Local (optimistic) helpers --------------------------------------- */

  const findCard = (id: string): BoardCard | undefined => {
    for (const l of board?.lists ?? []) {
      const c = (l.cards ?? []).find((x) => x.id === id);
      if (c) return c;
    }
    return undefined;
  };

  /** Apply an in-place patch to one card in local state (optimistic UI). */
  const localPatchCard = useCallback((cardId: string, up: (c: BoardCard) => BoardCard) => {
    setBoard((b) =>
      b
        ? {
            ...b,
            lists: (b.lists ?? []).map((l) => ({
              ...l,
              cards: (l.cards ?? []).map((c) => (c.id === cardId ? up(c) : c)),
            })),
          }
        : b,
    );
  }, []);

  /** Optimistic FREE-card move/reorder + PATCH {listId,index}; reload on error. */
  const moveCard = (cardId: string, toListId: string, rawIndex: number) => {
    if (!board) return;
    let moved: BoardCard | undefined;
    let fromIdx = -1;
    let fromList = "";
    for (const l of board.lists ?? []) {
      const i = (l.cards ?? []).findIndex((c) => c.id === cardId);
      if (i >= 0) {
        moved = (l.cards ?? [])[i];
        fromIdx = i;
        fromList = l.id;
        break;
      }
    }
    if (!moved || isTaskCard(moved)) return; // task moves go through moveTask()
    // The hint index was computed BEFORE removal — shift down when moving
    // later within the same list.
    let idx = rawIndex;
    if (fromList === toListId && fromIdx < rawIndex) idx = rawIndex - 1;
    if (fromList === toListId && fromIdx === idx) return; // dropped in place
    const nextLists = (board.lists ?? []).map((l) => ({
      ...l,
      cards: (l.cards ?? []).filter((c) => c.id !== cardId),
    }));
    const target = nextLists.find((l) => l.id === toListId);
    if (!target) return;
    idx = Math.max(0, Math.min(idx, target.cards.length));
    target.cards.splice(idx, 0, { ...moved, listId: toListId });
    setBoard({ ...board, lists: nextLists });
    boardApi.updateBoardCard(cardId, { listId: toListId, index: idx }).catch(() => reload());
  };

  /** Optimistic TASK-card move between columns + PATCH task status; reload
   *  afterwards. Task cards live after free cards, so append to the target. */
  const moveTask = (card: BoardTaskCard, toListId: string) => {
    if (card.listId === toListId) return; // same column = no-op
    const status = statusOf(toListId);
    if (!status) return;
    setBoard((b) => {
      if (!b) return b;
      const nextLists = (b.lists ?? []).map((l) => ({
        ...l,
        cards: (l.cards ?? []).filter((c) => c.id !== card.id),
      }));
      const target = nextLists.find((l) => l.id === toListId);
      if (target) {
        target.cards.push({ ...card, listId: toListId, task: { ...card.task, status } });
      }
      return { ...b, lists: nextLists };
    });
    boardApi
      .taskSetStatus(card.task.projectId, card.task.taskId, status)
      .then(reload)
      .catch(() => reload());
  };

  /** Route a card drop to the free-card or task-card mover. */
  const dropCard = (toListId: string, index: number) => {
    const d = dragRef.current;
    if (d?.kind !== "card") return;
    const dragged = findCard(d.id);
    if (!dragged) return;
    if (isTaskCard(dragged)) moveTask(dragged, toListId);
    else moveCard(dragged.id, toListId, index);
  };

  /* ---- Mutations --------------------------------------------------------- */

  const createCard = async (listId: string) => {
    const t = newCard.trim();
    if (!t) return;
    try {
      await boardApi.createBoardCard(listId, t);
      setNewCard(""); // keep the input open for consecutive adds
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  /* ---- Render ------------------------------------------------------------ */

  if (!board && !err) {
    return (
      <div className="cyb-scope">
        <div className="empty-note">
          <div className="spinner" /> Memuat papan…
        </div>
      </div>
    );
  }

  return (
    <div className="cyb-scope">
      <div className="cyb-wrap">
        <div className="cyb-toolbar">
          <h2 className="cyb-title">{title}</h2>
          <div className="cyb-tools">
            <input
              className="cyb-search"
              placeholder="Cari kartu / proyek / PIC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="cyb-filter-avs">
              {users.map((u) => (
                <button
                  key={u.username}
                  className={"cyb-av cyb-av-btn" + (fMembers.includes(u.username) ? " on" : "")}
                  style={{ background: avatarBg(u.username) }}
                  title={u.name}
                  onClick={() =>
                    setFMembers((f) =>
                      f.includes(u.username) ? f.filter((x) => x !== u.username) : [...f, u.username],
                    )
                  }
                >
                  {initialsOf(u.name)}
                </button>
              ))}
            </div>
            <div className="cyb-pop-wrap">
              <button
                className={"cyb-btn-ghost" + (fLabels.length ? " on" : "")}
                onClick={() => setLabelFilterOpen((v) => !v)}
              >
                Label{fLabels.length > 0 ? ` (${fLabels.length})` : ""} ▾
              </button>
              {labelFilterOpen && (
                <div className="cyb-pop">
                  {labels.length === 0 && <div className="cyb-pop-empty">Belum ada label</div>}
                  {labels.map((lb) => (
                    <button
                      key={lb.id}
                      className="cyb-pop-row"
                      onClick={() =>
                        setFLabels((f) =>
                          f.includes(lb.id) ? f.filter((x) => x !== lb.id) : [...f, lb.id],
                        )
                      }
                    >
                      <span className="cyb-lb-swatch" style={{ background: lb.color }} />
                      <span className="cyb-pop-name">{lb.name}</span>
                      {fLabels.includes(lb.id) && <span className="cyb-pop-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {canAllDivisions && (
              <select
                className="cyb-select"
                title="Filter divisi (lintas divisi — khusus Dirops)"
                value={fDivision}
                onChange={(e) => setFDivision(e.target.value)}
              >
                <option value="">Semua divisi</option>
                {depts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {err && <div className="empty-note error">{err}</div>}

        <div className="cyb-board">
          {lists.map((l) => {
            const cards = l.cards ?? [];
            return (
              <div className="cyb-col" key={l.id}>
                {/* Fixed system column — header is just title + count (no
                    rename/delete/reorder; the four lists are immutable). */}
                <div className="cyb-col-hd">
                  <span className="cyb-col-title">{l.title}</span>
                  <span className="cyb-col-count">{cards.length}</span>
                  <span className="cyb-sp" />
                </div>

                <div
                  className="cyb-col-body"
                  onDragOver={(e) => {
                    if (dragRef.current?.kind !== "card") return;
                    e.preventDefault();
                    setDropHint({ listId: l.id, index: cards.length });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragRef.current?.kind === "card" && dropHint) {
                      dropCard(dropHint.listId, dropHint.index);
                    }
                    dragRef.current = null;
                    setDropHint(null);
                  }}
                >
                  {cards.map((c, i) => {
                    if (!cardVisible(c)) return null;
                    return (
                      <Fragment key={c.id}>
                        {dropHint && dropHint.listId === l.id && dropHint.index === i && (
                          <div className="cyb-drop-line" />
                        )}
                        <div
                          className={"cyb-card" + (isTaskCard(c) ? " cyb-task" : "")}
                          draggable
                          onClick={() => setOpenId(c.id)}
                          onDragStart={(e) => {
                            dragRef.current = { kind: "card", id: c.id };
                            e.dataTransfer.effectAllowed = "move";
                            try {
                              e.dataTransfer.setData("text/plain", c.id);
                            } catch {
                              /* older browsers */
                            }
                          }}
                          onDragEnd={() => {
                            dragRef.current = null;
                            setDropHint(null);
                          }}
                          onDragOver={(e) => {
                            if (dragRef.current?.kind !== "card") return;
                            e.preventDefault();
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            const before = e.clientY < r.top + r.height / 2;
                            setDropHint({ listId: l.id, index: i + (before ? 0 : 1) });
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragRef.current?.kind === "card" && dropHint) {
                              dropCard(dropHint.listId, dropHint.index);
                            }
                            dragRef.current = null;
                            setDropHint(null);
                          }}
                        >
                          {isTaskCard(c)
                            ? renderTaskTile(c)
                            : renderFreeTile(c)}
                        </div>
                      </Fragment>
                    );
                  })}
                  {dropHint && dropHint.listId === l.id && dropHint.index >= cards.length && (
                    <div className="cyb-drop-line" />
                  )}
                  {cards.length === 0 && !dropHint && <div className="cyb-col-empty">Belum ada tugas</div>}
                </div>

                <div className="cyb-col-foot">
                  {addCardFor === l.id ? (
                    <input
                      autoFocus
                      className="cyb-inline-input"
                      placeholder="Judul tugas… (Enter)"
                      value={newCard}
                      onChange={(e) => setNewCard(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createCard(l.id);
                        if (e.key === "Escape") setAddCardFor(null);
                      }}
                      onBlur={() => {
                        if (!newCard.trim()) setAddCardFor(null);
                      }}
                    />
                  ) : (
                    <button
                      className="cyb-add-card"
                      onClick={() => {
                        setAddCardFor(l.id);
                        setNewCard("");
                      }}
                    >
                      + Buat Tugas
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {labelFilterOpen && (
          <div className="cyb-pop-scrim" onClick={() => setLabelFilterOpen(false)} />
        )}

        {openId &&
          board &&
          (() => {
            const c = findCard(openId);
            if (!c) return null;
            if (isTaskCard(c)) {
              return (
                <TaskCardModal
                  board={board}
                  cardId={openId}
                  onClose={() => setOpenId(null)}
                  reload={reload}
                />
              );
            }
            return (
              <CardModal
                board={board}
                cardId={openId}
                boardName={boardName ?? (ownDept ? `Departemen ${ownDept}` : "Papan Tugas")}
                onClose={() => setOpenId(null)}
                reload={reload}
                onLocalCard={localPatchCard}
              />
            );
          })()}
      </div>
    </div>
  );

  /* ---- Tile renderers (closures over labels/deptName/nameOf) -------------- */

  function renderFreeTile(c: BoardCard) {
    if (isTaskCard(c)) return null; // narrows to BoardFreeCard below
    const agg = checklistAgg(c);
    const cardLabels = (c.labels ?? [])
      .map((id) => labels.find((x) => x.id === id))
      .filter((x): x is NonNullable<typeof x> => !!x);
    return (
      <>
        {c.cover && (
          <img
            className="cyb-card-cover"
            src={boardApi.boardAttachmentUrl(c.cover)}
            alt=""
            draggable={false}
          />
        )}
        {(cardLabels.length > 0 || c.division) && (
          <div className="cyb-card-labels">
            {cardLabels.map((lb) => (
              <span
                key={lb.id}
                className="cyb-chip"
                style={{ background: lb.color, color: labelTextColor(lb.color) }}
              >
                {lb.name}
              </span>
            ))}
            {c.division && (
              <span className="cyb-div-chip" title={`Divisi: ${deptName(c.division)}`}>
                {deptName(c.division)}
              </span>
            )}
          </div>
        )}
        <div className="cyb-card-title">{c.title}</div>
        <div className="cyb-card-meta">
          {c.desc && (
            <span className="cyb-mi" title="Ada catatan">
              ☰
            </span>
          )}
          {(c.attachments ?? []).length > 0 && (
            <span className="cyb-mi" title="Lampiran">
              📎 {(c.attachments ?? []).length}
            </span>
          )}
          {agg.total > 0 && (
            <span className={"cyb-mi" + (agg.done === agg.total ? " ok" : "")} title="Ceklis">
              ✓ {agg.done}/{agg.total}
            </span>
          )}
          {c.due && (
            <span className={"cyb-due" + (c.dueDone ? " done" : isOverdue(c) ? " late" : "")}>
              🕐 {fmtDayMonth(c.due)}
            </span>
          )}
          <span className="cyb-sp" />
          {(c.members ?? []).length > 0 && (
            <span className="cyb-avs">
              {(c.members ?? []).slice(0, 4).map((m) => (
                <span key={m} className="cyb-av" title={nameOf(m)} style={{ background: avatarBg(m) }}>
                  {initialsOf(nameOf(m))}
                </span>
              ))}
              {(c.members ?? []).length > 4 && (
                <span className="cyb-av more">+{(c.members ?? []).length - 4}</span>
              )}
            </span>
          )}
        </div>
      </>
    );
  }

  function renderTaskTile(c: BoardTaskCard) {
    const t = c.task;
    return (
      <>
        <div className="cyb-task-head">
          <span className="cyb-task-pill">📋 PROYEK</span>
          <span className="cyb-sp" />
          {t.revisiNote && <span className="cyb-task-revisi">REVISI</span>}
        </div>
        <div className="cyb-card-labels">
          {t.output && (
            <span className="cyb-div-chip" title={`Output: ${deptName(t.output)}`}>
              {deptName(t.output)}
            </span>
          )}
        </div>
        <div className="cyb-card-title">{c.title}</div>
        <div className="cyb-task-sub" title={`${c.project.gp} · ${c.project.name}`}>
          {c.project.gp} · {c.project.name}
        </div>
        <div className="cyb-card-meta">
          {t.hasDoc && (
            <span className="cyb-task-mark" title="Ada dokumen review">
              📄
            </span>
          )}
          {t.approvedBy && (
            <span className="cyb-task-mark ok" title={`Disetujui oleh ${nameOf(t.approvedBy)}`}>
              ✓ Disetujui
            </span>
          )}
          <span className="cyb-sp" />
          <span className="cyb-avs">
            <span className="cyb-av" title={nameOf(t.pic)} style={{ background: avatarBg(t.pic) }}>
              {initialsOf(nameOf(t.pic))}
            </span>
          </span>
        </div>
      </>
    );
  }
}
