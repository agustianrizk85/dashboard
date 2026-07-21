import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardApiError, boardApi } from "./boardApi";
import type {
  BoardAiCheck,
  BoardAttachment,
  BoardCard,
  BoardChecklistItem,
  BoardData,
  BoardFreeCard,
} from "./types";
import { isTaskCard } from "./types";
import {
  LABEL_COLORS,
  aiFindingParts,
  attKind,
  avatarBg,
  extBadge,
  fmtDayMonth,
  fmtDueLong,
  fmtMonthDay,
  fmtSize,
  fmtWhen,
  initialsOf,
  labelTextColor,
  toLocalInput,
} from "./boardFmt";

/* Cycle-style card detail modal (shared across modules). It does NOT own the
 * card data: the card is re-derived from the latest board on every render, so
 * realtime refetches update an open modal live. The parent closes it when the
 * card disappears. */

interface Upload {
  key: number;
  name: string;
  pct: number;
  err?: string;
}

/** Map a free-form severity ("Tinggi", "HIGH", "medium") onto a badge class. */
function sevClass(sev: string): string {
  const s = sev.toLowerCase();
  if (/(high|tinggi|critical|kritis|berat)/.test(s)) return " high";
  if (/(med|sedang)/.test(s)) return " medium";
  if (/(low|rendah|minor|ringan)/.test(s)) return " low";
  return "";
}

export function CardModal({
  board,
  cardId,
  boardName,
  onClose,
  reload,
  onLocalCard,
}: {
  board: BoardData;
  cardId: string;
  /** Board owner for the header sub-line ("Departemen Perencanaan"). */
  boardName: string;
  onClose: () => void;
  reload: () => void;
  /** Optimistic local patch of a card in the parent's board state. */
  onLocalCard: (cardId: string, up: (c: BoardCard) => BoardCard) => void;
}) {
  // CardModal only handles FREE cards; task cards open TaskCardModal instead.
  // Narrow here so the whole modal sees BoardFreeCard (desc/createdAt/… fields).
  const found = useMemo(() => {
    for (const l of board.lists ?? []) {
      const c = (l.cards ?? []).find((x) => x.id === cardId && !isTaskCard(x));
      if (c) return { card: c as BoardFreeCard, list: l };
    }
    return null;
  }, [board, cardId]);
  const card = found?.card;
  const list = found?.list;

  // ---- state (all hooks before the not-found early return) ----------------
  const [mErr, setMErr] = useState("");
  const [pop, setPop] = useState<string | null>(null); // "members" | "member:<u>" | "labels" | "due" | "att:<id>"
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [memberQ, setMemberQ] = useState("");
  const [labelNew, setLabelNew] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [dueDraft, setDueDraft] = useState("");
  const [dueDoneDraft, setDueDoneDraft] = useState(false);
  const [addingCl, setAddingCl] = useState(false);
  const [clTitle, setClTitle] = useState("");
  const [clEdit, setClEdit] = useState<string | null>(null);
  const [clEditVal, setClEditVal] = useState("");
  const [itemFor, setItemFor] = useState<string | null>(null);
  const [itemText, setItemText] = useState("");
  const [attView, setAttView] = useState<"grid" | "list">("grid");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [commentText, setCommentText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const upSeq = useRef(0);

  // Cek AI state — restored via GET on open, polled every 3s while running.
  const [ai, setAi] = useState<BoardAiCheck | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const aiPrevStatus = useRef("");
  const aiRunning = ai?.status === "running";

  const fetchAi = useCallback(() => {
    boardApi
      .aiCheck(cardId)
      .then((s) => {
        const was = aiPrevStatus.current;
        aiPrevStatus.current = s.status;
        setAi(s);
        // Just finished: open the result panel and reload the board so the
        // auto-posted "ai" comment shows up in Komentar.
        if (was === "running" && (s.status === "done" || s.status === "error")) {
          setAiOpen(true);
          reload();
        }
      })
      .catch(() => {
        /* AI state is best-effort; board data stays authoritative */
      });
  }, [cardId, reload]);

  // Reset transient editors when switching to another card.
  useEffect(() => {
    setTitleDraft(null);
    setDescDraft(null);
    setPop(null);
    setLightbox(null);
    setPdfView(null);
    setMErr("");
    setAi(null);
    setAiOpen(true);
    aiPrevStatus.current = "";
  }, [cardId]);

  // Restore the AI-check state once per card open.
  useEffect(fetchAi, [fetchAi]);

  // Poll while a check is running (the backend works in the background).
  useEffect(() => {
    if (!aiRunning) return;
    const t = setInterval(fetchAi, 3000);
    return () => clearInterval(t);
  }, [aiRunning, fetchAi]);

  // Also refetch on every realtime board bump while running — the "done" push
  // usually arrives well before the next 3s tick.
  useEffect(() => {
    if (aiRunning) fetchAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // Esc closes the topmost layer; ←/→ navigate the image lightbox.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null);
        else if (pdfView) setPdfView(null);
        else if (pop) setPop(null);
        else onClose();
        return;
      }
      if (lightbox && (e.key === "ArrowLeft" || e.key === "ArrowRight") && card) {
        const images = (card.attachments ?? []).filter((a) => attKind(a) === "image");
        if (images.length < 2) return;
        const idx = images.findIndex((a) => a.id === lightbox);
        const next =
          e.key === "ArrowRight"
            ? (idx + 1) % images.length
            : (idx - 1 + images.length) % images.length;
        setLightbox(images[next].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox, pdfView, pop, onClose, card]);

  // Autosize the notes textarea.
  useEffect(() => {
    const el = taRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight + 2, 420) + "px";
    }
  }, [descDraft, card?.desc]);

  if (!card || !list) return null;

  // ---- permissions ---------------------------------------------------------
  const me = board.me;
  const admin = me.admin;
  const contributor =
    admin || card.createdBy === me.username || (card.members ?? []).includes(me.username);
  const accessLabel = admin ? "Admin" : contributor ? "Kontributor" : "Pengamat";
  const canDeleteCard = contributor;

  const nameOf = (u: string) => (board.users ?? []).find((x) => x.username === u)?.name ?? u;
  /** Comment/creator display name — the backend posts AI results as "ai". */
  const authorName = (u: string) => (u === "ai" ? "🤖 AI" : nameOf(u));

  const depts = board.departments ?? [];
  const deptName = (code: string) => depts.find((d) => d.code === code)?.name ?? code;

  const cardLabels = (card.labels ?? [])
    .map((id) => (board.labels ?? []).find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const candidates = (board.users ?? []).filter(
    (u) =>
      !(card.members ?? []).includes(u.username) &&
      (memberQ.trim() === "" ||
        u.name.toLowerCase().includes(memberQ.trim().toLowerCase()) ||
        u.username.toLowerCase().includes(memberQ.trim().toLowerCase())),
  );

  const comments = [...(card.comments ?? [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  const aiAttName = ai?.attId
    ? (card.attachments ?? []).find((a) => a.id === ai.attId)?.name ?? "lampiran"
    : "lampiran";

  // ---- mutations -----------------------------------------------------------
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      setMErr("");
      await fn();
      after?.();
      reload();
    } catch (e) {
      setMErr(e instanceof Error ? e.message : String(e));
    }
  };

  const commitTitle = () => {
    const t = (titleDraft ?? "").trim();
    setTitleDraft(null);
    if (!t || t === card.title) return;
    void run(() => boardApi.updateBoardCard(card.id, { title: t }));
  };

  const saveDesc = () => {
    if (descDraft === null) return;
    void run(() => boardApi.updateBoardCard(card.id, { desc: descDraft }), () => setDescDraft(null));
  };

  const openDuePop = () => {
    setDueDraft(toLocalInput(card.due));
    setDueDoneDraft(card.dueDone);
    setPop(pop === "due" ? null : "due");
  };

  const saveDue = () =>
    run(
      () =>
        boardApi.updateBoardCard(card.id, {
          due: dueDraft ? new Date(dueDraft).toISOString() : "",
          dueDone: dueDoneDraft,
        }),
      () => setPop(null),
    );

  const clearDue = () =>
    run(() => boardApi.updateBoardCard(card.id, { due: "", dueDone: false }), () => setPop(null));

  const createLabel = () => {
    const n = labelName.trim();
    if (!n) return;
    void run(
      async () => {
        const lb = await boardApi.createBoardLabel(n, labelColor);
        await boardApi.addBoardCardLabel(card.id, lb.id);
      },
      () => {
        setLabelNew(false);
        setLabelName("");
      },
    );
  };

  const toggleItem = (clId: string, it: BoardChecklistItem) => {
    if (!contributor) return;
    const next = !it.done;
    // Optimistic flip so the checkbox feels instant; the reload picks up the
    // server-stamped doneAt. (Task cards carry no editable checklists — guard
    // keeps the union spread narrowed to free cards.)
    onLocalCard(card.id, (c) =>
      isTaskCard(c)
        ? c
        : {
            ...c,
            checklists: (c.checklists ?? []).map((cl) =>
              cl.id === clId
                ? {
                    ...cl,
                    items: (cl.items ?? []).map((x) =>
                      x.id === it.id
                        ? { ...x, done: next, doneAt: next ? new Date().toISOString() : "" }
                        : x,
                    ),
                  }
                : cl,
            ),
          },
    );
    boardApi
      .updateBoardChecklistItem(card.id, clId, it.id, { done: next })
      .then(reload)
      .catch(() => reload());
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const cid = card.id;
    Array.from(files).forEach((f) => {
      const key = ++upSeq.current;
      setUploads((u) => [...u, { key, name: f.name, pct: 0 }]);
      boardApi
        .uploadBoardAttachment(cid, f, (pct) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x))),
        )
        .then(() => {
          setUploads((u) => u.filter((x) => x.key !== key));
          reload();
        })
        .catch((e) =>
          setUploads((u) =>
            u.map((x) =>
              x.key === key ? { ...x, err: e instanceof Error ? e.message : String(e) } : x,
            ),
          ),
        );
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Kick a Cek AI run on a pdf/image attachment (409 = one already running). */
  const startAiCheck = (a: BoardAttachment) => {
    setPop(null);
    setMErr("");
    boardApi
      .startAiCheck(card.id, a.id)
      .then(() => {
        aiPrevStatus.current = "running";
        setAi({ status: "running", attId: a.id });
      })
      .catch((e) => {
        if (e instanceof BoardApiError && e.status === 409) {
          // Already running — just sync to the in-flight check.
          fetchAi();
          return;
        }
        setMErr(e instanceof Error ? e.message : String(e));
      });
  };

  const deleteCard = () => {
    if (!window.confirm("Hapus kartu ini beserta seluruh isinya?")) return;
    void run(() => boardApi.deleteBoardCard(card.id), onClose);
  };

  // ---- render --------------------------------------------------------------
  return (
    <div
      className="cyb-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cyb-modal">
        <button className="cyb-x" onClick={onClose} aria-label="Tutup">
          ×
        </button>

        {mErr && <div className="cyb-merr">{mErr}</div>}

        {/* ---- Header ---- */}
        <div className="cyb-m-head">
          {contributor ? (
            <input
              className="cyb-m-title"
              value={titleDraft ?? card.title}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <h2 className="cyb-m-title-ro">{card.title}</h2>
          )}
          <div className="cyb-m-sub">
            di dalam list <u>{list.title}</u> di <u>{boardName}</u>
          </div>
          <div className="cyb-m-creator">
            <span className="cyb-av" style={{ background: avatarBg(card.createdBy) }}>
              {initialsOf(nameOf(card.createdBy))}
            </span>
            <span className="cyb-m-cname">{nameOf(card.createdBy)}</span>
            {card.createdAt && <span className="cyb-m-cdate">{fmtMonthDay(card.createdAt)}</span>}
            <span className="cyb-sp" />
            {canDeleteCard && (
              <button className="cyb-btn-ghost danger sm" onClick={deleteCard}>
                Hapus kartu
              </button>
            )}
            <span className="cyb-m-access">🛡 Akses: {accessLabel}</span>
          </div>
        </div>

        {/* ---- ANGGOTA / LABEL / TANGGAL / DIVISI ---- */}
        <div className="cyb-m-meta">
          <div className="cyb-m-block">
            <div className="cyb-m-label">Anggota</div>
            <div className="cyb-m-avrow">
              {(card.members ?? []).map((m) => (
                <div className="cyb-pop-wrap" key={m}>
                  <button
                    className="cyb-av cyb-av-lg cyb-av-btn"
                    style={{ background: avatarBg(m) }}
                    title={nameOf(m)}
                    onClick={() => setPop(pop === "member:" + m ? null : "member:" + m)}
                  >
                    {initialsOf(nameOf(m))}
                  </button>
                  {pop === "member:" + m && (
                    <div className="cyb-pop">
                      <div className="cyb-pop-title">{nameOf(m)}</div>
                      <div className="cyb-pop-sub">@{m}</div>
                      {contributor && (
                        <button
                          className="cyb-pop-row danger"
                          onClick={() =>
                            void run(() => boardApi.removeBoardMember(card.id, m), () => setPop(null))
                          }
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {contributor && (
                <div className="cyb-pop-wrap">
                  <button
                    className="cyb-av-add"
                    title="Tambah anggota"
                    onClick={() => {
                      setMemberQ("");
                      setPop(pop === "members" ? null : "members");
                    }}
                  >
                    +
                  </button>
                  {pop === "members" && (
                    <div className="cyb-pop cyb-pop-wide">
                      <input
                        autoFocus
                        className="cyb-inline-input"
                        placeholder="Cari nama…"
                        value={memberQ}
                        onChange={(e) => setMemberQ(e.target.value)}
                      />
                      <div className="cyb-pop-list">
                        {candidates.map((u) => (
                          <button
                            key={u.username}
                            className="cyb-pop-row"
                            onClick={() => void run(() => boardApi.addBoardMember(card.id, u.username))}
                          >
                            <span className="cyb-av" style={{ background: avatarBg(u.username) }}>
                              {initialsOf(u.name)}
                            </span>
                            <span className="cyb-pop-name">{u.name}</span>
                          </button>
                        ))}
                        {candidates.length === 0 && (
                          <div className="cyb-pop-empty">Tidak ada user</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(card.members ?? []).length === 0 && !contributor && (
                <span className="cyb-none">—</span>
              )}
            </div>
          </div>

          <div className="cyb-m-block">
            <div className="cyb-m-label">Label</div>
            <div className="cyb-m-chips">
              {cardLabels.map((lb) => (
                <span
                  key={lb.id}
                  className="cyb-chip cyb-chip-lg"
                  style={{ background: lb.color, color: labelTextColor(lb.color) }}
                >
                  {lb.name}
                </span>
              ))}
              {contributor && (
                <div className="cyb-pop-wrap">
                  <button
                    className="cyb-av-add"
                    title="Kelola label"
                    onClick={() => {
                      setLabelNew(false);
                      setPop(pop === "labels" ? null : "labels");
                    }}
                  >
                    +
                  </button>
                  {pop === "labels" && (
                    <div className="cyb-pop cyb-pop-wide">
                      <div className="cyb-pop-title">Label</div>
                      <div className="cyb-pop-list">
                        {(board.labels ?? []).map((lb) => {
                          const onCard = (card.labels ?? []).includes(lb.id);
                          return (
                            <button
                              key={lb.id}
                              className="cyb-pop-row"
                              onClick={() =>
                                void run(() =>
                                  onCard
                                    ? boardApi.removeBoardCardLabel(card.id, lb.id)
                                    : boardApi.addBoardCardLabel(card.id, lb.id),
                                )
                              }
                            >
                              <span className="cyb-lb-swatch" style={{ background: lb.color }} />
                              <span className="cyb-pop-name">{lb.name}</span>
                              {onCard && <span className="cyb-pop-check">✓</span>}
                            </button>
                          );
                        })}
                        {(board.labels ?? []).length === 0 && (
                          <div className="cyb-pop-empty">Belum ada label</div>
                        )}
                      </div>
                      {!labelNew ? (
                        <button className="cyb-pop-row" onClick={() => setLabelNew(true)}>
                          + Buat label baru
                        </button>
                      ) : (
                        <div className="cyb-newlabel">
                          <input
                            autoFocus
                            className="cyb-inline-input"
                            placeholder="Nama label"
                            value={labelName}
                            onChange={(e) => setLabelName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") createLabel();
                            }}
                          />
                          <div className="cyb-swatches">
                            {LABEL_COLORS.map((c) => (
                              <button
                                key={c}
                                className={"cyb-swatch" + (labelColor === c ? " on" : "")}
                                style={{ background: c }}
                                title={c}
                                onClick={() => setLabelColor(c)}
                              />
                            ))}
                          </div>
                          <button className="cyb-btn" onClick={createLabel}>
                            Simpan
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {cardLabels.length === 0 && !contributor && <span className="cyb-none">—</span>}
            </div>
          </div>

          <div className="cyb-m-block">
            <div className="cyb-m-label">Tanggal</div>
            <div className="cyb-pop-wrap">
              {card.due ? (
                <button
                  className={
                    "cyb-due-pill" + (card.dueDone ? " done" : "") + (!contributor ? " ro" : "")
                  }
                  onClick={contributor ? openDuePop : undefined}
                >
                  {fmtDueLong(card.due)}
                  {card.dueDone && <span className="cyb-due-flag">Selesai</span>}
                  {contributor && <span className="cyb-caret">▾</span>}
                </button>
              ) : contributor ? (
                <button className="cyb-btn-ghost" onClick={openDuePop}>
                  + Tambah tanggal
                </button>
              ) : (
                <span className="cyb-none">Tidak ada</span>
              )}
              {pop === "due" && (
                <div className="cyb-pop cyb-pop-wide">
                  <div className="cyb-pop-title">Tanggal jatuh tempo</div>
                  <input
                    type="datetime-local"
                    className="cyb-inline-input"
                    value={dueDraft}
                    onChange={(e) => setDueDraft(e.target.value)}
                  />
                  <label className="cyb-checkline">
                    <input
                      type="checkbox"
                      checked={dueDoneDraft}
                      onChange={(e) => setDueDoneDraft(e.target.checked)}
                    />
                    Selesai
                  </label>
                  <div className="cyb-pop-actions">
                    <button className="cyb-btn" onClick={() => void saveDue()}>
                      Simpan
                    </button>
                    {card.due && (
                      <button className="cyb-btn-ghost danger" onClick={() => void clearDue()}>
                        Hapus tanggal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="cyb-m-block">
            <div className="cyb-m-label">Divisi</div>
            {contributor ? (
              <select
                className="cyb-select"
                value={card.division || ""}
                onChange={(e) =>
                  void run(() => boardApi.updateBoardCard(card.id, { division: e.target.value }))
                }
              >
                <option value="">—</option>
                {depts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : card.division ? (
              <span className="cyb-div-chip lg" title={card.division}>
                {deptName(card.division)}
              </span>
            ) : (
              <span className="cyb-none">—</span>
            )}
          </div>
        </div>

        {/* ---- Catatan ---- */}
        <div className="cyb-sec">
          <div className="cyb-m-label">Catatan</div>
          {contributor ? (
            <>
              <textarea
                ref={taRef}
                className="cyb-desc"
                placeholder="Tulis catatan…"
                value={descDraft ?? card.desc}
                onChange={(e) => setDescDraft(e.target.value)}
              />
              {descDraft !== null && descDraft !== card.desc && (
                <div className="cyb-desc-actions">
                  <button className="cyb-btn" onClick={saveDesc}>
                    Simpan
                  </button>
                  <button className="cyb-btn-ghost" onClick={() => setDescDraft(null)}>
                    Batal
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {card.desc && <div className="cyb-desc-ro">{card.desc}</div>}
              <div className="cyb-noaccess">
                Kamu ga punya akses untuk edit catatan. Minimal Kontributor keatas untuk edit
                catatan
              </div>
            </>
          )}
        </div>

        {/* ---- Ceklis ---- */}
        <div className="cyb-sec">
          <div className="cyb-m-label">Ceklis</div>
          {(card.checklists ?? []).map((cl) => {
            const items = cl.items ?? [];
            const doneN = items.filter((i) => i.done).length;
            const pct = items.length ? Math.round((doneN / items.length) * 100) : 0;
            return (
              <div className="cyb-cl" key={cl.id}>
                <div className="cyb-cl-hd">
                  <span className="cyb-cl-ic">⊘</span>
                  {clEdit === cl.id ? (
                    <input
                      autoFocus
                      className="cyb-inline-input"
                      value={clEditVal}
                      onChange={(e) => setClEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setClEdit(null);
                      }}
                      onBlur={() => {
                        const t = clEditVal.trim();
                        setClEdit(null);
                        if (t && t !== cl.title) {
                          void run(() => boardApi.updateBoardChecklist(card.id, cl.id, { title: t }));
                        }
                      }}
                    />
                  ) : (
                    <span
                      className={"cyb-cl-title" + (contributor ? " editable" : "")}
                      onClick={
                        contributor
                          ? () => {
                              setClEdit(cl.id);
                              setClEditVal(cl.title);
                            }
                          : undefined
                      }
                    >
                      {cl.title}
                    </span>
                  )}
                  <span className="cyb-sp" />
                  {contributor && (
                    <button
                      className="cyb-btn-ghost danger sm"
                      onClick={() => {
                        if (window.confirm("Hapus ceklis ini?")) {
                          void run(() => boardApi.deleteBoardChecklist(card.id, cl.id));
                        }
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <div className="cyb-cl-prog">
                  <span className="cyb-cl-pct">{pct}%</span>
                  <div className="cyb-cl-bar">
                    <div className="cyb-cl-fill" style={{ width: pct + "%" }} />
                  </div>
                </div>
                {items.map((it) => (
                  <div className={"cyb-item" + (it.done ? " done" : "")} key={it.id}>
                    <input
                      type="checkbox"
                      checked={it.done}
                      disabled={!contributor}
                      onChange={() => toggleItem(cl.id, it)}
                    />
                    <span className="cyb-item-text">{it.text}</span>
                    {it.done && it.doneAt && (
                      <span className="cyb-done-badge">✓ {fmtDayMonth(it.doneAt)}</span>
                    )}
                    {contributor && (
                      <button
                        className="cyb-item-del"
                        title="Hapus item"
                        onClick={() =>
                          void run(() => boardApi.deleteBoardChecklistItem(card.id, cl.id, it.id))
                        }
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}
                {contributor &&
                  (itemFor === cl.id ? (
                    <input
                      autoFocus
                      className="cyb-inline-input"
                      placeholder="Item baru… (Enter)"
                      value={itemText}
                      onChange={(e) => setItemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const t = itemText.trim();
                          if (t) {
                            void run(
                              () => boardApi.addBoardChecklistItem(card.id, cl.id, t),
                              () => setItemText(""),
                            );
                          }
                        }
                        if (e.key === "Escape") setItemFor(null);
                      }}
                      onBlur={() => {
                        if (!itemText.trim()) setItemFor(null);
                      }}
                    />
                  ) : (
                    <button
                      className="cyb-add-inline"
                      onClick={() => {
                        setItemFor(cl.id);
                        setItemText("");
                      }}
                    >
                      + Tambah item
                    </button>
                  ))}
              </div>
            );
          })}
          {contributor &&
            (addingCl ? (
              <input
                autoFocus
                className="cyb-inline-input"
                placeholder="Judul ceklis… (Enter)"
                value={clTitle}
                onChange={(e) => setClTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const t = clTitle.trim();
                    if (t) {
                      void run(
                        () => boardApi.createBoardChecklist(card.id, t),
                        () => {
                          setClTitle("");
                          setAddingCl(false);
                        },
                      );
                    }
                  }
                  if (e.key === "Escape") setAddingCl(false);
                }}
                onBlur={() => {
                  if (!clTitle.trim()) setAddingCl(false);
                }}
              />
            ) : (
              <button
                className="cyb-btn-ghost"
                onClick={() => {
                  setAddingCl(true);
                  setClTitle("");
                }}
              >
                + Tambah ceklis
              </button>
            ))}
          {(card.checklists ?? []).length === 0 && !contributor && (
            <div className="cyb-none">Belum ada ceklis</div>
          )}
        </div>

        {/* ---- Lampiran ---- */}
        <div className="cyb-sec">
          <div className="cyb-sec-hd">
            <div className="cyb-m-label">Lampiran</div>
            <span className="cyb-sp" />
            <button
              className={"cyb-view-btn" + (attView === "grid" ? " on" : "")}
              title="Tampilan grid"
              onClick={() => setAttView("grid")}
            >
              ▦
            </button>
            <button
              className={"cyb-view-btn" + (attView === "list" ? " on" : "")}
              title="Tampilan daftar"
              onClick={() => setAttView("list")}
            >
              ☰
            </button>
            {contributor && (
              <button className="cyb-btn" onClick={() => fileRef.current?.click()}>
                + Tambah Lampiran
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {uploads.length > 0 && (
            <div className="cyb-uploads">
              {uploads.map((u) => (
                <div className={"cyb-upload" + (u.err ? " err" : "")} key={u.key}>
                  <span className="cyb-upload-name" title={u.name}>
                    {u.name}
                  </span>
                  {u.err ? (
                    <>
                      <span className="cyb-upload-err">{u.err}</span>
                      <button
                        className="cyb-item-del"
                        title="Tutup"
                        onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="cyb-cl-bar">
                        <div className="cyb-cl-fill" style={{ width: u.pct + "%" }} />
                      </div>
                      <span className="cyb-upload-pct">{u.pct}%</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- Cek AI: progress / hasil / error ---- */}
          {aiRunning && (
            <div className="cyb-ai-strip">
              <span>🤖 AI sedang memeriksa {aiAttName}…</span>
              <div className="cyb-ai-bar" />
            </div>
          )}
          {ai?.status === "done" && (
            <div className="cyb-ai-panel">
              <button className="cyb-ai-hd" onClick={() => setAiOpen((v) => !v)}>
                <span>🤖 Hasil Cek AI</span>
                <span className="cyb-ai-when">{aiAttName}</span>
                <span className="cyb-sp" />
                {ai.checkedAt && <span className="cyb-ai-when">{fmtWhen(ai.checkedAt)}</span>}
                <span className="cyb-caret">{aiOpen ? "▴" : "▾"}</span>
              </button>
              {aiOpen && (
                <div className="cyb-ai-bd">
                  {ai.summary && <div className="cyb-ai-summary">{ai.summary}</div>}
                  {(ai.findings ?? []).length > 0 && (
                    <div className="cyb-ai-findings">
                      {(ai.findings ?? []).map((f, i) => {
                        const { severity, text } = aiFindingParts(f);
                        return (
                          <div className="cyb-ai-finding" key={i}>
                            {severity && (
                              <span className={"cyb-ai-sev" + sevClass(severity)}>{severity}</span>
                            )}
                            <span>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!ai.summary && (ai.findings ?? []).length === 0 && (
                    <div className="cyb-none">Tidak ada temuan.</div>
                  )}
                </div>
              )}
            </div>
          )}
          {ai?.status === "error" && (
            <div className="cyb-ai-err">
              🤖 Cek AI gagal: {ai.error || "kesalahan tidak diketahui"}
            </div>
          )}

          <div className={"cyb-atts " + attView}>
            {(card.attachments ?? []).map((a) => {
              const kind = attKind(a);
              const url = boardApi.boardAttachmentUrl(a.id);
              return (
                <div className={"cyb-att " + kind} key={a.id}>
                  <div className="cyb-att-prev">
                    {kind === "image" && (
                      <button className="cyb-att-imgbtn" onClick={() => setLightbox(a.id)}>
                        <img src={url} alt={a.name} loading="lazy" />
                      </button>
                    )}
                    {kind === "video" && <video controls preload="metadata" src={url} />}
                    {kind === "audio" && (
                      <div className="cyb-att-audio">
                        <span className="cyb-att-ic">🎵</span>
                        <audio controls preload="metadata" src={url} />
                      </div>
                    )}
                    {kind === "pdf" && (
                      <button className="cyb-att-pdf" onClick={() => setPdfView(a.id)}>
                        PDF
                      </button>
                    )}
                    {kind === "other" && (
                      <button
                        className="cyb-att-ext"
                        title="Unduh"
                        onClick={() => window.open(boardApi.boardAttachmentUrl(a.id, true), "_blank")}
                      >
                        {extBadge(a)}
                      </button>
                    )}
                  </div>
                  <div className="cyb-att-info">
                    <div className="cyb-att-name" title={a.name}>
                      {a.name}
                    </div>
                    <div className="cyb-att-meta">
                      {fmtSize(a.size)} · oleh {nameOf(a.by)} · {fmtDayMonth(a.at)}
                    </div>
                  </div>
                  <div className="cyb-pop-wrap">
                    <button
                      className="cyb-col-menu"
                      title="Menu lampiran"
                      onClick={() => setPop(pop === "att:" + a.id ? null : "att:" + a.id)}
                    >
                      ⋯
                    </button>
                    {pop === "att:" + a.id && (
                      <div className="cyb-pop cyb-pop-right">
                        <button
                          className="cyb-pop-row"
                          onClick={() => {
                            setPop(null);
                            window.open(boardApi.boardAttachmentUrl(a.id, true), "_blank");
                          }}
                        >
                          Unduh
                        </button>
                        {contributor && (kind === "pdf" || kind === "image") && (
                          <button
                            className="cyb-pop-row"
                            title="Periksa lampiran ini dengan AI"
                            onClick={() => startAiCheck(a)}
                          >
                            🤖 Cek AI
                          </button>
                        )}
                        {contributor && kind === "image" && card.cover !== a.id && (
                          <button
                            className="cyb-pop-row"
                            onClick={() =>
                              void run(
                                () => boardApi.updateBoardCard(card.id, { cover: a.id }),
                                () => setPop(null),
                              )
                            }
                          >
                            Jadikan Cover
                          </button>
                        )}
                        {contributor && card.cover === a.id && (
                          <button
                            className="cyb-pop-row"
                            onClick={() =>
                              void run(
                                () => boardApi.updateBoardCard(card.id, { cover: "" }),
                                () => setPop(null),
                              )
                            }
                          >
                            Hapus Cover
                          </button>
                        )}
                        {contributor && (
                          <button
                            className="cyb-pop-row danger"
                            onClick={() => {
                              if (window.confirm("Hapus lampiran ini?")) {
                                void run(
                                  () => boardApi.deleteBoardAttachment(card.id, a.id),
                                  () => setPop(null),
                                );
                              }
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {(card.attachments ?? []).length === 0 && uploads.length === 0 && (
              <div className="cyb-none">Belum ada lampiran</div>
            )}
          </div>
        </div>

        {/* ---- Komentar ---- */}
        <div className="cyb-sec">
          <div className="cyb-m-label">Komentar</div>
          <div className="cyb-comment-composer">
            <span className="cyb-av" style={{ background: avatarBg(me.username) }}>
              {initialsOf(nameOf(me.username))}
            </span>
            <input
              className="cyb-inline-input"
              placeholder="Tulis komentar…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) {
                  void run(
                    () => boardApi.addBoardComment(card.id, commentText.trim()),
                    () => setCommentText(""),
                  );
                }
              }}
            />
            <button
              className="cyb-btn"
              disabled={!commentText.trim()}
              onClick={() =>
                void run(
                  () => boardApi.addBoardComment(card.id, commentText.trim()),
                  () => setCommentText(""),
                )
              }
            >
              Kirim
            </button>
          </div>
          <div className="cyb-comments">
            {comments.map((cm) => (
              <div className="cyb-comment" key={cm.id}>
                {cm.author === "ai" ? (
                  <span className="cyb-av cyb-av-ai" title="AI">
                    🤖
                  </span>
                ) : (
                  <span className="cyb-av" style={{ background: avatarBg(cm.author) }}>
                    {initialsOf(nameOf(cm.author))}
                  </span>
                )}
                <div className="cyb-comment-bd">
                  <div className="cyb-comment-hd">
                    <span className="cyb-comment-author">{authorName(cm.author)}</span>
                    <span className="cyb-comment-when">{fmtWhen(cm.at)}</span>
                    {(admin || cm.author === me.username) && (
                      <button
                        className="cyb-item-del"
                        title="Hapus komentar"
                        onClick={() => void run(() => boardApi.deleteBoardComment(card.id, cm.id))}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  <div className="cyb-comment-text">{cm.text}</div>
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="cyb-none">Belum ada komentar</div>}
          </div>
        </div>
      </div>

      {pop && <div className="cyb-pop-scrim" onClick={() => setPop(null)} />}

      {/* ---- Image lightbox ---- */}
      {lightbox &&
        (() => {
          const images = (card.attachments ?? []).filter((a) => attKind(a) === "image");
          const idx = images.findIndex((a) => a.id === lightbox);
          const cur = idx >= 0 ? images[idx] : null;
          if (!cur) return null;
          return (
            <div
              className="cyb-lightbox"
              onClick={(e) => {
                if (e.target === e.currentTarget) setLightbox(null);
              }}
            >
              <button className="cyb-lb-x" onClick={() => setLightbox(null)} aria-label="Tutup">
                ×
              </button>
              {images.length > 1 && (
                <button
                  className="cyb-lb-nav prev"
                  aria-label="Sebelumnya"
                  onClick={() =>
                    setLightbox(images[(idx - 1 + images.length) % images.length].id)
                  }
                >
                  ‹
                </button>
              )}
              <img src={boardApi.boardAttachmentUrl(cur.id)} alt={cur.name} />
              {images.length > 1 && (
                <button
                  className="cyb-lb-nav next"
                  aria-label="Berikutnya"
                  onClick={() => setLightbox(images[(idx + 1) % images.length].id)}
                >
                  ›
                </button>
              )}
              <div className="cyb-lb-name">{cur.name}</div>
            </div>
          );
        })()}

      {/* ---- PDF viewer ---- */}
      {pdfView &&
        (() => {
          const a = (card.attachments ?? []).find((x) => x.id === pdfView);
          if (!a) return null;
          return (
            <div
              className="cyb-lightbox pdf"
              onClick={(e) => {
                if (e.target === e.currentTarget) setPdfView(null);
              }}
            >
              <div className="cyb-pdf-frame">
                <div className="cyb-pdf-hd">
                  <span className="cyb-att-name">{a.name}</span>
                  <span className="cyb-sp" />
                  <button
                    className="cyb-btn-ghost"
                    onClick={() => window.open(boardApi.boardAttachmentUrl(a.id, true), "_blank")}
                  >
                    Unduh
                  </button>
                  <button className="cyb-x-inline" onClick={() => setPdfView(null)} aria-label="Tutup">
                    ×
                  </button>
                </div>
                <iframe title={a.name} src={boardApi.boardAttachmentUrl(a.id)} />
              </div>
            </div>
          );
        })()}
    </div>
  );
}
