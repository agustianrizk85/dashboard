import { api } from "./api";
import type {
  CreateProjectInput,
  PKSPackage,
  Project,
  ProjectProgress,
} from "@/modules/permit/models";

export const projectService = {
  async list(): Promise<Project[]> {
    const { data } = await api.get<Project[]>("/projects");
    return data;
  },

  async get(id: number): Promise<Project> {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const { data } = await api.post<Project>("/projects", input);
    return data;
  },

  async progress(id: number): Promise<ProjectProgress> {
    const { data } = await api.get<ProjectProgress>(`/projects/${id}/progress`);
    return data;
  },

  /** Tie this lahan to a Perencanaan project (id like "gp-001") so C10/C12 can
   *  pull its Siteplan / IMB. Pass "" to clear the link. Returns the updated
   *  project. */
  async setLink(id: number, perencanaanProjectId: string): Promise<Project> {
    const { data } = await api.put<Project>(`/projects/${id}/link`, {
      perencanaan_project_id: perencanaanProjectId,
    });
    return data;
  },

  /** Auto-aggregated PKS Bank (Berkas Acuan F) — pulls acuan documents from the
   *  project's own steps A6/A7/B4/C10. `ready` = every group has ≥1 document. */
  async pksPackage(id: number): Promise<PKSPackage> {
    const { data } = await api.get<PKSPackage>(`/projects/${id}/pks-package`);
    return data;
  },
};
