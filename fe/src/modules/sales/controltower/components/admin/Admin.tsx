import { useState } from "react";
import type { Dashboard } from "../../types";
import { SECTIONS } from "./schema";
import { ArrayEditor, CrudSection, SingletonForm } from "./widgets";
import { ImportPanel } from "./ImportPanel";

const IMPORT_ID = "__import__";

/**
 * Master-data admin. Reads the current dashboard payload, renders one editable
 * section at a time and calls reload() after every write so the dashboard view
 * reflects the change. The Upload Excel tab drives the file-import pipeline.
 */
export function Admin({ data, reload }: { data: Dashboard; reload: () => void }) {
  const [active, setActive] = useState(IMPORT_ID);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="adm-root">
      <aside className="adm-nav">
        <div className="adm-nav-title">Data</div>
        <button
          className={"adm-nav-item" + (active === IMPORT_ID ? " active" : "")}
          onClick={() => setActive(IMPORT_ID)}
        >
          📤 Upload Excel
        </button>
        <div className="adm-nav-title">Master Data</div>
        {SECTIONS.map((s) => (
          <button key={s.id} className={"adm-nav-item" + (s.id === active ? " active" : "")} onClick={() => setActive(s.id)}>
            {s.label}
          </button>
        ))}
      </aside>
      <div className="adm-body">
        {active === IMPORT_ID ? (
          <ImportPanel reload={reload} />
        ) : (
          <>
            {/* key by section id so editors re-init from the latest data on switch */}
            {section.kind === "crud" && <CrudSection key={section.id} section={section} rows={section.pick(data)} reload={reload} />}
            {section.kind === "single" && <SingletonForm key={section.id} section={section} value={section.pick(data)} reload={reload} />}
            {section.kind === "array" && <ArrayEditor key={section.id} section={section} rows={section.pick(data)} reload={reload} />}
          </>
        )}
      </div>
    </div>
  );
}
