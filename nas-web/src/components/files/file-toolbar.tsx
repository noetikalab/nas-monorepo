"use client";

/**
 * FileToolbar — 文件操作工具栏
 *
 * 提供：
 *   - 上传按钮（触发父组件的 onUpload 回调，UI 由 Task #45 的 UploadDialog 实现）
 *   - 新建文件夹按钮（触发 onMkdir 回调）
 *   - 搜索输入（本地过滤文件名）
 *   - 视图切换（列表 ↔ 网格），状态持久化到 localStorage key nas-view-mode
 *   - 当前路径显示 + 批量操作提示
 *
 * Props：
 *   - viewMode: 当前视图模式
 *   - onViewModeChange: 切换视图回调
 *   - onSearch: 搜索文本变化回调
 *   - onUpload: 点击上传按钮回调
 *   - onMkdir: 点击新建文件夹按钮回调
 *   - selectedCount: 选中文件数量（用于显示批量操作）
 *   - onBatchDelete: 批量删除回调
 */

import { Search, Upload, FolderPlus, Trash2, LayoutGrid, List } from "lucide-react";

interface FileToolbarProps {
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  onSearch: (query: string) => void;
  onUpload: () => void;
  onMkdir: () => void;
  selectedCount: number;
  onBatchDelete: () => void;
}

export function FileToolbar({
  viewMode,
  onViewModeChange,
  onSearch,
  onUpload,
  onMkdir,
  selectedCount,
  onBatchDelete,
}: FileToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
      {/* 左侧：操作按钮 */}
      <div className="flex items-center gap-1">
        {/* 上传 */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium
            bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          onClick={onUpload}
        >
          <Upload className="size-3.5" />
          上传
        </button>

        {/* 新建文件夹 */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium
            border border-border text-foreground hover:bg-accent transition-colors cursor-pointer"
          onClick={onMkdir}
        >
          <FolderPlus className="size-3.5" />
          新建文件夹
        </button>

        {/* 批量删除：有选中时显示 */}
        {selectedCount > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium
              border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            onClick={onBatchDelete}
          >
            <Trash2 className="size-3.5" />
            删除 ({selectedCount})
          </button>
        )}
      </div>

      {/* 中间：搜索 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="搜索文件..."
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 右侧：视图切换 */}
      <div className="flex items-center rounded-md border border-border overflow-hidden">
        <button
          type="button"
          className={`p-1.5 cursor-pointer transition-colors ${
            viewMode === "list"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onViewModeChange("list")}
          title="列表视图"
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          className={`p-1.5 cursor-pointer transition-colors ${
            viewMode === "grid"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onViewModeChange("grid")}
          title="网格视图"
        >
          <LayoutGrid className="size-4" />
        </button>
      </div>
    </div>
  );
}
