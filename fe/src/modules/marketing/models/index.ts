// Domain models — typed mirror of the Go backend (marketingflow/internal/model).

export type Role = "kadep" | "staff" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  position: string;
  created_at: string;
  updated_at: string;
}

// The four Marketing workflows from the department flowchart.
export type Alur = "A" | "B" | "C" | "D";

export type WorkStage =
  | "brief"
  | "produksi"
  | "review"
  | "approval"
  | "distribusi"
  | "done";

export interface WorkItem {
  id: number;
  title: string;
  alur: Alur;
  project: string;
  stage: WorkStage;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Provenance — present when ingested from the Content Plan spreadsheet.
  source?: string; // "content-plan" | "" (manual)
  source_key?: string;
  source_tab?: string; // exact sheet tab, e.g. "Copywrite LHL"
  content_type?: string; // raw calendar label, e.g. "Softsell Instagram"
  planned_date?: string | null;
  brief?: string;
  caption?: string;
  steps?: WorkStep[];
}

export type StepStatus = "pending" | "in_progress" | "done";

export interface WorkStep {
  id: number;
  work_item_id: number;
  code: string;
  alur: string;
  name: string;
  sequence: number;
  phase: string;
  owner: string;
  collab_dept: string;
  status: StepStatus;
  is_approval: boolean;
  requires_budget: boolean;
  budget_label: string;
  notify_departments: boolean;
  sla_days: number;
  due_date: string | null;
  budget_amount: number;
  notes: string;
  metadata: Record<string, unknown> | null;
  completed_by: number | null;
  completed_at: string | null;
  documents?: DocumentFile[];
}

export interface DocumentFile {
  id: number;
  work_item_id: number;
  work_step_id: number | null;
  doc_type: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: string;
}

export interface WorkItemProgress {
  work_item_id: number;
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
export interface CreateWorkItemInput {
  title: string;
  alur: Alur;
  project?: string;
}

export interface UpdateStepInput {
  status?: StepStatus;
  budget_amount?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  sla_days?: number;
  due_date?: string;
}

// A step joined with its work item context (for the per-PIC board / mobile).
export interface MineStep extends WorkStep {
  work_item_title: string;
  work_item_alur: Alur;
}

// --- Dashboard ---

export type WarningSeverity = "critical" | "warning" | "info";

export interface Warning {
  work_item_id: number;
  work_item_title: string;
  step_id: number;
  step_code: string;
  step_name: string;
  owner: string;
  severity: WarningSeverity;
  message: string;
  due_date: string | null;
}
