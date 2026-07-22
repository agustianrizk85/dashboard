import { useEffect, useMemo, useState } from "react";
import {
  perencanaanService,
  type XdivDeliverable,
} from "@/modules/permit/services/perencanaan.service";
import { outputService } from "@/modules/permit/services/output.service";
import type { DivOutputs } from "@/modules/permit/models";
import { OutputCard, type OutRow } from "@/modules/permit/components/OutputCard";
import { OutputDetailModal } from "@/modules/permit/components/OutputDetailModal";

/* "Output Divisi" — two directions:
 *   ⬇ MASUK : deliverables the other divisions' Papan Tugas route TO Legal
 *             Permit (Output=legalpermit), from perencanaan xdiv. Rows open a
 *             read-only detail modal.
 *   ⬆ KELUAR: Legal Permit's own deliverables routed OUT to other divisions
 *             (Siteplan→Perencanaan/Teknik, docs→Sales), from legalpermit
 *             /outputs. Read-only table.
 * Both grouped per division; each card has a filtering search (Enter-to-open)
 * and pagination via <OutputCard>. */

interface Source {
  division: string;
  label: string;
  icon: string;
  fetch: () => Promise<XdivDeliverable[]>;
  docUrl: (projectId: string, taskId: string) => string;
}

const SOURCES: Source[] = [
  {
    division: "perencanaan",
    label: "Perencanaan",
    icon: "📐",
    fetch: () => perencanaanService.allDeliverables(),
    docUrl: (p, t) => perencanaanService.docUrl(p, t),
  },
];

interface InGroup extends Source {
  items: XdivDeliverable[];
}

type DetailReq = { d: XdivDeliverable; docUrl: Source["docUrl"] };

const OUT_ICON: Record<string, string> = { perencanaan: "📐", teknik: "🏗", sales: "🏷" };

const XDIV_STATUS: Record<string, { label: string; cls: string }> = {
  todo: { label: "Belum", cls: "od-st-todo" },
  progress: { label: "Proses", cls: "od-st-prog" },
  review: { label: "Review", cls: "od-st-review" },
  done: { label: "Selesai", cls: "od-st-done" },
};
const STEP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Belum", cls: "od-st-todo" },
  in_progress: { label: "Proses", cls: "od-st-prog" },
  done: { label: "Selesai", cls: "od-st-done" },
};

export function OutputsPage() {
  const [inbound, setInbound] = useState<InGroup[] | null>(null);
  const [outbound, setOutbound] = useState<DivOutputs[] | null>(null);
  const [noSso, setNoSso] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<DetailReq | null>(null);

  useEffect(() => {
    if (!perencanaanService.hasSsoToken()) {
      setNoSso(true);
      setInbound([]);
      setOutbound([]);
      return;
    }
    let alive = true;

    // Inbound (other divisions → Permit)
    Promise.allSettled(SOURCES.map((s) => s.fetch())).then((results) => {
      if (!alive) return;
      const gs = SOURCES.map((s, i) => ({
        ...s,
        items:
          results[i].status === "fulfilled"
            ? (results[i] as PromiseFulfilledResult<XdivDeliverable[]>).value
            : [],
      }));
      const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstErr && gs.every((g) => g.items.length === 0)) {
        setError((firstErr.reason as Error)?.message || "Gagal memuat output.");
      }
      setInbound(gs);
    });

    // Outbound (Permit → other divisions)
    outputService
      .byDivision()
      .then((d) => alive && setOutbound(d))
      .catch(() => alive && setOutbound([]));

    return () => {
      alive = false;
    };
  }, []);

  // Inbound rows (clickable → detail modal).
  const inboundCards = useMemo(() => {
    return (inbound ?? []).map((g) => {
      const rows: OutRow[] = g.items.map((d) => {
        const st = XDIV_STATUS[d.status] ?? XDIV_STATUS.todo;
        return {
          key: `${d.projectId}:${d.taskId}`,
          name: d.deliverable,
          sub: `${d.category ? d.category + " · " : ""}${d.gp ? d.gp + " · " : ""}${d.projectName}`,
          statusLabel: st.label,
          statusCls: st.cls,
          mark: d.hasDoc ? (
            <span className="od-mark doc" title="Dokumen tersedia">
              📄
            </span>
          ) : (
            <span className="od-nodoc">Belum ada dokumen</span>
          ),
          searchText: `${d.deliverable} ${d.category} ${d.group} ${d.gp} ${d.projectName} ${d.pic}`.toLowerCase(),
          onClick: () => setDetail({ d, docUrl: g.docUrl }),
        };
      });
      const done = g.items.filter((d) => d.status === "done").length;
      return { key: g.division, icon: g.icon, label: g.label, rows, done };
    });
  }, [inbound]);

  // Outbound rows (read-only table).
  const outboundCards = useMemo(() => {
    return (outbound ?? []).map((g) => {
      const rows: OutRow[] = g.items.map((it) => {
        const st = STEP_STATUS[it.status] ?? STEP_STATUS.pending;
        return {
          key: `${g.division}:${it.step_id}`,
          name: it.name,
          sub: `${it.code} · ${it.project_name}`,
          statusLabel: st.label,
          statusCls: st.cls,
          mark: (
            <>
              {it.confidential && (
                <span className="od-mark conf" title="Output rahasia (watermark untuk Sales)">
                  🔒
                </span>
              )}
              {it.has_doc ? (
                <span className="od-mark doc" title="Dokumen tersedia">
                  📄
                </span>
              ) : (
                <span className="od-nodoc">Belum ada dokumen</span>
              )}
            </>
          ),
          searchText: `${it.name} ${it.code} ${it.project_name}`.toLowerCase(),
        };
      });
      return { key: g.division, icon: OUT_ICON[g.division] ?? "📦", label: g.label, rows, done: g.ready };
    });
  }, [outbound]);

  if (!inbound || !outbound) return <div className="muted">Memuat…</div>;

  const inTotal = inboundCards.reduce((n, c) => n + c.rows.length, 0);
  const outTotal = outboundCards.reduce((n, c) => n + c.rows.length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Output Divisi</h1>
          <p className="muted">
            Aliran deliverable antar divisi &amp; Legal Permit — apa yang <b>masuk</b> ke Permit dan apa
            yang <b>keluar</b> ke divisi lain.
          </p>
        </div>
      </div>

      {noSso ? (
        <div className="alert">
          Masuk lewat dashboard (SSO) untuk menarik output divisi dari Papan Tugas.
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <>
          {/* ⬇ MASUK */}
          <div className="od-sec-head">
            <h2>⬇ Masuk ke Legal Permit</h2>
            <span className="muted small">Dari Papan Tugas divisi lain (Output → Legal Permit)</span>
          </div>
          {inTotal === 0 ? (
            <div className="alert">Belum ada deliverable divisi lain yang dialirkan ke Legal Permit.</div>
          ) : (
            <div className="od-grid">
              {inboundCards.map((c) => (
                <OutputCard key={c.key} icon={c.icon} label={c.label} rows={c.rows} done={c.done} />
              ))}
            </div>
          )}

          {/* ⬆ KELUAR */}
          <div className="od-sec-head">
            <h2>⬆ Keluar ke divisi lain</h2>
            <span className="muted small">Dari langkah Legal Permit (Siteplan → Perencanaan/Teknik, dok. rahasia → Sales)</span>
          </div>
          {outTotal === 0 ? (
            <div className="alert">Belum ada output Legal Permit ke divisi lain.</div>
          ) : (
            <div className="od-grid">
              {outboundCards.map((c) => (
                <OutputCard key={c.key} icon={c.icon} label={c.label} rows={c.rows} done={c.done} />
              ))}
            </div>
          )}
        </>
      )}

      {detail && (
        <OutputDetailModal d={detail.d} docUrl={detail.docUrl} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
