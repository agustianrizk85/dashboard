import { api } from "./api";
import { LEGACY_DISABLED_MESSAGE, PERMIT_LEGACY_ENABLED } from "./features";

export interface ImportSummary {
  projectsTotal: number;
  projectsCreated: number;
  projectsUpdated: number;
  stepsTotal: number;
  stepsCreated: number;
  stepsUpdated: number;
  issues: string[];
  applied: boolean;
}

export interface AutoStatus {
  enabled: boolean;
  intervalSec: number;
  configured: boolean;
  lastSync: string;
  lastError: string;
  lastSummary: ImportSummary | null;
}

const EMPTY_AUTO: AutoStatus = {
  enabled: false,
  intervalSec: 0,
  configured: false,
  lastSync: "",
  lastError: "",
  lastSummary: null,
};

export const importService = {
  async source(): Promise<{ configured: boolean }> {
    if (!PERMIT_LEGACY_ENABLED) return { configured: false };
    const { data } = await api.get("/import/source");
    return data;
  },
  async preview(): Promise<ImportSummary> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<ImportSummary>("/import/sync/preview");
    return data;
  },
  async approve(): Promise<ImportSummary> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.post<ImportSummary>("/import/sync/approve");
    return data;
  },
  async autoStatus(): Promise<AutoStatus> {
    if (!PERMIT_LEGACY_ENABLED) return EMPTY_AUTO;
    const { data } = await api.get<AutoStatus>("/import/auto");
    return data;
  },
  async autoSet(enabled: boolean, intervalSec: number): Promise<AutoStatus> {
    if (!PERMIT_LEGACY_ENABLED) throw new Error(LEGACY_DISABLED_MESSAGE);
    const { data } = await api.put<AutoStatus>("/import/auto", { enabled, intervalSec });
    return data;
  },
};
