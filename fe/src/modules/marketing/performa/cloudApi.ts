/* ════════════════════════════════════════════════════════════════════════
 * Marketing "Performa Iklan" — live data from the cloud Control Tower API.
 *
 * The panels (Alert System + Content & Winning Campaign) are sourced from the
 * production marketing app (marketing.greenparkgroup.cloud), whose dashboard
 * schema is RICHER than the local sales backend (it carries `content` and
 * colour-grouped `alerts`). We self-authenticate with a read account and cache
 * the bearer token; on 401 we re-login once.
 *
 * Override via env: VITE_MARKETING_CLOUD_API / _USER / _PASS.
 * ════════════════════════════════════════════════════════════════════════ */
const ENV = import.meta.env;
const BASE = (ENV.VITE_MARKETING_CLOUD_API as string) ?? "https://marketing.greenparkgroup.cloud/api";
const USER = (ENV.VITE_MARKETING_CLOUD_USER as string) ?? "admin";
const PASS = (ENV.VITE_MARKETING_CLOUD_PASS as string) ?? "admin123";
const TOKEN_KEY = "gp_marketing_cloud_token";

export interface WinningCampaign {
  name: string;
  project: string;
  channel: string;
  /** how many of 8 qualification criteria it passes */
  criteria: number;
  cpl: string;
  mql: string;
  booking: number;
}
export interface ContentHighlight {
  name: string;
  account: string;
  metric: string;
}
export interface ContentBlock {
  winning: WinningCampaign[];
  best: ContentHighlight;
  worst: ContentHighlight;
  rework: number;
  pause: number;
}
export interface AlertsBlock {
  red: string[];
  yellow: string[];
  green: string[];
}

/* ---- Qualified Demand Control Tower slices (live dashboard schema) ---- */
export interface ChannelRow {
  name: string;
  group: string; // Paid | Owned | Trust | Offline
  spend: number | null;
  leads: number;
  mql: number;
  cpl: number | null;
  roi: string | null; // e.g. "4.8×"
  status: string; // scale | optimize | pause | test
}
export interface ProjectDot {
  name: string;
  demand: number; // 0..100 (y)
  readiness: number; // 0..100 (x)
  leads: number;
  mql: number;
  booking: number;
}
export interface LqBreakdown {
  label: string;
  value: number;
  color: string; // hot | warm | nurture | low
}
export interface LqStat {
  label: string;
  value: string;
}
export interface LeadQuality {
  breakdown: LqBreakdown[];
  stats: LqStat[];
  topSource: string;
  bottomSource: string;
  topProject: string;
  bottomProject: string;
}
export interface HandoverItem {
  label: string;
  value: string;
  status: string; // good | warn | bad
}
export interface AssetRow {
  type: string;
  handle: string;
  health: number;
  active: boolean;
  note: string;
}
export interface IgAccount {
  handle: string;
  health: number;
  active: boolean;
  days: number;
}
export interface DashboardSummary {
  totalLeads: number;
  totalMQL: number;
  totalSpend: number;
  totalBooking: number;
}

/** Slices the Performa view renders. The live dashboard has even more. */
export interface PerformaData {
  content: ContentBlock;
  alerts: AlertsBlock;
  channels: ChannelRow[];
  projects: ProjectDot[];
  leadQuality: LeadQuality | null;
  handover: HandoverItem[];
  assets: AssetRow[];
  igAccounts: IgAccount[];
  summary: DashboardSummary | null;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`Login Control Tower gagal (HTTP ${res.status}).`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Login Control Tower tidak mengembalikan token.");
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

async function getDashboard(token: string): Promise<Response> {
  return fetch(`${BASE}/dashboard`, { headers: { Authorization: "Bearer " + token } });
}

/** Fetch the live performa slices, logging in (or re-logging in) as needed. */
export async function fetchPerforma(): Promise<PerformaData> {
  let token = localStorage.getItem(TOKEN_KEY) ?? "";
  if (!token) token = await login();

  let res = await getDashboard(token);
  if (res.status === 401) {
    token = await login();
    res = await getDashboard(token);
  }
  if (!res.ok) throw new Error(`Gagal memuat data Control Tower (HTTP ${res.status}).`);
  const data = (await res.json()) as Partial<PerformaData>;
  if (!data.content || !data.alerts) throw new Error("Respons Control Tower tidak memuat content/alerts.");
  return {
    content: data.content,
    alerts: data.alerts,
    channels: data.channels ?? [],
    projects: data.projects ?? [],
    leadQuality: data.leadQuality ?? null,
    handover: data.handover ?? [],
    assets: data.assets ?? [],
    igAccounts: data.igAccounts ?? [],
    summary: data.summary ?? null,
  };
}
