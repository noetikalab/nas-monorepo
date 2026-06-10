/**
 * 审计日志 / 存证 API（admin only）
 */

import { api } from "@/lib/api";
import type { CertifiedOperationListResponse, ProofDetailResponse, ProofBundle } from "@/lib/types";

export const logsApi = {
  /** 分页查询存证操作日志 */
  list: (page = 1, limit = 20, type?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.set("type", type);
    return api.get<CertifiedOperationListResponse>(`/logs?${params.toString()}`);
  },

  /** 查询单条存证详情（操作 + 哈希链） */
  detail: (id: number) =>
    api.get<ProofDetailResponse>(`/proof/${id}`),

  /** 导出指定范围的存证包 */
  bundle: (from = 1, to?: number) => {
    const params = new URLSearchParams({ from: String(from) });
    if (to) params.set("to", String(to));
    return api.get<ProofBundle>(`/proof/bundle?${params.toString()}`);
  },
};
