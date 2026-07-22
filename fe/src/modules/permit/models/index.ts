// Domain models — typed mirror of the Go backend (internal/model).

export type Role = "ceo" | "dirops" | "kadep" | "legal_permit";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export type ProjectStage = "pra_akad" | "akad" | "permit" | "legal" | "done";

export interface Project {
  id: number;
  name: string;
  location: string;
  owner_name: string;
  pt_name: string;
  stage: ProjectStage;
  // Link to a Perencanaan project (id like "gp-001") so Permit can pull its
  // Siteplan / IMB deliverables cross-module. "" = not linked yet.
  perencanaan_project_id: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  steps?: ProcessStep[];
}

export type StepStatus = "pending" | "in_progress" | "done";

export interface ProcessStep {
  id: number;
  project_id: number;
  code: string;
  category: string;
  name: string;
  sequence: number;
  status: StepStatus;
  requires_price: boolean;
  requires_spk: boolean;
  price_label: string;
  notify_departments: boolean;
  confidential_output: boolean;
  sla_days: number;
  due_date: string | null;
  price_fix: number;
  spk_number: string;
  notes: string;
  metadata: Record<string, unknown> | null;
  completed_by: number | null;
  completed_at: string | null;
  documents?: DocumentFile[];
}

export interface DocumentFile {
  id: number;
  project_id: number;
  process_step_id: number | null;
  doc_type: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  confidential: boolean;
  ocr_data: Record<string, unknown> | null;
  uploaded_by: number;
  created_at: string;
}

export interface ProjectProgress {
  project_id: number;
  total: number;
  done: number;
  percentage: number;
  by_status: Partial<Record<StepStatus, number>>;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

// Request payloads.
export interface CreateProjectInput {
  name: string;
  location?: string;
  owner_name?: string;
  pt_name?: string;
}

export interface UpdateStepInput {
  status?: StepStatus;
  price_fix?: number;
  spk_number?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  sla_days?: number;
  due_date?: string;
}

// --- Master Data PT (Proses E) ---

export interface PTDocument {
  id: number;
  pt_master_id: number;
  doc_type: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: string;
}

export interface PTMaster {
  id: number;
  name: string;
  npwp: string;
  nib: string;
  notes: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  documents?: PTDocument[];
}

export interface CreatePTInput {
  name: string;
  npwp?: string;
  nib?: string;
  notes?: string;
}

// --- Master Data Vendor / Pihak Ketiga (Proses I) ---

export interface Vendor {
  id: number;
  category: string;
  name: string;
  address: string;
  ktp_number: string;
  account_number: string;
  bank_name: string;
  account_holder: string;
  notes: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface VendorInput {
  category?: string;
  name: string;
  address?: string;
  ktp_number?: string;
  account_number?: string;
  bank_name?: string;
  account_holder?: string;
  notes?: string;
}

// --- SPK Legal Permit (Proses J) ---

export type SPKStatus = "draft" | "approved" | "rejected";
export type PricingMode = "per_meter" | "per_unit" | "lumpsum";

export interface SPKType {
  code: string;
  name: string;
  pricing_mode: PricingMode;
}

export interface SPK {
  id: number;
  number: string;
  type: string;
  type_name: string;
  project_id: number | null;
  project?: Project | null;
  vendor_id: number;
  vendor?: Vendor | null;
  pricing_mode: PricingMode;
  unit_price: number;
  quantity: number;
  total: number;
  completion_time: string;
  payment_terms: string;
  scope_note: string;
  status: SPKStatus;
  created_by: number;
  approved_by: number | null;
  approved_at: string | null;
  decision_note: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSPKInput {
  type: string;
  vendor_id: number;
  project_id?: number | null;
  unit_price?: number;
  quantity?: number;
  completion_time?: string;
  payment_terms?: string;
  scope_note?: string;
}

// --- Dashboard ---

export type WarningSeverity = "critical" | "warning" | "info";

export interface Warning {
  project_id: number;
  project_name: string;
  step_id: number;
  step_code: string;
  step_name: string;
  severity: WarningSeverity;
  message: string;
  due_date: string | null;
}

// --- Output Divisi (keluar): permit deliverables routed to consuming divisions ---

/** One Legal Permit deliverable routed OUT to a consuming division. */
export interface DivOutputItem {
  project_id: number;
  project_name: string;
  step_id: number;
  code: string; // "C10"
  name: string;
  status: StepStatus;
  confidential: boolean; // watermark output (Sales)
  has_doc: boolean;
}

/** Every permit output feeding one division (Perencanaan / Teknik / Sales). */
export interface DivOutputs {
  division: string; // "perencanaan"
  label: string; // "Perencanaan"
  total: number;
  ready: number; // items already Selesai
  items: DivOutputItem[];
}

// --- Settings (DACI / Notification) ---

export interface DACIDriver {
  code: string;
  name: string;
}

export interface DACIConfig {
  drivers: DACIDriver[];
  approver: string[];
  consulting: string[];
  informed: string[];
}

export interface NotificationConfig {
  whatsapp_enabled: boolean;
  audit_ai_enabled: boolean;
  reminder_hour: number;
  whatsapp_api_url: string;
}

// --- Master Deadline ---

export interface DeadlineRule {
  code: string;
  name: string;
  category: string;
  deadline_enabled: boolean;
  alert_enabled: boolean;
  sla_days: number;
  updated_at?: string;
}

// --- OCR ---

export interface OCRResult {
  doc_type: string;
  fields: Record<string, string>;
  confidence: number;
  provider: string;
}

// --- PKS Bank / Berkas Acuan (Proses F) ---

/** A single acuan document aggregated into the F package. */
export interface PKSDoc {
  id: number;
  doc_type: string;
  original_name: string;
  confidential: boolean;
}

/** One acuan source group (A6/A7/B4/C10) with its documents. */
export interface PKSSource {
  code: string;
  label: string;
  step_status?: string;
  documents: PKSDoc[];
}

/** Auto-aggregated PKS Bank package for a project (Berkas Acuan F). */
export interface PKSPackage {
  project_id: number;
  project_name: string;
  pt_name: string;
  perencanaan_project_id: string;
  gdrive_folder_link: string;
  ready: boolean;
  sources: PKSSource[];
}
