/**
 * 用户管理 API（admin only）
 */

import { api } from "@/lib/api";
import type { CreateUserRequest, CreateUserResponse, UserListResponse } from "@/lib/types";

export const usersApi = {
  /** 用户列表（后端返回 { users: UserEntry[] }） */
  list: () =>
    api.get<UserListResponse>("/users"),

  /** 用户总数 */
  count: () =>
    api.get<{ count: number }>("/users/count"),

  /** admin 创建用户 */
  create: (data: CreateUserRequest) =>
    api.post<CreateUserResponse>("/users", data),

  /** 删除用户 */
  delete: (username: string) =>
    api.del<{ ok: boolean }>(`/users/${encodeURIComponent(username)}`),
};
