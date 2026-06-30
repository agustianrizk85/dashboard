// Live Meta (Facebook) data via the dedicated metaapi service (/api/meta/*).
// metaapi shares the marketing backend's JWT secret, so the same login token is
// accepted (unified auth). Base via VITE_META_API (default http://localhost:8097
// in dev; https://meta.greenparkgroup.cloud in prod). The bearer is the same
// marketing session token from tokenStore.
import axios from "axios";
import { tokenStore } from "../services/api";

const metaBase = ((import.meta.env.VITE_META_API as string | undefined) ?? "http://localhost:8097").replace(/\/$/, "");
const api = axios.create({
  baseURL: `${metaBase}/api`,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((config) => {
  // metaapi accepts the unified dashboard SSO login token (Ed25519) directly, so
  // prefer it — no dependency on a per-backend bridged token. Fall back to the
  // marketing module token for the standalone app.
  const token = localStorage.getItem("gp_dashboard_token") || tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// WebSocket URL for the realtime WhatsApp inbox (metaapi pushes a rev bump on
// each new inbound message). Null when not authenticated. Handles both an
// absolute dev base and a relative prod base (/be/meta) → ws(s) on same origin.
export function waRealtimeURL(): string | null {
  const token = localStorage.getItem("gp_dashboard_token") || tokenStore.get();
  if (!token) return null;
  const httpBase = metaBase.startsWith("http") ? metaBase : window.location.origin + metaBase;
  return httpBase.replace(/^http/, "ws") + "/api/meta/whatsapp/ws?token=" + encodeURIComponent(token);
}

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
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  resultLabel: string;
  results: number;
  costPerResult: number;
  effectiveStatus: string;
  issues: number;
  issueSummary: string;
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
  reach: number;
  frequency: number;
  conversionRate: number;
  campaigns: number;
  activeCampaigns: number;
  deliveringCampaigns: number;
  issueCampaigns: number;
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
  id?: string; // phone_number_id — recipient of Cloud API sends
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
  hourly?: MetaBreakdownRow[];
  creatives?: MetaCreative[];
  error?: string;
}

// One winning ad-copy (aggregated across ads that share the same body text),
// joined with live performance — works for standard ads (no asset feed needed).
export interface MetaCreative {
  body: string;
  title: string;
  cta: string;
  thumbnail: string;
  resultLabel: string;
  spend: number;
  results: number;
  costPerResult: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ads: number;
}

// Date-range options for the Ads tab — "max" pulls Meta's maximum window
// (lifetime, up to ~37 months) so campaigns across all years show up.
export type MetaRange = "today" | "7d" | "30d" | "90d" | "this_year" | "last_year" | "max";
export const META_RANGES: { key: MetaRange; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "90d", label: "90 Hari" },
  { key: "this_year", label: "Tahun Ini" },
  { key: "last_year", label: "Tahun Lalu" },
  { key: "max", label: "Semua Tahun" },
];

export interface MetaCampaignInfo {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: number;
  lifetimeBudget: number;
  startTime: string;
  stopTime: string;
  accountId: string;
}
export interface MetaCampaignTotals {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  resultLabel: string;
  results: number;
  costPerResult: number;
}
export interface MetaCampaignDetail {
  configured: boolean;
  range?: string;
  campaign?: MetaCampaignInfo;
  totals?: MetaCampaignTotals | null;
  daily?: MetaDailyRow[];
  demographics?: MetaBreakdownRow[];
  placements?: MetaBreakdownRow[];
  ads?: MetaBreakdownRow[];
  adsets?: MetaBreakdownRow[];
  error?: string;
}

// ---- Instagram DM inbox ----
export interface IGConversation {
  id: string;
  pageId: string;
  igUser: string;
  customer: string;
  recipientId: string;
  snippet: string;
  updatedTime: string;
  unread: number;
}
export interface IGConversations {
  configured: boolean;
  conversations: IGConversation[];
  accounts: number;
  limited?: string; // set when Advanced Access to instagram_manage_messages is needed
}
export interface IGMessage {
  id: string;
  text: string;
  time: string;
  fromMe: boolean;
  fromId: string;
}

// ---- WhatsApp inbox (Cloud API, webhook-backed) ----
// WhatsApp has no message-history API, so threads come from messages captured
// by metaapi's webhook (inbound) + replies we send (outbound), stored server-side.
export interface WAConversation {
  id: number;
  phoneNumberId: string;
  contactWaId: string; // customer phone (no +) — the reply recipient
  contactName: string;
  lastSnippet: string;
  lastDirection: "in" | "out" | string;
  lastMessageAt: string;
  unread: number;
}
export interface WAConversations {
  configured: boolean;
  conversations: WAConversation[];
}
export interface WAMessage {
  id: number;
  wamId: string;
  contactWaId: string;
  direction: "in" | "out" | string;
  type: string;
  text: string;
  status: string;
  timestamp: string;
}

const rq = (range?: MetaRange) => (range ? `?range=${range}` : "");

export const metaApi = {
  ads: (range?: MetaRange) => api.get<MetaAds>("/meta/ads" + rq(range)).then((r) => r.data),
  adsDetail: (range?: MetaRange) => api.get<MetaAdsDetail>("/meta/ads/detail" + rq(range)).then((r) => r.data),
  adsCampaign: (id: string, range?: MetaRange) =>
    api
      .get<MetaCampaignDetail>(`/meta/ads/campaign?id=${encodeURIComponent(id)}${range ? `&range=${range}` : ""}`)
      .then((r) => r.data),
  whatsapp: () => api.get<MetaWa>("/meta/whatsapp").then((r) => r.data),
  instagram: () => api.get<MetaIg>("/meta/instagram").then((r) => r.data),
  igConversations: () => api.get<IGConversations>("/meta/instagram/conversations").then((r) => r.data),
  igMessages: (conversationId: string, pageId: string) =>
    api
      .get<{ messages: IGMessage[]; igUser: string }>(
        `/meta/instagram/messages?conversation_id=${encodeURIComponent(conversationId)}&page_id=${encodeURIComponent(pageId)}`,
      )
      .then((r) => r.data),
  igSend: (pageId: string, recipientId: string, text: string) =>
    api.post<{ ok: boolean }>("/meta/instagram/send", { page_id: pageId, recipient_id: recipientId, text }).then((r) => r.data),

  // WhatsApp inbox
  waConversations: () => api.get<WAConversations>("/meta/whatsapp/conversations").then((r) => r.data),
  waMessages: (phoneNumberId: string, contact: string) =>
    api
      .get<{ messages: WAMessage[] }>(
        `/meta/whatsapp/messages?phone_number_id=${encodeURIComponent(phoneNumberId)}&contact=${encodeURIComponent(contact)}`,
      )
      .then((r) => r.data),
  waSend: (phoneNumberId: string, to: string, text: string) =>
    api
      .post<{ ok: boolean; wamId: string }>("/meta/whatsapp/send", { phone_number_id: phoneNumberId, to, text })
      .then((r) => r.data),
};
