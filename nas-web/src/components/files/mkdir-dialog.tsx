"use client";

/**
 * MkdirDialog — 新建文件夹对话框
 *
 * 调用 POST /files/mkdir，请求体 { path: targetPath/folderName }。
 *
 * Props：
 *   - open: 对话框是否打开
 *   - onClose: 关闭对话框回调
 *   - parentPath: 父目录路径（新建文件夹将位于此路径下）
 *   - onSuccess: 创建成功后回调（父组件刷新文件列表）
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { FolderPlus } from "lucide-react";
import { filesApi } from "@/services";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MkdirDialogProps {
  open: boolean;
  onClose: () => void;
  /** 父目录路径 */
  parentPath: string;
  /** 创建成功后回调 */
  onSuccess: () => void;
}

export function MkdirDialog({ open, onClose, parentPath, onSuccess }: MkdirDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开对话框时自动聚焦输入框
  useEffect(() => {
    if (open) {
      setFolderName("");
      setError(null);
      // 下一帧聚焦，等待 Dialog 动画完成
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /** 提交创建 */
  const handleSubmit = useCallback(async () => {
    const name = folderName.trim();
    if (!name) {
      setError("请输入文件夹名称");
      return;
    }
    // 不允许包含路径分隔符，防止路径穿越
    if (name.includes("/") || name.includes("\\")) {
      setError("文件夹名称不能包含路径分隔符");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 拼接完整路径
      const fullPath = `${parentPath.replace(/\/$/, "")}/${name}`;
      await filesApi.mkdir({ path: fullPath });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [folderName, parentPath, onSuccess, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>新建文件夹</DialogTitle>
          <p className="text-xs text-muted-foreground">
            路径：{parentPath}/
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="文件夹名称"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs border border-border hover:bg-accent cursor-pointer"
              disabled={submitting}
              onClick={onClose}
            >
              取消
            </button>
          </DialogClose>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            disabled={submitting || !folderName.trim()}
            onClick={handleSubmit}
          >
            <FolderPlus className="size-3.5" />
            {submitting ? "创建中..." : "创建"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
