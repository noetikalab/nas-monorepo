"use client";

/**
 * FileGrid — 文件网格视图（Card 模式）
 *
 * 特性：
 *   - CSS Grid 自适应列数：grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6
 *   - 每个 Card 显示图标 + 名称 + 大小
 *   - 单击选中，双击进入目录/下载文件
 *   - 使用 react-file-icon 根据扩展名显示文件类型图标
 *
 * Props 与 FileList 完全一致，两者可互换渲染。
 */

import { useMemo } from "react";
import { Folder } from "lucide-react";
import { FileIcon, defaultStyles } from "react-file-icon";
import type { FileInfo } from "@/lib/types";

interface FileGridProps {
  files: FileInfo[];
  selected: Set<string>;
  onToggleSelect: (path: string) => void;
  onNavigate: (dirName: string) => void;
  onDownload: (fileName: string) => void;
  /** 右键菜单回调（传递事件 + 文件信息） */
  onContextMenu?: (e: React.MouseEvent, file: FileInfo) => void;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 获取文件扩展名（小写，无点号前缀） */
function fileExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && ext !== name ? ext : "";
}

export function FileGrid({
  files,
  selected,
  onToggleSelect,
  onNavigate,
  onDownload,
  onContextMenu,
}: FileGridProps) {
  /** 目录排在前面，其余按名称排序 */
  const sorted = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [files]);

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {sorted.map((f) => {
          const isDir = f.type === "directory";
          const isSelected = selected.has(f.name);
          const ext = fileExtension(f.name);

          return (
            <button
              key={f.name}
              type="button"
              className={`file-card flex flex-col items-center gap-2 p-3 rounded-lg border border-border/50 cursor-pointer transition-all
                ${isSelected
                  ? "bg-accent text-accent-foreground ring-2 ring-ring"
                  : "hover:bg-accent/30 hover:border-border"
                }`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  onToggleSelect(f.name);
                }
              }}
              onDoubleClick={() => {
                if (isDir) {
                  onNavigate(f.name);
                } else {
                  onDownload(f.name);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu?.(e, f);
              }}
            >
              {/* 图标区域 */}
              <div className="size-14 flex items-center justify-center shrink-0">
                {isDir ? (
                  <Folder className="size-12 text-blue-400" />
                ) : ext ? (
                  <div className="size-10">
                    <FileIcon
                      extension={ext}
                      {...(defaultStyles[ext as keyof typeof defaultStyles] || defaultStyles.txt)}
                    />
                  </div>
                ) : (
                  <div className="size-10">
                    <FileIcon extension="" {...defaultStyles.txt} />
                  </div>
                )}
              </div>

              {/* 文件名（最多两行，超出省略） */}
              <p className="text-xs text-center line-clamp-2 break-all leading-tight w-full">
                {f.name}
              </p>

              {/* 文件大小 */}
              {!isDir && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {formatSize(f.size)}
                </p>
              )}
            </button>
          );
        })}

        {/* 空目录提示 */}
        {sorted.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Folder className="size-12 mb-3 opacity-30" />
            <p className="text-sm">此目录为空</p>
          </div>
        )}
      </div>
    </div>
  );
}
