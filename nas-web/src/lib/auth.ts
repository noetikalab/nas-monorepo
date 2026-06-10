/**
 * 鉴权工具函数 — JWT token 管理 + 登录/登出流程。
 *
 * localStorage 存储键：
 *   nas-token     — JWT token 字符串（api.ts 自动注入 Authorization header）
 *   nas-username  — 当前登录用户名（UI 展示）
 *   nas-role      — 用户角色（"admin" | "user"），前端据此决定是否显示管理菜单
 */

import { authApi } from "@/services";
import type { LoginResult } from "@/services/auth";

const TOKEN_KEY = "nas-token";
const USER_KEY = "nas-username";
const ROLE_KEY = "nas-role";

/** 执行登录请求，成功后将 token、用户名和角色存入 localStorage */
export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  const res = await authApi.login({ username, password });
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, username);
    // 存储角色，前端侧边栏和路由守卫依赖此值决定是否展示管理功能
    localStorage.setItem(ROLE_KEY, res.role);
  }
  return res;
}

/** 清除登录状态并重定向到登录页 */
export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    window.location.href = "/login";
  }
}

/** 获取当前 JWT token，未登录返回 null */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** 获取当前登录用户名 */
export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY);
}

/** 获取当前用户角色 */
export function getRole(): "admin" | "user" | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "admin" || role === "user") return role;
  return null;
}

/** 判断是否已登录（仅检查 token 是否存在，不验证有效性） */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/** 判断当前用户是否为管理员 */
export function isAdmin(): boolean {
  return getRole() === "admin";
}
