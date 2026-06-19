import { api, tokenStore } from "./api";
import type { LoginResponse, User } from "../models";

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
    tokenStore.set(data.token);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  logout() {
    tokenStore.clear();
  },
};
