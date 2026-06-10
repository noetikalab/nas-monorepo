"use client";

/**
 * useFileBlob / useFileText — 文件预览 Hook。
 *
 * 由于文件下载接口需要 Bearer Token 认证，无法直接用 URL 作为
 * img/video/audio 的 src，因此通过 filesApi.getBlobUrl / getText 获取内容。
 *
 * 生命周期：
 *   - filePath 变化时自动重新获取
 *   - 组件卸载时自动取消请求 + 释放 objectURL，防止内存泄漏
 */

import { useEffect, useState } from "react";
import { filesApi } from "@/services/files";

/** Hook 返回值 */
interface UseFileBlobReturn {
  /** Blob URL，可直接用于 src 属性 */
  blobUrl: string | null;
  /** 加载中标识 */
  loading: boolean;
  /** 错误消息 */
  error: string | null;
}

/**
 * 获取文件的 Blob URL。
 * @param filePath 文件完整路径（如 /data/alice/photo.jpg）
 * @param enabled 是否启用加载（默认 true，设为 false 可延迟加载）
 */
export function useFileBlob(filePath: string | null, enabled = true): UseFileBlobReturn {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 路径为空或未启用时不加载
    if (!filePath || !enabled) {
      setBlobUrl(null);
      return;
    }

    let revoked = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = await filesApi.getBlobUrl(filePath!, controller.signal);
        if (revoked) return; // 组件已卸载
        setBlobUrl(url);
        if (!url) setError("加载失败");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    load();

    // 清理：释放 objectURL + 取消请求
    return () => {
      revoked = true;
      controller.abort();
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [filePath, enabled]);

  return { blobUrl, loading, error };
}

/**
 * useFileText — 获取文本文件内容的 Hook。
 *
 * 用于代码预览、文本预览等需要读取文件文本内容的场景。
 * 限制最大读取 2MB 防止浏览器卡顿，由 filesApi.getText 内部处理。
 */
interface UseFileTextReturn {
  /** 文本内容 */
  text: string | null;
  /** 加载中 */
  loading: boolean;
  /** 错误消息 */
  error: string | null;
}

export function useFileText(filePath: string | null, enabled = true): UseFileTextReturn {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath || !enabled) {
      setText(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const content = await filesApi.getText(filePath!, controller.signal);
        if (cancelled) return;
        setText(content);
        if (content === null) setError("加载失败或文件过大");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filePath, enabled]);

  return { text, loading, error };
}
