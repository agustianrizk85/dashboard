import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RESOURCES } from "./schema";
import { ResourceManager } from "./ResourceManager";
import { ProgressChecklist } from "../components/ProgressChecklist";
import { SyncSpreadsheet } from "./SyncSpreadsheet";
import { MasterKlausulPanel } from "@/components/klausul/MasterKlausulPanel";
import { MasterKontraktorPanel } from "@/components/kontraktor/MasterKontraktorPanel";
import { MasterSeksiPanel } from "./MasterSeksiPanel";
import { MasterBobotPanel } from "./MasterBobotPanel";
import { TeknikDocBuilder } from "./TeknikDocBuilder";
import { api } from "../api/client";
import type { ConstructionStage, ProgressUnit } from "../types";

/** Cek List Progress lives under Master Data; it loads its own stages + units. */
function ChecklistSection() {
  const [stages, setStages] = useState<ConstructionStage[]>([]);
  const [units, setUnits] = useState<ProgressUnit[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    Promise.all([
      api.list<ConstructionStage>("construction-stages"),
      api.list<ProgressUnit>("progress-units"),
    ]).then(([s, u]) => {
      setStages(s);
      setUnits(u);
      setLoaded(true);
    });
  }, []);
  if (!loaded) return <div className="md-empty">Memuat…</div>;
  return <ProgressChecklist stages={stages} units={units} />;
}

/** AI model picker — choose the OpenRouter model used by all AI Insight. */
function AiModelSection() {
  const [cfg, setCfg] = useState<{ configured: boolean; model: string } | null>(null);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.aiConfig().then((c) => {
      setCfg(c);
      setSel(c.model);
      if (c.configured) api.aiModels().then(setModels).catch(() => setModels([]));
    });
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.setAiModel(sel);
      setMsg("✓ Model aktif: " + r.model);
    } catch (e) {
      setMsg("Gagal: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="md-empty">Memuat…</div>;
  return (
    <div className="md-panel">
      <header className="md-head">
        <div>
          <h2>AI Model (OpenRouter)</h2>
          <span className="md-count">{cfg.configured ? `${models.length} model gratis tersedia` : "belum dikonfigurasi"}</span>
        </div>
      </header>
      {!cfg.configured ? (
        <div className="md-error">
          API key belum diset. Taruh key di file <b>backend/teknik/openrouter.key</b> lalu restart server.
        </div>
      ) : (
        <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="mdf-field">
            <span className="mdf-label">Model untuk semua AI Insight</span>
            <select value={sel} onChange={(e) => setSel(e.target.value)}>
              {models.length === 0 && <option value={cfg.model}>{cfg.model}</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.id}</option>
              ))}
            </select>
          </label>
          <div>
            <button className="md-btn primary" onClick={() => void save()} disabled={busy || !sel}>
              {busy ? "Menyimpan…" : "Simpan model"}
            </button>
          </div>
          {msg && <div style={{ color: msg.startsWith("✓") ? "var(--ok)" : "var(--bad)", fontSize: 13 }}>{msg}</div>}
          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
            Model gratis (<code>:free</code>) kadang sibuk; sistem otomatis fallback ke model gratis lain.
            Untuk lebih cepat/stabil, isi saldo OpenRouter & pilih model berbayar.
          </div>
        </div>
      )}
    </div>
  );
}

/** Non-CRUD sections that get their own nav entry. */
const SECTIONS: { key: string; group: string; title: string; render: () => ReactNode }[] = [
  { key: "checklist", group: "Operasional", title: "Cek List Progress", render: () => <ChecklistSection /> },
  { key: "sync-sheet", group: "Data", title: "Sync Spreadsheet", render: () => <SyncSpreadsheet /> },
  { key: "master-kontraktor", group: "Master", title: "Master Kontraktor", render: () => <MasterKontraktorPanel /> },
  { key: "master-seksi", group: "Master", title: "Master Seksi", render: () => <MasterSeksiPanel /> },
  { key: "master-bobot", group: "Master", title: "Master Item Bobot", render: () => <MasterBobotPanel /> },
  { key: "master-klausul", group: "Dokumen", title: "Master Klausul (pustaka)", render: () => <MasterKlausulPanel division="teknik" /> },
  { key: "doc-builder", group: "Dokumen", title: "Buat Dokumen (SPK)", render: () => <TeknikDocBuilder /> },
  { key: "ai-model", group: "Pengaturan", title: "AI Model", render: () => <AiModelSection /> },
];

/** Sub-view Master Data (Sync Spreadsheet TIDAK di sini — sudah jadi menu utama
 *  sendiri, biar tak dobel). Sisanya disembunyikan; kode tetap ada. */
const VISIBLE = ["master-kontraktor", "master-seksi", "master-bobot", "master-klausul", "doc-builder"];

/** VISIBLE sections grouped by `group`, preserving first-seen order. */
const visibleGroups: { name: string; items: typeof SECTIONS }[] = (() => {
  const out: { name: string; items: typeof SECTIONS }[] = [];
  SECTIONS.filter((s) => VISIBLE.includes(s.key)).forEach((s) => {
    let g = out.find((x) => x.name === s.group);
    if (!g) {
      g = { name: s.group, items: [] };
      out.push(g);
    }
    g.items.push(s);
  });
  return out;
})();

/** Sub-view Master Data untuk dropdown di sidebar utama (WMS). */
export const MASTER_VIEWS = SECTIONS.filter((s) => VISIBLE.includes(s.key)).map((s) => ({
  key: s.key,
  label: s.title,
}));

/** Master-data workspace. Dua mode:
 *  - uncontrolled (CEO/Dirops): sidebar-dalam ala lama.
 *  - controlled `view`/`onView` (WMS staff/kadep): TANPA sidebar-dalam — pemilih
 *    sub-view berupa dropdown yang menempel di item "Master Data" sidebar utama. */
export function MasterData({ view, onView }: { view?: string; onView?: (v: string) => void } = {}) {
  const embedded = view !== undefined;
  const [localKey, setLocalKey] = useState("master-klausul");
  const activeKey = embedded ? (view as string) : localKey;
  const setActiveKey = embedded ? onView ?? (() => {}) : setLocalKey;
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const active = RESOURCES.find((r) => r.key === activeKey);
  const section = SECTIONS.find((s) => s.key === activeKey);

  const run = async (kind: "seed" | "clear", fn: () => Promise<unknown>, confirmMsg: string) => {
    if (busy) return;
    if (!window.confirm(confirmMsg)) return;
    setBusy(kind);
    try {
      await fn();
      window.location.reload();
    } catch (e) {
      alert("Gagal: " + (e instanceof Error ? e.message : String(e)));
      setBusy(null);
    }
  };

  const reseed = () =>
    run("seed", () => api.reseed(), "Isi ulang dengan data migrasi? Semua perubahan saat ini akan ditimpa.");
  const clearAll = () =>
    run("clear", () => api.clearData(), "Hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.");

  // WMS: sidebar-dalam dihapus — dropdown ada di sidebar utama (WmsShell item.sub).
  // Di sini cukup render panel terpilih full-width + alat data ringkas di bawah.
  if (embedded) {
    return (
      <div className="master-embed">
        <section className="master-content">
          {section ? section.render() : active ? <ResourceManager key={active.key} config={active} /> : null}
        </section>
        <div className="master-tools-row">
          <button className="master-tool" onClick={reseed} disabled={busy !== null}>
            {busy === "seed" ? "Memproses…" : "↻ Seed data migrasi"}
          </button>
          <button className="master-tool danger" onClick={clearAll} disabled={busy !== null}>
            {busy === "clear" ? "Memproses…" : "🗑 Hapus semua data"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="master">
      <aside className="master-nav">
        <div className="master-nav-title">Master Data</div>
        {/* Menu diringkas (Cek List, AI Model, RESOURCES disembunyikan — kode
            tetap ada, ubah VISIBLE untuk memunculkannya lagi). Grup 1 entri =
            tombol; grup banyak entri (Dokumen) = SATU dropdown di sidebar. */}
        {visibleGroups.map((g) => (
          <div key={g.name}>
            <div className="master-nav-group">{g.name}</div>
            {g.items.length === 1 ? (
              <button
                className={`master-nav-item ${g.items[0].key === activeKey ? "active" : ""}`}
                onClick={() => setActiveKey(g.items[0].key)}
              >
                {g.items[0].title}
              </button>
            ) : (
              <select
                className={`master-nav-select ${g.items.some((it) => it.key === activeKey) ? "active" : ""}`}
                value={g.items.some((it) => it.key === activeKey) ? activeKey : ""}
                onChange={(e) => setActiveKey(e.target.value)}
              >
                {!g.items.some((it) => it.key === activeKey) && (
                  <option value="" disabled>
                    Pilih…
                  </option>
                )}
                {g.items.map((it) => (
                  <option key={it.key} value={it.key}>
                    {it.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        <div className="master-tools">
          <div className="master-nav-title">Alat Data</div>
          <button className="master-tool" onClick={reseed} disabled={busy !== null}>
            {busy === "seed" ? "Memproses…" : "↻ Seed data migrasi"}
          </button>
          <button className="master-tool danger" onClick={clearAll} disabled={busy !== null}>
            {busy === "clear" ? "Memproses…" : "🗑 Hapus semua data"}
          </button>
        </div>
      </aside>
      <section className="master-content">
        {section ? section.render() : active ? <ResourceManager key={active.key} config={active} /> : null}
      </section>
    </div>
  );
}
