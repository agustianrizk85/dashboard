import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* AI › Model — pilih model AI yang dipakai DIVISI ini (teks + vision) dari
 * katalog pusat via dropdown-search, lalu fitur AI divisi (Asisten, Deep Revisi)
 * pakai model itu. Katalog master dikelola superadmin di Panel Admin › Model AI. */

const AUTH = ((import.meta.env.VITE_AUTH_API as string) ?? "/api").replace(/\/$/, "");

function ssoToken(): string {
  return localStorage.getItem("gp_dashboard_token") ?? "";
}
async function authGet<T>(path: string): Promise<T> {
  const r = await fetch(`${AUTH}${path}`, { headers: { Authorization: "Bearer " + ssoToken() } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

interface AIModel {
  name: string;
  intelligence: string;
  useCase: string;
  score: number;
}
interface DivChoice {
  text: string;
  vision: string;
  effectiveText: string;
  effectiveVision: string;
}
interface Opt {
  value: string;
  label: string;
  sub?: string;
}

function scoreColor(s: number): string {
  return s >= 80 ? "#15803d" : s >= 50 ? "#b45309" : "#64748b";
}

/** Dropdown-search: ketik untuk memfilter, klik untuk pilih. */
function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "— Pilih —",
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return options;
    return options.filter((o) => (o.label + " " + (o.sub ?? "")).toLowerCase().includes(n));
  }, [options, q]);

  return (
    <div className={`pr-ss ${open ? "open" : ""}`} ref={ref}>
      <input
        className="pr-ss-input"
        value={open ? q : selected?.label ?? ""}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <span className="pr-ss-caret">▾</span>
      {open && (
        <div className="pr-ss-menu">
          {filtered.length === 0 ? (
            <div className="pr-ss-empty">Tidak ada</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value || "__default__"}
                className={`pr-ss-opt ${o.value === value ? "on" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="pr-ss-opt-label">{o.label}</span>
                {o.sub && <span className="pr-ss-opt-sub">{o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ModelView({ division = "perencanaan" }: { division?: string }) {
  const [catalog, setCatalog] = useState<AIModel[] | null>(null);
  const [choice, setChoice] = useState<DivChoice | null>(null);
  const [text, setText] = useState("");
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [catQ, setCatQ] = useState("");
  const [catPage, setCatPage] = useState(0);

  const load = useCallback(async () => {
    if (!ssoToken()) {
      setErr("Masuk lewat dashboard untuk mengatur model.");
      setCatalog([]);
      return;
    }
    try {
      const [cat, ch] = await Promise.all([
        authGet<AIModel[]>("/ai/model-catalog"),
        authGet<DivChoice>(`/ai/division-model?division=${encodeURIComponent(division)}`),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setChoice(ch);
      setText(ch.text ?? "");
      setVision(ch.vision ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [division]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const r = await fetch(`${AUTH}/ai/division-model`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + ssoToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ division, text, vision }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setChoice(j as DivChoice);
      setMsg("✓ Tersimpan — fitur AI divisi ini memakai model terpilih.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toOpt = (m: AIModel): Opt => ({
    value: m.name,
    label: m.name,
    sub: `score ${m.score} · ${m.useCase}`,
  });
  const textOpts: Opt[] = useMemo(
    () => [{ value: "", label: "— Default global —" }, ...(catalog ?? []).map(toOpt)],
    [catalog],
  );
  const visionOpts: Opt[] = useMemo(
    () => [
      { value: "", label: "— Default global —" },
      ...(catalog ?? []).filter((m) => /vision/i.test(m.useCase)).map(toOpt),
    ],
    [catalog],
  );

  // Katalog: filter (search) + paginasi.
  const CAT_PAGE = 8;
  const catFiltered = useMemo(() => {
    const n = catQ.trim().toLowerCase();
    const list = catalog ?? [];
    if (!n) return list;
    return list.filter((m) => `${m.name} ${m.intelligence} ${m.useCase}`.toLowerCase().includes(n));
  }, [catalog, catQ]);
  const catPages = Math.max(1, Math.ceil(catFiltered.length / CAT_PAGE));
  const catCur = Math.min(catPage, catPages - 1);
  const catSlice = catFiltered.slice(catCur * CAT_PAGE, catCur * CAT_PAGE + CAT_PAGE);

  return (
    <div className="pr-panel">
      <div className="pr-panel-head">
        <h2>🧠 Model AI Divisi</h2>
        <p className="muted">
          Pilih model AI yang dipakai divisi ini. <b>Model Teks</b> untuk Asisten &amp; Generate AI;{" "}
          <b>Model Vision</b> untuk Deep Revisi gambar kerja. Katalog dikelola di{" "}
          <b>Panel Admin › Model AI</b>.
        </p>
      </div>

      {err && <div className="empty-note error">{err}</div>}

      {catalog === null ? (
        <div className="empty-note">
          <div className="spinner" /> Memuat…
        </div>
      ) : (
        <>
          <div className="pr-modelpick">
            <div className="field">
              <span>Model Teks (Asisten / Generate)</span>
              <SearchSelect options={textOpts} value={text} onChange={setText} placeholder="Cari model teks…" />
              <small className="muted">
                Aktif: <b>{choice?.effectiveText || "—"}</b>
              </small>
            </div>
            <div className="field">
              <span>Model Vision (Deep Revisi)</span>
              <SearchSelect
                options={visionOpts}
                value={vision}
                onChange={setVision}
                placeholder="Cari model vision…"
              />
              <small className="muted">
                Aktif: <b>{choice?.effectiveVision || "—"}</b>
              </small>
            </div>
            <button className="btn-ai" disabled={busy} onClick={save}>
              {busy ? "Menyimpan…" : "Simpan pilihan"}
            </button>
            {msg && <div style={{ color: "#15803d", fontWeight: 600, alignSelf: "center" }}>{msg}</div>}
          </div>

          <div className="pr-cat-head">
            <h3>Katalog Model AI ({(catalog ?? []).length})</h3>
            <div className="pr-cat-search">
              <input
                value={catQ}
                onChange={(e) => {
                  setCatQ(e.target.value);
                  setCatPage(0);
                }}
                placeholder="🔎 Cari model / kegunaan…"
              />
              {catQ.trim() && <span className="muted small">{catFiltered.length} hasil</span>}
            </div>
          </div>
          {catalog.length === 0 ? (
            <div className="empty-note">Belum ada model. Tambahkan di Panel Admin › Model AI.</div>
          ) : catFiltered.length === 0 ? (
            <div className="empty-note">Tidak ada yang cocok.</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Kepintaran</th>
                      <th>Kegunaan</th>
                      <th style={{ textAlign: "right" }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catSlice.map((m) => (
                      <tr key={m.name}>
                        <td>
                          <b>{m.name}</b>
                        </td>
                        <td>{m.intelligence || "—"}</td>
                        <td>{m.useCase || "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className="badge"
                            style={{ background: scoreColor(m.score) + "22", color: scoreColor(m.score), fontWeight: 700 }}
                          >
                            {m.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {catPages > 1 && (
                <div className="pr-cat-pager">
                  <button type="button" disabled={catCur === 0} onClick={() => setCatPage(catCur - 1)}>
                    ‹ Sebelumnya
                  </button>
                  <span>
                    Hal {catCur + 1} / {catPages}
                  </span>
                  <button type="button" disabled={catCur >= catPages - 1} onClick={() => setCatPage(catCur + 1)}>
                    Berikutnya ›
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
