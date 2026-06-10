"use client";

/**
 * useFiles — 文件列表状态管理 Hook
 *
 * 职责：
 *   - 维护当前浏览路径（path state）
 *   - 从 /files?path=... 拉取文件/目录列表
 *   - 提供 navigateTo（进入目录）、goUp（返回上级）、refresh（刷新）
 *
 * 使用方式：
 *   const { files, path, loading, error, navigateTo, goUp, refresh } = useFiles();
 *   // 初始 path 为空时，后端根据 JWT role 自动返回 /data/{user}/ 或 /data/
 */

import { useCallback, useEffect, useState } from "react";
import { filesApi } from "@/services";
import type { FileInfo } from "@/lib/types";

export interface UseFilesReturn {
  /** 当前浏览的绝对路径（如 /data/alice/photos） */
  path: string;
  /** 手动设置路径（如面包屑点击跳转） */
  setPath: (p: string) => void;
  /** 当前目录下的文件和子目录列表 */
  files: FileInfo[];
  /** 是否正在加载 */
  loading: boolean;
  /** 加载错误信息，为 null 表示无错误 */
  error: string | null;
  /** 进入指定子目录（追加到 path） */
  navigateTo: (dirName: string) => void;
  /** 返回上级目录 */
  goUp: () => void;
  /** 重新加载当前目录 */
  refresh: () => void;
}

export function useFiles(initialPath?: string): UseFilesReturn {
  const [path, setPath] = useState<string>(initialPath ?? "");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从后端拉取指定路径的文件列表。
   * path 为空时后端会根据 JWT role 返回默认目录：
   *   admin → /data/
   *   user  → /data/{username}/
   */
  const fetchFiles = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await filesApi.list(p);
      setPath(res.path);
      setFiles(res.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 路径变化时自动拉取文件列表
  useEffect(() => {
    fetchFiles(path);
  }, [path, fetchFiles]);

  /** 进入指定子目录 */
  const navigateTo = useCallback(
    (dirName: string) => {
      // path 可能为空字符串（初始状态），此时直接跳转到 dirName
      const base = path || "/data";
      setPath(`${base.replace(/\/$/, "")}/${dirName}`);
    },
    [path],
  );

  /** 返回上级目录 */
  const goUp = useCallback(() => {
    // 防止越界：/data 是根，不允许继续往上
    if (path === "/data" || path === "") return;
    const parent = path.substring(0, path.lastIndexOf("/"));
    setPath(parent || "/data");
  }, [path]);

  /** 重新加载当前目录 */
  const refresh = useCallback(() => {
    fetchFiles(path);
  }, [path, fetchFiles]);

  return {
    path,
    setPath,
    files,
    loading,
    error,
    navigateTo,
    goUp,
    refresh,
  };
}
