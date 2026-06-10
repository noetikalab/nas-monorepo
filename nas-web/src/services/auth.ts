/**
 * 认证 API — login / register / validate
 */

import { api } from "@/lib/api";

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  role: "admin" | "user";
}

export interface RegisterParams {
  username: string;
  password: string;
}

export interface RegisterResult {
  token: string;
  uid: number;
  role: "admin" | "user";
}

export const authApi = {
  login: (params: LoginParams) =>
    api.post<LoginResult>("/login", params),

  register: (params: RegisterParams) =>
    api.post<RegisterResult>("/register", params),

  validateToken: () =>
    api.get<{ ok: boolean }>("/validate-token"),
};
