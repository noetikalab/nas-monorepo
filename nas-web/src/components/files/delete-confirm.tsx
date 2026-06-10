"use client";

/**
 * DeleteConfirm — 删除确认对话框
 *
 * 调用 DELETE /files?path=... 删除文件或目录。
 * 目录删除是递归的（rm -rf），不可恢复，因此提供确认提示。
 *
 * Props：
 *   - open: 对话框是否打开
 *   - onClose: 关闭对话框回调
 *   - items: 待删除的文件/目录名数组
 *   - parentPath: 这些文件/目录所在的父路径
 *   - onSuccess: 删除成功后回调
 */

import { useCallback, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { filesApi } from "@/services";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DeleteConfirmProps {
  open: boolean;
  onClose: () => void;
  /** 待删除的文件/目录名数组 */
  items: string[];
  /** 所在父路径 */
  parentPath: string;
  /** 删除成功后回调 */
  onSuccess: () => void;
}

export function DeleteConfirm({ open, onClose, items, parentPath, onSuccess }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 逐个删除 */
  const handleDelete = useCallback(async () => {
    if (items.length === 0) return;
    setDeleting(true);
    setError(null);

    for (const name of items) {
      try {
        const filePath = `${parentPath.replace(/\/$/, "")}/${name}`;
        await filesApi.delete(filePath);
      } catch (e) {
        setError(`删除 "${name}" 失败: ${e instanceof Error ? e.message : "未知错误"}`);
        setDeleting(false);
        return;
      }
    }

    setDeleting(false);
    onSuccess();
    onClose();
  }, [items, parentPath, onSuccess, onClose]);

  const isMany = items.length > 1;
  const isSingle = items.length === 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !deleting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <DialogTitle>确认删除</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {isSingle
              ? `确定要删除 "${items[0]}" 吗？`
              : `确定要删除以下 ${items.length} 个项目吗？`}
          </p>

          {/* 显示前 5 个待删除项名称 */}
          {isMany && (
            <ul className="max-h-24 overflow-auto rounded-md bg-muted/50 px-3 py-1.5 text-xs space-y-0.5">
              {items.slice(0, 5).map((name) => (
                <li key={name} className="truncate text-muted-foreground">
                  {name}
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-muted-foreground">
                  ...还有 {items.length - 5} 个项目
                </li>
              )}
            </ul>
          )}

          <p className="text-xs text-destructive/80">
            此操作不可恢复。目录内的所有内容将被递归删除。
          </p>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs border border-border hover:bg-accent cursor-pointer"
              disabled={deleting}
              onClick={onClose}
            >
              取消
            </button>
          </DialogClose>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer disabled:opacity-50"
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />
            {deleting ? "删除中..." : `删除${isMany ? ` (${items.length})` : ""}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
