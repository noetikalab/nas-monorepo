"use client";

/**
 * RenameDialog — 重命名文件/目录对话框
 *
 * 调用 POST /files/move，请求体 { from: oldPath, to: newPath }。
 * 通过修改路径最后一段来实现重命名（move 操作的特殊情况）。
 *
 * Props：
 *   - open: 对话框是否打开
 *   - onClose: 关闭对话框回调
 *   - currentName: 当前文件/目录名（默认填入输入框）
 *   - parentPath: 文件/目录所在的父路径
 *   - isDirectory: 是否是目录（用于提示文案）
 *   - onSuccess: 重命名成功后回调
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { filesApi } from "@/services";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  /** 当前名称（默认填入） */
  currentName: string;
  /** 所在的父目录路径 */
  parentPath: string;
  /** 是否是目录 */
  isDirectory: boolean;
  /** 重命名成功后回调 */
  onSuccess: () => void;
}

export function RenameDialog({
  open,
  onClose,
  currentName,
  parentPath,
  isDirectory,
  onSuccess,
}: RenameDialogProps) {
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开对话框时自动填入当前名称并聚焦
  useEffect(() => {
    if (open) {
      setNewName(currentName);
      setError(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        // 选中文件名部分（不含扩展名）
        const dot = currentName.lastIndexOf(".");
        if (!isDirectory && dot > 0) {
          inputRef.current?.setSelectionRange(0, dot);
        } else {
          inputRef.current?.select();
        }
      });
    }
  }, [open, currentName, isDirectory]);

  /** 提交重命名 */
  const handleSubmit = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setError("请输入新名称");
      return;
    }
    if (name === currentName) {
      onClose();
      return;
    }
    // 防止路径穿越
    if (name.includes("/") || name.includes("\\")) {
      setError("名称不能包含路径分隔符");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const from = `${parentPath.replace(/\/$/, "")}/${currentName}`;
      const to = `${parentPath.replace(/\/$/, "")}/${name}`;
      await filesApi.move({ from, to });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重命名失败");
    } finally {
      setSubmitting(false);
    }
  }, [newName, currentName, parentPath, onSuccess, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>重命名{isDirectory ? "目录" : "文件"}</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">
            当前位置：{parentPath}
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="新名称"
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
            disabled={submitting || !newName.trim() || newName.trim() === currentName}
            onClick={handleSubmit}
          >
            <Pencil className="size-3.5" />
            {submitting ? "重命名中..." : "确认"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
