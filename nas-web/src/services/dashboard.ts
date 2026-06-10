/**
 * Dashboard API — 系统概览 / 最近操作
 */

import { api } from "@/lib/api";
import type { DashboardStats, RecentEntry } from "@/lib/types";

export const dashboardApi = {
  /** 获取系统资源概览（CPU/内存/磁盘） */
  getStats: () =>
    api.get<DashboardStats>("/dashboard/stats"),

  /** 获取最近文件操作记录 */
  getRecent: (limit = 10) =>
    api.get<RecentEntry[]>(`/dashboard/recent?limit=${limit}`),
};
