"use client";

/**
 * FilesPage — 文件管理主页面
 *
 * 整合所有文件管理子组件的编排页面，职责：
 *   - 路径状态 + 文件列表（useFiles hook）
 *   - 视图模式切换（列表 ↔ 网格，localStorage 持久化）
 *   - 文件选择、搜索过滤
 *   - 左侧目录树 + 右侧文件区域（可拖拽分栏）
 *   - 右键菜单（react-contexify）
 *   - 操作对话框（上传/新建/重命名/删除）
 *   - 文件预览面板（右侧 Sheet 滑出）
 *   - GSAP 动画（stagger 入场 + 视图切换交错）
 *
 * 组件树：
 *   FilesPage
 *   ├── PanelGroup
 *   │   ├── Panel → DirectoryTree
 *   │   └── Panel
 *   │       ├── Breadcrumb
 *   │       ├── FileToolbar
 *   │       └── FileList / FileGrid
 *   ├── FileContextMenu (react-contexify)
 *   ├── FilePreview (Sheet)
 *   ├── UploadDialog / MkdirDialog / RenameDialog / DeleteConfirm
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertCircle, GripVertical } from "lucide-react";

// react-contexify 样式
import "react-contexify/ReactContexify.css";

// Hooks
import { useFiles } from "@/hooks/use-files";
import { useFileAnimation } from "@/hooks/use-file-animation";

// 子组件
import { Breadcrumb } from "@/components/files/breadcrumb";
import { DirectoryTree } from "@/components/files/directory-tree";
import { FileToolbar } from "@/components/files/file-toolbar";
import { FileList } from "@/components/files/file-list";
import { FileGrid } from "@/components/files/file-grid";
import { FilePreview } from "@/components/files/file-preview";
import { FileContextMenu, useFileContextMenu } from "@/components/files/file-context-menu";
import type { FileContextMenuHandlers } from "@/components/files/file-context-menu";
import { UploadDialog } from "@/components/files/upload-dialog";
import { MkdirDialog } from "@/components/files/mkdir-dialog";
import { RenameDialog } from "@/components/files/rename-dialog";
import { DeleteConfirm } from "@/components/files/delete-confirm";
import { ShareDialog } from "@/components/files/share-dialog";
import { filesApi } from "@/services";
import { getUsername } from "@/lib/auth";
import type { FileInfo } from "@/lib/types";

// ============================================================
// 视图模式 localStorage 持久化
// ============================================================

const VIEW_MODE_KEY = "nas-file-view-mode";
const SIDEBAR_WIDTH_KEY = "nas-file-sidebar-width";

function getStoredViewMode(): "list" | "grid" {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "grid" ? "grid" : "list";
}

function getStoredSidebarWidth(): number {
  if (typeof window === "undefined") return 260;
  const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  return stored ? parseInt(stored) : 260;
}

// ============================================================
// 页面组件
// ============================================================

export default function FilesPage() {
  // —— 文件列表核心状态 ——
  const { path, setPath, files, loading, error, navigateTo, goUp, refresh } = useFiles();

  // —— 视图模式（列表/网格）——
  const [viewMode, setViewMode] = useState<"list" | "grid">(getStoredViewMode);
  const handleViewModeChange = useCallback((mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // —— 侧边栏宽度（可拖拽调整，localStorage 持久化）——
  const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
  const dragging = useRef(false);
  const widthRef = useRef(sidebarWidth);
  widthRef.current = sidebarWidth;

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.max(180, Math.min(500, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      if (dragging.current) {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current));
      }
      dragging.current = false;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // —— 搜索过滤 ——
  const [searchQuery, setSearchQuery] = useState("");
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // —— 文件选择 ——
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);
  // 切换目录时清空选择
  useEffect(() => {
    setSelected(new Set());
    setSearchQuery("");
  }, [path]);

  // —— GSAP 动画 ——
  const { containerRef, animateStagger, animateViewSwitch } = useFileAnimation();
  // 文件列表加载完成后触发入场动画
  useEffect(() => {
    if (!loading && filteredFiles.length > 0) {
      const selector = viewMode === "list" ? ".file-row" : ".file-card";
      animateStagger(selector);
    }
  }, [loading, filteredFiles, viewMode, animateStagger]);

  // —— 预览面板状态 ——
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    filePath: string | null;
    fileName: string;
    fileSize: number;
    modified: string;
  }>({ open: false, filePath: null, fileName: "", fileSize: 0, modified: "" });

  const openPreview = useCallback(
    (file: FileInfo) => {
      const fullPath = `${path.replace(/\/$/, "")}/${file.name}`;
      setPreviewState({
        open: true,
        filePath: fullPath,
        fileName: file.name,
        fileSize: file.size,
        modified: file.modified,
      });
    },
    [path],
  );

  const closePreview = useCallback(() => {
    setPreviewState((prev) => ({ ...prev, open: false }));
  }, []);

  // —— 对话框状态 ——
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [renameState, setRenameState] = useState<{
    open: boolean;
    name: string;
    isDirectory: boolean;
  }>({ open: false, name: "", isDirectory: false });
  const [deleteState, setDeleteState] = useState<{
    open: boolean; items: string[];
  }>({ open: false, items: [] });
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [contextTarget, setContextTarget] = useState<{
    fileName: string;
    isDirectory: boolean;
  }>({ fileName: "", isDirectory: false });

  const contextMenuHandlers: FileContextMenuHandlers = useMemo(
    () => ({
      onPreview: (fileName) => {
        const file = files.find((f) => f.name === fileName);
        if (file) openPreview(file);
      },
      onDownload: (fileName) => {
        const fullPath = `${path.replace(/\/$/, "")}/${fileName}`;
        filesApi.download(fullPath, fileName);
      },
      onRename: (fileName) => {
        const file = files.find((f) => f.name === fileName);
        setRenameState({
          open: true,
          name: fileName,
          isDirectory: (file?.type === "directory") || false,
        });
      },
      onDelete: (fileName) => {
        setDeleteState({ open: true, items: [fileName] });
      },
      onShare: (fileName) => {
        const fullPath = `${path.replace(/\/$/, "")}/${fileName}`;
        setSharePath(fullPath);
      },
    }),
    [files, path, openPreview],
  );

  const { showMenu } = useFileContextMenu(contextMenuHandlers);

  /** 右键菜单触发（由 FileList/FileGrid 调用） */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileInfo) => {
      setContextTarget({ fileName: file.name, isDirectory: file.type === "directory" });
      showMenu(e, file.name, file.type === "directory");
    },
    [showMenu],
  );

  // —— 双击文件 → 预览（非目录） ——
  const handleFileAction = useCallback(
    (fileName: string) => {
      const file = files.find((f) => f.name === fileName);
      if (file && file.type === "file") {
        openPreview(file);
      }
    },
    [files, openPreview],
  );

  // —— 批量删除 ——
  const handleBatchDelete = useCallback(() => {
    if (selected.size === 0) return;
    setDeleteState({ open: true, items: Array.from(selected) });
  }, [selected]);

  // —— 视图切换 + 动画 ——
  const handleViewSwitch = useCallback(
    (mode: "list" | "grid") => {
      const newSelector = mode === "list" ? ".file-row" : ".file-card";
      animateViewSwitch(newSelector, () => handleViewModeChange(mode));
    },
    [animateViewSwitch, handleViewModeChange],
  );

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 可拖拽分栏布局 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：目录树 */}
        <div
          className="shrink-0 border-r border-border overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <DirectoryTree currentPath={path} onSelect={setPath} username={getUsername() ?? ""} />
        </div>

        {/* 拖拽分隔条 */}
        <div
          className="w-1 shrink-0 bg-border/50 hover:bg-primary/50 active:bg-primary cursor-col-resize transition-colors flex items-center justify-center"
          onMouseDown={handleMouseDown}
        >
          <GripVertical className="size-3 text-muted-foreground/50 pointer-events-none" />
        </div>

        {/* 右侧：面包屑 + 工具栏 + 文件列表 */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* 面包屑导航 */}
          <div className="px-4 pt-3 pb-1">
            <Breadcrumb path={path} onNavigate={setPath} />
          </div>

          {/* 工具栏 */}
          <div className="px-4 py-2 border-b border-border">
            <FileToolbar
              viewMode={viewMode}
              onViewModeChange={handleViewSwitch}
              onSearch={setSearchQuery}
              onUpload={() => setUploadOpen(true)}
              onMkdir={() => setMkdirOpen(true)}
              selectedCount={selected.size}
              onBatchDelete={handleBatchDelete}
            />
          </div>

          {/* 文件内容区 */}
          <div ref={containerRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* 加载中 */}
            {loading && (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            )}

            {/* 错误 */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
                <AlertCircle className="size-8" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* 空目录 */}
            {!loading && !error && filteredFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <p className="text-sm">
                  {searchQuery ? "没有匹配的文件" : "此目录为空"}
                </p>
              </div>
            )}

            {/* 文件列表/网格 */}
            {!loading && !error && filteredFiles.length > 0 && (
              <>
                {viewMode === "list" ? (
                  <FileList
                    files={filteredFiles}
                    selected={selected}
                    onToggleSelect={toggleSelect}
                    onNavigate={navigateTo}
                    onDownload={handleFileAction}
                    onContextMenu={handleContextMenu}
                  />
                ) : (
                  <FileGrid
                    files={filteredFiles}
                    selected={selected}
                    onToggleSelect={toggleSelect}
                    onNavigate={navigateTo}
                    onDownload={handleFileAction}
                    onContextMenu={handleContextMenu}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- 右键菜单（全局唯一实例） ---- */}
      <FileContextMenu
        handlers={contextMenuHandlers}
        fileName={contextTarget.fileName}
        isDirectory={contextTarget.isDirectory}
      />

      {/* ---- 文件预览面板 ---- */}
      <FilePreview
        open={previewState.open}
        onClose={closePreview}
        filePath={previewState.filePath}
        fileName={previewState.fileName}
        fileSize={previewState.fileSize}
        modified={previewState.modified}
      />

      {/* ---- 操作对话框 ---- */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        targetPath={path}
        onSuccess={refresh}
      />
      <MkdirDialog
        open={mkdirOpen}
        onClose={() => setMkdirOpen(false)}
        parentPath={path}
        onSuccess={refresh}
      />
      <RenameDialog
        open={renameState.open}
        onClose={() => setRenameState((s) => ({ ...s, open: false }))}
        currentName={renameState.name}
        parentPath={path}
        isDirectory={renameState.isDirectory}
        onSuccess={refresh}
      />
      <DeleteConfirm
        open={deleteState.open}
        onClose={() => setDeleteState((s) => ({ ...s, open: false }))}
        items={deleteState.items}
        parentPath={path}
        onSuccess={() => {
          setSelected(new Set());
          refresh();
        }}
      />
      <ShareDialog
        path={sharePath ?? ""}
        open={!!sharePath}
        onClose={() => setSharePath(null)}
      />
    </div>
  );
}
