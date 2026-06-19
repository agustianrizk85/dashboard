import { api } from "./api";
import type { CreateProjectInput, Project, ProjectProgress } from "@/modules/permit/models";

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
};
