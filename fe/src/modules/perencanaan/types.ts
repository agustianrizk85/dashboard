// Types for the Perencanaan planning module. These mirror the Go backend DTOs
// (internal/service/*.go) exactly so the API responses map straight onto them.

export type Rag = "green" | "amber" | "red" | "grey";

export type TaskStatus = "todo" | "progress" | "review" | "done";

export type Division = "" | "legal" | "marketing" | "teknik" | "konsumen" | "ceo";

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

export interface ProjectDetail extends ProjectRollup {
  tasks: Task[];
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

export interface MasterData {
  projects: MasterProjectInfo[];
  template: TemplateCategory[];
  accounts: AccountInfo[];
  divisions: DivisionInfo[];
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
