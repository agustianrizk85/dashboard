// Types for the Perencanaan planning module. These mirror the Go backend DTOs
// (internal/service/*.go) exactly so the API responses map straight onto them.

export type Rag = "green" | "amber" | "red" | "grey";

export type TaskStatus = "todo" | "progress" | "review" | "done";

/** A task's output target: "" (no division) or a department code from the
 *  central catalogue (dynamic, synced from auth SSO — e.g. "teknik", "cso"). */
export type Division = string;

/* ---- Auth -------------------------------------------------------------- */

export interface AuthUser {
  username: string;
  name: string;
  role: string; // "ceo" | "kadep" | "arsitek" | "drafter"
}

/* ---- Projects + deliverable tree --------------------------------------- */

export interface TaskDoc {
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  category: string;
  group: string;
  name: string;
  pic: string;
  output: Division;
  weighted: boolean;
  status: TaskStatus;
  updatedAt: string;
  doc?: TaskDoc;
  approvedBy?: string;
  approvedAt?: string;
  /** Revision instruction recorded when a reviewer sends the task back (Revisi). */
  revisiNote?: string;
  /** Deep Analisis AI state (single-document vision QC of the review PDF). */
  aiStatus?: "" | "idle" | "running" | "done" | "failed";
  aiDone?: number;
  aiTotal?: number;
  aiFindings?: GKFinding[];
  aiSkills?: string[];
  aiAnnotated?: { name: string; size: number };
  aiError?: string;
  aiCheckedAt?: string;
}

export interface GroupRollup {
  group: string;
  progress: number;
  done: number;
  total: number;
}

export interface CategoryRollup {
  category: string;
  progress: number;
  groups: GroupRollup[];
}

export interface ProjectRollup {
  id: string;
  no: number;
  gp: string;
  name: string;
  lokasi: string;
  luas: string;
  units: number;
  types: number;
  progress: number;
  status: Rag;
  done: number;
  total: number;
  categories?: CategoryRollup[];
}

/** Phase/cluster grouping within a project (A, B, "Verci 3 Ekstensi"). */
export interface Blok {
  id: string;
  projectId: string;
  name: string;
}

/** One unit/plot: sits in a Blok, built to a BuildingType. */
export interface Kavling {
  id: string;
  projectId: string;
  blokId: string;
  noKav: string;
  typeId: string;
  luasBangunan: number;
  luasKavling: number;
  lebarKavling: string;
}

export interface ProjectDetail extends ProjectRollup {
  tasks: Task[];
  bloks: Blok[];
  kavling: Kavling[];
}

/** A task annotated with its owning project (the backend embeds Task). */
export interface AssignedTask extends Task {
  projectId: string;
  projectName: string;
  gp: string;
}

/* ---- Outputs by division ----------------------------------------------- */

export interface OutputItem {
  projectId: string;
  projectName: string;
  gp: string;
  deliverable: string;
  pic: string;
  status: TaskStatus;
  ready: boolean;
}

export interface DivisionOutputs {
  division: Division;
  label: string;
  ready: number;
  total: number;
  items: OutputItem[];
}

/* ---- Working-drawing flow + alerts ------------------------------------- */

export type WorkDrawingStatus = "info" | "konsumen" | "ttd" | "kontraktor" | "done";

export interface WorkDrawing {
  id: string;
  projectId: string;
  projectName: string;
  konsumen: string;
  unit: string;
  pic: string;
  infoMasuk: string;
  konsumenDue: string;
  konsumenDone: string;
  ttdKonsumen: string;
  kontraktorDue: string;
  kontraktorDone: string;
  status: WorkDrawingStatus;
  revisiNote: string;
  konsumenDaysLeft: number;
  kontraktorDaysLeft: number;
  activeLeg: "konsumen" | "kontraktor" | "";
  sev: Rag;
  /** Files linked to this drawing (e.g. imported from cicle). */
  attachments?: { name: string; url: string }[];

  /** Deep Revisi AI — GK Kontraktor vs GK TTD vision check (Ollama). */
  gkKontraktor?: GKDoc;
  gkTTD?: GKDoc;
  gkAnnotated?: GKDoc;
  gkStatus?: "" | "idle" | "running" | "done" | "failed";
  gkDone?: number; // pages analysed so far (progress while running)
  gkTotal?: number; // total pages to analyse
  gkFindings?: GKFinding[];
  gkError?: string;
  gkCheckedAt?: string;
}

export interface GKDoc {
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface GKFinding {
  page: number;
  wrong: string;
  correct: string;
  explain: string;
  confidence: string;
}

export interface AlertItem {
  id: string;
  sev: Rag;
  leg: "konsumen" | "kontraktor";
  projectName: string;
  konsumen: string;
  unit: string;
  pic: string;
  due: string;
  daysLeft: number;
  message: string;
}

/* ---- Summary ----------------------------------------------------------- */

export interface PICLoad {
  pic: string;
  total: number;
  done: number;
  progress: number;
}

export interface DivisionStat {
  division: Division;
  label: string;
  ready: number;
  total: number;
}

export interface Summary {
  today: string;
  projects: number;
  avgProgress: number;
  tasks: number;
  tasksDone: number;
  pics: PICLoad[];
  divisions: DivisionStat[];
  alerts: { red: number; amber: number; green: number };
}

/* ---- Master reference data --------------------------------------------- */

export interface MasterProjectInfo {
  id: string;
  no: number;
  gp: string;
  name: string;
  lokasi: string;
  luas: string;
  units: number;
  types: number;
  tasks: number;
  added: boolean;
}

export interface TemplateTask {
  id: string;
  name: string;
  pic: string;
  output: Division;
  weighted: boolean;
}

export interface TemplateGroup {
  group: string;
  tasks: TemplateTask[];
}

export interface TemplateCategory {
  category: string;
  groups: TemplateGroup[];
}

export interface AccountInfo {
  username: string;
  name: string;
  role: string;
  roleLabel: string;
  isPic: boolean;
}

export interface DivisionInfo {
  division: Division;
  label: string;
}

/** Grup / cluster master (GP1, GP2, …) — a project belongs to one GP. */
export interface GP {
  id: string;
  code: string;
  name: string;
}

/** Reusable house-type master (Garnet, Ruby, …) with standard building + land area. */
export interface BuildingType {
  id: string;
  name: string;
  luasBangunan: number;
  luasTanah: number;
}

/** Kavling frontage category master (L3.5, L4, L5). */
export interface Lebar {
  id: string;
  name: string;
}

/** Location master (Leuwinanggung, Curug, …) reused across projects. */
export interface Lokasi {
  id: string;
  name: string;
}

export interface MasterData {
  projects: MasterProjectInfo[];
  template: TemplateCategory[];
  accounts: AccountInfo[];
  divisions: DivisionInfo[];
  gps: GP[];
  types: BuildingType[];
  lebars: Lebar[];
  lokasis: Lokasi[];
  seedCount: number;
}

/* ---- Staff / team ------------------------------------------------------ */

export interface StaffMember {
  username: string;
  name: string;
  role: string;
  roleLabel: string;
  isPic: boolean;
  total: number;
  done: number;
  inProgress: number;
  progress: number;
  activeDrawings: number;
}
