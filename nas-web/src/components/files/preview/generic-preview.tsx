"use client";

/**
 * GenericPreview — 通用文件预览（不可预览类型的兜底组件）。
 *
 * 当文件类型不属于 text/image/pdf/video/audio 时展示：
 *   - 文件图标 + 文件名
 *   - 文件大小、修改时间
 *   - 下载按钮
 *
 * 不加载文件内容，仅展示元信息。
 */

import { FileText, Download, HardDrive, Clock } from "lucide-react";
import { filesApi } from "@/services";

interface GenericPreviewProps {
  /** 文件完整路径（用于下载） */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 修改时间（ISO 字符串） */
  modified: string;
}

/** 格式化文件大小为人类可读形式 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** 格式化日期为本地字符串 */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function GenericPreview({ filePath, fileName, fileSize, modified }: GenericPreviewProps) {
  /** 触发文件下载 */
  const handleDownload = () => {
    filesApi.download(filePath, fileName);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      {/* 文件图标 */}
      <div className="flex flex-col items-center gap-3">
        <FileText className="size-20 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground truncate max-w-64">{fileName}</p>
        <p className="text-xs text-muted-foreground">此文件类型不支持在线预览</p>
      </div>

      {/* 文件信息 */}
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HardDrive className="size-3.5" />
          <span>大小：{formatSize(fileSize)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-3.5" />
          <span>修改：{formatDate(modified)}</span>
        </div>
      </div>

      {/* 下载按钮 */}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm
          bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
        onClick={handleDownload}
      >
        <Download className="size-4" />
        下载文件
      </button>
    </div>
  );
}
