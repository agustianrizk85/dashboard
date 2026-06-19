// Live Meta (Facebook) data via the marketing backend proxy (/api/meta/*).
// The token stays server-side; the marketing API client attaches the bearer.
import { api } from "../services/api";

export interface MetaCampaign {
  id: string;
  name: string;
  account: string;
  accountId: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  resultLabel: string;
  results: number;
  costPerResult: number;
}
export interface MetaAdsTotals {
  spend: number;
  results: number;
  costPerResult: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  campaigns: number;
  activeCampaigns: number;
  accounts: number;
}
export interface MetaAds {
  configured: boolean;
  account?: Record<string, unknown>;
  accounts?: Record<string, unknown>[];
  insights?: Record<string, string>;
  campaigns?: MetaCampaign[];
  totals?: MetaAdsTotals;
  error?: string;
}
export interface MetaPhone {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  platform_type?: string;
}
export interface MetaTemplate {
  name?: string;
  status?: string;
  category?: string;
}
export interface MetaWaba {
  id: string;
  name: string;
  phones?: MetaPhone[];
  templates?: MetaTemplate[];
}
export interface MetaWa {
  configured: boolean;
  wabas?: MetaWaba[];
  error?: string;
}
export interface MetaIgAccount {
  id?: string;
  username?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  page?: string;
}
export interface MetaIg {
  configured: boolean;
  pages?: Record<string, unknown>[];
  instagram?: MetaIgAccount[];
  error?: string;
}

export interface MetaBreakdownRow {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  results: number;
}
export interface MetaDailyRow {
  date: string;
  spend: number;
  results: number;
  clicks: number;
  impressions: number;
}
export interface MetaAdsDetail {
  configured: boolean;
  account?: string;
  daily?: MetaDailyRow[];
  demographics?: MetaBreakdownRow[];
  placements?: MetaBreakdownRow[];
  regions?: MetaBreakdownRow[];
  devices?: MetaBreakdownRow[];
  topAds?: MetaBreakdownRow[];
  error?: string;
}

export const metaApi = {
  ads: () => api.get<MetaAds>("/meta/ads").then((r) => r.data),
  adsDetail: () => api.get<MetaAdsDetail>("/meta/ads/detail").then((r) => r.data),
  whatsapp: () => api.get<MetaWa>("/meta/whatsapp").then((r) => r.data),
  instagram: () => api.get<MetaIg>("/meta/instagram").then((r) => r.data),
};
