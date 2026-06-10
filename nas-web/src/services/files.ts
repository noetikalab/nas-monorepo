/**
 * 文件操作 API — list / download / upload / mkdir / delete / move
 */

import { api } from "@/lib/api";
import type { FileInfo, PermissionListResponse } from "@/lib/types";

export interface FileListResult {
  path: string;
  files: FileInfo[];
}

export interface MkdirParams {
  path: string;
}

export interface MoveParams {
  from: string;
  to: string;
}

export const filesApi = {
  /** 列出目录内容 */
  list: (path?: string) => {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    return api.get<FileListResult>(`/files?${params.toString()}`);
  },

  /** 下载文件（触发浏览器下载） */
  download: (filePath: string, fileName: string) =>
    api.download(`/files/download?path=${encodeURIComponent(filePath)}`, fileName),

  /** 获取文件 Blob URL（预览用）。
   *  @param filePath 文件完整路径
   *  @param signal   AbortSignal，用于组件卸载时取消请求，避免内存泄漏 */
  getBlobUrl: async (filePath: string, signal?: AbortSignal): Promise<string | null> => {
    const res = await api.requestRaw(`/files/download?path=${encodeURIComponent(filePath)}`, { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /** 获取文件文本内容（预览用，限制 2MB）。
   *  @param filePath 文件完整路径
   *  @param signal   AbortSignal，用于组件卸载时取消请求 */
  getText: async (filePath: string, signal?: AbortSignal): Promise<string | null> => {
    const res = await api.requestRaw(`/files/download?path=${encodeURIComponent(filePath)}`, { signal });
    if (!res.ok) return null;
    // 检查文件大小，防止超大文本卡死浏览器
    const len = res.headers.get("Content-Length");
    if (len && parseInt(len) > 2 * 1024 * 1024) {
      throw new Error("文件过大（超过 2MB），无法预览");
    }
    return res.text();
  },

  /** 上传文件（FormData） */
  upload: (formData: FormData) =>
    api.upload<{ ok: boolean }>("/files/upload", formData),

  /** 新建目录 */
  mkdir: (params: MkdirParams) =>
    api.post<{ ok: boolean }>("/files/mkdir", params),

  /** 删除文件或目录 */
  delete: (filePath: string) =>
    api.del<{ ok: boolean }>(`/files?path=${encodeURIComponent(filePath)}`),

  /** 移动/重命名 */
  move: (params: MoveParams) =>
    api.post<{ ok: boolean }>("/files/move", params),

  /** 文件共享权限操作 */
  share: {
    /** 查询路径上的 ACL 权限列表 */
    list: (filePath: string) =>
      api.get<PermissionListResponse>(`/share/permissions?path=${encodeURIComponent(filePath)}`),

    /** 授权用户访问 */
    grant: (path: string, targetUser: string, action: "readonly" | "readwrite") =>
      api.post<{ ok: boolean }>("/share/permission", { path, target_user: targetUser, action }),

    /** 撤销用户权限 */
    revoke: (path: string, targetUser: string) =>
      api.post<{ ok: boolean }>("/share/permission", { path, target_user: targetUser, action: "remove" }),
  },
};
