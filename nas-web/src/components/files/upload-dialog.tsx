"use client";

/**
 * UploadDialog — 文件上传对话框
 *
 * 使用 react-dropzone 提供拖拽上传区域。
 * 上传通过 FormData 调用 POST /files/upload，字段：
 *   - path：目标目录路径
 *   - file：上传的文件
 *
 * Props：
 *   - open: 对话框是否打开
 *   - onClose: 关闭对话框回调
 *   - targetPath: 上传目标目录路径
 *   - onSuccess: 上传成功后的回调（父组件刷新文件列表）
 */

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, File } from "lucide-react";
import { filesApi } from "@/services";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** 上传目标目录路径，如 /data/alice/photos */
  targetPath: string;
  /** 上传完成后回调 */
  onSuccess: () => void;
}

interface PendingFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function UploadDialog({ open, onClose, targetPath, onSuccess }: UploadDialogProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  /** react-dropzone 配置：接受所有文件类型，限制单个文件 500MB */
  const onDrop = useCallback((accepted: File[]) => {
    setPendingFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, status: "pending" as const })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  /** 移除待上传文件 */
  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** 执行上传 */
  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);

    // 逐个上传（可改为并发，但串行更可靠）
    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i];
      if (pf.status === "done") continue;

      setPendingFiles((prev) =>
        prev.map((f, j) => (j === i ? { ...f, status: "uploading" as const } : f)),
      );

      try {
        const formData = new FormData();
        formData.append("path", targetPath);
        formData.append("file", pf.file, pf.file.name);
        await filesApi.upload(formData);
        setPendingFiles((prev) =>
          prev.map((f, j) => (j === i ? { ...f, status: "done" as const } : f)),
        );
      } catch (e) {
        setPendingFiles((prev) =>
          prev.map((f, j) =>
            j === i
              ? { ...f, status: "error" as const, error: e instanceof Error ? e.message : "上传失败" }
              : f,
          ),
        );
      }
    }

    setUploading(false);
    onSuccess();
  }, [pendingFiles, targetPath, onSuccess]);

  /** 关闭时清理状态 */
  const handleClose = useCallback(() => {
    if (!uploading) {
      setPendingFiles([]);
      onClose();
    }
  }, [uploading, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <p className="text-xs text-muted-foreground">
            目标：{targetPath}
          </p>
        </DialogHeader>

        {/* 拖拽上传区域 */}
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer
            ${isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
        >
          <input {...getInputProps()} />
          <Upload className="size-8 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm text-primary font-medium">释放以上传文件</p>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">拖拽文件到此处</p>
              <p>或点击选择文件（最大 500MB）</p>
            </div>
          )}
        </div>

        {/* 待上传文件列表 */}
        {pendingFiles.length > 0 && (
          <div className="max-h-48 overflow-auto space-y-1">
            {pendingFiles.map((pf, i) => (
              <div
                key={`${pf.file.name}-${i}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs bg-muted/50"
              >
                <File className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{pf.file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {pf.status === "pending" && "等待"}
                  {pf.status === "uploading" && "上传中..."}
                  {pf.status === "done" && "✓"}
                  {pf.status === "error" && (
                    <span className="text-destructive" title={pf.error}>失败</span>
                  )}
                </span>
                {pf.status === "pending" && !uploading && (
                  <button
                    type="button"
                    className="cursor-pointer shrink-0 rounded p-0.5 hover:bg-accent"
                    onClick={() => removeFile(i)}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs border border-border hover:bg-accent cursor-pointer"
              disabled={uploading}
              onClick={handleClose}
            >
              取消
            </button>
          </DialogClose>
          <button
            type="button"
            className="rounded-md px-4 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            disabled={pendingFiles.length === 0 || uploading}
            onClick={handleUpload}
          >
            {uploading ? "上传中..." : `上传 (${pendingFiles.length})`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
