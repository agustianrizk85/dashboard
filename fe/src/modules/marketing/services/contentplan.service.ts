import { api } from "./api";
import type { Alur } from "../models";

// Mirror of the Go ContentPlan sync DTOs (marketingflow/internal/service).

export interface ContentPlanSource {
  sheet_id: string;
  service_account: boolean;
}

export interface ContentPlanSummary {
  total_items: number;
  by_project: Record<string, number>;
  by_alur: Record<string, number>;
  with_date: number;
  with_caption: number;
  tabs_seen: number;
  tabs_skipped: string[];
}

export interface ContentPlanRow {
  project: string;
  project_key: string;
  title: string;
  alur: Alur;
  content_type?: string;
  date?: string | null;
  brief?: string;
  caption?: string;
  source_tab: string;
  source_key: string;
  is_new: boolean;
}

export interface ContentPlanPreview {
  summary: ContentPlanSummary;
  new_count: number;
  existing: number;
  rows: ContentPlanRow[];
}

export interface ContentPlanApproveResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  synced_at: string;
}

export interface AutoSyncStatus {
  enabled: boolean;
  intervalSec: number;
  configured: boolean;
  lastSync: string;
  lastError: string;
  lastCreated: number;
  lastTotal: number;
}

export const contentPlanService = {
  async source(): Promise<ContentPlanSource> {
    const { data } = await api.get<ContentPlanSource>("/content-plan/source");
    return data;
  },

  async preview(url?: string): Promise<ContentPlanPreview> {
    const { data } = await api.post<ContentPlanPreview>("/content-plan/sync/preview", { url: url ?? "" });
    return data;
  },

  async approve(url?: string): Promise<ContentPlanApproveResult> {
    const { data } = await api.post<ContentPlanApproveResult>("/content-plan/sync/approve", { url: url ?? "" });
    return data;
  },

  async autoStatus(): Promise<AutoSyncStatus> {
    const { data } = await api.get<AutoSyncStatus>("/content-plan/auto");
    return data;
  },

  async autoSet(enabled: boolean, intervalSec: number): Promise<AutoSyncStatus> {
    const { data } = await api.post<AutoSyncStatus>("/content-plan/auto", { enabled, intervalSec });
    return data;
  },
};
