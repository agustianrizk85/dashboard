import { api } from "./api";

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

export const importService = {
  async source(): Promise<{ configured: boolean }> {
    const { data } = await api.get("/import/source");
    return data;
  },
  async preview(): Promise<ImportSummary> {
    const { data } = await api.post<ImportSummary>("/import/sync/preview");
    return data;
  },
  async approve(): Promise<ImportSummary> {
    const { data } = await api.post<ImportSummary>("/import/sync/approve");
    return data;
  },
  async autoStatus(): Promise<AutoStatus> {
    const { data } = await api.get<AutoStatus>("/import/auto");
    return data;
  },
  async autoSet(enabled: boolean, intervalSec: number): Promise<AutoStatus> {
    const { data } = await api.put<AutoStatus>("/import/auto", { enabled, intervalSec });
    return data;
  },
};
