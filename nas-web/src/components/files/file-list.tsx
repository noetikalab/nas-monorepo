"use client";

/**
 * FileList — 文件列表视图（Table 模式）
 *
 * 特性：
 *   - 使用 react-virtuoso 虚拟滚动，> 100 条时只渲染可见行
 *   - 表头可排序：name / size / type / modified
 *   - 单击选中行，双击进入目录（通过 onNavigate 回调）
 *   - 选中的文件/目录通过 onSelect 回调通知父组件（批量删除、右键菜单）
 *
 * Props：
 *   - files: 当前目录下的文件/目录列表
 *   - selected: 当前选中的文件路径集合（来自父组件）
 *   - onToggleSelect: 切换某个文件/目录的选中状态
 *   - onNavigate: 双击目录时回调（进入子目录）
 *   - onDownload: 双击文件时回调（下载）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { File, Folder, ChevronUp, ChevronDown } from "lucide-react";
import type { FileInfo } from "@/lib/types";

type SortField = "name" | "size" | "type" | "modified";
type SortDirection = "asc" | "desc";

interface FileListProps {
  files: FileInfo[];
  selected: Set<string>;
  onToggleSelect: (path: string) => void;
  onNavigate: (dirName: string) => void;
  onDownload: (fileName: string) => void;
  /** 右键菜单回调（传递事件 + 文件信息） */
  onContextMenu?: (e: React.MouseEvent, file: FileInfo) => void;
}

/** 格式化文件大小为人类可读形式 */
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

/** 格式化 ISO 时间为简短显示 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 根据文件扩展名返回简短类型标签 */
function fileTypeLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext || ext === name) return "—";
  return ext.toUpperCase();
}

export function FileList({
  files,
  selected,
  onToggleSelect,
  onNavigate,
  onDownload,
  onContextMenu,
}: FileListProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // 测量容器高度，传给 Virtuoso
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const header = el.firstElementChild as HTMLElement;
    const ro = new ResizeObserver(() => {
      if (header) {
        setListHeight(el.clientHeight - header.clientHeight);
      }
    });
    ro.observe(el);
    // 初始测量
    if (header) setListHeight(el.clientHeight - header.clientHeight);
    return () => ro.disconnect();
  }, []);

  /** 排序后的文件列表 */
  const sorted = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      // 目录始终排在文件前面
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "modified":
          cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [files, sortField, sortDir]);

  /** 点击表头切换排序 */
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  /** 渲染排序箭头 */
  const SortArrow = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline size-3" />
    ) : (
      <ChevronDown className="inline size-3" />
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
      {/* 表头 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground shrink-0">
        <div className="w-8 shrink-0" />
        <button
          className="flex-1 flex items-center gap-1 cursor-pointer hover:text-foreground"
          onClick={() => handleSort("name")}
        >
          名称 <SortArrow field="name" />
        </button>
        <button
          className="w-24 flex items-center justify-end gap-1 cursor-pointer hover:text-foreground"
          onClick={() => handleSort("size")}
        >
          大小 <SortArrow field="size" />
        </button>
        <button
          className="w-20 flex items-center justify-center gap-1 cursor-pointer hover:text-foreground"
          onClick={() => handleSort("type")}
        >
          类型 <SortArrow field="type" />
        </button>
        <button
          className="w-36 flex items-center justify-end gap-1 cursor-pointer hover:text-foreground"
          onClick={() => handleSort("modified")}
        >
          修改时间 <SortArrow field="modified" />
        </button>
      </div>

      {/* 虚拟滚动文件行 */}
      <Virtuoso
        style={{ height: listHeight }}
        totalCount={sorted.length}
        itemContent={(index) => {
          const f = sorted[index];
          const isDir = f.type === "directory";
          const isSelected = selected.has(f.name);

          return (
            <div
              className={`file-row flex items-center gap-2 px-4 py-2 cursor-pointer border-b border-border/50 transition-colors
                ${isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/30"}
              `}
              onClick={(e) => {
                // Ctrl/Cmd + 点击 → 多选
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
              {/* 图标 */}
              <div className="size-8 flex items-center justify-center shrink-0">
                {isDir ? (
                  <Folder className="size-5 text-blue-400" />
                ) : (
                  <File className="size-5 text-muted-foreground" />
                )}
              </div>

              {/* 名称 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{f.name}</p>
              </div>

              {/* 大小 */}
              <div className="w-24 text-xs text-muted-foreground text-right tabular-nums">
                {isDir ? "—" : formatSize(f.size)}
              </div>

              {/* 类型 */}
              <div className="w-20 text-xs text-muted-foreground text-center">
                {isDir ? "目录" : fileTypeLabel(f.name)}
              </div>

              {/* 修改时间 */}
              <div className="w-36 text-xs text-muted-foreground text-right">
                {formatTime(f.modified)}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
