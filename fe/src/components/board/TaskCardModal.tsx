import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardApiError, boardApi } from "./boardApi";
import type { BoardSkill, BoardData, BoardTaskAi, BoardTaskStatus } from "./types";
import { isTaskCard } from "./types";
import {
  aiFindingParts,
  attKind,
  avatarBg,
  extBadge,
  fmtDayMonth,
  fmtSize,
  fmtWhen,
  initialsOf,
} from "./boardFmt";

/* Detail modal for a formal project TASK card (read-only projection of a Data
 * Master deliverable). Self-contained: it calls the boardApi task methods and
 * re-derives its task from the freshest board data on every render, so realtime
 * refetches keep an open modal live. When the card disappears it renders null
 * and the parent closes it. Rendered inside its own `.cyb-scope` wrapper so the
 * board CSS applies even if a host mounts it standalone. */

/** One in-flight attachment upload (mirrors CardModal's Lampiran uploader). */
interface Upload {
  key: number;
  name: string;
  pct: number;
  err?: string;
}

const STATUS_STEPS: { key: BoardTaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "progress", label: "Sedang Dikerjakan" },
  { key: "review", label: "Review" },
  { key: "done", label: "Selesai" },
];

/** Map a free-form severity ("Tinggi", "HIGH", "medium") onto a badge class. */
function sevClass(sev: string): string {
  const s = sev.toLowerCase();
  if (/(high|tinggi|critical|kritis|berat)/.test(s)) return " high";
  if (/(med|sedang)/.test(s)) return " medium";
  if (/(low|rendah|minor|ringan)/.test(s)) return " low";
  return "";
}

export function TaskCardModal({
  board,
  cardId,
  onClose,
  reload,
}: {
  board: BoardData;
  cardId: string;
  onClose: () => void;
  /** Refetch the board after every mutation (shared with BoardView). */
  reload: () => void;
}) {
  // Freshest task card by id (survives realtime bumps); null → parent closes.
  const found = useMemo(() => {
    for (const l of board.lists ?? []) {
      const c = (l.cards ?? []).find((x) => x.id === cardId);
      if (c && isTaskCard(c)) return c;
    }
    return null;
  }, [board, cardId]);
  // Keep a ref so stable callbacks (fetchAi) can read pid/tid without deps.
  const cardRef = useRef(found);
  cardRef.current = found;

  const [mErr, setMErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [aiPdfOpen, setAiPdfOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ---- Lampiran (multi-file, any type) state ------------------------------
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null); // image attId
  const [attPdf, setAttPdf] = useState<string | null>(null); // pdf attId in iframe
  const [attPop, setAttPop] = useState<string | null>(null); // attId whose menu is open
  const attFileRef = useRef<HTMLInputElement | null>(null);
  const upSeq = useRef(0);

  // ---- Deep Analisis pickers (skills + PDF source) ------------------------
  const [skills, setSkills] = useState<BoardSkill[]>([]); // available skills (may be empty)
  const [selSkills, setSelSkills] = useState<string[]>([]); // selected skill NAMES (default: none)
  const [selAttId, setSelAttId] = useState<string | null>(null); // null = follow default source
  const [skillPop, setSkillPop] = useState(false); // skill searchable dropdown open
  const [skillQuery, setSkillQuery] = useState("");
  const [filePop, setFilePop] = useState(false); // file searchable dropdown open
  const [fileQuery, setFileQuery] = useState("");
  const [commentText, setCommentText] = useState("");

  // Deep Analisis AI state — restored on open, polled every 3s while running.
  const [ai, setAi] = useState<BoardTaskAi | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const aiPrevStatus = useRef("");
  const aiRunning = ai?.status === "running";

  const fetchAi = useCallback(() => {
    const c = cardRef.current;
    if (!c) return;
    boardApi
      .taskAI(c.task.projectId, c.task.taskId)
      .then((s) => {
        const was = aiPrevStatus.current;
        aiPrevStatus.current = s.status;
        setAi(s);
        if (was === "running" && (s.status === "done" || s.status === "error")) {
          setAiOpen(true);
          reload();
        }
      })
      .catch(() => {
        /* AI state is best-effort; board data stays authoritative */
      });
  }, [reload]);

  // Reset transient editors + AI state when switching to another task.
  useEffect(() => {
    setMErr("");
    setBusy(false);
    setPdfOpen(false);
    setAiPdfOpen(false);
    setRejecting(false);
    setRejectNote("");
    setUploadPct(null);
    setUploads([]);
    setLightbox(null);
    setAttPdf(null);
    setAttPop(null);
    setSelSkills([]);
    setSelAttId(null);
    setSkillPop(false);
    setSkillQuery("");
    setFilePop(false);
    setFileQuery("");
    setCommentText("");
    setAi(null);
    setAiOpen(true);
    aiPrevStatus.current = "";
  }, [cardId]);

  // Load the available Deep Analisis skills once (best-effort). An empty or
  // failed load hides the skill picker and falls back to the backend default.
  useEffect(() => {
    let alive = true;
    boardApi
      .boardSkills()
      .then((s) => {
        if (alive) setSkills(Array.isArray(s) ? s : []);
      })
      .catch(() => {
        if (alive) setSkills([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Restore the Deep Analisis state once per task open.
  useEffect(() => {
    fetchAi();
  }, [cardId, fetchAi]);

  // Poll while a run is in progress (backend works in the background).
  useEffect(() => {
    if (!aiRunning) return;
    const t = setInterval(fetchAi, 3000);
    return () => clearInterval(t);
  }, [aiRunning, fetchAi]);

  // Also refetch on every realtime board bump while running — the "done" push
  // usually arrives before the next 3s tick.
  useEffect(() => {
    if (aiRunning) fetchAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // Esc closes the topmost layer; ←/→ navigate the image lightbox.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null);
        else if (attPdf) setAttPdf(null);
        else if (pdfOpen) setPdfOpen(false);
        else if (aiPdfOpen) setAiPdfOpen(false);
        else if (attPop) setAttPop(null);
        else onClose();
        return;
      }
      if (lightbox && (e.key === "ArrowLeft" || e.key === "ArrowRight") && found) {
        const images = (found.attachments ?? []).filter((a) => attKind(a) === "image");
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
  }, [lightbox, attPdf, pdfOpen, aiPdfOpen, attPop, onClose, found]);

  if (!found) return null;
  const { task, project } = found;
  const pid = task.projectId;
  const tid = task.taskId;

  // ---- permissions --------------------------------------------------------
  const me = board.me;
  const admin = me.admin;
  const isPic = me.username === task.pic;
  const canEdit = admin || isPic;
  const accessLabel = admin ? "Admin" : isPic ? "PIC" : "Pengamat";

  const nameOf = (u: string) => (board.users ?? []).find((x) => x.username === u)?.name ?? u;
  const depts = board.departments ?? [];
  const deptName = (code: string) => depts.find((d) => d.code === code)?.name ?? code;

  // ---- Deep Analisis source picker (review Doc + PDF attachments) ----------
  const attachments = found.attachments ?? [];
  const pdfAtts = attachments.filter((a) => attKind(a) === "pdf");
  // Selectable sources for "File dianalisis": review Doc (value "") then PDFs.
  const pdfSources: { value: string; label: string }[] = [
    ...(task.hasDoc ? [{ value: "", label: "Dokumen Review" }] : []),
    ...pdfAtts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const hasAnyPdf = pdfSources.length > 0;
  // Effective selection: honour the user's pick if still valid, else the first
  // available source (review Doc when present, otherwise the first PDF).
  const effectiveAttId =
    selAttId !== null && pdfSources.some((s) => s.value === selAttId)
      ? selAttId
      : pdfSources[0]?.value ?? "";

  // ---- mutations ----------------------------------------------------------
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      setMErr("");
      await fn();
      after?.();
      reload();
    } catch (e) {
      setMErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: BoardTaskStatus) => {
    if (!canEdit || status === task.status || busy) return;
    void run(() => boardApi.taskSetStatus(pid, tid, status));
  };

  const onDocFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setMErr("");
    setUploadPct(0);
    boardApi
      .uploadTaskDoc(pid, tid, f, setUploadPct)
      .then(() => {
        setUploadPct(null);
        reload();
      })
      .catch((e) => {
        setUploadPct(null);
        setMErr(e instanceof Error ? e.message : String(e));
      });
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Upload one or more Lampiran files of ANY type (mirrors CardModal). */
  const onAttFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => {
      const key = ++upSeq.current;
      setUploads((u) => [...u, { key, name: f.name, pct: 0 }]);
      boardApi
        .uploadTaskAttachment(pid, tid, f, (pct) =>
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
    if (attFileRef.current) attFileRef.current.value = "";
  };

  const deleteAtt = (attId: string) => {
    if (!window.confirm("Hapus lampiran ini?")) return;
    void run(() => boardApi.deleteTaskAttachment(pid, tid, attId), () => setAttPop(null));
  };

  const approve = () => void run(() => boardApi.approveTask(pid, tid));

  const submitReject = () => {
    const note = rejectNote.trim();
    if (!note) return;
    void run(
      () => boardApi.rejectTask(pid, tid, note),
      () => {
        setRejecting(false);
        setRejectNote("");
      },
    );
  };

  /** Kick a Deep Analisis run over the chosen PDF source with the selected
   *  skills (409 = one already running → sync to it). */
  const startAI = () => {
    if (!canEdit || !hasAnyPdf) return;
    setMErr("");
    boardApi
      .startTaskAI(pid, tid, selSkills, effectiveAttId || undefined)
      .then(() => {
        aiPrevStatus.current = "running";
        setAi({ status: "running" });
      })
      .catch((e) => {
        if (e instanceof BoardApiError && e.status === 409) {
          fetchAi();
          return;
        }
        setMErr(e instanceof Error ? e.message : String(e));
      });
  };

  const toggleSkill = (name: string) =>
    setSelSkills((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const canApprove = task.status === "review" && task.hasDoc && admin && !task.approvedBy;

  // ---- Deep Analisis progress + findings (shared by running & done) --------
  const aiFindings = ai?.findings ?? [];
  const aiDone = ai?.done ?? 0;
  const aiTotal = ai?.total ?? 0;
  const aiPct = aiTotal > 0 ? Math.min(100, Math.round((aiDone / aiTotal) * 100)) : 0;
  const findingsList =
    aiFindings.length > 0 ? (
      <div className="cyb-ai-findings">
        {aiFindings.map((f, i) => {
          const { severity, text } = aiFindingParts(f);
          return (
            <div className="cyb-ai-finding" key={i}>
              {severity && <span className={"cyb-ai-sev" + sevClass(severity)}>{severity}</span>}
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    ) : null;

  // One PDF docked BESIDE the modal (review Doc / annotated AI / a lampiran
  // PDF) so the findings and the document are visible side by side.
  const sideAtt = attPdf ? attachments.find((x) => x.id === attPdf) : null;
  const sidePdf = aiPdfOpen
    ? {
        src: boardApi.taskAIPdfUrl(pid, tid),
        title: `PDF Anotasi AI — ${found.title}`,
        download: "",
        close: () => setAiPdfOpen(false),
      }
    : pdfOpen
      ? {
          src: boardApi.taskDocUrl(pid, tid),
          title: `Dokumen Review — ${found.title}`,
          download: "",
          close: () => setPdfOpen(false),
        }
      : sideAtt
        ? {
            src: boardApi.taskAttachmentUrl(pid, tid, sideAtt.id),
            title: sideAtt.name,
            download: boardApi.taskAttachmentUrl(pid, tid, sideAtt.id, true),
            close: () => setAttPdf(null),
          }
        : null;

  // ---- render -------------------------------------------------------------
  return (
    <div className="cyb-scope">
      <div
        className={"cyb-scrim" + (sidePdf ? " split" : "")}
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
            <div className="cyb-task-badge-row">
              <span className="cyb-task-pill lg">📋 PROYEK</span>
              {task.revisiNote && <span className="cyb-task-revisi">REVISI</span>}
              {task.approvedBy && <span className="cyb-task-approved-pill">✓ Disetujui</span>}
              <span className="cyb-sp" />
              <span className="cyb-m-access">🛡 Akses: {accessLabel}</span>
            </div>
            <h2 className="cyb-m-title-ro">{found.title}</h2>
            <div className="cyb-m-sub">
              Tugas proyek · <u>{project.gp}</u> — <u>{project.name}</u> · {task.category} /{" "}
              {task.group}
            </div>
          </div>

          {/* ---- Status ---- */}
          <div className="cyb-sec">
            <div className="cyb-m-label">Status</div>
            <div className="cyb-seg">
              {STATUS_STEPS.map((s) => (
                <button
                  key={s.key}
                  className={"cyb-seg-btn" + (task.status === s.key ? " on" : "")}
                  disabled={!canEdit || busy}
                  onClick={() => setStatus(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {!canEdit && (
              <div className="cyb-none">Hanya PIC atau admin yang dapat mengubah status.</div>
            )}
          </div>

          {/* ---- PIC & Output ---- */}
          <div className="cyb-sec">
            <div className="cyb-m-meta">
              <div className="cyb-m-block">
                <div className="cyb-m-label">PIC</div>
                <div className="cyb-m-avrow">
                  <span className="cyb-av cyb-av-lg" style={{ background: avatarBg(task.pic) }}>
                    {initialsOf(nameOf(task.pic))}
                  </span>
                  <span className="cyb-m-cname cyb-task-picname">{nameOf(task.pic)}</span>
                </div>
              </div>
              <div className="cyb-m-block">
                <div className="cyb-m-label">Output</div>
                <div className="cyb-m-chips">
                  {task.output ? (
                    <span className="cyb-div-chip lg">{deptName(task.output)}</span>
                  ) : (
                    <span className="cyb-none">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---- Dokumen Review (PDF) ---- */}
          <div className="cyb-sec">
            <div className="cyb-sec-hd">
              <div className="cyb-m-label">Dokumen Review (PDF)</div>
              <span className="cyb-sp" />
              {task.hasDoc && (
                <button className="cyb-btn-ghost" onClick={() => setPdfOpen(true)}>
                  Lihat PDF
                </button>
              )}
              {canEdit && (
                <button
                  className="cyb-btn"
                  disabled={uploadPct !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  {task.hasDoc ? "Ganti PDF" : "+ Unggah PDF"}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => onDocFile(e.target.files)}
              />
            </div>
            {uploadPct !== null && (
              <div className="cyb-upload">
                <span className="cyb-upload-name">Mengunggah…</span>
                <div className="cyb-cl-bar">
                  <div className="cyb-cl-fill" style={{ width: uploadPct + "%" }} />
                </div>
                <span className="cyb-upload-pct">{uploadPct}%</span>
              </div>
            )}
            {!task.hasDoc && uploadPct === null && (
              <div className="cyb-none">Belum ada dokumen review.</div>
            )}
          </div>

          {/* ---- Lampiran (semua jenis file) ---- */}
          <div className="cyb-sec">
            <div className="cyb-sec-hd">
              <div className="cyb-m-label">Lampiran</div>
              <span className="cyb-sp" />
              {canEdit && (
                <button className="cyb-btn" onClick={() => attFileRef.current?.click()}>
                  + Tambah Lampiran
                </button>
              )}
              <input
                ref={attFileRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => onAttFiles(e.target.files)}
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

            <div className="cyb-atts grid">
              {attachments.map((a) => {
                const kind = attKind(a);
                const url = boardApi.taskAttachmentUrl(pid, tid, a.id);
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
                        <button className="cyb-att-pdf" onClick={() => setAttPdf(a.id)}>
                          PDF
                        </button>
                      )}
                      {kind === "other" && (
                        <button
                          className="cyb-att-ext"
                          title="Unduh"
                          onClick={() =>
                            window.open(boardApi.taskAttachmentUrl(pid, tid, a.id, true), "_blank")
                          }
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
                        onClick={() => setAttPop(attPop === a.id ? null : a.id)}
                      >
                        ⋯
                      </button>
                      {attPop === a.id && (
                        <div className="cyb-pop cyb-pop-right">
                          <button
                            className="cyb-pop-row"
                            onClick={() => {
                              setAttPop(null);
                              window.open(
                                boardApi.taskAttachmentUrl(pid, tid, a.id, true),
                                "_blank",
                              );
                            }}
                          >
                            Unduh
                          </button>
                          {canEdit && (
                            <button className="cyb-pop-row danger" onClick={() => deleteAtt(a.id)}>
                              Hapus
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {attachments.length === 0 && uploads.length === 0 && (
                <div className="cyb-none">Belum ada lampiran</div>
              )}
            </div>
          </div>

          {/* ---- Persetujuan ---- */}
          <div className="cyb-sec">
            <div className="cyb-m-label">Persetujuan</div>
            {task.approvedBy ? (
              <div className="cyb-task-approved">
                ✓ Disetujui oleh {nameOf(task.approvedBy)}
                {task.approvedAt ? ` · ${fmtWhen(task.approvedAt)}` : ""}
              </div>
            ) : task.revisiNote ? (
              <div className="cyb-task-revisi-note">Revisi diminta: {task.revisiNote}</div>
            ) : (
              <div className="cyb-none">Belum ada keputusan.</div>
            )}
            {canApprove &&
              (rejecting ? (
                <div className="cyb-task-reject">
                  <textarea
                    className="cyb-desc"
                    placeholder="Catatan revisi…"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <div className="cyb-pop-actions">
                    <button
                      className="cyb-btn-ghost danger"
                      disabled={!rejectNote.trim() || busy}
                      onClick={submitReject}
                    >
                      Kirim Revisi
                    </button>
                    <button
                      className="cyb-btn-ghost"
                      onClick={() => {
                        setRejecting(false);
                        setRejectNote("");
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cyb-task-approve-actions">
                  <button className="cyb-btn" disabled={busy} onClick={approve}>
                    Setujui
                  </button>
                  <button
                    className="cyb-btn-ghost danger"
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    Revisi
                  </button>
                </div>
              ))}
          </div>

          {/* ---- Deep Analisis AI ---- */}
          <div className="cyb-sec">
            <div className="cyb-sec-hd">
              <div className="cyb-m-label">Deep Analisis AI</div>
              <span className="cyb-sp" />
              {canEdit && !aiRunning && (
                <button
                  className="cyb-btn"
                  disabled={!hasAnyPdf}
                  title={hasAnyPdf ? "" : "Unggah PDF dulu untuk dianalisis"}
                  onClick={startAI}
                >
                  {ai?.status === "done" || ai?.status === "error"
                    ? "Ulangi Deep Analisis"
                    : "Mulai Deep Analisis"}
                </button>
              )}
            </div>

            {/* Skill picker + PDF source picker (contributor, when idle).
                Both are searchable dropdowns (cyb-pop). */}
            {canEdit && !aiRunning && hasAnyPdf && (
              <div className="cyb-ai-config">
                {skills.length > 0 && (
                  <div className="cyb-ai-cfg-block">
                    <div className="cyb-m-label">Skill AI</div>
                    <div className="cyb-pop-wrap cyb-dd">
                      <button
                        className="cyb-ddbtn"
                        onClick={() => {
                          setSkillPop((v) => !v);
                          setFilePop(false);
                        }}
                      >
                        <span className="cyb-pop-name">
                          {selSkills.length ? `${selSkills.length} skill dipilih` : "Pilih skill…"}
                        </span>
                        <span className="cyb-dd-caret">▾</span>
                      </button>
                      {skillPop && (
                        <div className="cyb-pop cyb-pop-wide">
                          <input
                            className="cyb-pop-search"
                            placeholder="Cari skill…"
                            value={skillQuery}
                            autoFocus
                            onChange={(e) => setSkillQuery(e.target.value)}
                          />
                          <div className="cyb-pop-list">
                            {skills
                              .filter((sk) =>
                                sk.title.toLowerCase().includes(skillQuery.trim().toLowerCase()),
                              )
                              .map((sk) => (
                                <button
                                  className="cyb-pop-row"
                                  key={sk.name}
                                  onClick={() => toggleSkill(sk.name)}
                                >
                                  <span className="cyb-pop-name">{sk.title}</span>
                                  {selSkills.includes(sk.name) && (
                                    <span className="cyb-pop-check">✓</span>
                                  )}
                                </button>
                              ))}
                            {skills.filter((sk) =>
                              sk.title.toLowerCase().includes(skillQuery.trim().toLowerCase()),
                            ).length === 0 && <div className="cyb-pop-empty">Tidak ada skill</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="cyb-ai-cfg-block">
                  <div className="cyb-m-label">File dianalisis</div>
                  <div className="cyb-pop-wrap cyb-dd">
                    <button
                      className="cyb-ddbtn"
                      onClick={() => {
                        setFilePop((v) => !v);
                        setSkillPop(false);
                      }}
                    >
                      <span className="cyb-pop-name">
                        {pdfSources.find((s) => s.value === effectiveAttId)?.label ?? "Pilih file…"}
                      </span>
                      <span className="cyb-dd-caret">▾</span>
                    </button>
                    {filePop && (
                      <div className="cyb-pop cyb-pop-wide cyb-pop-right">
                        <input
                          className="cyb-pop-search"
                          placeholder="Cari file…"
                          value={fileQuery}
                          autoFocus
                          onChange={(e) => setFileQuery(e.target.value)}
                        />
                        <div className="cyb-pop-list">
                          {pdfSources
                            .filter((s) =>
                              s.label.toLowerCase().includes(fileQuery.trim().toLowerCase()),
                            )
                            .map((s) => (
                              <button
                                className="cyb-pop-row"
                                key={s.value || "__doc"}
                                onClick={() => {
                                  setSelAttId(s.value);
                                  setFilePop(false);
                                  setFileQuery("");
                                }}
                              >
                                <span className="cyb-pop-name">{s.label}</span>
                                {s.value === effectiveAttId && <span className="cyb-pop-check">✓</span>}
                              </button>
                            ))}
                          {pdfSources.filter((s) =>
                            s.label.toLowerCase().includes(fileQuery.trim().toLowerCase()),
                          ).length === 0 && <div className="cyb-pop-empty">Tidak ada file</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!hasAnyPdf && (
              <div className="cyb-none">Unggah PDF dulu untuk dianalisis.</div>
            )}
            {aiRunning && (
              <div className="cyb-ai-panel">
                <div className="cyb-ai-hd static">
                  <span>🤖 AI sedang menganalisis dokumen…</span>
                  <span className="cyb-sp" />
                  <span className="cyb-ai-when">
                    {aiTotal > 0 ? `Halaman ${aiDone}/${aiTotal} · ${aiPct}%` : "menyiapkan…"}
                  </span>
                </div>
                <div className="cyb-ai-prog">
                  {aiTotal > 0 ? (
                    <div className="cyb-cl-bar">
                      <div className="cyb-cl-fill" style={{ width: aiPct + "%" }} />
                    </div>
                  ) : (
                    <div className="cyb-ai-bar" />
                  )}
                </div>
                {findingsList && (
                  <div className="cyb-ai-bd">
                    <div className="cyb-ai-live-hd">
                      Temuan sejauh ini ({aiFindings.length}):
                    </div>
                    {findingsList}
                  </div>
                )}
              </div>
            )}
            {ai?.status === "done" && (
              <div className="cyb-ai-panel">
                <button className="cyb-ai-hd" onClick={() => setAiOpen((v) => !v)}>
                  <span>🤖 Hasil Deep Analisis</span>
                  <span className="cyb-sp" />
                  {ai.checkedAt && <span className="cyb-ai-when">{fmtWhen(ai.checkedAt)}</span>}
                  <span className="cyb-caret">{aiOpen ? "▴" : "▾"}</span>
                </button>
                {aiOpen && (
                  <div className="cyb-ai-bd">
                    {ai.annotated && (
                      <div className="cyb-ai-actions">
                        <button className="cyb-btn" onClick={() => setAiPdfOpen(true)}>
                          📄 Lihat PDF Anotasi
                        </button>
                      </div>
                    )}
                    {ai.summary && <div className="cyb-ai-summary">{ai.summary}</div>}
                    {aiFindings.length > 0 && (
                      <div className="cyb-ai-live-hd">{aiFindings.length} temuan ditemukan:</div>
                    )}
                    {findingsList}
                    {!ai.summary && aiFindings.length === 0 && (
                      <div className="cyb-none">Tidak ada temuan.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {ai?.status === "error" && (
              <div className="cyb-ai-err">
                🤖 Deep Analisis gagal: {ai.error || "kesalahan tidak diketahui"}
              </div>
            )}
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
                      () => boardApi.addTaskComment(pid, tid, commentText.trim()),
                      () => setCommentText(""),
                    );
                  }
                }}
              />
              <button
                className="cyb-btn"
                disabled={!commentText.trim() || busy}
                onClick={() =>
                  void run(
                    () => boardApi.addTaskComment(pid, tid, commentText.trim()),
                    () => setCommentText(""),
                  )
                }
              >
                Kirim
              </button>
            </div>
            <div className="cyb-comments">
              {(found.comments ?? []).map((cm) => (
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
                      <span className="cyb-comment-author">
                        {cm.author === "ai" ? "🤖 AI" : nameOf(cm.author)}
                      </span>
                      <span className="cyb-comment-when">{fmtWhen(cm.at)}</span>
                      {(admin || cm.author === me.username) && (
                        <button
                          className="cyb-item-del"
                          title="Hapus komentar"
                          onClick={() => void run(() => boardApi.deleteTaskComment(pid, tid, cm.id))}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                    <div className="cyb-comment-text">{cm.text}</div>
                  </div>
                </div>
              ))}
              {(found.comments ?? []).length === 0 && (
                <div className="cyb-none">Belum ada komentar</div>
              )}
            </div>
          </div>
        </div>

        {/* ---- PDF docked beside the modal (findings ↔ document) ---- */}
        {sidePdf && (
          <div className="cyb-side-pdf">
            <div className="cyb-pdf-hd">
              <span className="cyb-att-name">{sidePdf.title}</span>
              <span className="cyb-sp" />
              {sidePdf.download && (
                <button
                  className="cyb-btn-ghost"
                  onClick={() => window.open(sidePdf.download, "_blank")}
                >
                  Unduh
                </button>
              )}
              <button className="cyb-x-inline" onClick={sidePdf.close} aria-label="Tutup PDF">
                ×
              </button>
            </div>
            <iframe title={sidePdf.title} src={sidePdf.src} />
          </div>
        )}

        {/* Close any open popover on outside click. Kept INSIDE .cyb-scrim so it
            shares the pop menu's stacking context — otherwise (as a sibling of the
            scrim) it paints OVER the menu and swallows the row click. */}
        {(attPop || skillPop || filePop) && (
          <div
            className="cyb-pop-scrim"
            onClick={() => {
              setAttPop(null);
              setSkillPop(false);
              setFilePop(false);
            }}
          />
        )}
      </div>

      {/* ---- Lampiran image lightbox ---- */}
      {lightbox &&
        (() => {
          const images = attachments.filter((a) => attKind(a) === "image");
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
                  onClick={() => setLightbox(images[(idx - 1 + images.length) % images.length].id)}
                >
                  ‹
                </button>
              )}
              <img src={boardApi.taskAttachmentUrl(pid, tid, cur.id)} alt={cur.name} />
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

    </div>
  );
}
