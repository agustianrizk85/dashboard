import { useEffect, useMemo, useState } from "react";
import { metaApi } from "./metaApi";
import type { MetaProject } from "./metaApi";

/**
 * Loads the project map once and returns lookups by account ref:
 *   waMap[phone_number_id] → project,  igMap[ig_user_id] → project.
 * Used to attribute inbound WhatsApp/Instagram conversations to a project +
 * its sales team, and to filter the inbox per project.
 */
export function useProjects() {
  const [projects, setProjects] = useState<MetaProject[]>([]);
  useEffect(() => {
    metaApi.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return useMemo(() => {
    const waMap: Record<string, MetaProject> = {};
    const igMap: Record<string, MetaProject> = {};
    // IG conversations expose the @username, not the ig_user_id — so also index
    // by the account label's username so the inbox can match by that.
    const igUserMap: Record<string, MetaProject> = {};
    for (const p of projects) {
      for (const a of p.accounts ?? []) {
        if (a.kind === "wa") waMap[a.ref] = p;
        else if (a.kind === "ig") {
          igMap[a.ref] = p;
          const uname = a.label.replace(/^@/, "").toLowerCase().trim();
          if (uname) igUserMap[uname] = p;
        }
      }
    }
    return { projects, waMap, igMap, igUserMap };
  }, [projects]);
}

/** Compact project + sales badge for a conversation row/header. */
export function ProjectBadge({ project, compact }: { project?: MetaProject; compact?: boolean }) {
  if (!project) return null;
  const sales = (project.sales ?? []).map((s) => s.name.split(" ")[0]);
  return (
    <span className="meta-proj-badge" title={(project.sales ?? []).map((s) => `${s.name} (${s.email})`).join(", ")}>
      🏗️ {project.name}
      {!compact && sales.length > 0 && <em> · {sales.join(", ")}</em>}
    </span>
  );
}

/** A <select> that filters by project. `value` is the project id as a string
 *  ("" = all). Only projects that have at least one account of `kind` show. */
export function ProjectFilter({
  projects,
  kind,
  value,
  onChange,
}: {
  projects: MetaProject[];
  kind: "wa" | "ig";
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = projects.filter((p) => (p.accounts ?? []).some((a) => a.kind === kind));
  if (opts.length === 0) return null;
  return (
    <select className="meta-proj-filter" value={value} onChange={(e) => onChange(e.target.value)} title="Filter per proyek">
      <option value="">Semua proyek</option>
      {opts.map((p) => (
        <option key={p.id} value={String(p.id)}>
          🏗️ {p.name}
        </option>
      ))}
    </select>
  );
}
