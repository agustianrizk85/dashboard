import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { SkillMeta } from "../../api/client";
import { Icon } from "../Icon";
import "./skill.css";

/**
 * SkillView — multi-skill editor for the AI features. A "skill" is a Markdown
 * checklist the vision AI follows during Deep Analisis / Deep Revisi. Managers
 * can maintain SEVERAL skills (create / edit / delete) and each analysis run
 * picks which ones to apply. Left: skill list; right: editor + live preview.
 */
export function SkillView({ canManage }: { canManage: boolean }) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [sel, setSel] = useState<string>("");
  const [content, setContent] = useState("");
  const [orig, setOrig] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBody, setLoadingBody] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // new-skill form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const refreshList = async (selectName?: string) => {
    const list = await api.skills();
    setSkills(list);
    const next = selectName ?? sel ?? (list[0]?.name ?? "");
    if (next && list.some((s) => s.name === next)) setSel(next);
    else if (list.length) setSel(list[0].name);
    else setSel("");
    return list;
  };

  useEffect(() => {
    api
      .skills()
      .then((list) => {
        setSkills(list);
        if (list.length) setSel(list[0].name);
      })
      .catch((e) => setMsg({ ok: false, text: `⚠ Gagal memuat daftar skill: ${errText(e)}` }))
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected skill's content.
  useEffect(() => {
    if (!sel) {
      setContent("");
      setOrig("");
      return;
    }
    let alive = true;
    setLoadingBody(true);
    api
      .skillGet(sel)
      .then((r) => {
        if (!alive) return;
        setContent(r.content);
        setOrig(r.content);
      })
      .catch((e) => alive && setMsg({ ok: false, text: `⚠ ${errText(e)}` }))
      .finally(() => alive && setLoadingBody(false));
    return () => {
      alive = false;
    };
  }, [sel]);

  const dirty = content !== orig;
  const preview = useMemo(() => renderMarkdown(content), [content]);
  const selMeta = skills.find((s) => s.name === sel);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api.saveSkillNamed(sel, content);
      setContent(r.content);
      setOrig(r.content);
      await refreshList(sel);
      setMsg({ ok: true, text: "✓ Tersimpan — dipakai pada analisis berikutnya" });
    } catch (e) {
      setMsg({ ok: false, text: `⚠ ${errText(e)}` });
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    const name = newName.trim().toLowerCase();
    setMsg(null);
    try {
      const meta = await api.createSkill(name, newTitle.trim());
      setCreating(false);
      setNewName("");
      setNewTitle("");
      await refreshList(meta.name);
      setSel(meta.name);
      setMsg({ ok: true, text: `✓ Skill "${meta.title}" dibuat` });
    } catch (e) {
      setMsg({ ok: false, text: `⚠ ${errText(e)}` });
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Hapus skill "${name}"? Tidak bisa dikembalikan.`)) return;
    setMsg(null);
    try {
      await api.deleteSkill(name);
      const list = await refreshList();
      setSel(list[0]?.name ?? "");
      setMsg({ ok: true, text: `✓ Skill "${name}" dihapus` });
    } catch (e) {
      setMsg({ ok: false, text: `⚠ ${errText(e)}` });
    }
  };

  return (
    <div className="skill-view">
      <div className="skill-head">
        <div className="skill-head-txt">
          <h2>
            <Icon name="flag" size={18} /> Skill AI — Checklist Pengecekan
          </h2>
          <p>
            Kumpulan checklist yang diikuti AI vision saat <b>Deep Analisis</b> / <b>Deep Revisi</b>. Kelola
            beberapa skill di sini; tiap analisis bisa memilih skill mana yang dipakai. Edit langsung dipakai
            pada cek berikutnya (tanpa restart).
          </p>
        </div>
      </div>

      {msg && <div className={`skill-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      {loadingList ? (
        <div className="empty-note">Memuat daftar skill…</div>
      ) : (
        <div className="skill-multi">
          {/* ---- Skill list ---- */}
          <aside className="skill-list">
            <div className="skill-list-hd">Skill ({skills.length})</div>
            {skills.map((s) => (
              <button
                key={s.name}
                type="button"
                className={`skill-list-item ${s.name === sel ? "on" : ""}`}
                onClick={() => setSel(s.name)}
                title={s.name}
              >
                <span className="skill-list-title">{s.title}</span>
                <span className="skill-list-name">{s.name}.md</span>
              </button>
            ))}
            {skills.length === 0 && <div className="skill-list-empty">Belum ada skill.</div>}
            {canManage &&
              (creating ? (
                <div className="skill-new">
                  <input
                    className="skill-new-in"
                    placeholder="nama-file (huruf-kecil)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                    spellCheck={false}
                  />
                  <input
                    className="skill-new-in"
                    placeholder="Judul skill"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <div className="skill-new-act">
                    <button type="button" className="skill-btn ghost" onClick={() => setCreating(false)}>
                      Batal
                    </button>
                    <button type="button" className="skill-btn" disabled={!newName.trim()} onClick={create}>
                      Buat
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="skill-add" onClick={() => setCreating(true)}>
                  + Skill baru
                </button>
              ))}
          </aside>

          {/* ---- Editor + preview for the selected skill ---- */}
          <div className="skill-main">
            {!sel ? (
              <div className="empty-note">Pilih atau buat skill untuk mulai mengedit.</div>
            ) : (
              <>
                <div className="skill-main-hd">
                  <div className="skill-main-title">
                    {selMeta?.title ?? sel} <span className="skill-main-file">{sel}.md</span>
                  </div>
                  {canManage && (
                    <div className="skill-actions">
                      <button type="button" className="skill-btn danger" onClick={() => remove(sel)}>
                        Hapus
                      </button>
                      {dirty && (
                        <button
                          type="button"
                          className="skill-btn ghost"
                          disabled={saving}
                          onClick={() => setContent(orig)}
                        >
                          Batal
                        </button>
                      )}
                      <button type="button" className="skill-btn" disabled={!dirty || saving} onClick={save}>
                        {saving ? "Menyimpan…" : dirty ? "Simpan" : "Tersimpan"}
                      </button>
                    </div>
                  )}
                </div>

                {loadingBody ? (
                  <div className="empty-note">Memuat skill…</div>
                ) : (
                  <div className="skill-split">
                    <div className="skill-pane">
                      <div className="skill-pane-label">
                        Editor · Markdown {!canManage && <span className="skill-ro">(hanya baca)</span>}
                      </div>
                      <textarea
                        className="skill-editor"
                        value={content}
                        spellCheck={false}
                        readOnly={!canManage}
                        onChange={(e) => setContent(e.target.value)}
                      />
                    </div>
                    <div className="skill-pane">
                      <div className="skill-pane-label">Preview</div>
                      <div className="skill-md" dangerouslySetInnerHTML={{ __html: preview }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ---- lightweight markdown renderer (no external lib) ------------------- */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline formatting: bold, italic, inline code — applied AFTER html-escaping. */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
}

/** Minimal block-level markdown → HTML: headings, ul/ol lists, paragraphs. */
function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const tag = "h" + Math.min(6, h[1].length + 2); // # -> h3, ## -> h4 …
      out.push(`<${tag}>${inline(h[2])}</${tag}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
