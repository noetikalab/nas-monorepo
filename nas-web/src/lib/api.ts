/**
 * API 客户端 — 基于 fetch 封装，提供 JWT 鉴权注入和 401 自动拦截。
 *
 * 用法：
 *   import { api } from "@/lib/api";
 *   const stats = await api.get<DashboardStats>("/dashboard/stats");
 *   await api.post("/files/mkdir", { path: "/data/alice/newdir" });
 *   await api.del("/files?path=...");
 *
 * 特性：
 *   - 自动从 localStorage 读取 token 并注入 Authorization header
 *   - 401 响应自动清除 token 并重定向到 /login
 *   - 所有方法返回 Promise<T>，类型安全
 *   - 上传文件使用 api.upload()，不设置 Content-Type（让浏览器自动设置 boundary）
 */

import { toast } from "sonner";

const API_BASE = "/api"; // 同源，nginx location /api/ → authd:8080

type HttpMethod = "GET" | "POST" | "DELETE";

class ApiClient {
  /** 从 localStorage 获取 JWT token */
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("nas-token");
  }

  /** 核心请求方法 */
  private async request<T>(
    path: string,
    options?: RequestInit & { rawResponse?: boolean },
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};

    // 仅当 Content-Type 未被调用方显式设置时才设置 application/json
    // 上传文件时需要让浏览器自动设置 multipart boundary
    if (!(options?.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 合并用户自定义 headers
    if (options?.headers) {
      Object.assign(headers, options.headers as Record<string, string>);
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // 401 → 清除 token 并重定向登录页
    if (res.status === 401) {
      localStorage.removeItem("nas-token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("未登录或登录已过期");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const msg = err.error || `请求失败 (${res.status})`;
      toast.error(msg);
      throw new Error(msg);
    }

    // 某些接口返回空体（如 DELETE）
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  /** GET 请求 */
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /** POST 请求（JSON body） */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** DELETE 请求 */
  async del<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  /** 文件上传（FormData body，不设置 Content-Type） */
  async upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: "POST", body: formData });
  }

  /** 原始请求方法 — 返回原生 Response，不做 JSON 解析。
   *  适用于需要二进制响应（blob）或纯文本响应的场景。
   *  仍然处理 token 注入和 401 拦截，响应状态由调用方自行判断。 */
  async requestRaw(path: string, options?: RequestInit): Promise<Response> {
    const token = this.getToken();
    const headers: Record<string, string> = {};

    if (!(options?.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (options?.headers) {
      Object.assign(headers, options.headers as Record<string, string>);
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      localStorage.removeItem("nas-token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("未登录或登录已过期");
    }

    return res;
  }

  /** 下载文件 */
  async download(path: string, filename: string): Promise<void> {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`下载失败 (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/** 全局 API 客户端实例 */
export const api = new ApiClient();
