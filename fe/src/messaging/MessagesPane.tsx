import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachmentUrl, chatApi, subscribeChat } from "./api";
import type { Attachment, Channel, ChatMessage, Conversation, DirUser } from "./api";
import "./chat.css";

/**
 * MessagesPane — the shared two-pane messaging UI (list + thread + composer +
 * file attach + realtime), parameterised by mode:
 *   • "channels" — per-division group channels (used by Chat).
 *   • "dms"      — 1:1 direct messages per person (used by Kotak Masuk).
 * Splitting by mode keeps Chat = divisions and Kotak Masuk = people, as chosen.
 */

type Mode = "channels" | "dms";
type Target = { kind: "dm"; user: DirUser } | { kind: "channel"; ch: Channel };

export function MessagesPane({ mode }: { mode: Mode }) {
  const isChan = mode === "channels";
  const [dir, setDir] = useState<DirUser[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<Target | null>(null);
  targetRef.current = target;

  const loadLists = useCallback(() => {
    if (isChan) {
      chatApi.channels().then(setChannels).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    } else {
      chatApi.users().then(setDir).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
      chatApi.conversations().then(setConvs).catch(() => {});
    }
  }, [isChan]);

  const loadThread = useCallback((t: Target) => {
    const p = t.kind === "dm" ? chatApi.thread(t.user.id) : chatApi.channelThread(t.ch.code);
    p.then(setThread).catch(() => {});
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    return subscribeChat(() => {
      loadLists();
      if (targetRef.current) loadThread(targetRef.current);
    });
  }, [loadLists, loadThread]);

  const open = useCallback(
    (t: Target) => {
      setTarget(t);
      setErr("");
      loadThread(t);
      const done = t.kind === "dm" ? chatApi.markRead(t.user.id) : chatApi.channelMarkRead(t.ch.code);
      done.then(loadLists).catch(() => {});
    },
    [loadThread, loadLists],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, target]);

  const afterSend = useCallback(() => {
    setInput("");
    if (targetRef.current) loadThread(targetRef.current);
    loadLists();
  }, [loadThread, loadLists]);

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || !target || sending) return;
    setSending(true);
    setErr("");
    try {
      if (target.kind === "dm") await chatApi.send(target.user.id, body);
      else await chatApi.channelSend(target.ch.code, body);
      afterSend();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [input, target, sending, afterSend]);

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !target) return;
      setSending(true);
      setErr("");
      try {
        const caption = input.trim();
        if (target.kind === "dm") await chatApi.sendFile(target.user.id, file, caption);
        else await chatApi.channelSendFile(target.ch.code, file, caption);
        afterSend();
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : String(e2));
      } finally {
        setSending(false);
      }
    },
    [target, input, afterSend],
  );

  const convByUser = useMemo(() => Object.fromEntries(convs.map((c) => [c.userId, c])), [convs]);
  const term = q.trim().toLowerCase();
  const contacts = useMemo(() => {
    const list = dir.filter((u) => !term || u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term));
    return list.sort((a, b) => {
      const ca = convByUser[a.id];
      const cb = convByUser[b.id];
      if (ca && cb) return cb.lastAt - ca.lastAt;
      if (ca) return -1;
      if (cb) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [dir, convByUser, term]);
  const shownChannels = useMemo(
    () => channels.filter((c) => !term || c.name.toLowerCase().includes(term)),
    [channels, term],
  );

  const isChannelTarget = target?.kind === "channel";
  const headTitle = !target ? "" : target.kind === "dm" ? target.user.name : "# " + target.ch.name;
  const headSub = !target ? "" : target.kind === "dm" ? target.user.username : "Saluran divisi · semua anggota";

  return (
    <div className="chat">
      <aside className="chat-list">
        <div className="chat-search">
          <input placeholder={isChan ? "Cari saluran…" : "Cari orang…"} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chat-contacts">
          {isChan
            ? shownChannels.map((ch) => (
                <button
                  key={ch.code}
                  className={`chat-contact ${target?.kind === "channel" && target.ch.code === ch.code ? "on" : ""}`}
                  onClick={() => open({ kind: "channel", ch })}
                  type="button"
                >
                  <span className="chat-ava chan">#</span>
                  <span className="chat-contact-main">
                    <b>{ch.name}</b>
                    <span className="chat-contact-last">{ch.last || "Belum ada pesan"}</span>
                  </span>
                  {ch.unread > 0 && <span className="chat-unread">{ch.unread}</span>}
                </button>
              ))
            : contacts.map((u) => {
                const c = convByUser[u.id];
                return (
                  <button
                    key={u.id}
                    className={`chat-contact ${target?.kind === "dm" && target.user.id === u.id ? "on" : ""}`}
                    onClick={() => open({ kind: "dm", user: u })}
                    type="button"
                  >
                    <span className="chat-ava">{initials(u.name)}</span>
                    <span className="chat-contact-main">
                      <b>{u.name}</b>
                      <span className="chat-contact-last">{c?.last ?? u.username}</span>
                    </span>
                    {c && c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
                  </button>
                );
              })}
          {isChan && shownChannels.length === 0 && <div className="chat-empty sm">Belum ada saluran.</div>}
          {!isChan && contacts.length === 0 && <div className="chat-empty sm">Tidak ada kontak.</div>}
        </div>
      </aside>

      <section className="chat-thread">
        {!target ? (
          <div className="chat-empty">{isChan ? "Pilih saluran divisi untuk mengobrol." : "Pilih orang untuk mengirim pesan."}</div>
        ) : (
          <>
            <header className="chat-thread-hd">
              <span className={`chat-ava ${isChannelTarget ? "chan" : ""}`}>
                {isChannelTarget ? "#" : initials((target as { user: DirUser }).user.name)}
              </span>
              <div>
                <b>{headTitle}</b>
                <span className="chat-thread-sub">{headSub}</span>
              </div>
            </header>
            <div className="chat-msgs" ref={scrollRef}>
              {thread.length === 0 && <div className="chat-empty sm">Belum ada pesan.</div>}
              {thread.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.mine ? "mine" : "theirs"}`}>
                  {isChannelTarget && !m.mine && <span className="chat-bubble-from">{m.fromName}</span>}
                  {m.att && <AttachmentView att={m.att} />}
                  {m.body && <span className="chat-bubble-body">{m.body}</span>}
                  <span className="chat-bubble-time">{fmtTime(m.createdAt)}</span>
                </div>
              ))}
            </div>
            {err && <div className="chat-err">{err}</div>}
            <div className="chat-composer">
              <input type="file" ref={fileRef} hidden onChange={onPickFile} />
              <button
                className="chat-attach"
                disabled={sending}
                onClick={() => fileRef.current?.click()}
                title="Lampirkan file"
                type="button"
              >
                📎
              </button>
              <input
                placeholder="Tulis pesan…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button className="chat-send" disabled={!input.trim() || sending} onClick={() => void send()} type="button">
                {sending ? "…" : "Kirim"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function AttachmentView({ att }: { att: Attachment }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let u = "";
    let alive = true;
    attachmentUrl(att.id)
      .then((x) => {
        if (alive) {
          u = x;
          setUrl(x);
        } else {
          URL.revokeObjectURL(x);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [att.id]);

  if (att.mime.startsWith("image/")) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="chat-att-imgwrap">
        <img className="chat-att-img" src={url} alt={att.name} />
      </a>
    ) : (
      <div className="chat-att-loading">memuat gambar…</div>
    );
  }
  return (
    <a className="chat-att-file" href={url || undefined} target="_blank" rel="noreferrer" download={att.name}>
      <span className="chat-att-ic">📎</span>
      <span className="chat-att-meta">
        <b>{att.name}</b>
        <span>{fmtSize(att.size)}</span>
      </span>
    </a>
  );
}

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtSize(b: number): string {
  if (b >= 1 << 20) return (b / (1 << 20)).toFixed(1) + " MB";
  if (b >= 1 << 10) return Math.round(b / (1 << 10)) + " KB";
  return b + " B";
}
